
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  ADMIN_COOKIE_NAME,
  verifyAdminSession,
} from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/auth/supabase-admin";

export const runtime = "nodejs";

type RemovalRecord = {
  id: number;
  vin: string;
  payment_provider: string | null;
  payment_status: string;
  removal_status: string;
  affected_lot_paths: unknown;
};

function paymentConfirmed(record: RemovalRecord): boolean {
  return record.payment_provider === "nowpayments"
    ? record.payment_status === "finished"
    : (record.payment_provider === null ||
        record.payment_provider === "stripe") &&
        record.payment_status === "paid";
}

function savedPaths(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value.filter(
    (path): path is string =>
      typeof path === "string" &&
      /^\/lot\/(copart|iaai)\/[A-Za-z0-9_-]+$/i.test(path)
  );
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = (await cookies()).get(ADMIN_COOKIE_NAME)?.value;

  if (!verifyAdminSession(session)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const origin = request.headers.get("origin");

  if (!origin || origin !== new URL(request.url).origin) {
    return NextResponse.json(
      { error: "Invalid origin" },
      { status: 403 }
    );
  }

  const { id } = await context.params;

  if (!/^[1-9]\d*$/.test(id)) {
    return NextResponse.json(
      { error: "Invalid request ID" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();

  try {
    const { data: removal, error: lookupError } = await supabase
      .from("removal_requests")
      .select(
        "id, vin, payment_provider, payment_status, removal_status, affected_lot_paths"
      )
      .eq("id", id)
      .single();

    if (lookupError || !removal) {
      return NextResponse.json(
        { error: "Removal request not found" },
        { status: 404 }
      );
    }

    if (!paymentConfirmed(removal)) {
      return NextResponse.json(
        { error: "Payment is not confirmed" },
        { status: 400 }
      );
    }

    if (removal.removal_status === "completed") {
      return NextResponse.json({
        success: true,
        alreadyCompleted: true,
      });
    }

    const vin = String(removal.vin).trim().toUpperCase();

    if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) {
      return NextResponse.json(
        { error: "Invalid VIN" },
        { status: 400 }
      );
    }

    let lotPaths: string[] = [];
    let recovery = false;

    if (removal.removal_status === "pending_review") {
      const { data: lots, error: lotsError } = await supabase
        .from("auction_lots")
        .select("auction_source, lot_number")
        .eq("vin", vin);

      if (lotsError) throw lotsError;

      lotPaths = Array.from(
        new Set([
          ...savedPaths(removal.affected_lot_paths),
          ...(lots ?? []).map(
            (lot) =>
              `/lot/${String(lot.auction_source).toLowerCase()}/${lot.lot_number}`
          ),
        ])
      );

      const { data: claimed, error: claimError } = await supabase.rpc(
        "claim_removal_request",
        { p_request_id: Number(id) }
      );

      if (claimError) throw claimError;

      if (claimed !== true) {
        return NextResponse.json(
          { error: "Request was already claimed" },
          { status: 409 }
        );
      }

      const { error: pathsError } = await supabase
        .from("removal_requests")
        .update({ affected_lot_paths: lotPaths })
        .eq("id", id)
        .eq("removal_status", "processing");

      if (pathsError) throw pathsError;
    } else if (removal.removal_status === "processing") {
      const { data: claimed, error: claimError } = await supabase.rpc(
        "claim_removal_recovery",
        { p_request_id: Number(id) }
      );

      if (claimError) throw claimError;

      if (claimed !== true) {
        return NextResponse.json(
          {
            error:
              "Removal is still processing or requires manual recovery.",
          },
          { status: 409 }
        );
      }

      recovery = true;
      lotPaths = savedPaths(removal.affected_lot_paths);
    } else {
      return NextResponse.json(
        { error: "Request is not eligible for approval" },
        { status: 409 }
      );
    }

    const { error: deleteError } = await supabase.rpc(
      "remove_vehicle_history",
      {
        p_vin: vin,
        p_reason: `Approved paid removal request ${id}`,
      }
    );

    if (deleteError) throw deleteError;

    const [vehicleResult, lotsResult, suppressionResult] =
      await Promise.all([
        supabase
          .from("vehicles")
          .select("vin", { count: "exact", head: true })
          .eq("vin", vin),
        supabase
          .from("auction_lots")
          .select("id", { count: "exact", head: true })
          .eq("vin", vin),
        supabase
          .from("suppressed_vins")
          .select("vin", { count: "exact", head: true })
          .eq("vin", vin),
      ]);

    if (
      vehicleResult.error ||
      lotsResult.error ||
      suppressionResult.error ||
      vehicleResult.count !== 0 ||
      lotsResult.count !== 0 ||
      suppressionResult.count !== 1
    ) {
      throw new Error("VIN removal verification failed");
    }

    revalidatePath(`/vin/${vin}`);

    for (const path of lotPaths) {
      revalidatePath(path);
    }

    revalidatePath("/");
    revalidatePath("/recent-auctions");
    revalidatePath("/sitemap.xml");

    const { data: completed, error: completeError } = await supabase
      .from("removal_requests")
      .update({
        removal_status: "completed",
        completed_at: new Date().toISOString(),
        removal_error: null,
      })
      .eq("id", id)
      .eq("removal_status", "processing")
      .select("id")
      .single();

    if (completeError || !completed) {
      throw new Error("Failed to record removal completion");
    }

    return NextResponse.json({
      success: true,
      vin,
      recovered: recovery,
      invalidatedLots: lotPaths.length,
    });
  } catch (error) {
    console.error("Removal approval failed:", error);

    await supabase
      .from("removal_requests")
      .update({
        removal_error:
          error instanceof Error ? error.message : "Unknown error",
      })
      .eq("id", id)
      .eq("removal_status", "processing");

    return NextResponse.json(
      {
        error:
          "Removal could not be completed. Review the request before retrying.",
      },
      { status: 500 }
    );
  }
}

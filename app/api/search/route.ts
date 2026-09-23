import { NextResponse } from "next/server";
import { supabase } from "../../../utils/supabase/client";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const query = searchParams
    .get("q")
    ?.trim()
    .toUpperCase();

  if (!query) {
    return NextResponse.json(
      { error: "Enter a VIN or lot number." },
      { status: 400 }
    );
  }

  // ========================================
  // VIN SEARCH
  // ========================================

  if (/^[A-HJ-NPR-Z0-9]{17}$/.test(query)) {
    const { data, error } = await supabase
      .from("vehicles")
      .select("vin")
      .eq("vin", query)
      .maybeSingle();

    if (error) {
      console.error("VIN search error:", error);

      return NextResponse.json(
        { error: "Search failed." },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        {
          found: false,
          type: "vin",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      found: true,
      type: "vin",
      url: `/vin/${data.vin}`,
    });
  }

  // ========================================
  // LOT SEARCH
  // ========================================

  if (/^\d+$/.test(query)) {
    const { data, error } = await supabase
      .from("auction_lots")
      .select("auction_source, lot_number")
      .eq("lot_number", query);

    if (error) {
      console.error("Lot search error:", error);

      return NextResponse.json(
        { error: "Search failed." },
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        {
          found: false,
          type: "lot",
        },
        { status: 404 }
      );
    }

    // Normally a lot number will have one result.
    if (data.length === 1) {
      const lot = data[0];

      return NextResponse.json({
        found: true,
        type: "lot",
        url: `/lot/${lot.auction_source.toLowerCase()}/${lot.lot_number}`,
      });
    }

    // Protects us if Copart and IAAI ever use
    // the same numeric lot number.
    return NextResponse.json({
      found: true,
      type: "multiple_lots",
      results: data.map((lot) => ({
        auction_source: lot.auction_source,
        lot_number: lot.lot_number,
        url: `/lot/${lot.auction_source.toLowerCase()}/${lot.lot_number}`,
      })),
    });
  }

  return NextResponse.json(
    {
      error: "Enter a valid 17-character VIN or auction lot number.",
    },
    { status: 400 }
  );
}
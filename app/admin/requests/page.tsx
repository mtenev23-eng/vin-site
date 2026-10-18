import fs from "fs/promises";
import { getSupabaseAdmin } from "../../../lib/auth/supabase-admin";
import ApproveRemovalButton from "./ApproveRemovalButton";
import path from "path";
import AdminLogoutButton from "./AdminLogoutButton";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ADMIN_COOKIE_NAME,
  verifyAdminSession,
} from "../../../lib/auth/session";

const filePath = path.join(process.cwd(), "data", "requests.json");

type RequestItem = {
  id: number;
  vin: string;
  name: string;
  contact: string;
  requestType: string;
  message: string;
  status?: string;
  submittedAt: string;
};

async function getRequests(): Promise<RequestItem[]> {
  try {
    const fileContents = await fs.readFile(filePath, "utf-8");
    return JSON.parse(fileContents);
  } catch (error) {
    return [];
  }
}

export default async function AdminRequestsPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get(ADMIN_COOKIE_NAME)?.value;

  if (!verifyAdminSession(session)) {
    redirect("/admin/login");
  }
  const requests = await getRequests();
const { data: paidRemovals, error: paidRemovalsError } =
  await getSupabaseAdmin()
    .from("removal_requests")
    .select(
      "id, vin, auction_source, lot_number, payment_provider, amount_paid, currency, payment_status, removal_status, created_at"
    )
    .order("created_at", { ascending: false });

if (paidRemovalsError) {
  throw new Error(
    `Failed to load paid removals: ${paidRemovalsError.message}`
  );
}
  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "#f8f9fb",
        padding: "40px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
<section style={{ marginBottom: "32px" }}>
  <h2>Paid VIN Removal Requests</h2>

  {!paidRemovals?.length ? (
    <p>No paid removal requests found.</p>
  ) : (
    <div style={{ display: "grid", gap: "12px" }}>
      {paidRemovals.map((request) => (
        <div
          key={request.id}
          style={{
            padding: "20px",
            background: "white",
            borderRadius: "12px",
          }}
        >
          <strong>VIN: {request.vin}</strong>
          <p>
            {request.auction_source} — Lot {request.lot_number}
          </p>
          <p>
            Payment: {request.payment_provider || "stripe"} —{" "}
            {request.amount_paid != null
              ? (request.amount_paid / 100).toFixed(2)
              : "Unknown"}{" "}
            {request.currency?.toUpperCase()}
          </p>
          <p>Payment status: {request.payment_status}</p>
          <p>Removal status: {request.removal_status}</p>
{request.removal_status === "pending_review" &&
  (request.payment_status === "paid" ||
    request.payment_status === "finished") && (
    <ApproveRemovalButton
      id={request.id}
      vin={request.vin}
    />
  )}
        </div>
      ))}
    </div>
  )}
</section>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px" }}>
          <h1 style={{ fontSize: "36px", marginBottom: "12px" }}>
          Admin Requests Dashboard
        </h1>
          <AdminLogoutButton />
        </div>

        <p style={{ color: "#555", marginBottom: "28px" }}>
          View submitted correction, update, and removal requests.
        </p>

        {requests.length === 0 ? (
          <div
            style={{
              backgroundColor: "white",
              padding: "24px",
              borderRadius: "16px",
              boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
            }}
          >
            <p style={{ margin: 0 }}>No requests have been submitted yet.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: "18px" }}>
            {requests
              .slice()
              .reverse()
              .map((request) => (
                <div
                  key={request.id}
                  style={{
                    backgroundColor: "white",
                    padding: "24px",
                    borderRadius: "16px",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: "20px",
                      marginBottom: "16px",
                    }}
                  >
                    <div>
                      <h2 style={{ margin: 0, marginBottom: "8px", fontSize: "24px" }}>
                        VIN: {request.vin}
                      </h2>
                      <p style={{ margin: 0, color: "#666" }}>
                        Submitted: {new Date(request.submittedAt).toLocaleString()}
                      </p>
                    </div>

                    <span
                      style={{
                        padding: "8px 12px",
                        borderRadius: "999px",
                        backgroundColor: "#111",
                        color: "white",
                        fontSize: "14px",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {request.status || "new"} / {request.requestType}
                    </span>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                      gap: "14px 24px",
                      marginBottom: "16px",
                    }}
                  >
                    <div>
                      <strong>Name:</strong> {request.name}
                    </div>
                    <div>
                      <strong>Contact:</strong> {request.contact}
                    </div>
                  </div>

                  <div>
                    <strong>Message:</strong>
                    <p
                      style={{
                        marginTop: "8px",
                        marginBottom: 0,
                        color: "#333",
                        lineHeight: 1.6,
                      }}
                    >
                      {request.message}
                    </p>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </main>
  );
}


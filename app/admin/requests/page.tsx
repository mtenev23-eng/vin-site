import fs from "fs/promises";
import path from "path";

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

export default async function AdminRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ password?: string }>;
}) {
  const { password } = await searchParams;

  const ADMIN_PASSWORD = "martin123";

  if (password !== ADMIN_PASSWORD) {
    return (
      <main
        style={{
          minHeight: "100vh",
          backgroundColor: "#f8f9fb",
          padding: "40px",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            maxWidth: "600px",
            margin: "0 auto",
            backgroundColor: "white",
            padding: "32px",
            borderRadius: "18px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
          }}
        >
          <h1>Admin Access Required</h1>
          <p>This page is protected. Please provide the correct password.</p>
        </div>
      </main>
    );
  }
  const requests = await getRequests();

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
        <h1 style={{ fontSize: "36px", marginBottom: "12px" }}>
          Admin Requests Dashboard
        </h1>

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
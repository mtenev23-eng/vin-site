"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ApproveRemovalButton({
  id,
  vin,
}: {
  id: number;
  vin: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function approve() {
    if (
      !window.confirm(
        `Permanently remove ALL auction history for VIN ${vin}? This cannot be undone.`
      )
    ) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/admin/removals/${id}/approve`,
        { method: "POST" }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Approval failed");
      }

      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unexpected error"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={approve}
        disabled={loading}
        style={{
          background: "#111827",
          color: "white",
          padding: "10px 16px",
          border: "none",
          borderRadius: "8px",
          cursor: loading ? "wait" : "pointer",
        }}
      >
        {loading ? "Processing..." : "Approve Removal"}
      </button>

      {error && (
        <p style={{ color: "#b91c1c" }}>{error}</p>
      )}
    </div>
  );
}

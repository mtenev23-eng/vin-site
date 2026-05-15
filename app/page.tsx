"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const [vin, setVin] = useState("");
  const router = useRouter();

  function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const cleanedVin = vin.trim().toUpperCase();

    if (!cleanedVin) return;

    router.push(`/vin/${cleanedVin}`);
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px",
        fontFamily: "Arial",
        backgroundColor: "#f7f7f7",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "700px",
          backgroundColor: "white",
          padding: "40px",
          borderRadius: "16px",
          boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
        }}
      >
        <h1 style={{ fontSize: "42px", marginBottom: "12px" }}>
          VIN Archive Search
        </h1>

        <p style={{ fontSize: "18px", color: "#555", marginBottom: "30px" }}>
          Search archived vehicle auction records by VIN.
        </p>

        <form onSubmit={handleSearch} style={{ display: "flex", gap: "12px" }}>
          <input
            type="text"
            placeholder="Enter VIN number"
            value={vin}
            onChange={(e) => setVin(e.target.value)}
            style={{
              flex: 1,
              padding: "16px",
              fontSize: "18px",
              borderRadius: "10px",
              border: "1px solid #ccc",
            }}
          />

          <button
            type="submit"
            style={{
              padding: "16px 22px",
              fontSize: "18px",
              borderRadius: "10px",
              border: "none",
              backgroundColor: "black",
              color: "white",
              cursor: "pointer",
            }}
          >
            Search
          </button>
        </form>
      </div>
    </main>
  );
}
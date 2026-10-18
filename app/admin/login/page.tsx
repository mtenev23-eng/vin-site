"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
        cache: "no-store",
      });

      if (!response.ok) {
        setError(
          response.status === 401
            ? "Incorrect password."
            : "Login unavailable. Please try again."
        );
        return;
      }

      setPassword("");
      router.replace("/admin/requests");
      router.refresh();
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#f8f9fb",
      padding: "24px",
      fontFamily: "Arial, sans-serif",
    }}>
      <form onSubmit={handleSubmit} style={{
        width: "100%",
        maxWidth: "400px",
        padding: "36px",
        background: "#fff",
        borderRadius: "16px",
        boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
      }}>
        <h1>Admin Login</h1>
        <p>Salvage VIN History</p>

        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          style={{
            display: "block",
            width: "100%",
            boxSizing: "border-box",
            padding: "12px",
            marginTop: "8px",
            marginBottom: "20px",
          }}
        />

        {error && (
          <p role="alert" style={{ color: "#c62828" }}>
            {error}
          </p>
        )}

        <button type="submit" disabled={loading} style={{
          width: "100%",
          padding: "12px",
          background: "#111827",
          color: "white",
          border: "none",
          borderRadius: "8px",
          cursor: loading ? "wait" : "pointer",
        }}>
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </main>
  );
}

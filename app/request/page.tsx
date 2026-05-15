"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

export default function RequestPage() {
  const searchParams = useSearchParams();
  const vinFromUrl = searchParams.get("vin") || "";

  const [vin, setVin] = useState(vinFromUrl.toUpperCase());
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [requestType, setRequestType] = useState("correction");
  const [message, setMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setIsSubmitting(true);
    setStatusMessage("");

    try {
      const response = await fetch("/api/requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          vin,
          name,
          contact,
          requestType,
          message,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setStatusMessage(data.error || "Something went wrong.");
        setIsSubmitting(false);
        return;
      }

      setStatusMessage("Your request was submitted successfully.");

      setName("");
      setContact("");
      setRequestType("correction");
      setMessage("");
    } catch (error) {
      setStatusMessage("Something went wrong while submitting the form.");
    }

    setIsSubmitting(false);
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
      <div
        style={{
          maxWidth: "800px",
          margin: "0 auto",
          backgroundColor: "white",
          padding: "32px",
          borderRadius: "18px",
          boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
        }}
      >
        <h1 style={{ fontSize: "36px", marginTop: 0, marginBottom: "12px" }}>
          Request Correction or Removal
        </h1>

        <p style={{ color: "#555", lineHeight: 1.6, marginBottom: "28px" }}>
          Use this form to request a correction, update, or removal review for a
          vehicle record.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "18px" }}>
          <div>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>
              VIN Number
            </label>
            <input
              type="text"
              value={vin}
              onChange={(e) => setVin(e.target.value.toUpperCase())}
              placeholder="Enter VIN"
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: "10px",
                border: "1px solid #ccc",
                fontSize: "16px",
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>
              Your Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: "10px",
                border: "1px solid #ccc",
                fontSize: "16px",
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>
              Contact Info
            </label>
            <input
              type="text"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="Email, phone, or Viber"
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: "10px",
                border: "1px solid #ccc",
                fontSize: "16px",
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>
              Request Type
            </label>
            <select
              value={requestType}
              onChange={(e) => setRequestType(e.target.value)}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: "10px",
                border: "1px solid #ccc",
                fontSize: "16px",
              }}
            >
              <option value="correction">Correction</option>
              <option value="update">Update</option>
              <option value="removal">Removal Review</option>
            </select>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>
              Message
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe your request"
              rows={6}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: "10px",
                border: "1px solid #ccc",
                fontSize: "16px",
                resize: "vertical",
              }}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              padding: "15px",
              borderRadius: "12px",
              border: "none",
              backgroundColor: isSubmitting ? "#555" : "black",
              color: "white",
              fontSize: "16px",
              cursor: isSubmitting ? "not-allowed" : "pointer",
            }}
          >
            {isSubmitting ? "Submitting..." : "Submit Request"}
          </button>

          {statusMessage && (
            <p
              style={{
                marginTop: "8px",
                color: statusMessage.toLowerCase().includes("successfully")
                  ? "green"
                  : "red",
              }}
            >
              {statusMessage}
            </p>
          )}
        </form>
      </div>
    </main>
  );
}
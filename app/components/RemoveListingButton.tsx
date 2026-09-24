"use client";

import { useState } from "react";

type RemoveListingButtonProps = {
  vin: string;
  auctionSource: string;
  lotNumber: string;
};

export default function RemoveListingButton({
  vin,
  auctionSource,
  lotNumber,
}: RemoveListingButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyListingDetails = async () => {
    const removalDetails = `Removal Request

VIN: ${vin}
Auction: ${auctionSource}
Lot: ${lotNumber}`;

    await navigator.clipboard.writeText(removalDetails);

    setCopied(true);

    setTimeout(() => {
      setCopied(false);
    }, 2000);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        style={{
          background: "#c81e1e",
          color: "#ffffff",
          border: "none",
          borderRadius: "8px",
          padding: "14px 22px",
          fontSize: "14px",
          fontWeight: "800",
          letterSpacing: "0.4px",
          cursor: "pointer",
          boxShadow: "0 4px 14px rgba(0,0,0,0.12)",
        }}
      >
        REMOVE THIS LISTING
      </button>

      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.62)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: "520px",
              background: "#ffffff",
              borderRadius: "14px",
              padding: "30px",
              boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
              position: "relative",
            }}
          >
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close removal request"
              style={{
                position: "absolute",
                top: "16px",
                right: "18px",
                border: "none",
                background: "transparent",
                fontSize: "24px",
                color: "#666",
                cursor: "pointer",
              }}
            >
              ×
            </button>

            <div
              style={{
                fontSize: "12px",
                fontWeight: "800",
                letterSpacing: "0.8px",
                color: "#777",
                marginBottom: "8px",
              }}
            >
              LISTING REMOVAL
            </div>

            <h2
              style={{
                margin: "0 35px 10px 0",
                fontSize: "27px",
                lineHeight: 1.2,
                color: "#171717",
              }}
            >
              Request removal of this listing
            </h2>

            <p
              style={{
                margin: "0 0 22px",
                color: "#666",
                fontSize: "14px",
                lineHeight: 1.6,
              }}
            >
              Request removal of this vehicle&apos;s auction record
              and archived photos from Salvage VIN History. Please
              submit a request only if you are the vehicle owner or
              are authorized to act on the owner&apos;s behalf.
            </p>

            <div
              style={{
                background: "#f6f7f8",
                borderRadius: "9px",
                padding: "16px",
                marginBottom: "12px",
              }}
            >
              <div
                style={{
                  fontSize: "12px",
                  color: "#777",
                  marginBottom: "5px",
                }}
              >
                VIN
              </div>

              <strong
                style={{
                  display: "block",
                  fontSize: "15px",
                  wordBreak: "break-all",
                  marginBottom: "12px",
                }}
              >
                {vin}
              </strong>

              <div
                style={{
                  display: "flex",
                  gap: "24px",
                  flexWrap: "wrap",
                  fontSize: "13px",
                }}
              >
                <span>
                  Source: <strong>{auctionSource}</strong>
                </span>

                <span>
                  Lot: <strong>#{lotNumber}</strong>
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={copyListingDetails}
              style={{
                width: "100%",
                padding: "11px 16px",
                marginBottom: "18px",
                background: "#ffffff",
                color: "#171717",
                border: "1px solid #d8d8d8",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: "700",
                cursor: "pointer",
              }}
            >
              {copied ? "✓ DETAILS COPIED" : "COPY LISTING DETAILS"}
            </button>

            <div
              style={{
                display: "grid",
                gap: "12px",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  window.open(
                    "https://t.me/salvagevinhistory",
                    "_blank",
                    "noopener,noreferrer"
                  );
                }}
                style={{
                  width: "100%",
                  padding: "15px 18px",
                  background: "#ffffff",
                  color: "#171717",
                  border: "1px solid #d8d8d8",
                  borderRadius: "8px",
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                <strong
                  style={{
                    display: "block",
                    fontSize: "15px",
                    marginBottom: "4px",
                  }}
                >
                  Contact via Telegram
                </strong>

                <span
                  style={{
                    color: "#666",
                    fontSize: "13px",
                  }}
                >
                  Contact @salvagevinhistory about this removal request.
                </span>
              </button>

              <button
                type="button"
                onClick={async () => {
  try {
    const response = await fetch(
      "/api/stripe/checkout",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          vin,
          auctionSource,
          lotNumber,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok || !data.url) {
      throw new Error(
        data.error || "Could not start checkout."
      );
    }

    window.location.href = data.url;
  } catch (error) {
    console.error(
      "Stripe checkout error:",
      error
    );

    alert(
      "Could not start payment. Please try again."
    );
  }
}}
                style={{
                  width: "100%",
                  padding: "15px 18px",
                  background: "#171717",
                  color: "#ffffff",
                  border: "1px solid #171717",
                  borderRadius: "8px",
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                <strong
                  style={{
                    display: "block",
                    fontSize: "15px",
                    marginBottom: "4px",
                  }}
                >
                  Pay by Card — $39
                </strong>

                <span
                  style={{
                    color: "#d6d6d6",
                    fontSize: "13px",
                  }}
                >
                  Pay securely by credit or debit card.
                </span>
              </button>
            </div>

            <p
              style={{
                margin: "18px 0 0",
                color: "#888",
                fontSize: "11px",
                lineHeight: 1.5,
              }}
            >
              By proceeding with payment, you acknowledge the removal request terms described in our{" "}
<a
  href="/removal-policy"
  target="_blank"
  rel="noopener noreferrer"
  style={{
    color: "#111",
    fontWeight: 700,
    textDecoration: "underline",
  }}
>
  Removal Policy
</a>
. Removal requests are reviewed before processing, and payment does not by itself guarantee removal.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
"use client";

import { useState } from "react";

export default function AuctionPhotoGallery({
  images,
  vehicleName,
  auctionSource,
  lotNumber,
}: {
  images: string[];
  vehicleName: string;
  auctionSource: string;
  lotNumber: string;
}) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  return (
    <>
      <div
        style={{
          background: "#f3f3f3",
          border: "1px solid #e2e2e2",
          borderRadius: "12px",
          overflow: "hidden",
        }}
      >
        <img
          src={images[0]}
          alt={`${vehicleName} ${auctionSource} lot ${lotNumber} auction photo`}
          onClick={() => setSelectedIndex(0)}
          style={{
            width: "100%",
            maxHeight: "700px",
            objectFit: "contain",
            display: "block",
            cursor: "pointer",
          }}
        />
      </div>

      {images.length > 1 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
            gap: "12px",
            marginTop: "12px",
          }}
        >
          {images.slice(1).map((image, index) => (
            <div
              key={image}
              style={{
                background: "#f3f3f3",
                border: "1px solid #e5e5e5",
                borderRadius: "9px",
                overflow: "hidden",
              }}
            >
              <img
                src={image}
                alt={`${vehicleName} ${auctionSource} lot ${lotNumber} auction photo ${
                  index + 2
                }`}
                loading="lazy"
                onClick={() => setSelectedIndex(index + 1)}
                style={{
                  width: "100%",
                  height: "190px",
                  objectFit: "cover",
                  display: "block",
                  cursor: "pointer",
                }}
              />
            </div>
          ))}
        </div>
      )}

      {selectedIndex !== null && (
  <div
    onClick={() => setSelectedIndex(null)}
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.9)",
      zIndex: 9999,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "30px",
    }}
  >
    <button
      onClick={() => setSelectedIndex(null)}
      style={{
        position: "absolute",
        top: "20px",
        right: "25px",
        border: "none",
        background: "transparent",
        color: "#ffffff",
        fontSize: "38px",
        cursor: "pointer",
        zIndex: 2,
      }}
    >
      ×
    </button>

    {images.length > 1 && (
      <button
        onClick={(e) => {
          e.stopPropagation();
          setSelectedIndex(
            selectedIndex === 0
              ? images.length - 1
              : selectedIndex - 1
          );
        }}
        style={{
          position: "absolute",
          left: "25px",
          top: "50%",
          transform: "translateY(-50%)",
          border: "none",
          background: "rgba(0,0,0,0.45)",
          color: "#ffffff",
          width: "52px",
          height: "52px",
          borderRadius: "50%",
          fontSize: "34px",
          cursor: "pointer",
          zIndex: 2,
        }}
      >
        ‹
      </button>
    )}

    <img
      src={images[selectedIndex]}
      alt={`Auction photo ${selectedIndex + 1}`}
      onClick={(e) => e.stopPropagation()}
      style={{
        maxWidth: "95vw",
        maxHeight: "90vh",
        objectFit: "contain",
      }}
    />

    {images.length > 1 && (
      <button
        onClick={(e) => {
          e.stopPropagation();
          setSelectedIndex(
            selectedIndex === images.length - 1
              ? 0
              : selectedIndex + 1
          );
        }}
        style={{
          position: "absolute",
          right: "25px",
          top: "50%",
          transform: "translateY(-50%)",
          border: "none",
          background: "rgba(0,0,0,0.45)",
          color: "#ffffff",
          width: "52px",
          height: "52px",
          borderRadius: "50%",
          fontSize: "34px",
          cursor: "pointer",
          zIndex: 2,
        }}
      >
        ›
      </button>
    )}

    <div
      style={{
        position: "absolute",
        bottom: "20px",
        color: "#ffffff",
        fontSize: "14px",
      }}
    >
      {selectedIndex + 1} / {images.length}
    </div>
  </div>
)}
   </>
  );
}
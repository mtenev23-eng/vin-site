"use client";

import { useEffect, useState } from "react";

type VinPhotoGalleryProps = {
  images: string[];
  vehicleName: string;
};

export default function VinPhotoGallery({
  images,
  vehicleName,
}: VinPhotoGalleryProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const isOpen = activeIndex !== null;

  function closeGallery() {
    setActiveIndex(null);
  }

  function showPrevious() {
    setActiveIndex((current) => {
      if (current === null) return null;

      return current === 0
        ? images.length - 1
        : current - 1;
    });
  }

  function showNext() {
    setActiveIndex((current) => {
      if (current === null) return null;

      return current === images.length - 1
        ? 0
        : current + 1;
    });
  }

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeGallery();
      }

      if (event.key === "ArrowLeft") {
        showPrevious();
      }

      if (event.key === "ArrowRight") {
        showNext();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, images.length]);

  if (images.length === 0) {
    return (
      <div
        style={{
          minHeight: "430px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#777",
          fontSize: "14px",
          background: "#f1f1f1",
        }}
      >
        No vehicle photo available
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setActiveIndex(0)}
        aria-label={`View ${vehicleName} auction photos`}
        style={{
          position: "relative",
          display: "block",
          width: "100%",
          height: "100%",
          minHeight: "430px",
          padding: 0,
          border: 0,
          background: "#f1f1f1",
          cursor: "zoom-in",
          overflow: "hidden",
        }}
      >
        <img
          src={images[0]}
          alt={`${vehicleName} auction vehicle`}
          style={{
            width: "100%",
            height: "100%",
            minHeight: "430px",
            objectFit: "cover",
            display: "block",
          }}
        />

        <div
          style={{
            position: "absolute",
            right: "16px",
            bottom: "16px",
            padding: "8px 11px",
            borderRadius: "7px",
            background: "rgba(0,0,0,0.78)",
            color: "#fff",
            fontSize: "13px",
            fontWeight: "700",
          }}
        >
          {images.length} photos
                </div>
      </button>

      {/* PHOTO THUMBNAILS */}
      {images.length > 1 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fill, minmax(110px, 1fr))",
            gap: "10px",
            padding: "14px",
            background: "#fff",
            borderTop: "1px solid #e5e5e5",
          }}
        >
          {images.map((image, index) => (
            <button
              key={`${image}-${index}`}
              type="button"
              onClick={() => setActiveIndex(index)}
              aria-label={`View auction photo ${index + 1}`}
              style={{
                padding: 0,
                border: "1px solid #e2e2e2",
                borderRadius: "7px",
                overflow: "hidden",
                background: "#f3f3f3",
                cursor: "zoom-in",
                aspectRatio: "4 / 3",
              }}
            >
              <img
                src={image}
                alt={`${vehicleName} auction photo ${index + 1}`}
                loading={index < 5 ? "eager" : "lazy"}
                style={{
                  display: "block",
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            </button>
          ))}
        </div>
      )}

      {isOpen && activeIndex !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${vehicleName} photo gallery`}
          onClick={closeGallery}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0,0,0,0.94)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "70px 80px",
          }}
        >
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              closeGallery();
            }}
            aria-label="Close photo gallery"
            style={{
              position: "absolute",
              top: "20px",
              right: "24px",
              width: "44px",
              height: "44px",
              border: 0,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.14)",
              color: "#fff",
              fontSize: "28px",
              lineHeight: 1,
              cursor: "pointer",
            }}
          >
            ×
          </button>

          <div
            style={{
              position: "absolute",
              top: "27px",
              left: "50%",
              transform: "translateX(-50%)",
              color: "#fff",
              fontSize: "14px",
              fontWeight: "700",
            }}
          >
            {activeIndex + 1} / {images.length}
          </div>

          {images.length > 1 && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                showPrevious();
              }}
              aria-label="Previous photo"
              style={{
                position: "absolute",
                left: "22px",
                top: "50%",
                transform: "translateY(-50%)",
                width: "50px",
                height: "50px",
                border: 0,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.14)",
                color: "#fff",
                fontSize: "32px",
                cursor: "pointer",
              }}
            >
              ‹
            </button>
          )}

          <img
            src={images[activeIndex]}
            alt={`${vehicleName} auction photo ${activeIndex + 1}`}
            onClick={(event) => event.stopPropagation()}
            style={{
              display: "block",
              maxWidth: "100%",
              maxHeight: "calc(100vh - 140px)",
              objectFit: "contain",
              userSelect: "none",
            }}
          />

          {images.length > 1 && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                showNext();
              }}
              aria-label="Next photo"
              style={{
                position: "absolute",
                right: "22px",
                top: "50%",
                transform: "translateY(-50%)",
                width: "50px",
                height: "50px",
                border: 0,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.14)",
                color: "#fff",
                fontSize: "32px",
                cursor: "pointer",
              }}
            >
              ›
            </button>
          )}
        </div>
      )}
    </>
  );
}
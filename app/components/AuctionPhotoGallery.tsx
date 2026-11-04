"use client";

import { useEffect, useState } from "react";

export default function AuctionPhotoGallery({
  images, vehicleName, auctionSource, lotNumber,
}: {
  images: string[];
  vehicleName: string;
  auctionSource: string;
  lotNumber: string;
}) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const previewCount = 6;
  const visibleImages = expanded ? images.slice(1) : images.slice(1, previewCount + 1);

  useEffect(() => {
    if (selectedIndex === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedIndex(null);
      if (event.key === "ArrowRight") setSelectedIndex(i => i === null ? null : (i + 1) % images.length);
      if (event.key === "ArrowLeft") setSelectedIndex(i => i === null ? null : (i - 1 + images.length) % images.length);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedIndex, images.length]);

  if (!images.length) {
    return (
      <div style={{ background: "#f3f3f3", padding: "70px 20px", textAlign: "center", color: "#666" }}>
        No photos available for this auction.
      </div>
    );
  }

  const photoAlt = (index: number) =>
    `${vehicleName} ${auctionSource} lot ${lotNumber} auction photo ${index + 1}`;

  return (
    <div style={{ minWidth: 0, padding: "0 0 16px" }}>
      <div style={{ background: "#f3f3f3", border: "1px solid #e2e2e2", borderRadius: "12px", overflow: "hidden" }}>
        <img src={images[0]} alt={photoAlt(0)} onClick={() => setSelectedIndex(0)}
          style={{ width: "100%", maxHeight: "700px", objectFit: "contain", display: "block", cursor: "pointer" }} />
      </div>
      {images.length > 1 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "10px", marginTop: "12px" }}>
          {visibleImages.map((src, index) => (
            <button type="button" key={`${src}-${index}`} onClick={() => setSelectedIndex(index + 1)}
              aria-label={`Open auction photo ${index + 2}`}
              style={{ padding: 0, border: "1px solid #e5e5e5", borderRadius: "9px", overflow: "hidden", cursor: "pointer", background: "#f3f3f3" }}>
              <img src={src} alt={photoAlt(index + 1)} loading="lazy"
                style={{ width: "100%", aspectRatio: "4 / 3", objectFit: "cover", display: "block" }} />
            </button>
          ))}
        </div>
      )}
      {images.length > previewCount + 1 && (
        <button type="button" onClick={() => setExpanded(value => !value)}
          style={{ marginTop: "12px", padding: "10px 16px", background: "#fff", border: "1px solid #d5d5d5", borderRadius: "8px", fontWeight: 700, cursor: "pointer" }}>
          {expanded ? "Show fewer photos" : `View all ${images.length} photos`}
        </button>
      )}
      {selectedIndex !== null && (
        <div role="dialog" aria-modal="true" aria-label="Auction photo viewer"
          onClick={() => setSelectedIndex(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.93)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
          <button type="button" aria-label="Close photo viewer" onClick={() => setSelectedIndex(null)}
            style={{ position: "absolute", top: 14, right: 20, border: "none", background: "transparent", color: "#fff", fontSize: 38, cursor: "pointer", zIndex: 2 }}>×</button>
          {images.length > 1 && (
            <button type="button" aria-label="Previous photo"
              onClick={event => { event.stopPropagation(); setSelectedIndex((selectedIndex - 1 + images.length) % images.length); }}
              style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", background: "rgba(0,0,0,.55)", border: "none", color: "#fff", borderRadius: "50%", width: 46, height: 46, fontSize: 30, cursor: "pointer" }}>‹</button>
          )}
          <img src={images[selectedIndex]} alt={photoAlt(selectedIndex)} onClick={event => event.stopPropagation()}
            style={{ maxWidth: "calc(100vw - 110px)", maxHeight: "88vh", objectFit: "contain" }} />
          {images.length > 1 && (
            <button type="button" aria-label="Next photo"
              onClick={event => { event.stopPropagation(); setSelectedIndex((selectedIndex + 1) % images.length); }}
              style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "rgba(0,0,0,.55)", border: "none", color: "#fff", borderRadius: "50%", width: 46, height: 46, fontSize: 30, cursor: "pointer" }}>›</button>
          )}
          <div style={{ position: "absolute", bottom: 15, color: "#fff", fontSize: 14 }}>{selectedIndex + 1} / {images.length}</div>
        </div>
      )}
    </div>
  );
}

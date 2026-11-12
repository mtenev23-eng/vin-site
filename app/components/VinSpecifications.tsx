
import { getVinSpecifications } from "../../utils/nhtsa-vin";

export default async function VinSpecifications({
  vin,
}: {
  vin: string;
}) {
  const vinSpecifications = await getVinSpecifications(vin);

  if (vinSpecifications.length === 0) {
    return null;
  }

  return (
    <section
      style={{
        marginTop: "48px",
        marginBottom: "48px",
        borderTop: "1px solid #e5e5e5",
        paddingTop: "34px",
      }}
    >
      <h2 style={{ fontSize: "26px", margin: "0 0 8px" }}>
        Additional Vehicle Specifications
      </h2>

      <p
        style={{
          color: "#666",
          fontSize: "14px",
          margin: "0 0 24px",
          lineHeight: 1.6,
        }}
      >
        Additional technical specifications decoded from the VIN.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "22px",
        }}
      >
        {vinSpecifications.map((spec) => (
          <div key={spec.label}>
            <div
              style={{
                fontSize: "12px",
                color: "#777",
                textTransform: "uppercase",
                marginBottom: "6px",
                fontWeight: 600,
              }}
            >
              {spec.label}
            </div>

            <div
              style={{
                fontSize: "16px",
                fontWeight: 600,
                color: "#222",
              }}
            >
              {spec.value}
            </div>
          </div>
        ))}
      </div>

      <p
        style={{
          fontSize: "12px",
          color: "#888",
          marginTop: "22px",
        }}
      >
        Source: NHTSA VIN Decoder. Specifications are manufacturer-reported
        and may vary by vehicle.
      </p>
    </section>
  );
}

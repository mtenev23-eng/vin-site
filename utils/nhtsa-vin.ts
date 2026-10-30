import { unstable_cache } from "next/cache";

export type VinSpecification = {
  label: string;
  value: string;
};

const fields: { key: string; label: string; suffix?: string }[] = [
  { key: "EngineCylinders", label: "Engine Cylinders" },
  { key: "EngineHP", label: "Horsepower", suffix: " hp" },
  { key: "EngineConfiguration", label: "Engine Configuration" },
  { key: "EngineModel", label: "Engine Model" },
  { key: "Turbo", label: "Turbocharged" },
  { key: "ElectrificationLevel", label: "Electrification" },
  { key: "BatteryType", label: "Battery Type" },
  { key: "BatteryKWh", label: "Battery Capacity", suffix: " kWh" },
  { key: "GVWR", label: "Gross Vehicle Weight Rating" },
];

function valid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    !["not applicable", "not available", "unknown", "null"].includes(
      value.trim().toLowerCase()
    )
  );
}

const decodeVinCached = unstable_cache(
  async (vin: string): Promise<VinSpecification[]> => {
    try {
      const response = await fetch(
        `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(vin)}?format=json`,
        { signal: AbortSignal.timeout(5000) }
      );

      if (!response.ok) return [];

      const data = await response.json();
      const result = data?.Results?.[0];

      if (!result) return [];

      const specifications: VinSpecification[] = [];

      for (const field of fields) {
        const value = result[field.key];

        if (valid(value)) {
          specifications.push({
            label: field.label,
            value: `${value.trim()}${field.suffix ?? ""}`,
          });
        }
      }

      const location = [
        result.PlantCity,
        result.PlantState,
        result.PlantCountry,
      ].filter(valid);

      if (location.length > 0) {
        specifications.push({
          label: "Manufacturing Location",
          value: location.join(", "),
        });
      }

      return specifications;
    } catch (error) {
      console.error("NHTSA VIN decode error:", error);
      return [];
    }
  },
  ["nhtsa-vin-specifications-v1"],
  { revalidate: 2592000 }
);

export async function getVinSpecifications(
  vin: string
): Promise<VinSpecification[]> {
  const cleaned = vin.trim().toUpperCase();

  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(cleaned)) {
    return [];
  }

  return decodeVinCached(cleaned);
}

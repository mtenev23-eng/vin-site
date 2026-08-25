import { supabase } from "../../../utils/supabase/client";

type Car = {
  vin: string;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  mileage: number | null;
  final_bid: number | null;
  auction_date: string | null;
  location: string | null;
  primary_damage: string | null;
  secondary_damage: string | null;
  color: string | null;
  image_urls: string[] | null;
};

async function getCar(vin: string): Promise<Car | null> {
  const cleanedVin = vin.trim().toUpperCase();

  console.log("Looking up VIN:", cleanedVin);

  const { data, error } = await supabase
    .from("cars")
    .select("*")
    .eq("vin", cleanedVin)
    .maybeSingle();

  if (error) {
    console.log("ERROR MESSAGE:", error.message);
    console.log("ERROR CODE:", error.code);
    console.log("ERROR DETAILS:", error.details);
    console.log("ERROR HINT:", error.hint);
    return null;
  }

  console.log("CAR FOUND:", data?.vin ?? "NONE");

  return data;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ vin: string }>;
}) {
  const { vin } = await params;

  return {
    title: `VIN ${vin} - Vehicle Record`,
    description: `Auction history and details for VIN ${vin}.`,
  };
}

export default async function VinPage({
  params,
}: {
  params: Promise<{ vin: string }>;
}) {
  const { vin } = await params;

  const car = await getCar(vin);

  if (!car) {
    return (
      <main style={{ padding: "40px", fontFamily: "Arial" }}>
        <h1>Vehicle Not Found</h1>
        <p>No archived record exists for VIN {vin}.</p>
      </main>
    );
  }

  return (
    <main
      style={{
        padding: "40px",
        fontFamily: "Arial",
        maxWidth: "1000px",
        margin: "0 auto",
      }}
    >
      <h1 style={{ fontSize: "36px" }}>VIN: {car.vin}</h1>

      <p style={{ fontSize: "22px", color: "#444" }}>
        {car.year} {car.make} {car.model} {car.trim}
      </p>

      {car.image_urls && car.image_urls.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: "16px",
            marginTop: "30px",
            marginBottom: "30px",
          }}
        >
          {car.image_urls.map((imageUrl, index) => (
            <img
              key={index}
              src={imageUrl}
              alt={`Auction photo ${index + 1} for VIN ${car.vin}`}
              style={{
                width: "100%",
                borderRadius: "12px",
                border: "1px solid #ddd",
              }}
            />
          ))}
        </div>
      )}

      <hr style={{ margin: "30px 0" }} />

      <p>
        <strong>Mileage:</strong>{" "}
        {car.mileage !== null
          ? `${car.mileage.toLocaleString()} miles`
          : "Not available"}
      </p>

      <p>
        <strong>Final Bid:</strong>{" "}
        {car.final_bid !== null
          ? `$${Number(car.final_bid).toLocaleString()}`
          : "Not available"}
      </p>

      <p>
        <strong>Auction Date:</strong> {car.auction_date || "Not available"}
      </p>

      <p>
        <strong>Location:</strong> {car.location || "Not available"}
      </p>

      <p>
        <strong>Primary Damage:</strong>{" "}
        {car.primary_damage || "Not available"}
      </p>

      <p>
        <strong>Secondary Damage:</strong>{" "}
        {car.secondary_damage || "Not available"}
      </p>

      <p>
        <strong>Color:</strong> {car.color || "Not available"}
      </p>
    </main>
  );
}
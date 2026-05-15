
import fs from "fs/promises";
import path from "path";

const filePath = path.join(process.cwd(), "data", "cars.json");

type Car = {
  vin: string;
  year: number;
  make: string;
  model: string;
  trim: string;
  mileage: number;
  finalBid: number;
  auctionDate: string;
  location: string;
  primaryDamage: string;
  secondaryDamage: string;
  color: string;
  imageUrls?: string[];
};

async function getCars(): Promise<Car[]> {
  const file = await fs.readFile(filePath, "utf-8");
  return JSON.parse(file);
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

  const cars = await getCars();

  const car = cars.find(
    (item) => item.vin.toUpperCase() === vin.toUpperCase()
  );

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
{car.imageUrls && car.imageUrls.length > 0 && (
  <section style={{ marginTop: "30px" }}>
    <h2>Vehicle Photos</h2>

    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gap: "16px",
      }}
    >
      {car.imageUrls.map((imageUrl, index) => (
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
  </section>
)}
      <hr style={{ margin: "30px 0" }} />

      <p><strong>Mileage:</strong> {car.mileage.toLocaleString()} miles</p>
      <p><strong>Final Bid:</strong> ${car.finalBid.toLocaleString()}</p>
      <p><strong>Auction Date:</strong> {car.auctionDate}</p>
      <p><strong>Location:</strong> {car.location}</p>
      <p><strong>Primary Damage:</strong> {car.primaryDamage}</p>
      <p><strong>Secondary Damage:</strong> {car.secondaryDamage}</p>
      <p><strong>Color:</strong> {car.color}</p>
    </main>
  );
}


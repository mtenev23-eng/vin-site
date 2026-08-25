const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseSecretKey) {
  console.error("Missing Supabase URL or secret key.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseSecretKey);

const csvPath = path.join(process.cwd(), "data", "import-cars.csv");

function parseCsvLine(line) {
  const result = [];
  let current = "";
  let insideQuotes = false;

  for (const char of line) {
    if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === "," && !insideQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

async function importCars() {
  const csv = fs.readFileSync(csvPath, "utf-8");
  const lines = csv.trim().split(/\r?\n/);

  const headers = parseCsvLine(lines[0]).map((header) => header.trim());

  const cars = lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const car = {};

    headers.forEach((header, index) => {
      car[header] = values[index] ? values[index].trim() : "";
    });

    return {
      vin: car.vin.toUpperCase(),
      year: car.year ? Number(car.year) : null,
      make: car.make || null,
      model: car.model || null,
      trim: car.trim || null,
      mileage: car.mileage ? Number(car.mileage) : null,
      final_bid: car.finalBid ? Number(car.finalBid) : null,
      auction_date: car.auctionDate || null,
      location: car.location || null,
      primary_damage: car.primaryDamage || null,
      secondary_damage: car.secondaryDamage || null,
      color: car.color || null,

      image_urls: car.imageUrls
        ? car.imageUrls
            .split("|")
            .map((url) => url.trim())
            .filter(Boolean)
        : [],
    };
  });

  console.log(`Found ${cars.length} cars in CSV.`);

  const { data, error } = await supabase
    .from("cars")
    .upsert(cars, {
      onConflict: "vin",
    })
    .select();

  if (error) {
    console.error("Import failed:");
    console.error(error);
    process.exit(1);
  }

  console.log(`Successfully imported/updated ${data.length} cars.`);
}

importCars();
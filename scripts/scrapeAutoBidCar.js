const cheerio = require("cheerio");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseSecretKey) {
  console.error("Missing Supabase URL or secret key.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseSecretKey);

const url = process.argv[2];

if (!url) {
  console.error("Please provide an AutoBidCar URL.");
  process.exit(1);
}

function clean(value) {
  if (value === undefined || value === null) return null;

  const result = String(value).replace(/\s+/g, " ").trim();
  return result || null;
}

function numberFromText(value) {
  if (!value) return null;

  const cleaned = String(value).replace(/[^\d.]/g, "");

  return cleaned ? Number(cleaned) : null;
}

/*
  Get a field directly from AutoBidCar's characteristics list.

  Example HTML:
  <li>
    <span class="art-info-title">Secondary Damage</span>
    UNDERCARRIAGE
  </li>
*/
function getCharacteristic($, label) {
  let result = null;

  $(".art-info-wrapper li").each((_, element) => {
    const title = clean($(element).find(".art-info-title").text());

    if (title?.toLowerCase() === label.toLowerCase()) {
      const clone = $(element).clone();

      clone.find(".art-info-title").remove();

      result = clean(clone.text());
    }
  });

  return result;
}

/*
  Find all full-size AutoBidCar images.

  AutoBidCar uses:
  https://cdn.autobidcar.com/cars/VIN/main/VIN_1.webp
  https://cdn.autobidcar.com/cars/VIN/main/VIN_2.webp
  etc.
*/
async function getVehicleImages(vin) {
  const MAX_IMAGES = 50;

  const urls = Array.from(
    { length: MAX_IMAGES },
    (_, i) =>
      `https://cdn.autobidcar.com/cars/${vin}/main/${vin}_${i + 1}.webp`
  );

  const results = await Promise.all(
    urls.map(async (url, index) => {
      try {
        const response = await fetch(url, {
          method: "HEAD",
        });

        return response.ok
          ? {
              index: index + 1,
              url,
            }
          : null;
      } catch {
        return null;
      }
    })
  );

  return results
    .filter(Boolean)
    .sort((a, b) => a.index - b.index)
    .map((result) => result.url);
}

async function scrapeAutoBidCar() {
  console.log("Fetching:", url);

  /*
    STEP 1:
    Download the AutoBidCar vehicle page.
  */

  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
        "AppleWebKit/537.36 Chrome/153 Safari/537.36",

      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",

      "Accept-Language": "en-US,en;q=0.9",
    },
  });

  if (!response.ok) {
    throw new Error(
      `AutoBidCar returned ${response.status} ${response.statusText}`
    );
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  /*
    STEP 2:
    Find AutoBidCar's structured Vehicle JSON-LD.
  */

  let vehicleJson = null;

  $('script[type="application/ld+json"]').each((_, script) => {
    const raw = $(script).html();

    if (!raw) return;

    try {
      const parsed = JSON.parse(raw);
      const objects = Array.isArray(parsed) ? parsed : [parsed];

      for (const object of objects) {
        if (
          object &&
          (
            object["@type"] === "Vehicle" ||
            object.vehicleIdentificationNumber
          )
        ) {
          vehicleJson = object;
        }
      }
    } catch {
      // Ignore unrelated/invalid JSON-LD blocks.
    }
  });

  if (!vehicleJson) {
    throw new Error("Could not locate vehicle structured data.");
  }

  /*
    STEP 3:
    Extract reliable structured fields.
  */

  const vin = clean(vehicleJson.vehicleIdentificationNumber);

  if (!vin) {
    throw new Error("Could not locate VIN.");
  }

  const year =
    numberFromText(vehicleJson.vehicleModelDate) ||
    numberFromText(vehicleJson.modelDate) ||
    numberFromText(vehicleJson.productionDate);

  const make =
    clean(vehicleJson.manufacturer) ||
    clean(vehicleJson.brand?.name);

  const model = clean(vehicleJson.model);

  const color = clean(vehicleJson.color);

  const transmission = clean(
    vehicleJson.vehicleTransmission
  );

  const primaryDamage = clean(
    vehicleJson.knownVehicleDamages
  );

  const engine =
    clean(vehicleJson.vehicleEngine?.engineType) ||
    clean(vehicleJson.vehicleEngine?.name);

  const fuel = clean(
    vehicleJson.vehicleEngine?.fuelType
  );

  const auctionDate = clean(
    vehicleJson.purchaseDate
  );

  const finalBid = numberFromText(
    vehicleJson.offers?.price
  );

  const auctionSource = clean(
    vehicleJson.offers?.seller?.name
  );

  /*
    STEP 4:
    Extract fields from the characteristics list.
  */

  const trim = getCharacteristic($, "Series");

  const mileage = numberFromText(
    getCharacteristic($, "Odometer")
  );

  const location = getCharacteristic($, "Location");

  const secondaryDamage = getCharacteristic(
    $,
    "Secondary Damage"
  );

  const drivetrain = getCharacteristic($, "Drive");

  /*
    Lot number isn't part of the characteristics list,
    so get it from the page text.
  */

  const pageText = $("body")
    .text()
    .replace(/\s+/g, " ");

  const lotMatch = pageText.match(
    /Lot(?: Number| #)?\s*:?\s*#?\s*(\d{5,12})/i
  );

  const lotNumber = lotMatch
    ? clean(lotMatch[1])
    : null;

  /*
    STEP 5:
    Find the complete full-size image gallery.
  */

  console.log("Finding vehicle images...");

  const imageUrls = await getVehicleImages(vin);

  /*
    STEP 6:
    Build final vehicle object.
  */

  const car = {
    vin,
    year,
    make,
    model,
    trim,
    mileage,
    final_bid: finalBid,
    auction_date: auctionDate,
    location,
    primary_damage: primaryDamage,
    secondary_damage: secondaryDamage,
    color,
    engine,
    transmission,
    drivetrain,
    fuel,
    auction_source: auctionSource,
    lot_number: lotNumber,
    source_url: url,
    image_urls: imageUrls,
  };

  console.log("\nSCRAPED VEHICLE:\n");
  console.log(JSON.stringify(car, null, 2));

  console.log(`\nImages found: ${car.image_urls.length}`);

 /*
  FINAL DATA QUALITY CHECK

  The catalog filter is only the first filter.
  Before anything enters Supabase, verify the
  individual vehicle page itself.
*/

if (!car.vin) {
  console.log("\nSKIPPED: Vehicle has no VIN.");
  process.exit(2);
}

if (!car.auction_source) {
  console.log("\nSKIPPED: Vehicle has no auction source.");
  process.exit(2);
}

if (!car.lot_number) {
  console.log("\nSKIPPED: Vehicle has no lot number.");
  process.exit(2);
}

if (!car.final_bid || car.final_bid < 5000) {
  console.log(
    `\nSKIPPED: Final bid is ${
      car.final_bid === null
        ? "missing"
        : `$${car.final_bid.toLocaleString()}`
    }.`
  );
  process.exit(2);
}

if (!car.image_urls || car.image_urls.length === 0) {
  console.log("\nSKIPPED: Vehicle has no images.");
  process.exit(2);
}

console.log("\nData quality check passed.");

// ========================================
// CHECK WHETHER AUCTION LOT ALREADY EXISTS
// ========================================

const { data: existingLot, error: existingLotError } =
  await supabase
    .from("auction_lots")
    .select("id")
    .eq("auction_source", car.auction_source)
    .eq("lot_number", car.lot_number)
    .maybeSingle();

if (existingLotError) {
  throw new Error(
    `Existing lot check failed: ${existingLotError.message}`
  );
}

if (existingLot) {
  console.log(
    `ALREADY ARCHIVED: ${car.auction_source} ${car.lot_number}`
  );

  process.exit(3);
}

console.log("New auction lot.");
console.log("Saving vehicle to Supabase...");

// ========================================
// SAVE VEHICLE
// ========================================

const vehicle = {
  vin: car.vin,
  year: car.year,
  make: car.make,
  model: car.model,
  trim: car.trim,
};

const { error: vehicleError } = await supabase
  .from("vehicles")
  .upsert(vehicle, {
    onConflict: "vin",
  });

if (vehicleError) {
  throw new Error(
    `Vehicle save failed: ${vehicleError.message}`
  );
}

// ========================================
// SAVE AUCTION LOT
// ========================================

const auctionLot = {
  vin: car.vin,
  auction_source: car.auction_source,
  lot_number: car.lot_number,

  final_bid: car.final_bid,
  auction_date: car.auction_date,
  mileage: car.mileage,
  location: car.location,

  primary_damage: car.primary_damage,
  secondary_damage: car.secondary_damage,

  color: car.color,
  engine: car.engine,
  transmission: car.transmission,
  drivetrain: car.drivetrain,
  fuel: car.fuel,

  image_urls: car.image_urls,
  source_url: car.source_url,
};

const { data, error: lotError } = await supabase
  .from("auction_lots")
  .upsert(auctionLot, {
    onConflict: "auction_source,lot_number",
  })
  .select()
  .single();

if (lotError) {
  throw new Error(
    `Auction lot save failed: ${lotError.message}`
  );
}

console.log(
  `Saved successfully: ${data.vin} | ${data.auction_source} ${data.lot_number}`
);

}

scrapeAutoBidCar().catch((error) => {
  console.error("\nScraper failed:");
  console.error(error);
  process.exit(1);
});
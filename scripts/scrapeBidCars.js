const cheerio = require("cheerio");

const url = process.argv[2];

if (!url) {
  console.error("Please provide a BidCars URL.");
  console.error(
    'Example: node scripts/scrapeBidCars.js "https://bid.cars/en/lot/..."'
  );
  process.exit(1);
}

function clean(text) {
  return text ? text.replace(/\s+/g, " ").trim() : null;
}

function numberFromText(text) {
  if (!text) return null;

  const value = text.replace(/[^\d.]/g, "");

  return value ? Number(value) : null;
}

async function scrapeBidCars() {
  console.log("Fetching:", url);

  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });

  if (!response.ok) {
    throw new Error(
      `BidCars returned ${response.status} ${response.statusText}`
    );
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  const pageText = clean($("body").text()) || "";

  // VIN: find a standard 17-character VIN.
  const vinMatch = pageText.match(/\b[A-HJ-NPR-Z0-9]{17}\b/);
  const vin = vinMatch ? vinMatch[0] : null;

  // Title example:
  // "2019 Mercedes-Benz GLC 300, 4Matic"
  const heading =
    clean($("h2").first().text()) ||
    clean($("h1").first().text()) ||
    clean($("title").text());

  let year = null;
  let make = null;
  let model = null;
  let trim = null;

  if (heading) {
    const yearMatch = heading.match(/\b(19|20)\d{2}\b/);

    if (yearMatch) {
      year = Number(yearMatch[0]);

      const afterYear = heading
        .slice(heading.indexOf(yearMatch[0]) + 4)
        .trim();

      const parts = afterYear.split(",");

      const vehicleName = parts[0].trim();
      trim = parts[1] ? parts[1].trim() : null;

      // Good enough for this first Mercedes test.
      const words = vehicleName.split(/\s+/);

      if (words.length >= 2) {
        make = words[0];

        if (make.toLowerCase() === "mercedes-benz") {
          model = words.slice(1).join(" ");
        } else {
          model = words.slice(1).join(" ");
        }
      }
    }
  }

  // Lot number such as 0-45850102
  const lotMatch = pageText.match(/\b0-\d{6,10}\b/);
  const lotNumber = lotMatch ? lotMatch[0] : null;

  // Location
  const locationMatch = pageText.match(
    /Location:\s*([A-Za-z .'-]+\([A-Z]{2}\))/
  );
  const location = locationMatch ? clean(locationMatch[1]) : null;

  // Determine source from visible page text.
  let auctionSource = null;

  if (pageText.includes("IAAI")) {
    auctionSource = "IAAI";
  } else if (pageText.includes("Copart")) {
    auctionSource = "Copart";
  }

  /*
    Grab sales-history rows.

    We'll later pick the most recent SOLD row for:
    auction_date
    final_bid
    mileage
  */
  const saleRows = [];

  $("tr").each((_, row) => {
    const cells = $(row)
      .find("th, td")
      .map((__, cell) => clean($(cell).text()))
      .get()
      .filter(Boolean);

    if (cells.length >= 5) {
      const joined = cells.join(" | ");

      if (
        joined.includes("IAAI") ||
        joined.includes("Copart")
      ) {
        saleRows.push(cells);
      }
    }
  });

  let soldRow = null;

  for (const row of saleRows) {
    const rowText = row.join(" ");

    if (/Sold/i.test(rowText)) {
      soldRow = row;
    }
  }

  let auctionDate = null;
  let finalBid = null;
  let mileage = null;

  if (soldRow) {
    const date = soldRow.find((value) =>
      /^\d{4}-\d{2}-\d{2}$/.test(value)
    );

    const bid = soldRow.find((value) =>
      /^\$[\d,]+/.test(value)
    );

    const miles = soldRow.find((value) =>
      /\bmi\b/i.test(value)
    );

    auctionDate = date || null;
    finalBid = numberFromText(bid);
    mileage = numberFromText(miles);
  }

  // Collect full-size BidCars-hosted image URLs.
  const imageUrls = new Set();

  $("img").each((_, image) => {
    const candidates = [
      $(image).attr("src"),
      $(image).attr("data-src"),
      $(image).attr("data-lazy-src"),
    ];

    for (const candidate of candidates) {
      if (
        candidate &&
        candidate.includes("mercury.bid.cars") &&
        (!vin || candidate.includes(vin))
      ) {
        imageUrls.add(candidate);
      }
    }
  });

  $("a").each((_, link) => {
    const href = $(link).attr("href");

    if (
      href &&
      href.includes("mercury.bid.cars") &&
      (!vin || href.includes(vin))
    ) {
      imageUrls.add(href);
    }
  });

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
    auction_source: auctionSource,
    lot_number: lotNumber,
    source_url: url,
    image_urls: [...imageUrls],
  };

  console.log("\nSCRAPED VEHICLE:\n");
  console.log(JSON.stringify(car, null, 2));
  console.log(`\nImages found: ${car.image_urls.length}`);
}

scrapeBidCars().catch((error) => {
  console.error("\nScraper failed:");
  console.error(error);
  process.exit(1);
});
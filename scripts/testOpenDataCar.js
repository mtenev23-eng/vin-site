const CATALOG_URL = "https://opendatacar.com/en/auction?sold=1";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchPage(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/154.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });

  console.log(`HTTP ${response.status}  ${url}`);

  if (response.status === 429) {
    throw new Error("429 Too Many Requests — stopping");
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return await response.text();
}

function getVehicleUrls(html) {
  const regex = /href=["']([^"']*\/auction\/[^"']+)["']/gi;
  const urls = new Set();

  let match;

  while ((match = regex.exec(html)) !== null) {
    let url = match[1].split("?")[0];

    if (url.startsWith("/")) {
      url = `https://opendatacar.com${url}`;
    }

    // Actual vehicle pages should end in a 17-character VIN.
    const vinMatch = url.match(/-([A-HJ-NPR-Z0-9]{17})$/i);

    if (vinMatch) {
      urls.add(url);
    }
  }

  return [...urls];
}

function extractVin(url) {
  const match = url.match(/-([A-HJ-NPR-Z0-9]{17})$/i);
  return match ? match[1].toUpperCase() : null;
}

function inspectDetail(html, url) {
  const vin = extractVin(url);

  console.log("");
  console.log("----------------------------------------");
  console.log(`VIN: ${vin}`);

  const searchTerms = [
    "final_price",
    "finalPrice",
    "sale_price",
    "salePrice",
    "auction_date",
    "auctionDate",
    "sold_date",
    "soldDate",
    "lot_number",
    "lotNumber",
    "odometer",
    "mileage",
    "COPART",
    "IAAI",
  ];

  for (const term of searchTerms) {
    const index = html.toLowerCase().indexOf(term.toLowerCase());

    if (index !== -1) {
      const start = Math.max(0, index - 150);
      const end = Math.min(html.length, index + 350);

      console.log("");
      console.log(`FOUND: ${term}`);
      console.log(
        html
          .slice(start, end)
          .replace(/\s+/g, " ")
      );
    }
  }
}

async function main() {
  try {
    console.log("Fetching catalog...");
    const catalogHtml = await fetchPage(CATALOG_URL);

    const vehicleUrls = getVehicleUrls(catalogHtml);

    console.log("");
    console.log(`Actual vehicle URLs found: ${vehicleUrls.length}`);
    console.log("Testing first 5 vehicles only...");
    console.log("");

    for (const url of vehicleUrls.slice(0, 5)) {
      await delay(3000);

      const html = await fetchPage(url);

      inspectDetail(html, url);
    }

    console.log("");
    console.log("========================================");
    console.log("TEST COMPLETE");
    console.log("========================================");
  } catch (error) {
    console.error("");
    console.error(error.message);
    process.exit(1);
  }
}

main();
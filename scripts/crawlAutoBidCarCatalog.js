const cheerio = require("cheerio");
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

require("dotenv").config({
  path: ".env.local",
  quiet: true,
});

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

// ========================================
// SETTINGS
// ========================================

const MODE = process.argv[2] || "fresh";

const MIN_PRICE = 5000;

let START_PAGE;
let END_PAGE;

if (MODE === "fresh") {
  // Daily scan of newest catalog pages.
  START_PAGE = 1;
  END_PAGE = 20;
} else if (MODE === "backfill") {
  // Historical archive crawl.
  START_PAGE = 56;
  END_PAGE = 170;
} else if (MODE === "rescan") {
  // Full catalog rescan.
  START_PAGE = 1;
  END_PAGE = 170;
} else {
  console.error(
    'Invalid mode. Use "fresh", "backfill", or "rescan".'
  );
  process.exit(1);
}

const PAGE_DELAY = 1500;
const VEHICLE_DELAY = 2000;

const MAX_ATTEMPTS = 3;
const RETRY_DELAY = 5000;

// ========================================
// FILES
// ========================================

const DATA_DIR = path.join(process.cwd(), "data");

const CHECKPOINT_FILE = path.join(
  DATA_DIR,
  "autobidcar-checkpoint.json"
);

const LOG_FILE = path.join(
  DATA_DIR,
  "autobidcar-crawl.log"
);

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ========================================
// HELPERS
// ========================================

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function log(message = "") {
  console.log(message);

  fs.appendFileSync(
    LOG_FILE,
    `[${new Date().toISOString()}] ${message}\n`
  );
}

function extractVin(url) {
  const match = url.match(/([A-HJ-NPR-Z0-9]{17})$/i);

  return match
    ? match[1].toUpperCase()
    : null;
}

function loadCheckpoint() {
  if (!fs.existsSync(CHECKPOINT_FILE)) {
    return {
      completedPages: [],
    };
  }

  try {
    const data = JSON.parse(
      fs.readFileSync(CHECKPOINT_FILE, "utf8")
    );

    return {
      completedPages: Array.isArray(data.completedPages)
        ? data.completedPages
        : [],
    };
  } catch {
    return {
      completedPages: [],
    };
  }
}

function saveCheckpoint(checkpoint) {
  fs.writeFileSync(
    CHECKPOINT_FILE,
    JSON.stringify(checkpoint, null, 2)
  );
}

// ========================================
// CATALOG FETCH
// ========================================

async function getCatalogPage(page) {
  const url =
    page === 1
      ? "https://autobidcar.com/catalog"
      : `https://autobidcar.com/catalog?page=${page}`;

  log(`Fetching catalog page ${page}...`);

  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
        "AppleWebKit/537.36 Chrome/153 Safari/537.36",

      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",

      "Accept-Language":
        "en-US,en;q=0.9",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Catalog page ${page} returned ${response.status} ${response.statusText}`
    );
  }

  return response.text();
}

// ========================================
// FIND QUALIFYING VEHICLES
// ========================================

function findQualifyingCars(html) {
  const $ = cheerio.load(html);

  const cars = new Map();

  $('a[href*="/car/"]').each((_, element) => {
    let href = $(element).attr("href");

    if (!href) return;

    if (href.startsWith("/")) {
      href = `https://autobidcar.com${href}`;
    }

    if (
      !href.startsWith(
        "https://autobidcar.com/car/"
      )
    ) {
      return;
    }

    let container = $(element);
    let card = null;

    for (let level = 0; level < 10; level++) {
      container = container.parent();

      if (!container.length) break;

      const vehicleLinks = new Set();

      container
        .find('a[href*="/car/"]')
        .each((_, link) => {
          let linkHref = $(link).attr("href");

          if (!linkHref) return;

          if (linkHref.startsWith("/")) {
            linkHref =
              `https://autobidcar.com${linkHref}`;
          }

          vehicleLinks.add(linkHref);
        });

      const text = container
        .text()
        .replace(/\s+/g, " ")
        .trim();

      const hasPrice =
        /\$[\d,]+/.test(text);

      if (
        hasPrice &&
        vehicleLinks.size === 1 &&
        vehicleLinks.has(href)
      ) {
        card = container;
        break;
      }
    }

    if (!card) return;

    const cardText = card
      .text()
      .replace(/\s+/g, " ")
      .trim();

    const priceMatches =
      cardText.match(
        /\$[\d,]+(?:\.\d{2})?/g
      ) || [];

    const prices = priceMatches
      .map((price) =>
        Number(
          price.replace(/[^\d.]/g, "")
        )
      )
      .filter((price) =>
        Number.isFinite(price)
      );

    if (prices.length === 0) return;

    const price = Math.max(...prices);

    if (price < MIN_PRICE) return;

    if (!cars.has(href)) {
      cars.set(href, {
        url: href,
        price,
        vin: extractVin(href),
      });
    }
  });

  return [...cars.values()];
}



// ========================================
// IMPORT ONE VEHICLE
// ========================================

async function importVehicle(car) {
  for (
    let attempt = 1;
    attempt <= MAX_ATTEMPTS;
    attempt++
  ) {
    if (attempt > 1) {
      log(
        `Retry ${attempt}/${MAX_ATTEMPTS}: ${car.vin || car.url}`
      );

      await sleep(RETRY_DELAY);
    }

    const result = spawnSync(
      process.execPath,
      [
        "scripts/scrapeAutoBidCar.js",
        car.url,
      ],
      {
        stdio: "inherit",
        cwd: process.cwd(),
      }
    );

    // Successful import
    if (result.status === 0) {
      return "imported";
    }

    // Intentional quality-control skip
    if (result.status === 2) {
      return "skipped";
    }

// Auction lot is already in our archive
if (result.status === 3) {
  return "existing";
}

    log(
      `Attempt ${attempt}/${MAX_ATTEMPTS} failed for ${car.vin || car.url}`
    );
  }

  return "failed";
}

// ========================================
// MAIN
// ========================================

async function main() {
  const checkpoint = loadCheckpoint();

  const completedPages = new Set(
    checkpoint.completedPages
  );

  let pagesScanned = 0;
  let pagesSkipped = 0;

  let qualifying = 0;

  let imported = 0;
let alreadyArchived = 0;
let skipped = 0;
let failed = 0;

  log("");
  log("========================================");
  log("AUTOBIDCAR CATALOG CRAWLER");
  log(`Mode: ${MODE.toUpperCase()}`);
  log("========================================");

  log(
    `Pages: ${START_PAGE}-${END_PAGE}`
  );

  log(
    `Minimum sale price: $${MIN_PRICE.toLocaleString()}`
  );

  log("========================================");

  for (
    let page = START_PAGE;
    page <= END_PAGE;
    page++
  ) {
    /*
      If this page was already completed during
      an earlier interrupted run, skip it.
    */

    if (
  MODE === "backfill" &&
  completedPages.has(page)
) {
  pagesSkipped++;

  log(
    `Page ${page}: already completed - skipping`
  );

  continue;
}

    try {
      const html =
        await getCatalogPage(page);

      const cars =
        findQualifyingCars(html);

      pagesScanned++;

      qualifying += cars.length;

      log(
        `Page ${page}: ${cars.length} qualifying vehicles`
      );

      /*
        Check Supabase BEFORE opening
        individual vehicle pages.
      */

      const newCars = cars;

log(
  `Page ${page}: ${newCars.length} vehicles to check`
);
      /*
        Import vehicles one at a time.
      */

      for (
        let i = 0;
        i < newCars.length;
        i++
      ) {
        const car = newCars[i];

        log("");
        log(
          `Vehicle ${i + 1}/${newCars.length}`
        );

        log(
          `${car.vin || "UNKNOWN VIN"} | $${car.price.toLocaleString()}`
        );

        const result =
          await importVehicle(car);

        if (result === "imported") {
          imported++;

          log(
            `IMPORTED: ${car.vin || car.url}`
          );
        }

        if (result === "existing") {
  alreadyArchived++;

  log(
    `ALREADY ARCHIVED: ${car.vin || car.url}`
  );
}

        if (result === "skipped") {
          skipped++;

          log(
            `SKIPPED: ${car.vin || car.url}`
          );
        }

        if (result === "failed") {
          failed++;

          log(
            `FAILED: ${car.vin || car.url}`
          );
        }

        await sleep(VEHICLE_DELAY);
      }

      /*
        The page is marked complete only AFTER
        all of its vehicles have been processed.
      */

      if (MODE === "backfill") {
  completedPages.add(page);

  checkpoint.completedPages =
    [...completedPages].sort(
      (a, b) => a - b
    );

  saveCheckpoint(checkpoint);

  log(
    `Page ${page}: checkpoint saved`
  );
}
    } catch (error) {
      failed++;

      log(
        `PAGE ERROR ${page}: ${error.message}`
      );

      /*
        IMPORTANT:
        Do NOT mark this page completed.
        A future run will retry it.
      */
    }

    await sleep(PAGE_DELAY);
  }

  log("");
  log("");
  log("========================================");
  log("CATALOG RUN COMPLETE");
  log("========================================");

  log(
    `Requested pages:      ${START_PAGE}-${END_PAGE}`
  );

  log(
    `Pages scanned now:    ${pagesScanned}`
  );

  log(
    `Pages already done:   ${pagesSkipped}`
  );

  log(
    `Qualifying vehicles:  ${qualifying}`
  );


  log(
    `Imported:             ${imported}`
  );
log(
  `Already archived:     ${alreadyArchived}`
);
  log(
    `Skipped by QC:        ${skipped}`
  );

  log(
    `Failed:               ${failed}`
  );

  log("========================================");

  log(
    `Checkpoint: ${CHECKPOINT_FILE}`
  );

  log(
    `Log:        ${LOG_FILE}`
  );
}

main().catch((error) => {
  console.error(
    "\nCrawler crashed:",
    error
  );

  process.exit(1);
});
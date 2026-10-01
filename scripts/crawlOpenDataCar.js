const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

require("dotenv").config({ path: ".env.local" });

// ========================================
// SUPABASE
// ========================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseSecretKey) {
  console.error("Missing Supabase URL or secret key.");
  process.exit(1);
}

const supabase = createClient(
  supabaseUrl,
  supabaseSecretKey
);

// ========================================
// CRAWLER SETTINGS
// ========================================

const BASE_URL = "https://opendatacar.com";
const CATALOG_URL = `${BASE_URL}/auction?sold=1`;

const REQUEST_DELAY_MS = 3000;
const MIN_FINAL_BID = 1000;
const MIN_AUCTION_DATE = "2026-01-01";
const IAAI_RECOVERY_MODE = false;
const DATA_DIR = path.join(__dirname, "..", "data");

const CHECKPOINT_FILE = path.join(
  DATA_DIR,
  "opendatacar-checkpoint.json"
);

fs.mkdirSync(DATA_DIR, { recursive: true });

const sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

// ========================================
// BASIC HELPERS
// ========================================

function decodeHtml(value) {
  if (value === null || value === undefined) {
    return null;
  }

  return String(value)
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/&ndash;/gi, "–")
    .replace(/&mdash;/gi, "—");
}

function cleanText(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const cleaned = decodeHtml(
    String(value).replace(/<[^>]*>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim();

  return cleaned || null;
}

function parseNumber(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const cleaned = String(value).replace(
    /[^\d.]/g,
    ""
  );

  if (!cleaned) return null;

  const number = Number(cleaned);

  return Number.isFinite(number)
    ? number
    : null;
}

function escapeRegex(value) {
  return String(value).replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
}

function normalizePlaceholder(value) {
  if (!value) return null;

  const normalized = value.trim();

  if (
    normalized === "-" ||
    /^unknown$/i.test(normalized) ||
    /^n\/a$/i.test(normalized)
  ) {
    return null;
  }

  return normalized;
}

// ========================================
// HTTP
// ========================================

async function fetchPage(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/154.0.0.0 Safari/537.36",

      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",

      "Accept-Language":
        "en-US,en;q=0.9",
    },
  });

  console.log(
    `HTTP ${response.status}  ${url}`
  );

  if (response.status === 429) {
    throw new Error(
      "RATE_LIMITED: OpenDataCar returned HTTP 429"
    );
  }

  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status} ${response.statusText}`
    );
  }

  return await response.text();
}

// ========================================
// CATALOG
// ========================================

function getCatalogUrl(page) {
  if (page === 1) {
    return `${BASE_URL}/auction?sold=1`;
  }

  return `${BASE_URL}/auction?sold=1&page=${page}`;
}

function getVehicleUrls(html) {
  const regex =
    /href=["']([^"']*\/auction\/[^"']+)["']/gi;

  const urls = new Set();

  let match;

  while ((match = regex.exec(html)) !== null) {
    let url = match[1].split("?")[0];

    if (url.startsWith("/")) {
      url = `${BASE_URL}${url}`;
    }

    const vinMatch = url.match(
      /-([A-HJ-NPR-Z0-9]{17})$/i
    );

    if (vinMatch) {
      urls.add(url);
    }
  }

  return [...urls];
}
function getCatalogPriceForUrl(html, url) {
  const vin = extractVin(url);

  if (!vin) {
    return null;
  }

  const vinIndex = html
    .toUpperCase()
    .indexOf(vin.toUpperCase());

  if (vinIndex === -1) {
    return null;
  }

  // Find the beginning of this vehicle's catalog card.
  const cardStart = html.lastIndexOf(
    '<div class="ant-row',
    vinIndex
  );

  if (cardStart === -1) {
    return null;
  }

  // Find the beginning of the next vehicle card.
  const nextCardStart = html.indexOf(
    '<div class="ant-row',
    vinIndex + vin.length
  );

  const cardHtml = html.slice(
    cardStart,
    nextCardStart === -1
      ? html.length
      : nextCardStart
  );

  const priceMatch = cardHtml.match(
    /<span class="price-value">\s*\$\s*([\d,]+(?:\.\d{1,2})?)\s*<\/span>/i
  );

  if (!priceMatch) {
    return null;
  }

  return parseNumber(priceMatch[1]);
}
function getCatalogDateForUrl(html, url) {
  const vin = extractVin(url);

  if (!vin) {
    return null;
  }

  const vinIndex = html
    .toUpperCase()
    .indexOf(vin.toUpperCase());

  if (vinIndex === -1) {
    return null;
  }

  const cardStart = html.lastIndexOf(
    '<div class="ant-row',
    vinIndex
  );

  if (cardStart === -1) {
    return null;
  }

  const nextCardStart = html.indexOf(
    '<div class="ant-row',
    vinIndex + vin.length
  );

  const cardHtml = html.slice(
    cardStart,
    nextCardStart === -1
      ? html.length
      : nextCardStart
  );

  const dateMatch = cardHtml.match(
    /data-original-time="([^"]+)"/i
  );

  if (!dateMatch) {
    return null;
  }

  const parsedDate = new Date(
    dateMatch[1]
  );

  if (
    Number.isNaN(
      parsedDate.getTime()
    )
  ) {
    return null;
  }

  return parsedDate
    .toISOString()
    .slice(0, 10);
}

function extractVin(url) {
  const match = url.match(
    /-([A-HJ-NPR-Z0-9]{17})$/i
  );

  return match
    ? match[1].toUpperCase()
    : null;
}

function extractAuctionDate(html) {
  const match = html.match(
    /name=["']auction_date["']\s+value=["']([^"']+)["']/i
  );

  if (!match) return null;

  const date = new Date(match[1]);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

// ========================================
// JSON-LD
// ========================================

function extractJsonLdObjects(html) {
  const objects = [];

  const regex =
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  let match;

  while ((match = regex.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(
        match[1].trim()
      );

      if (Array.isArray(parsed)) {
        objects.push(...parsed);
      } else {
        objects.push(parsed);
      }
    } catch {
      // Ignore unrelated JSON-LD.
    }
  }

  return objects;
}

function extractVehicleJsonLd(html) {
  const objects =
    extractJsonLdObjects(html);

  for (const object of objects) {
    if (
      object &&
      typeof object === "object" &&
      (
        object.vehicleIdentificationNumber ||
        object["@type"] === "Vehicle" ||
        object["@type"] === "Car"
      )
    ) {
      return object;
    }
  }

  return null;
}

// ========================================
// VEHICLE IDENTITY
// ========================================

function extractVehicleFromUrl(url) {
  try {
    const pathname =
      new URL(url).pathname;

    const parts =
      pathname.split("/").filter(Boolean);

    const auctionIndex =
      parts.indexOf("auction");

    if (auctionIndex === -1) {
      return {};
    }

    const makeSlug =
      parts[auctionIndex + 1] || null;

    const modelSlug =
      parts[auctionIndex + 2] || null;

    const yearPart =
      parts[auctionIndex + 3] || null;

    const titleCase = (slug) => {
      if (!slug) return null;

      return slug
        .split("-")
        .map((word) =>
          word
            ? word.charAt(0).toUpperCase() +
              word.slice(1).toLowerCase()
            : ""
        )
        .join(" ");
    };

    return {
      year:
        /^\d{4}$/.test(yearPart)
          ? Number(yearPart)
          : null,

      make:
        titleCase(makeSlug),

      model:
        titleCase(modelSlug),
    };
  } catch {
    return {};
  }
}

function extractVehicleIdentity(html, url) {
  const jsonLd =
    extractVehicleJsonLd(html);

  const urlVehicle =
    extractVehicleFromUrl(url);

  let make = null;
  let model = null;
  let year = null;

  if (jsonLd) {
    if (
      typeof jsonLd.brand === "string"
    ) {
      make = cleanText(
        jsonLd.brand
      );
    } else if (
      jsonLd.brand &&
      typeof jsonLd.brand === "object"
    ) {
      make = cleanText(
        jsonLd.brand.name
      );
    }

    model =
      cleanText(jsonLd.model);

    year =
      parseNumber(
        jsonLd.vehicleModelDate ||
        jsonLd.productionDate
      );
  }

  return {
    year:
      year ||
      urlVehicle.year ||
      null,

    make:
      make ||
      urlVehicle.make ||
      null,

    model:
      model ||
      urlVehicle.model ||
      null,
  };
}

// ========================================
// AUCTION DATA
// ========================================

function extractAuctionSource(description) {
  if (!description) return null;

  const match = description.match(
    /(?:Auction|Аукціон)\s+(COPART|IAAI)/i
  );

  return match
    ? match[1].toUpperCase()
    : null;
}

function extractLotNumber(description) {
  if (!description) return null;

  const match = description.match(
    /(?:lot|лот)\s+(\d+)/i
  );

  return match ? match[1] : null;
}

function extractFinalBid(
  description,
  html
) {
  // Prefer the structured current_price field.
  // OpenDataCar's meta description can contain an older/stale price.
  const currentPriceMatch = html.match(
    /name=["']current_price["'][^>]*value=["']([^"']+)["']/i
  );

  if (currentPriceMatch) {
    const currentPrice =
      parseNumber(currentPriceMatch[1]);

    if (currentPrice !== null) {
      return currentPrice;
    }
  }

  // Fallback: JSON-LD offer price.
  const jsonLd =
    extractVehicleJsonLd(html);

  if (
    jsonLd &&
    jsonLd.offers &&
    jsonLd.offers.price !== undefined
  ) {
    const offerPrice =
      parseNumber(jsonLd.offers.price);

    if (offerPrice !== null) {
      return offerPrice;
    }
  }

  // Final fallback: meta description.
  if (description) {
    const match = description.match(
      /\$\s*([\d,]+(?:\.\d{1,2})?)\s*USD/i
    );

    if (match) {
      return parseNumber(
        match[1]
      );
    }
  }

  return null;
}

// ========================================
// MILEAGE
// ========================================

function extractMileage(
  description,
  html
) {
  const jsonLd =
    extractVehicleJsonLd(html);

  if (
    jsonLd &&
    jsonLd.mileageFromOdometer &&
    jsonLd.mileageFromOdometer.value !==
      undefined
  ) {
    const value = parseNumber(
      jsonLd.mileageFromOdometer.value
    );

    const unit = String(
      jsonLd.mileageFromOdometer
        .unitCode || ""
    ).toUpperCase();

    if (value !== null) {
      if (
        unit === "KMT" ||
        unit === "KM"
      ) {
        return Math.round(
          value * 0.621371
        );
      }

      if (
        unit === "SMI" ||
        unit === "MI" ||
        unit === "MILE"
      ) {
        return Math.round(value);
      }
    }
  }

  if (!description) {
    return null;
  }

  const kmMatch =
    description.match(
      /([\d\s,]+)\s*km\b/i
    );

  if (kmMatch) {
    const km =
      parseNumber(kmMatch[1]);

    if (km !== null) {
      return Math.round(
        km * 0.621371
      );
    }
  }

  const mileMatch =
    description.match(
      /([\d\s,]+)\s*mi\b/i
    );

  if (mileMatch) {
    return parseNumber(
      mileMatch[1]
    );
  }

  return null;
}

// ========================================
// STRUCTURED OPTION FIELDS
// ========================================

function extractOption(html, label) {
  const escaped =
    escapeRegex(label);

  const regex = new RegExp(
    `<div[^>]*class=["'][^"']*option[^"']*["'][^>]*>\\s*${escaped}\\s*<span[^>]*class=["'][^"']*right-info[^"']*["'][^>]*>([\\s\\S]*?)<\\/span>\\s*<\\/div>`,
    "i"
  );

  const match =
    html.match(regex);

  return match
    ? cleanText(match[1])
    : null;
}

function extractLocation(html) {
  const match = html.match(
    /<li>\s*<span>\s*Location:\s*<\/span>\s*([^<]+)<\/li>/i
  );

  return match
    ? cleanText(match[1])
    : null;
}

function extractKeysPresent(html) {
  const value =
    extractOption(html, "Keys");

  if (!value) return null;

  const normalized =
    value.toLowerCase();

  if (
    normalized.includes("present") ||
    normalized.includes("available") ||
    normalized === "yes"
  ) {
    return true;
  }

  if (
    normalized.includes("absent") ||
    normalized.includes("missing") ||
    normalized === "no"
  ) {
    return false;
  }

  return null;
}

function extractMoneyOption(
  html,
  label
) {
  const value =
    extractOption(html, label);

  return value
    ? parseNumber(value)
    : null;
}

// ========================================
// IMAGES
// ========================================

function extractImageUrls(html) {
  // ----------------------------------------
  // COPART IMAGES
  // ----------------------------------------

  const copartRegex =
    /https?:\/\/cs\.copart\.com\/[^"'\\\s<>]+?\.(?:jpg|jpeg|png|webp)(?:\?[^"'\\\s<>]*)?/gi;

  const copartRaw = [
    ...new Set(
      html.match(copartRegex) || []
    ),
  ];

  const copartImages =
    copartRaw.map((url) =>
      url.replace(
        /_thb\.(jpg|jpeg|png|webp)/i,
        "_hrs.$1"
      )
    );

  // ----------------------------------------
  // IAAI IMAGES
  // ----------------------------------------

  const iaaiImages = [];

  const galleryMatch = html.match(
    /window\.lotGalleryImages\s*=\s*(\[[\s\S]*?\]);/i
  );

  if (galleryMatch) {
    try {
      const gallery = JSON.parse(
        galleryMatch[1]
      );

      if (Array.isArray(gallery)) {
        for (const url of gallery) {
          if (
            typeof url === "string" &&
            url.includes("vis.iaai.com/deepzoom")
          ) {
            iaaiImages.push(
              decodeHtml(url)
            );
          }
        }
      }
    } catch {
      // Ignore malformed gallery data.
    }
  }

  // Fallback in case the gallery array changes
  // but IAAI deepzoom URLs still exist in the HTML.
  if (iaaiImages.length === 0) {
    const iaaiRegex =
      /https?:\\?\/\\?\/vis\.iaai\.com\\?\/deepzoom\?[^"'<>\\\s]+/gi;

    const matches =
      html.match(iaaiRegex) || [];

    for (const match of matches) {
      const normalized = decodeHtml(
        match.replace(/\\\//g, "/")
      );

      iaaiImages.push(normalized);
    }
  }

  return [
    ...new Set([
      ...copartImages,
      ...iaaiImages,
    ]),
  ].slice(0, 20);
}

async function validateImageUrls(urls) {
  const CONCURRENCY = 4;
  const validUrls = [];

  async function validateOne(url) {
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/154.0.0.0 Safari/537.36",
        },
      });

      const contentType =
        response.headers.get("content-type") || "";

      const valid =
        response.ok &&
        contentType
          .toLowerCase()
          .startsWith("image/");

      if (response.body) {
        await response.body.cancel();
      }

      return valid ? url : null;
    } catch {
      return null;
    }
  }

  for (
    let i = 0;
    i < urls.length;
    i += CONCURRENCY
  ) {
    const batch = urls.slice(
      i,
      i + CONCURRENCY
    );

    const results =
      await Promise.all(
        batch.map(validateOne)
      );

    validUrls.push(
      ...results.filter(Boolean)
    );
  }

  return validUrls;
}

// ========================================
// PARSE COMPLETE RECORD
// ========================================
function extractMetaDescription(html) {
  const match = html.match(
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>/i
  );

  if (match) {
    return cleanText(match[1]);
  }

  const reversedMatch = html.match(
    /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["'][^>]*>/i
  );

  return reversedMatch
    ? cleanText(reversedMatch[1])
    : null;
}


function parseVehicle(html, url) {
  const description =
    extractMetaDescription(html);

  const vehicle =
    extractVehicleIdentity(
      html,
      url
    );

  return {
    vin:
      extractVin(url),

    year:
      vehicle.year || null,

    make:
      vehicle.make || null,

    model:
      vehicle.model || null,

    trim:
      normalizePlaceholder(
        extractOption(
          html,
          "Full Model"
        )
      ),

    auction_source:
      extractAuctionSource(
        description
      ),

    lot_number:
      extractLotNumber(
        description
      ),

    final_bid:
      extractFinalBid(
        description,
        html
      ),

    auction_date:
      extractAuctionDate(html),

    mileage:
      extractMileage(
        description,
        html
      ),

    location:
      normalizePlaceholder(
        extractLocation(html)
      ),

    primary_damage:
      normalizePlaceholder(
        extractOption(
          html,
          "Primary Damage"
        )
      ),

    secondary_damage:
      normalizePlaceholder(
        extractOption(
          html,
          "Secondary Damage"
        )
      ),

    color:
      normalizePlaceholder(
        extractOption(
          html,
          "Color"
        )
      ),

    engine:
      normalizePlaceholder(
        extractOption(
          html,
          "Engine"
        )
      ),

    transmission:
      normalizePlaceholder(
        extractOption(
          html,
          "Transmission"
        )
      ),

    drivetrain:
      normalizePlaceholder(
        extractOption(
          html,
          "Drive"
        )
      ),

    fuel:
      normalizePlaceholder(
        extractOption(
          html,
          "Fuel"
        )
      ),

    loss_type:
      normalizePlaceholder(
        extractOption(
          html,
          "Loss Type"
        )
      ),

    start_code:
      normalizePlaceholder(
        extractOption(
          html,
          "Start Code"
        )
      ),

    keys_present:
      extractKeysPresent(html),

    seller:
      normalizePlaceholder(
        extractOption(
          html,
          "Seller"
        )
      ),

    seller_type:
      normalizePlaceholder(
        extractOption(
          html,
          "Seller Type"
        )
      ),

    sale_document:
      normalizePlaceholder(
        extractOption(
          html,
          "Sale Documents"
        )
      ),

    body_style:
      normalizePlaceholder(
        extractOption(
          html,
          "Body Style"
        )
      ),

    acv:
      extractMoneyOption(
        html,
        "Market Value in USA (ACV)"
      ),

    estimated_repair_cost:
      extractMoneyOption(
        html,
        "Auction Repair Estimate (ERC)"
      ),

    image_urls:
      extractImageUrls(html),

    source_url:
      url,
  };
}

// ========================================
// CHECKPOINT
// ========================================

function loadJson(file, fallback) {
  if (!fs.existsSync(file)) {
    return fallback;
  }

  try {
    return JSON.parse(
      fs.readFileSync(
        file,
        "utf8"
      )
    );
  } catch {
    return fallback;
  }
}

function saveJson(file, value) {
  fs.writeFileSync(
    file,
    JSON.stringify(
      value,
      null,
      2
    ),
    "utf8"
  );
}

// ========================================
// SAFE SUPABASE IMPORT
// ========================================

async function saveToSupabase(car) {
  // ----------------------------------------
  // 1. DUPLICATE LOT CHECK
  // ----------------------------------------

  const {
    data: existingLot,
    error: existingLotError,
  } = await supabase
    .from("auction_lots")
    .select("id")
    .eq(
      "auction_source",
      car.auction_source
    )
    .eq(
      "lot_number",
      car.lot_number
    )
    .maybeSingle();

  if (existingLotError) {
    throw new Error(
      `Existing lot check failed: ${existingLotError.message}`
    );
  }

 if (existingLot) {
  const lotUpdates = {
    vin: car.vin,
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
    loss_type: car.loss_type,
    start_code: car.start_code,
    keys_present: car.keys_present,
    seller: car.seller,
    seller_type: car.seller_type,
    sale_document: car.sale_document,
    body_style: car.body_style,
    acv: car.acv,
    estimated_repair_cost: car.estimated_repair_cost,
    image_urls: car.image_urls,
    source_url: car.source_url,
  };

  // Never replace an existing value with null/undefined.
  for (const key of Object.keys(lotUpdates)) {
    if (
      lotUpdates[key] === null ||
      lotUpdates[key] === undefined ||
      lotUpdates[key] === ""
    ) {
      delete lotUpdates[key];
    }
  }

  const { error: lotUpdateError } =
    await supabase
      .from("auction_lots")
      .update(lotUpdates)
      .eq("id", existingLot.id);

  if (lotUpdateError) {
    throw new Error(
      `Existing lot update failed: ${lotUpdateError.message}`
    );
  }

  return {
    status: "updated",
  };
}

  // ----------------------------------------
  // 2. CHECK EXISTING VEHICLE
  // ----------------------------------------

  const {
    data: existingVehicle,
    error: vehicleCheckError,
  } = await supabase
    .from("vehicles")
    .select(
      "vin, year, make, model, trim"
    )
    .eq("vin", car.vin)
    .maybeSingle();

  if (vehicleCheckError) {
    throw new Error(
      `Vehicle check failed: ${vehicleCheckError.message}`
    );
  }

  // ----------------------------------------
  // 3. INSERT OR SAFELY ENRICH VEHICLE
  // ----------------------------------------

  if (!existingVehicle) {
    const newVehicle = {
      vin: car.vin,
      year: car.year,
      make: car.make,
      model: car.model,
      trim: car.trim,
    };

    const {
      error: vehicleInsertError,
    } = await supabase
      .from("vehicles")
      .insert(newVehicle);

    if (vehicleInsertError) {
      throw new Error(
        `Vehicle insert failed: ${vehicleInsertError.message}`
      );
    }
  } else {
    const updates = {};

    // Only fill fields that are currently missing.
    // Never replace existing good vehicle data.

    if (
      existingVehicle.year === null &&
      car.year !== null
    ) {
      updates.year = car.year;
    }

    if (
      !existingVehicle.make &&
      car.make
    ) {
      updates.make = car.make;
    }

    if (
      !existingVehicle.model &&
      car.model
    ) {
      updates.model = car.model;
    }

    if (
      !existingVehicle.trim &&
      car.trim
    ) {
      updates.trim = car.trim;
    }

    if (
      Object.keys(updates).length > 0
    ) {
      const {
        error: vehicleUpdateError,
      } = await supabase
        .from("vehicles")
        .update(updates)
        .eq("vin", car.vin);

      if (vehicleUpdateError) {
        throw new Error(
          `Vehicle update failed: ${vehicleUpdateError.message}`
        );
      }
    }
  }

  // ----------------------------------------
  // 4. INSERT AUCTION LOT
  // ----------------------------------------

  const auctionLot = {
    vin:
      car.vin,

    auction_source:
      car.auction_source,

    lot_number:
      car.lot_number,

    final_bid:
      car.final_bid,

    auction_date:
      car.auction_date,

    mileage:
      car.mileage,

    location:
      car.location,

    primary_damage:
      car.primary_damage,

    secondary_damage:
      car.secondary_damage,

    color:
      car.color,

    engine:
      car.engine,

    transmission:
      car.transmission,

    drivetrain:
      car.drivetrain,

    fuel:
      car.fuel,

    image_urls:
      car.image_urls,

    source_url:
      car.source_url,

    loss_type:
      car.loss_type,

    start_code:
      car.start_code,

    keys_present:
      car.keys_present,

    seller:
      car.seller,

    seller_type:
      car.seller_type,

    sale_document:
      car.sale_document,

    body_style:
      car.body_style,

    acv:
      car.acv,

    estimated_repair_cost:
      car.estimated_repair_cost,
  };

  const {
    error: lotInsertError,
  } = await supabase
    .from("auction_lots")
    .insert(auctionLot);

  if (lotInsertError) {
    throw new Error(
      `Auction lot insert failed: ${lotInsertError.message}`
    );
  }

  return {
    status: "imported",
  };
}

// ========================================
// MAIN
// ========================================

async function main() {
  const checkpoint =
    loadJson(
      CHECKPOINT_FILE,
      {
        completedUrls: [],
      }
    );

  const completed =
    new Set(
      checkpoint.completedUrls || []
    );

  let pagesScanned = 0;
  let vehiclePagesChecked = 0;

  let imported = 0;
  let duplicates = 0;

  let skippedPrice = 0;
  let skippedDate = 0;
  let skippedInvalid = 0;
  let skippedImages = 0;

  let failed = 0;
let consecutiveOldPages = 0;
  console.log("");
  console.log(
    "========================================"
  );
  console.log(
    "OPENDATACAR SUPABASE IMPORT"
  );
  console.log(
    "========================================"
  );
  console.log(
    `Minimum bid: $${MIN_FINAL_BID}`
  );
  console.log(
    `Minimum date: ${MIN_AUCTION_DATE}`
  );
  console.log(
  "Maximum catalog pages: AUTO"
);
  console.log(
    `Delay: ${REQUEST_DELAY_MS} ms`
  );
  console.log(
    "Supabase writes: ENABLED"
  );
  console.log(
    "========================================"
  );

  try {
  const seenCatalogSignatures = new Set();

  for (let page = 1; ; page++) {
      const catalogUrl =
        getCatalogUrl(page);

      console.log("");
      console.log(
        `========== CATALOG PAGE ${page} ==========`
      );

      const catalogHtml =
        await fetchPage(
          catalogUrl
        );

      pagesScanned++;

      const urls =
        getVehicleUrls(
          catalogHtml
        );

      console.log(
        `Vehicle URLs found: ${urls.length}`
      );

      if (urls.length === 0) {
        console.log(
          "No vehicle URLs found. Stopping."
        );

        break;
      }
      const catalogSignature = [...urls]
  .sort()
  .join("|");

if (seenCatalogSignatures.has(catalogSignature)) {
  console.log(
    `Catalog page ${page} repeated a previous page. Stopping.`
  );

  break;
}

seenCatalogSignatures.add(catalogSignature);

      const newUrls = urls.filter(
  (url) => !completed.has(url)
);

console.log(
  `New/unprocessed URLs: ${newUrls.length}`
);


let pageDatedVehicles = 0;
let pageOldVehicles = 0;
     for (const url of urls) {

  // Read the catalog date for EVERY vehicle,
  // including URLs that were already completed.
  // This allows the crawler to correctly detect
  // when an entire catalog page is old.
  const catalogDate =
    getCatalogDateForUrl(
      catalogHtml,
      url
    );

  if (catalogDate !== null) {
    pageDatedVehicles++;

    if (
      catalogDate < MIN_AUCTION_DATE
    ) {
      pageOldVehicles++;
    }
  }

  // In normal mode, completed URLs are skipped.
//
// In IAAI recovery mode, completed URLs are intentionally
// revisited because older runs may have marked IAAI lots
// complete after rejecting their previously unsupported images.
if (
  completed.has(url) &&
  !IAAI_RECOVERY_MODE
) {
  console.log(
    `Already checked: ${url}`
  );

  continue;
}

  const catalogPrice =
    getCatalogPriceForUrl(
      catalogHtml,
      url
    );

// Cheap catalog price filter.
if (
  catalogPrice === null ||
  catalogPrice < MIN_FINAL_BID
) {
  skippedPrice++;

  console.log(
    `CATALOG SKIP price: ${extractVin(url) || url} | $${
      catalogPrice === null
        ? "NONE"
        : catalogPrice
    }`
  );

  continue;
}

// Cheap catalog date filter.
if (
  catalogDate !== null &&
  catalogDate < MIN_AUCTION_DATE
) {
  skippedDate++;

  console.log(
    `CATALOG SKIP old: ${extractVin(url) || url} | ${catalogDate}`
  );

  continue;
}

console.log(
  `CATALOG PASS: ${extractVin(url)} | $${catalogPrice} | ${
    catalogDate || "DATE UNKNOWN"
  }`
);

await sleep(
  REQUEST_DELAY_MS
);

        try {
          const detailUrl = url.replace(
  "https://opendatacar.com/auction/",
  "https://opendatacar.com/en/auction/"
);

const html = await fetchPage(detailUrl);

          vehiclePagesChecked++;

          const car =
            parseVehicle(
              html,
              url
            );

           // IAAI recovery mode:
// revisit checkpointed URLs, but only continue processing
// records that are actually from IAAI.
if (
  IAAI_RECOVERY_MODE &&
  car.auction_source !== "IAAI"
) {
  console.log(
    `RECOVERY SKIP non-IAAI: ${car.vin || url} | ${car.auction_source || "UNKNOWN"}`
  );

  continue;
}

          // --------------------------------
          // DATA QUALITY
          // --------------------------------

          if (
            !car.vin ||
            !car.auction_source ||
            !car.lot_number ||
            !car.auction_date
          ) {
            skippedInvalid++;

           console.log(
  `SKIP invalid: ${car.vin || url} | source=${car.auction_source} | lot=${car.lot_number} | date=${car.auction_date}`
);
          } else if (
            car.final_bid === null ||
            car.final_bid <
              MIN_FINAL_BID
          ) {
            skippedPrice++;

            console.log(
              `SKIP price: ${car.vin} | $${car.final_bid ?? "unknown"}`
            );
          } else if (
  car.auction_date <
    MIN_AUCTION_DATE
) {
  skippedDate++;

  console.log(
    `SKIP old: ${car.vin} | ${car.auction_date}`
  );
} else if (
  car.auction_date >
    new Date().toISOString().slice(0, 10)
) {
  skippedDate++;

  console.log(
    `SKIP future date: ${car.vin} | ${car.auction_date}`
  );
} else {
            car.image_urls =
              await validateImageUrls(
                car.image_urls || []
              );

            if (
              !car.image_urls ||
              car.image_urls.length === 0
            ) {
              skippedImages++;

              console.log(
                `SKIP images: ${car.vin}`
              );
            } else {
              const result =
                await saveToSupabase(
                  car
                );

              if (result.status === "updated") {
  duplicates++;

  console.log(
    `UPDATED: ${car.vin} | ${car.auction_source} ${car.lot_number} | $${car.final_bid} | ${car.auction_date} | images=${car.image_urls.length}`
  );
} else if (result.status === "duplicate") {
  duplicates++;

  console.log(
    `DUPLICATE: ${car.vin} | ${car.auction_source} ${car.lot_number}`
  );
} else {
  imported++;

  console.log(
    `IMPORTED: ${car.vin} | ${car.auction_source} ${car.lot_number} | $${car.final_bid} | ${car.auction_date} | images=${car.image_urls.length}`
  );
}

            }
          }

// Mark URL complete only after processing
          // succeeds without an exception.

          completed.add(url);

          checkpoint.completedUrls =
            [...completed];

          saveJson(
            CHECKPOINT_FILE,
            checkpoint
          );
        } catch (error) {
          if (
            String(
              error.message
            ).includes(
              "RATE_LIMITED"
            )
          ) {
            throw error;
          }

          failed++;

          console.error(
            `FAILED: ${url}`
          );

          console.error(
            error.message
          );
        }
      }
if (
  pageDatedVehicles === urls.length &&
  pageOldVehicles === pageDatedVehicles
) {
  consecutiveOldPages++;

  console.log(
    `Entire catalog page is older than ${MIN_AUCTION_DATE}. ` +
    `Consecutive old pages: ${consecutiveOldPages}`
  );
} else {
  consecutiveOldPages = 0;
}

if (consecutiveOldPages >= 3) {
  console.log("");
  console.log(
   `Reached 3 consecutive catalog pages containing only auctions older than ${MIN_AUCTION_DATE}.`
  );
  console.log(
    "Stopping backfill."
  );

  break;
}
      await sleep(5000);
    }
  } catch (error) {
    console.error("");
    console.error(
      `CRAWLER STOPPED: ${error.message}`
    );
  }

  console.log("");
  console.log(
    "========================================"
  );
  console.log(
    "IMPORT COMPLETE"
  );
  console.log(
    "========================================"
  );

  console.log(
    `Catalog pages scanned: ${pagesScanned}`
  );

  console.log(
    `Vehicle pages checked: ${vehiclePagesChecked}`
  );

  console.log(
    `Imported: ${imported}`
  );

  console.log(
    `Duplicates: ${duplicates}`
  );

 console.log(
  `Skipped below $${MIN_FINAL_BID}: ${skippedPrice}`
);

  console.log(
    `Skipped old date: ${skippedDate}`
  );

  console.log(
    `Skipped invalid: ${skippedInvalid}`
  );

  console.log(
    `Skipped no images: ${skippedImages}`
  );

  console.log(
    `Failed: ${failed}`
  );

  console.log(
    "========================================"
  );
}

main().catch((error) => {
  console.error("");
  console.error(
    "OpenDataCar crawler failed:"
  );
  console.error(error);
  process.exit(1);
});
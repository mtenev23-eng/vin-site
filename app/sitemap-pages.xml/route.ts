import {
  normalizeModelName,
  slugifyModel,
} from "../../utils/vehicle-models";

import { supabase } from "../../utils/supabase/client";

const BASE_URL = "https://salvagevinhistory.com";
const BATCH_SIZE = 1000;
const MIN_MODEL_VEHICLES = 5;

const MAKE_SLUGS: Record<string, string> = {
  TOYOTA: "toyota",
  FORD: "ford",
  HONDA: "honda",
  HYUNDAI: "hyundai",
  BMW: "bmw",
  CHEVROLET: "chevrolet",
  TESLA: "tesla",
  JEEP: "jeep",
  "MERCEDES-BENZ": "mercedes-benz",
  NISSAN: "nissan",
  LEXUS: "lexus",
  KIA: "kia",
  AUDI: "audi",
  DODGE: "dodge",
  VOLKSWAGEN: "volkswagen",
  MAZDA: "mazda",
  "LAND ROVER": "land-rover",
  VOLVO: "volvo",
  MITSUBISHI: "mitsubishi",
  BUICK: "buick",
  CHRYSLER: "chrysler",
};

const BMW_GROUPS = [
  "1 Series",
  "2 Series",
  "3 Series",
  "4 Series",
  "5 Series",
  "6 Series",
  "7 Series",
  "8 Series",
  "Z Series",
  "X Series",
  "M",
];

function getBmwGroup(model: string) {
  const value = normalizeModelName("BMW", model).toUpperCase();

  if (
    value.startsWith("Z3") ||
    value.startsWith("Z4") ||
    value.startsWith("Z8")
  ) {
    return "Z Series";
  }

  if (/^X[1-7]\b/.test(value) || value === "XM") {
    return "X Series";
  }

  if (
    /^M[1-8]\b/.test(value) ||
    value.startsWith("M2") ||
    value.startsWith("M3") ||
    value.startsWith("M4") ||
    value.startsWith("M5") ||
    value.startsWith("M6") ||
    value.startsWith("M8") ||
    value.startsWith("M235") ||
    value.startsWith("M240") ||
    value.startsWith("M340") ||
    value.startsWith("M440") ||
    value.startsWith("M550") ||
    value.startsWith("M850")
  ) {
    return "M";
  }

  if (value.startsWith("1 SERIES") || /^1\d{2}/.test(value)) {
    return "1 Series";
  }

  if (value.startsWith("2 SERIES") || /^2\d{2}/.test(value)) {
    return "2 Series";
  }

  if (value.startsWith("3 SERIES") || /^3\d{2}/.test(value)) {
    return "3 Series";
  }

  if (value.startsWith("4 SERIES") || /^4\d{2}/.test(value)) {
    return "4 Series";
  }

  if (value.startsWith("5 SERIES") || /^5\d{2}/.test(value)) {
    return "5 Series";
  }

  if (value.startsWith("6 SERIES") || /^6\d{2}/.test(value)) {
    return "6 Series";
  }

  if (value.startsWith("7 SERIES") || /^7\d{2}/.test(value)) {
    return "7 Series";
  }

  if (value.startsWith("8 SERIES") || /^8\d{2}/.test(value)) {
    return "8 Series";
  }

  return null;
}

async function fetchAllVehicles() {
  const { count, error: countError } = await supabase
    .from("vehicles")
    .select("*", {
      count: "exact",
      head: true,
    });

  if (countError) {
    console.error(
      "Pages sitemap vehicle count error:",
      countError
    );

    return [];
  }

  const totalRows = count || 0;

  const ranges: {
    from: number;
    to: number;
  }[] = [];

  for (
    let from = 0;
    from < totalRows;
    from += BATCH_SIZE
  ) {
    ranges.push({
      from,
      to: Math.min(
        from + BATCH_SIZE - 1,
        totalRows - 1
      ),
    });
  }

  const allRows: {
    make: string | null;
    model: string | null;
    created_at: string | null;
  }[] = [];

  const CONCURRENT_BATCHES = 8;

  for (
    let i = 0;
    i < ranges.length;
    i += CONCURRENT_BATCHES
  ) {
    const group = ranges.slice(
      i,
      i + CONCURRENT_BATCHES
    );

    const results = await Promise.all(
      group.map(async ({ from, to }) => {
        const { data, error } = await supabase
          .from("vehicles")
          .select("make, model, created_at")
          .order("created_at", {
            ascending: true,
          })
          .range(from, to);

        if (error) {
          throw error;
        }

        return data || [];
      })
    );

    for (const result of results) {
      allRows.push(...result);
    }
  }

  return allRows;
}

export async function GET() {
  const vehicles = await fetchAllVehicles();

  const urls: {
    url: string;
    lastModified?: Date;
  }[] = [
    { url: BASE_URL },
    { url: `${BASE_URL}/vin` },
    { url: `${BASE_URL}/recent-auctions` },
    { url: `${BASE_URL}/faq` },
    { url: `${BASE_URL}/removal-policy` },
  ];

  for (const makeSlug of Object.values(MAKE_SLUGS)) {
    urls.push({
      url: `${BASE_URL}/vehicles/${makeSlug}`,
    });
  }

  const normalModels = new Map<
    string,
    {
      make: string;
      model: string;
      count: number;
      lastModified: Date;
    }
  >();

  const bmwGroups = new Map<
    string,
    {
      count: number;
      lastModified: Date;
    }
  >();

  for (const vehicle of vehicles) {
    if (!vehicle.make || !vehicle.model) {
      continue;
    }

    const make = vehicle.make.toUpperCase();
    const makeSlug = MAKE_SLUGS[make];

    if (!makeSlug) {
      continue;
    }

    const createdAt = vehicle.created_at
      ? new Date(vehicle.created_at)
      : new Date();

    if (make === "BMW") {
      const group = getBmwGroup(vehicle.model);

      if (!group || !BMW_GROUPS.includes(group)) {
        continue;
      }

      const existing = bmwGroups.get(group);

      if (existing) {
        existing.count += 1;

        if (createdAt > existing.lastModified) {
          existing.lastModified = createdAt;
        }
      } else {
        bmwGroups.set(group, {
          count: 1,
          lastModified: createdAt,
        });
      }

      continue;
    }

    const normalizedModel = normalizeModelName(
      make,
      vehicle.model
    );

    const key = `${make}|${normalizedModel.toUpperCase()}`;
    const existing = normalModels.get(key);

    if (existing) {
      existing.count += 1;

      if (createdAt > existing.lastModified) {
        existing.lastModified = createdAt;
      }
    } else {
      normalModels.set(key, {
        make,
        model: normalizedModel,
        count: 1,
        lastModified: createdAt,
      });
    }
  }

  for (const item of normalModels.values()) {
    if (item.count < MIN_MODEL_VEHICLES) {
      continue;
    }

    urls.push({
      url: `${BASE_URL}/vehicles/${MAKE_SLUGS[item.make]}/${slugifyModel(
        item.model
      )}`,
      lastModified: item.lastModified,
    });
  }

  for (const [group, item] of bmwGroups.entries()) {
    if (item.count < MIN_MODEL_VEHICLES) {
      continue;
    }

    urls.push({
      url: `${BASE_URL}/vehicles/bmw/${slugifyModel(group)}`,
      lastModified: item.lastModified,
    });
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (item) => `  <url>
    <loc>${item.url}</loc>${
      item.lastModified
        ? `
    <lastmod>${item.lastModified.toISOString()}</lastmod>`
        : ""
    }
  </url>`
  )
  .join("\n")}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
    },
  });
}
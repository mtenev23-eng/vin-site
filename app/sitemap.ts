import { MetadataRoute } from "next";
import { supabase } from "../utils/supabase/client";

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

function displayModel(model: string) {
  const mappings: Record<string, string> = {
    "2ER": "2 Series",
    "3ER": "3 Series",
    "4ER": "4 Series",
    "5ER": "5 Series",
    "6ER": "6 Series",
    "7ER": "7 Series",
    "8ER": "8 Series",

    "A-KLASSE": "A-Class",
    "B-KLASSE": "B-Class",
    "C-KLASSE": "C-Class",
    "E-KLASSE": "E-Class",
    "G-KLASSE": "G-Class",
    "S-KLASSE": "S-Class",
    "CLA-KLASSE": "CLA-Class",
    "CLS-KLASSE": "CLS-Class",
    "GLA-KLASSE": "GLA-Class",
    "GLB-KLASSE": "GLB-Class",
    "GLC-KLASSE": "GLC-Class",
    "GLE-KLASSE": "GLE-Class",
    "GLS-KLASSE": "GLS-Class",
    "SL-KLASSE": "SL-Class",
  };

  return mappings[model.toUpperCase()] || model;
}

function slugifyModel(model: string) {
  return model
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
async function fetchAllRows(
  table: string,
  columns: string
): Promise<any[]> {
  const allRows: any[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(from, from + BATCH_SIZE - 1);

    if (error) {
      console.error(`Sitemap ${table} error:`, error);
      break;
    }

    if (!data || data.length === 0) {
      break;
    }

    allRows.push(...data);

    if (data.length < BATCH_SIZE) {
      break;
    }

    from += BATCH_SIZE;
  }

  return allRows;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [vehicles, lots] = await Promise.all([
    fetchAllRows("vehicles", "vin, make, model, created_at"),
    fetchAllRows(
      "auction_lots",
      "auction_source, lot_number, created_at"
    ),
  ]);

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },

    {
  url: `${BASE_URL}/vin`,
  lastModified: new Date(),
  changeFrequency: "daily",
  priority: 0.9,
},
    {
      url: `${BASE_URL}/recent-auctions`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/faq`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/removal-policy`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];

 const makes = [
  "toyota",
  "ford",
  "honda",
  "hyundai",
  "bmw",
  "chevrolet",
  "tesla",
  "jeep",
  "mercedes-benz",
  "nissan",
  "lexus",
  "kia",
  "audi",
  "dodge",
  "volkswagen",
  "mazda",
  "land-rover",
  "volvo",
  "mitsubishi",
  "buick",
  "chrysler",
];

  const makePages: MetadataRoute.Sitemap = makes.map((make) => ({
    url: `${BASE_URL}/recent-auctions/${make}`,
    lastModified: new Date(),
    changeFrequency: "daily",
    priority: 0.7,
  }));
const vehicleMakePages: MetadataRoute.Sitemap = makes.map(
  (make) => ({
    url: `${BASE_URL}/vehicles/${make}`,
    lastModified: new Date(),
    changeFrequency: "daily",
    priority: 0.8,
  })
);

const modelCounts = new Map<
  string,
  {
    make: string;
    model: string;
    count: number;
    lastModified: Date;
  }
>();

for (const vehicle of vehicles) {
  if (!vehicle.make || !vehicle.model) {
    continue;
  }

  const make = String(vehicle.make).toUpperCase();
  const model = String(vehicle.model).trim();
  const makeSlug = MAKE_SLUGS[make];

  if (!makeSlug || !model) {
    continue;
  }

  const key = `${make}|${model.toUpperCase()}`;
  const createdAt = vehicle.created_at
    ? new Date(vehicle.created_at)
    : new Date();

  const existing = modelCounts.get(key);

  if (existing) {
    existing.count += 1;

    if (createdAt > existing.lastModified) {
      existing.lastModified = createdAt;
    }
  } else {
    modelCounts.set(key, {
      make,
      model,
      count: 1,
      lastModified: createdAt,
    });
  }
}

const vehicleModelPages: MetadataRoute.Sitemap = Array.from(
  modelCounts.values()
)
  .filter((item) => item.count >= MIN_MODEL_VEHICLES)
  .map((item) => ({
    url: `${BASE_URL}/vehicles/${MAKE_SLUGS[item.make]}/${slugifyModel(
      displayModel(item.model)
    )}`,
    lastModified: item.lastModified,
    changeFrequency: "daily" as const,
    priority: 0.8,
  }));

  const vinPages: MetadataRoute.Sitemap = vehicles
    .filter((vehicle) => vehicle.vin)
    .map((vehicle) => ({
      url: `${BASE_URL}/vin/${vehicle.vin}`,
      lastModified: vehicle.created_at
        ? new Date(vehicle.created_at)
        : new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    }));

  const lotPages: MetadataRoute.Sitemap = lots
    .filter(
      (lot) =>
        lot.auction_source &&
        lot.lot_number &&
        ["COPART", "IAAI"].includes(
          lot.auction_source.toUpperCase()
        )
    )
    .map((lot) => ({
      url: `${BASE_URL}/lot/${lot.auction_source.toLowerCase()}/${lot.lot_number}`,
      lastModified: lot.created_at
        ? new Date(lot.created_at)
        : new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    }));

  return [
  ...staticPages,
  ...makePages,
  ...vehicleMakePages,
  ...vehicleModelPages,
  ...vinPages,
  ...lotPages,
];
}
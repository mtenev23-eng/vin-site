import { MetadataRoute } from "next";
import { supabase } from "../utils/supabase/client";

const BASE_URL = "https://salvagevinhistory.com";
const BATCH_SIZE = 1000;

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
    fetchAllRows("vehicles", "vin, created_at"),
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

const vehicleModelPages: MetadataRoute.Sitemap = [
  {
    url: `${BASE_URL}/vehicles/bmw/m4`,
    lastModified: new Date(),
    changeFrequency: "daily",
    priority: 0.8,
  },
];

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

import { supabase } from "../../utils/supabase/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const BASE_URL = "https://salvagevinhistory.com";
const SITEMAP_SIZE = 1000;

export async function GET() {
  const [
    { count: vehicleCount, error: vehicleError },
    { data: latestLots, error: lotError },
  ] = await Promise.all([
    supabase
      .from("sitemap_vins")
      .select("*", {
        count: "exact",
        head: true,
      }),

    supabase
      .from("auction_lots")
      .select("id")
      .in("auction_source", ["COPART", "IAAI"])
      .order("id", { ascending: false })
      .limit(1),
  ]);

  if (vehicleError || lotError) {
    console.error(
      "Sitemap index error:",
      vehicleError || lotError
    );

    return new Response(
      "Could not generate sitemap index",
      {
        status: 500,
      }
    );
  }

  const maxLotId = latestLots?.[0]?.id || 0;

  const vinSitemapCount = Math.ceil(
    (vehicleCount || 0) / SITEMAP_SIZE
  );

  const lotSitemapCount = Math.ceil(
    maxLotId / SITEMAP_SIZE
  );

  const sitemapUrls = [
    `${BASE_URL}/sitemap-pages.xml`,

    ...Array.from(
      { length: vinSitemapCount },
      (_, index) =>
        `${BASE_URL}/sitemap-vins/${index + 1}`
    ),

    ...Array.from(
      { length: lotSitemapCount },
      (_, index) =>
        `${BASE_URL}/sitemap-lots/${index + 1}`
    ),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapUrls
  .map(
    (url) => `  <sitemap>
    <loc>${url}</loc>
  </sitemap>`
  )
  .join("\n")}
</sitemapindex>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
    },
  });
}

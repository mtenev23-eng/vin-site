import { supabase } from "../../utils/supabase/client";

const BASE_URL = "https://salvagevinhistory.com";
const SITEMAP_SIZE = 1000;

export async function GET() {
  const [
    { count: vehicleCount, error: vehicleError },
    { count: lotCount, error: lotError },
  ] = await Promise.all([
    supabase
      .from("vehicles")
      .select("*", {
        count: "exact",
        head: true,
      }),

    supabase
      .from("auction_lots")
      .select("*", {
        count: "exact",
        head: true,
      })
      .in("auction_source", ["COPART", "IAAI"]),
  ]);

  if (vehicleError || lotError) {
    console.error(
      "Sitemap index count error:",
      vehicleError || lotError
    );

    return new Response(
      "Could not generate sitemap index",
      {
        status: 500,
      }
    );
  }

  const vinSitemapCount = Math.ceil(
    (vehicleCount || 0) / SITEMAP_SIZE
  );

  const lotSitemapCount = Math.ceil(
    (lotCount || 0) / SITEMAP_SIZE
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
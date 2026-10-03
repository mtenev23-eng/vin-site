import { supabase } from "../../../utils/supabase/client";

const BASE_URL = "https://salvagevinhistory.com";
const SITEMAP_SIZE = 1000;

export async function GET(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ page: string }>;
  }
) {
  const { page } = await params;

  const pageNumber = Number(page);

  if (
    !Number.isInteger(pageNumber) ||
    pageNumber < 1
  ) {
    return new Response("Invalid sitemap page", {
      status: 404,
    });
  }

  const from =
    (pageNumber - 1) * SITEMAP_SIZE;

  const to =
    from + SITEMAP_SIZE - 1;

  const { data: vehicles, error } =
    await supabase
      .from("vehicles")
      .select("vin, created_at")
      .not("vin", "is", null)
      .order("vin", { ascending: true })
      .range(from, to);

  if (error) {
    console.error(
      `VIN sitemap ${pageNumber} error:`,
      error
    );

    return new Response(
      "Could not generate sitemap",
      {
        status: 500,
      }
    );
  }

  if (!vehicles || vehicles.length === 0) {
    return new Response("Sitemap not found", {
      status: 404,
    });
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${vehicles
  .map(
    (vehicle) => `  <url>
    <loc>${BASE_URL}/vin/${vehicle.vin}</loc>${
      vehicle.created_at
        ? `
    <lastmod>${new Date(
      vehicle.created_at
    ).toISOString()}</lastmod>`
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
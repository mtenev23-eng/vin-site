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

  const { data: lots, error } =
    await supabase
      .from("auction_lots")
      .select(
  "id, auction_source, lot_number, created_at"
)
.in("auction_source", ["COPART", "IAAI"])
.order("id", {
  ascending: true,
})
.range(from, to);
  if (error) {
    console.error(
      `Lot sitemap ${pageNumber} error:`,
      error
    );

    return new Response(
      "Could not generate sitemap",
      {
        status: 500,
      }
    );
  }

  if (!lots || lots.length === 0) {
    return new Response("Sitemap not found", {
      status: 404,
    });
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${lots
  .map(
    (lot) => `  <url>
    <loc>${BASE_URL}/lot/${lot.auction_source.toLowerCase()}/${lot.lot_number}</loc>${
      lot.created_at
        ? `
    <lastmod>${new Date(
      lot.created_at
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
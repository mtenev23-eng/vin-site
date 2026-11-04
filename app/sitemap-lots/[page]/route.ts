import { supabase } from "../../../utils/supabase/client";

const BASE_URL = "https://salvagevinhistory.com";
const SITEMAP_SIZE = 1000;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ page: string }> }
) {
  const { page } = await params;
  const pageNumber = Number(page);

  if (!/^\d+$/.test(page) || !Number.isSafeInteger(pageNumber) || pageNumber < 1) {
    return new Response("Invalid sitemap page", { status: 404 });
  }

  const fromId = (pageNumber - 1) * SITEMAP_SIZE + 1;
  const toId = pageNumber * SITEMAP_SIZE;

  if (!Number.isSafeInteger(fromId) || !Number.isSafeInteger(toId)) {
    return new Response("Invalid sitemap page", { status: 404 });
  }

  const { data: lots, error } = await supabase
    .from("auction_lots")
    .select("id, auction_source, lot_number")
    .gte("id", fromId)
    .lte("id", toId)
    .in("auction_source", ["COPART", "IAAI"])
    .order("id", { ascending: true });

  if (error) {
    console.error(`Lot sitemap ${pageNumber} error:`, error);
    return new Response("Could not generate sitemap", {
      status: 500,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const urls = (lots || []).flatMap((lot) => {
    const source = String(lot.auction_source || "").toLowerCase();
    const number = String(lot.lot_number ?? "").trim();
    if (!(["copart", "iaai"].includes(source) && /^[A-Za-z0-9_-]+$/.test(number))) {
      return [];
    }
    return [`${BASE_URL}/lot/${source}/${number}`];
  });

  if (urls.length === 0) {
    return new Response("Sitemap not found", { status: 404 });
  }

  // Omit lastmod until a reliable content-update timestamp is available.
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `  <url>\n    <loc>${url}</loc>\n  </url>`).join("\n")}
</urlset>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}

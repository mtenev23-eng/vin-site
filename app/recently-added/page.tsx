
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase } from "../../utils/supabase/client";

const PAGE_SIZE = 24;
const MAX_ARCHIVE_PAGES = 300;
const BASE_URL = "https://salvagevinhistory.com";

type SearchParams = Promise<{ page?: string }>;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { page } = await searchParams;
  const pageNumber = Number(page || "1");

  const currentPage =
    Number.isSafeInteger(pageNumber) && pageNumber > 0
      ? pageNumber
      : 1;

  const title =
    currentPage === 1
      ? "Recently Added Vehicle Auction Records"
      : `Recently Added Vehicle Auctions - Page ${currentPage}`;

  const description =
    "Browse the latest vehicle auction records added to Salvage VIN History. Explore Copart and IAAI auction lots, VINs, vehicle details and historical sales.";

  const canonical =
    currentPage === 1
      ? `${BASE_URL}/recently-added`
      : `${BASE_URL}/recently-added?page=${currentPage}`;

  return {
    title,
    description,
    alternates: { canonical },
    robots: {
  index: currentPage <= 10,
  follow: true,
},
  };
}

export default async function RecentlyAddedPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { page } = await searchParams;
  const currentPage = Number(page || "1");

  if (
    !Number.isSafeInteger(currentPage) ||
    currentPage < 1 ||
    currentPage > MAX_ARCHIVE_PAGES
  ) {
    notFound();
  }

  const from = (currentPage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data: lots, error, count } = await supabase
    .from("auction_lots")
    .select(
      "id, vin, auction_source, lot_number, created_at",
      { count: "exact" }
    )
    .in("auction_source", ["COPART", "IAAI"])
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, to);

  if (error) {
    console.error("Recently added archive error:", error);

    return (
      <main style={{ padding: "48px 24px" }}>
        <h1>Recently Added Vehicle Auctions</h1>
        <p>Could not load auction records.</p>
      </main>
    );
  }

  const totalRecords = count || 0;
  const totalPages = Math.max(
    1,
    Math.min(
      MAX_ARCHIVE_PAGES,
      Math.ceil(totalRecords / PAGE_SIZE)
    )
  );

  if (currentPage > totalPages) {
    notFound();
  }

  const vins = [...new Set((lots || []).map((lot) => lot.vin))];

  const { data: vehicles, error: vehicleError } =
    vins.length > 0
      ? await supabase
          .from("vehicles")
          .select("vin, year, make, model")
          .in("vin", vins)
      : { data: [], error: null };

  if (vehicleError) {
    console.error("Recently added vehicle lookup error:", vehicleError);
  }

  const vehicleMap = new Map(
    (vehicles || []).map((vehicle) => [vehicle.vin, vehicle])
  );

  const pageHref = (number: number) =>
    number === 1
      ? "/recently-added"
      : `/recently-added?page=${number}`;

  const visiblePages = Array.from(
    new Set([
      1,
      2,
      currentPage - 2,
      currentPage - 1,
      currentPage,
      currentPage + 1,
      currentPage + 2,
      totalPages - 1,
      totalPages,
    ])
  )
    .filter((number) => number >= 1 && number <= totalPages)
    .sort((a, b) => a - b);

  return (
    <main
      style={{
        background: "#f6f7f8",
        minHeight: "100vh",
        color: "#171717",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <section
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "48px 24px 80px",
        }}
      >
        <h1 style={{ fontSize: "38px", margin: "0 0 12px" }}>
          Recently Added to Our Archive
        </h1>

        <p
          style={{
            color: "#666",
            lineHeight: 1.7,
            marginBottom: "18px",
          }}
        >
          Explore the newest vehicle auction records added to
          Salvage VIN History, including historical Copart and
          IAAI auction lots.
        </p>

        <p style={{ marginBottom: "32px" }}>
          <Link href="/recent-auctions">
            Browse by auction date →
          </Link>
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(250px, 1fr))",
            gap: "16px",
          }}
        >
          {(lots || []).map((lot) => {
            const vehicle = vehicleMap.get(lot.vin);

            const vehicleName = [
              vehicle?.year,
              vehicle?.make,
              vehicle?.model,
            ]
              .filter(Boolean)
              .join(" ");

            const lotUrl =
              `/lot/${lot.auction_source.toLowerCase()}/` +
              lot.lot_number;

            return (
              <article
                key={`${lot.auction_source}-${lot.lot_number}`}
                style={{
                  background: "#fff",
                  border: "1px solid #e1e1e1",
                  borderRadius: "10px",
                  padding: "18px",
                }}
              >
                <div
                  style={{
                    color: "#777",
                    fontSize: "12px",
                    marginBottom: "8px",
                  }}
                >
                  {lot.auction_source} · Lot #{lot.lot_number}
                </div>

                <h2
                  style={{
                    fontSize: "18px",
                    margin: "0 0 14px",
                  }}
                >
                  <Link
                    href={lotUrl}
                    prefetch={false}
                    style={{
                      color: "#171717",
                      textDecoration: "none",
                    }}
                  >
                    {vehicleName || `VIN ${lot.vin}`}
                  </Link>
                </h2>

                <Link
                  href={`/vin/${lot.vin}`}
                  prefetch={false}
                  style={{
                    color: "#555",
                    fontSize: "13px",
                    overflowWrap: "anywhere",
                  }}
                >
                  VIN: {lot.vin}
                </Link>

                {lot.created_at && (
                  <p
                    style={{
                      fontSize: "12px",
                      color: "#777",
                      margin: "12px 0 0",
                    }}
                  >
                    Added{" "}
                    {new Date(lot.created_at).toLocaleDateString(
                      "en-US",
                      {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        timeZone: "UTC",
                      }
                    )}
                  </p>
                )}
              </article>
            );
          })}
        </div>

        {totalPages > 1 && (
          <nav
            aria-label="Recently added pagination"
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: "10px",
              flexWrap: "wrap",
              marginTop: "40px",
            }}
          >
            {currentPage > 1 && (
              <Link href={pageHref(currentPage - 1)}>
                ← Previous
              </Link>
            )}

            {visiblePages.map((number, index) => (
              <span key={number}>
                {index > 0 &&
                  number - visiblePages[index - 1] > 1 &&
                  " … "}

                {number === currentPage ? (
                  <strong style={{ margin: "0 8px" }}>
                    {number}
                  </strong>
                ) : (
                  <Link
                    href={pageHref(number)}
                    style={{ margin: "0 8px" }}
                  >
                    {number}
                  </Link>
                )}
              </span>
            ))}

            {currentPage < totalPages && (
              <Link href={pageHref(currentPage + 1)}>
                Next →
              </Link>
            )}
          </nav>
        )}
      </section>
    </main>
  );
}

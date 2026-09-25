import Link from "next/link";
import { supabase } from "../../utils/supabase/client";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;

  const requestedPage = Number(params.page || "1");

  const currentPage =
    Number.isInteger(requestedPage) && requestedPage > 0
      ? requestedPage
      : 1;

  const canonical =
    currentPage === 1
      ? "https://salvagevinhistory.com/recent-auctions"
      : `https://salvagevinhistory.com/recent-auctions?page=${currentPage}`;

  const title =
    currentPage === 1
      ? "Recent Copart & IAAI Auction Sales"
      : `Recent Copart & IAAI Auction Sales - Page ${currentPage}`;

  const description =
    currentPage === 1
      ? "Browse recently archived Copart and IAAI vehicle auction sales. View VINs, final bids, auction dates, damage information and historical auction records."
      : `Browse page ${currentPage} of recently archived Copart and IAAI vehicle auction sales with VINs, final bids, auction dates, damage information and vehicle history.`;

  return {
    title,
    description,

    alternates: {
      canonical,
    },

    robots: {
      index: true,
      follow: true,
    },

    openGraph: {
      title,
      description,
      url: canonical,
      type: "website",
      siteName: "Salvage VIN History",
    },
  };
}
const PAGE_SIZE = 24;

function formatPrice(price: number | null) {
  if (price === null) {
    return "Price unavailable";
  }

  return `$${price.toLocaleString()}`;
}

function formatDate(date: string | null) {
  if (!date) {
    return "Date unavailable";
  }

  return new Date(`${date}T00:00:00`).toLocaleDateString(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    }
  );
}

export default async function RecentAuctionsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;

  const requestedPage = Number(params.page || "1");

  const currentPage =
    Number.isInteger(requestedPage) && requestedPage > 0
      ? requestedPage
      : 1;

  const from = (currentPage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const {
    data: lots,
    error,
    count,
  } = await supabase
    .from("auction_lots")
    .select(
      `
        id,
        auction_source,
        lot_number,
        vin,
        final_bid,
        auction_date,
        mileage,
        primary_damage,
        image_urls
      `,
      { count: "exact" }
    )
    .not("auction_date", "is", null)
    .order("auction_date", {
      ascending: false,
    })
    .order("id", {
      ascending: false,
    })
    .range(from, to);

  if (error) {
    console.error("Auction archive error:", error);

    return (
      <main
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "50px 24px",
        }}
      >
        <h1>Recent Auction Sales</h1>
        <p>Could not load auction records.</p>
      </main>
    );
  }

  const vins = [
    ...new Set((lots || []).map((lot) => lot.vin)),
  ];

  const { data: vehicles } =
    vins.length > 0
      ? await supabase
          .from("vehicles")
          .select("vin, year, make, model")
          .in("vin", vins)
      : { data: [] };

  const vehicleMap = new Map(
    (vehicles || []).map((vehicle) => [
      vehicle.vin,
      vehicle,
    ])
  );

  const totalRecords = count || 0;
  const totalPages = Math.max(
    1,
    Math.ceil(totalRecords / PAGE_SIZE)
  );

  const paginationPages = Array.from(
  new Set([
    1,
    2,
    3,
    currentPage - 2,
    currentPage - 1,
    currentPage,
    currentPage + 1,
    currentPage + 2,
    totalPages - 2,
    totalPages - 1,
    totalPages,
  ])
)
  .filter((page) => page >= 1 && page <= totalPages)
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
          padding: "48px 24px 70px",
        }}
      >
        <div style={{ marginBottom: "30px" }}>
          <div
            style={{
              fontSize: "12px",
              fontWeight: "bold",
              textTransform: "uppercase",
              letterSpacing: "1px",
              color: "#666",
              marginBottom: "8px",
            }}
          >
            Auction Archive
          </div>

          <h1
            style={{
              fontSize: "38px",
              margin: "0 0 10px",
            }}
          >
            Recent Auction Sales
          </h1>

          <p
            style={{
              color: "#666",
              fontSize: "16px",
              lineHeight: 1.6,
              margin: 0,
            }}
          >
            Browse archived Copart and IAAI vehicle
            auction records by VIN, lot number and
            auction date.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(250px, 1fr))",
            gap: "20px",
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

            const lotUrl = `/lot/${lot.auction_source.toLowerCase()}/${lot.lot_number}`;

            return (
              <article
                key={`${lot.auction_source}-${lot.lot_number}`}
                style={{
                  background: "#ffffff",
                  border: "1px solid #e1e1e1",
                  borderRadius: "12px",
                  overflow: "hidden",
                }}
              >
                <Link
                  href={lotUrl}
                  style={{
                    color: "inherit",
                    textDecoration: "none",
                  }}
                >
                  <div
                    style={{
                      height: "190px",
                      background: "#e9e9e9",
                    }}
                  >
                    {lot.image_urls &&
                    lot.image_urls.length > 0 ? (
                      <img
                        src={lot.image_urls[0]}
                        alt={
                          vehicleName ||
                          `Auction lot ${lot.lot_number}`
                        }
                        loading="lazy"
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          display: "block",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          height: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#777",
                        }}
                      >
                        No photo available
                      </div>
                    )}
                  </div>
                </Link>

                <div style={{ padding: "18px" }}>
                  <div
                    style={{
                      fontSize: "12px",
                      fontWeight: "bold",
                      color: "#666",
                      marginBottom: "7px",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                    }}
                  >
                    {lot.auction_source} •{" "}
                    {formatDate(lot.auction_date)}
                  </div>

                  <Link
                    href={lotUrl}
                    style={{
                      color: "#171717",
                      textDecoration: "none",
                    }}
                  >
                    <h2
                      style={{
                        fontSize: "19px",
                        lineHeight: 1.3,
                        margin: "0 0 14px",
                      }}
                    >
                      {vehicleName || `VIN ${lot.vin}`}
                    </h2>
                  </Link>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "12px",
                      alignItems: "flex-end",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: "12px",
                          color: "#777",
                          marginBottom: "3px",
                        }}
                      >
                        Final Bid
                      </div>

                      <strong style={{ fontSize: "19px" }}>
                        {formatPrice(lot.final_bid)}
                      </strong>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <div
                        style={{
                          fontSize: "12px",
                          color: "#777",
                          marginBottom: "3px",
                        }}
                      >
                        Lot
                      </div>

                      <strong>#{lot.lot_number}</strong>
                    </div>
                  </div>

                  <div
                    style={{
                      borderTop: "1px solid #eeeeee",
                      marginTop: "16px",
                      paddingTop: "13px",
                      fontSize: "13px",
                      color: "#666",
                    }}
                  >
                    <div>
                      VIN:{" "}
                      <Link
                        href={`/vin/${lot.vin}`}
                        style={{
                          color: "#171717",
                          fontWeight: "600",
                          textDecoration: "underline",
                        }}
                      >
                        {lot.vin}
                      </Link>
                    </div>

                    {lot.primary_damage && (
                      <div style={{ marginTop: "6px" }}>
                        Damage: {lot.primary_damage}
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <div
  style={{
    marginTop: "40px",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
  }}
>
  {currentPage > 1 && (
    <Link
      href={
        currentPage === 2
          ? "/recent-auctions"
          : `/recent-auctions?page=${currentPage - 1}`
      }
      style={{
        padding: "10px 14px",
        border: "1px solid #ccc",
        borderRadius: "7px",
        background: "#ffffff",
        color: "#171717",
        textDecoration: "none",
        fontWeight: "600",
        fontSize: "14px",
      }}
    >
      ← Previous
    </Link>
  )}

  {paginationPages.map((page, index) => {
    const previousPage = paginationPages[index - 1];
    const showEllipsis =
      previousPage && page - previousPage > 1;

    const href =
      page === 1
        ? "/recent-auctions"
        : `/recent-auctions?page=${page}`;

    return (
      <span
        key={page}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        {showEllipsis && (
          <span
            style={{
              color: "#777",
              padding: "0 3px",
            }}
          >
            …
          </span>
        )}

        {page === currentPage ? (
          <span
            style={{
              padding: "10px 14px",
              border: "1px solid #171717",
              borderRadius: "7px",
              background: "#171717",
              color: "#ffffff",
              fontWeight: "700",
              fontSize: "14px",
            }}
          >
            {page}
          </span>
        ) : (
          <Link
            href={href}
            style={{
              padding: "10px 14px",
              border: "1px solid #ccc",
              borderRadius: "7px",
              background: "#ffffff",
              color: "#171717",
              textDecoration: "none",
              fontWeight: "600",
              fontSize: "14px",
            }}
          >
            {page}
          </Link>
        )}
      </span>
    );
  })}

  {currentPage < totalPages && (
    <Link
      href={`/recent-auctions?page=${currentPage + 1}`}
      style={{
        padding: "10px 14px",
        border: "1px solid #ccc",
        borderRadius: "7px",
        background: "#ffffff",
        color: "#171717",
        textDecoration: "none",
        fontWeight: "600",
        fontSize: "14px",
      }}
    >
      Next →
    </Link>
  )}
</div>
      </section>
    </main>
  );
}
import Link from "next/link";
import type { Metadata } from "next";
import { supabase } from "../../utils/supabase/client";

const PAGE_SIZE = 24;

type Vehicle = {
  vin: string;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
};

type AuctionLot = {
  id: number;
  vin: string;
  auction_source: string;
  lot_number: string;
  final_bid: number | null;
  auction_date: string | null;
  mileage: number | null;
  primary_damage: string | null;
  image_urls: string[] | null;
};

type VehicleArchiveItem = {
  vehicle: Vehicle;
  lots: AuctionLot[];
};

function formatDate(value: string | null) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(`${value}T00:00:00`);

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatBid(value: number | null) {
  if (value === null) {
    return "Not available";
  }

  return `$${value.toLocaleString()}`;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{
  page?: string;
  q?: string;
}>;
}): Promise<Metadata> {
  const params = await searchParams;

  const requestedPage = Number(params.page || "1");
  const currentPage =
    Number.isFinite(requestedPage) && requestedPage > 0
      ? Math.floor(requestedPage)
      : 1;

  const canonicalUrl =
    currentPage === 1
      ? "https://salvagevinhistory.com/vin"
      : `https://salvagevinhistory.com/vin?page=${currentPage}`;

  const title =
    currentPage === 1
      ? "Browse Vehicle VIN Auction History"
      : `Browse Vehicle VIN Auction History - Page ${currentPage}`;

  const description =
    currentPage === 1
      ? "Browse archived vehicle auction history by VIN. View historical Copart and IAAI auction records, photos, sale prices, mileage and damage information."
      : `Browse archived vehicle auction history by VIN on page ${currentPage}. View historical Copart and IAAI auction records, photos, sale prices, mileage and damage information.`;

  return {
    title,
    description,

    alternates: {
      canonical: canonicalUrl,
    },

    robots: {
      index: true,
      follow: true,
    },

    openGraph: {
      title,
      description,
      url: canonicalUrl,
      type: "website",
      siteName: "Salvage VIN History",
    },

    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function VinArchivePage({
  searchParams,
}: {
  searchParams: Promise<{
  page?: string;
  q?: string;
}>;
}) {
  const params = await searchParams;

const searchQuery = params.q?.trim() || "";

const requestedPage = Number(params.page || "1");

  const currentPage =
    Number.isFinite(requestedPage) && requestedPage > 0
      ? Math.floor(requestedPage)
      : 1;

  const from = (currentPage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

 

let vehicleQuery = supabase
  .from("vehicles")
  .select("vin, year, make, model, trim", {
    count: "exact",
  });

if (searchQuery) {
  const searchTerms = searchQuery
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  for (const term of searchTerms) {
    if (/^\d{4}$/.test(term)) {
      vehicleQuery = vehicleQuery.eq(
        "year",
        Number(term)
      );
    } else {
      vehicleQuery = vehicleQuery.or(
        `make.ilike.%${term}%,model.ilike.%${term}%,trim.ilike.%${term}%`
      );
    }
  }
}

const {
  data: vehicles,
  count,
  error: vehicleError,
} = await vehicleQuery
  .order("created_at", {
    ascending: false,
  })
  .range(from, to);

if (vehicleError) {
  console.error(
    "VIN archive vehicle error:",
    vehicleError
  );
}

  const vehicleList = (vehicles || []) as Vehicle[];
  const vins = vehicleList.map((vehicle) => vehicle.vin);

  let lots: AuctionLot[] = [];

  if (vins.length > 0) {
    const { data: lotData, error: lotError } = await supabase
      .from("auction_lots")
      .select(
        "id, vin, auction_source, lot_number, final_bid, auction_date, mileage, primary_damage, image_urls"
      )
      .in("vin", vins)
      .order("auction_date", {
        ascending: false,
      })
      .order("id", {
        ascending: false,
      });

    if (lotError) {
      console.error("VIN archive lot error:", lotError);
    }

    lots = (lotData || []) as AuctionLot[];
  }

  const archiveItems: VehicleArchiveItem[] =
    vehicleList.map((vehicle) => ({
      vehicle,
      lots: lots.filter((lot) => lot.vin === vehicle.vin),
    }));

  const totalVehicles = count || 0;
  const totalPages = Math.max(
    1,
    Math.ceil(totalVehicles / PAGE_SIZE)
  );
const buildPageUrl = (page: number) => {
  const params = new URLSearchParams();

  if (searchQuery) {
    params.set("q", searchQuery);
  }

  if (page > 1) {
    params.set("page", String(page));
  }

  const queryString = params.toString();

  return queryString
    ? `/vin?${queryString}`
    : "/vin";
};

  const pageNumbers = Array.from(
    { length: totalPages },
    (_, index) => index + 1
  ).filter(
    (page) =>
      page <= 3 ||
      page > totalPages - 3 ||
      Math.abs(page - currentPage) <= 2
  );

  const paginationItems: Array<number | "ellipsis"> = [];

  pageNumbers.forEach((page, index) => {
    const previousPage = pageNumbers[index - 1];

    if (
      previousPage &&
      page - previousPage > 1
    ) {
      paginationItems.push("ellipsis");
    }

    paginationItems.push(page);
  });

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#ffffff",
        color: "#171717",
        fontFamily: "Arial, sans-serif",
      }}
    >
      {/* HERO */}

      <section
        style={{
          background: "#f6f7f8",
          borderBottom: "1px solid #e8e8e8",
        }}
      >
        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            padding: "55px 24px 50px",
          }}
        >
          <div
            style={{
              fontSize: "13px",
              fontWeight: "bold",
              textTransform: "uppercase",
              letterSpacing: "1px",
              color: "#777",
              marginBottom: "12px",
            }}
          >
            Vehicle Auction Archive
          </div>

          <h1
            style={{
              fontSize: "42px",
              lineHeight: 1.1,
              margin: "0 0 14px",
              letterSpacing: "-0.5px",
            }}
          >
            Browse VIN History
          </h1>

          <p
            style={{
              margin: 0,
              maxWidth: "760px",
              color: "#5f5f5f",
              fontSize: "16px",
              lineHeight: 1.7,
            }}
          >
            Browse archived vehicle auction history by VIN.
            Each vehicle history page brings together available
            Copart and IAAI auction records, including archived
            photos, sale information, mileage and reported damage.
          </p>
        </div>
      </section>

      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "38px 24px 80px",
        }}
      >
        {/* RESULT COUNT */}

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "20px",
            flexWrap: "wrap",
            marginBottom: "24px",
          }}
        >
          <div>
            <h2
              style={{
                fontSize: "26px",
                margin: "0 0 5px",
              }}
            >
              Vehicle History Archive
            </h2>

            <div
              style={{
                color: "#777",
                fontSize: "14px",
              }}
            >
              {totalVehicles.toLocaleString()} archived vehicles
            </div>
          </div>

          <div
            style={{
              color: "#777",
              fontSize: "14px",
            }}
          >
            Page {currentPage} of {totalPages}
          </div>
        </div>

        {/* VEHICLE CARDS */}

        <section
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "18px",
          }}
        >
          {archiveItems.map(({ vehicle, lots }) => {
            const latestLot = lots[0] || null;

            const vehicleName = [
              vehicle.year,
              vehicle.make,
              vehicle.model,
            ]
              .filter(Boolean)
              .join(" ");

            const firstImage =
              latestLot?.image_urls &&
              latestLot.image_urls.length > 0
                ? latestLot.image_urls[0]
                : null;

            return (
              <article
                key={vehicle.vin}
                style={{
                  border: "1px solid #e2e2e2",
                  borderRadius: "10px",
                  overflow: "hidden",
                  background: "#ffffff",
                }}
              >
                {firstImage && (
                  <Link
                    href={`/vin/${vehicle.vin}`}
                    style={{
                      display: "block",
                      background: "#f3f3f3",
                    }}
                  >
                    <img
                      src={firstImage}
                      alt={`${vehicleName || vehicle.vin} auction vehicle`}
                      loading="lazy"
                      style={{
                        display: "block",
                        width: "100%",
                        height: "210px",
                        objectFit: "cover",
                      }}
                    />
                  </Link>
                )}

                <div
                  style={{
                    padding: "20px",
                  }}
                >
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#777",
                      textTransform: "uppercase",
                      letterSpacing: "0.6px",
                      marginBottom: "7px",
                    }}
                  >
                    {lots.length} auction{" "}
                    {lots.length === 1
                      ? "record"
                      : "records"}
                  </div>

                  <h2
                    style={{
                      fontSize: "20px",
                      lineHeight: 1.3,
                      margin: "0 0 7px",
                    }}
                  >
                    <Link
                      href={`/vin/${vehicle.vin}`}
                      style={{
                        color: "#171717",
                        textDecoration: "none",
                      }}
                    >
                      {vehicleName || "Archived Vehicle"}
                    </Link>
                  </h2>

                  {vehicle.trim && (
                    <div
                      style={{
                        color: "#666",
                        fontSize: "14px",
                        marginBottom: "10px",
                      }}
                    >
                      {vehicle.trim}
                    </div>
                  )}

                  <div
                    style={{
                      fontSize: "13px",
                      color: "#555",
                      marginBottom: "16px",
                      wordBreak: "break-all",
                    }}
                  >
                    VIN{" "}
                    <strong
                      style={{
                        color: "#171717",
                      }}
                    >
                      {vehicle.vin}
                    </strong>
                  </div>

                  {latestLot && (
                    <div
                      style={{
                        borderTop: "1px solid #eeeeee",
                        paddingTop: "14px",
                        marginBottom: "17px",
                        display: "grid",
                        gap: "7px",
                        fontSize: "13px",
                        color: "#666",
                      }}
                    >
                      <div>
                        Latest auction:{" "}
                        <strong
                          style={{
                            color: "#171717",
                          }}
                        >
                          {formatDate(
                            latestLot.auction_date
                          )}
                        </strong>
                      </div>

                      <div>
                        Final bid:{" "}
                        <strong
                          style={{
                            color: "#171717",
                          }}
                        >
                          {formatBid(
                            latestLot.final_bid
                          )}
                        </strong>
                      </div>

                      {latestLot.primary_damage && (
                        <div>
                          Damage:{" "}
                          <strong
                            style={{
                              color: "#171717",
                            }}
                          >
                            {
                              latestLot.primary_damage
                            }
                          </strong>
                        </div>
                      )}
                    </div>
                  )}

                  <Link
                    href={`/vin/${vehicle.vin}`}
                    style={{
                      display: "inline-block",
                      background: "#171717",
                      color: "#ffffff",
                      textDecoration: "none",
                      fontWeight: "bold",
                      fontSize: "13px",
                      padding: "10px 14px",
                      borderRadius: "6px",
                    }}
                  >
                    View VIN History →
                  </Link>
                </div>
              </article>
            );
          })}
        </section>

        {/* PAGINATION */}

        {totalPages > 1 && (
          <nav
            aria-label="VIN archive pagination"
            style={{
              marginTop: "46px",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "8px",
            }}
          >
            {currentPage > 1 && (
              <Link
                href={buildPageUrl(currentPage - 1)}
                style={{
                  padding: "9px 12px",
                  border: "1px solid #dddddd",
                  borderRadius: "6px",
                  color: "#171717",
                  textDecoration: "none",
                  fontSize: "14px",
                }}
              >
                ← Previous
              </Link>
            )}

            {paginationItems.map((item, index) =>
              item === "ellipsis" ? (
                <span
                  key={`ellipsis-${index}`}
                  style={{
                    padding: "9px 5px",
                    color: "#777",
                  }}
                >
                  …
                </span>
              ) : (
                <Link
                  key={item}
                  href={buildPageUrl(item)}
                  aria-current={
                    item === currentPage
                      ? "page"
                      : undefined
                  }
                  style={{
                    minWidth: "38px",
                    textAlign: "center",
                    padding: "9px 10px",
                    border:
                      item === currentPage
                        ? "1px solid #171717"
                        : "1px solid #dddddd",
                    background:
                      item === currentPage
                        ? "#171717"
                        : "#ffffff",
                    color:
                      item === currentPage
                        ? "#ffffff"
                        : "#171717",
                    borderRadius: "6px",
                    textDecoration: "none",
                    fontSize: "14px",
                    fontWeight:
                      item === currentPage
                        ? "bold"
                        : "normal",
                  }}
                >
                  {item}
                </Link>
              )
            )}

            {currentPage < totalPages && (
              <Link
                href={buildPageUrl(currentPage + 1)}
                style={{
                  padding: "9px 12px",
                  border: "1px solid #dddddd",
                  borderRadius: "6px",
                  color: "#171717",
                  textDecoration: "none",
                  fontSize: "14px",
                }}
              >
                Next →
              </Link>
            )}
          </nav>
        )}
      </div>
    </main>
  );
}
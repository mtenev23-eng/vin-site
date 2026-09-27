import Link from "next/link";
import { notFound } from "next/navigation";

import { supabase } from "../../../utils/supabase/client";

type Vehicle = {
  vin: string;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
};

type AuctionLot = {
  id: number;
  auction_source: string;
  lot_number: string;
  vin: string;
  final_bid: number | null;
  auction_date: string | null;
  mileage: number | null;
  primary_damage: string | null;
  image_urls: string[] | null;
};

type VehicleCard = {
  vehicle: Vehicle;
  lot: AuctionLot | null;
};

type ModelSummary = {
  model: string;
  vehicleCount: number;
};

const PAGE_SIZE = 24;

const SUPPORTED_MAKES: Record<
  string,
  {
    databaseMake: string;
    displayName: string;
  }
> = {
  toyota: {
    databaseMake: "TOYOTA",
    displayName: "Toyota",
  },
  ford: {
    databaseMake: "FORD",
    displayName: "Ford",
  },
  honda: {
    databaseMake: "HONDA",
    displayName: "Honda",
  },
  hyundai: {
    databaseMake: "HYUNDAI",
    displayName: "Hyundai",
  },
  bmw: {
    databaseMake: "BMW",
    displayName: "BMW",
  },
  chevrolet: {
    databaseMake: "CHEVROLET",
    displayName: "Chevrolet",
  },
  tesla: {
    databaseMake: "TESLA",
    displayName: "Tesla",
  },
  jeep: {
    databaseMake: "JEEP",
    displayName: "Jeep",
  },
  "mercedes-benz": {
    databaseMake: "MERCEDES-BENZ",
    displayName: "Mercedes-Benz",
  },
  nissan: {
    databaseMake: "NISSAN",
    displayName: "Nissan",
  },
  lexus: {
    databaseMake: "LEXUS",
    displayName: "Lexus",
  },
  kia: {
    databaseMake: "KIA",
    displayName: "Kia",
  },
  audi: {
    databaseMake: "AUDI",
    displayName: "Audi",
  },
  dodge: {
    databaseMake: "DODGE",
    displayName: "Dodge",
  },
  volkswagen: {
    databaseMake: "VOLKSWAGEN",
    displayName: "Volkswagen",
  },
  mazda: {
    databaseMake: "MAZDA",
    displayName: "Mazda",
  },
  "land-rover": {
    databaseMake: "LAND ROVER",
    displayName: "Land Rover",
  },
  volvo: {
    databaseMake: "VOLVO",
    displayName: "Volvo",
  },
  mitsubishi: {
    databaseMake: "MITSUBISHI",
    displayName: "Mitsubishi",
  },
  buick: {
    databaseMake: "BUICK",
    displayName: "Buick",
  },
  chrysler: {
    databaseMake: "CHRYSLER",
    displayName: "Chrysler",
  },
};
const LIVE_MODEL_PAGES = new Set(["bmw/m4"]);

function slugifyModel(model: string) {
  return model
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

function displayModel(model: string) {
  const modelMap: Record<string, string> = {
    "2ER": "2 Series",
    "3ER": "3 Series",
    "4ER": "4 Series",
    "5ER": "5 Series",
    "6ER": "6 Series",
    "7ER": "7 Series",
    "8ER": "8 Series",
  };

  return modelMap[model] || model;
}

function formatPrice(price: number | null) {
  if (price === null) return "Price unavailable";

  return `$${price.toLocaleString()}`;
}

function formatDate(date: string | null) {
  if (!date) return "Date unavailable";

  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatMileage(mileage: number | null) {
  if (mileage === null) return "Mileage unavailable";

  return `${mileage.toLocaleString()} mi`;
}

async function getModelSummaries(databaseMake: string) {
  const { data, error } = await supabase
    .from("vehicles")
    .select("model")
    .eq("make", databaseMake);

  if (error) {
    console.error("Model summary error:", error);
    return [] as ModelSummary[];
  }

  const counts = new Map<string, number>();

  for (const vehicle of data || []) {
    const model = vehicle.model?.trim();

    if (!model) continue;

    counts.set(model, (counts.get(model) || 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([model, vehicleCount]) => ({
      model,
      vehicleCount,
    }))
    .sort((a, b) => {
      if (b.vehicleCount !== a.vehicleCount) {
        return b.vehicleCount - a.vehicleCount;
      }

      return a.model.localeCompare(b.model);
    });
}

async function getVehicleArchive(
  databaseMake: string,
  selectedModel: string | null,
  page: number
) {
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let vehicleQuery = supabase
    .from("vehicles")
    .select("vin, year, make, model, trim", {
      count: "exact",
    })
    .eq("make", databaseMake)
    .order("created_at", {
      ascending: false,
    });

  if (selectedModel) {
    vehicleQuery = vehicleQuery.eq("model", selectedModel);
  }

  const {
    data: vehicles,
    error: vehicleError,
    count,
  } = await vehicleQuery.range(from, to);

  if (vehicleError) {
    console.error("Vehicle archive error:", vehicleError);

    return {
      cards: [] as VehicleCard[],
      totalCount: 0,
    };
  }

  const typedVehicles = (vehicles || []) as Vehicle[];

  if (typedVehicles.length === 0) {
    return {
      cards: [] as VehicleCard[],
      totalCount: count || 0,
    };
  }

  const vins = typedVehicles.map((vehicle) => vehicle.vin);

  const { data: lots, error: lotError } = await supabase
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
      `
    )
    .in("vin", vins)
    .order("auction_date", {
      ascending: false,
      nullsFirst: false,
    })
    .order("id", {
      ascending: false,
    });

  if (lotError) {
    console.error("Vehicle auction lookup error:", lotError);
  }

  const latestLotByVin = new Map<string, AuctionLot>();

  for (const lot of (lots || []) as AuctionLot[]) {
    if (!latestLotByVin.has(lot.vin)) {
      latestLotByVin.set(lot.vin, lot);
    }
  }

  const cards: VehicleCard[] = typedVehicles.map((vehicle) => ({
    vehicle,
    lot: latestLotByVin.get(vehicle.vin) || null,
  }));

  return {
    cards,
    totalCount: count || 0,
  };
}

function getPaginationPages(currentPage: number, totalPages: number) {
  const pages = new Set<number>();

  for (let page = 1; page <= Math.min(3, totalPages); page++) {
    pages.add(page);
  }

  for (
    let page = Math.max(1, currentPage - 2);
    page <= Math.min(totalPages, currentPage + 2);
    page++
  ) {
    pages.add(page);
  }

  for (
    let page = Math.max(1, totalPages - 2);
    page <= totalPages;
    page++
  ) {
    pages.add(page);
  }

  return Array.from(pages).sort((a, b) => a - b);
}

function makeArchiveUrl(
  makeSlug: string,
  page: number,
  model: string | null
) {
  const params = new URLSearchParams();

  if (model) {
    params.set("model", model);
  }

  if (page > 1) {
    params.set("page", String(page));
  }

  const query = params.toString();

  return `/vehicles/${makeSlug}${query ? `?${query}` : ""}`;
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ make: string }>;
  searchParams: Promise<{
    page?: string;
    model?: string;
  }>;
}) {
  const { make: makeSlug } = await params;
  const query = await searchParams;

  const normalizedMakeSlug = makeSlug.toLowerCase();
  const config = SUPPORTED_MAKES[normalizedMakeSlug];

  if (!config) {
    return {
      title: "Vehicle Make Not Found",
      robots: {
        index: false,
        follow: true,
      },
    };
  }

  const page = Math.max(1, Number(query.page) || 1);
  const selectedModel = query.model?.trim() || null;

  const canonical =
    `https://salvagevinhistory.com/vehicles/${normalizedMakeSlug}`;

  const title = selectedModel
    ? `${config.displayName} ${displayModel(
        selectedModel
      )} Auction Records`
    : page > 1
    ? `${config.displayName} Auction History - Page ${page}`
    : `${config.displayName} Auction History & Salvage Vehicle Records`;

  const description = selectedModel
    ? `Browse archived ${config.displayName} ${displayModel(
        selectedModel
      )} vehicles from Copart and IAAI. Research VINs, final bids, mileage, damage and historical auction records.`
    : `Research historical ${config.displayName} vehicles from Copart and IAAI. Browse auction records by model, VIN, final bid, mileage, damage and auction history.`;

  return {
    title,
    description,

    alternates: {
      canonical,
    },

    robots: {
      index: !selectedModel && page === 1,
      follow: true,
    },

    openGraph: {
      title,
      description,
      url: canonical,
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

export default async function VehicleMakePage({
  params,
  searchParams,
}: {
  params: Promise<{ make: string }>;
  searchParams: Promise<{
    page?: string;
    model?: string;
  }>;
}) {
  const { make: makeSlug } = await params;
  const query = await searchParams;

  const normalizedMakeSlug = makeSlug.toLowerCase();

  const config = SUPPORTED_MAKES[normalizedMakeSlug];

  if (!config) {
    notFound();
  }

  const page = Math.max(1, Number(query.page) || 1);

  const models = await getModelSummaries(config.databaseMake);

  const requestedModel = query.model?.trim() || null;

  const selectedModel =
    requestedModel &&
    models.some((item) => item.model === requestedModel)
      ? requestedModel
      : null;

  const { cards, totalCount } = await getVehicleArchive(
    config.databaseMake,
    selectedModel,
    page
  );

  const totalPages = Math.max(
    1,
    Math.ceil(totalCount / PAGE_SIZE)
  );

  if (page > totalPages && totalCount > 0) {
    notFound();
  }

  const paginationPages = getPaginationPages(page, totalPages);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f6f7f8",
        color: "#171717",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <section
        className="vehicle-make-hero"
        style={{
          background: "#ffffff",
          borderBottom: "1px solid #e5e5e5",
        }}
      >
        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            padding: "54px 24px 48px",
          }}
        >
          <div
            style={{
              fontSize: "13px",
              fontWeight: "bold",
              textTransform: "uppercase",
              letterSpacing: "1px",
              color: "#666666",
              marginBottom: "12px",
            }}
          >
            Vehicle Auction Research
          </div>

          <h1
            className="vehicle-make-title"
            style={{
              fontSize: "44px",
              lineHeight: 1.1,
              margin: "0 0 16px",
            }}
          >
            {config.displayName} Auction History
          </h1>

          <p
            style={{
              maxWidth: "760px",
              margin: 0,
              color: "#606060",
              fontSize: "17px",
              lineHeight: 1.7,
            }}
          >
            Browse archived {config.displayName} vehicles from Copart and
            IAAI. Research auction history by model, VIN, final bid, mileage,
            reported damage and available historical vehicle photos.
          </p>
        </div>
      </section>

      <div
        className="vehicle-make-content"
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "38px 24px 80px",
        }}
      >
        <section
          style={{
            background: "#ffffff",
            border: "1px solid #e1e1e1",
            borderRadius: "12px",
            padding: "22px",
            marginBottom: "42px",
          }}
        >
          <div
            style={{
              color: "#777777",
              fontSize: "12px",
              textTransform: "uppercase",
              fontWeight: "bold",
              marginBottom: "8px",
            }}
          >
            {selectedModel
              ? `Archived ${config.displayName} ${displayModel(
                  selectedModel
                )} Vehicles`
              : `Archived ${config.displayName} Vehicles`}
          </div>

          <strong style={{ fontSize: "28px" }}>
            {totalCount.toLocaleString()}
          </strong>
        </section>

        <section style={{ marginBottom: "46px" }}>
          <h2
            style={{
              fontSize: "28px",
              margin: "0 0 10px",
            }}
          >
            Browse {config.displayName} Models
          </h2>

          <p
            style={{
              color: "#666666",
              lineHeight: 1.6,
              margin: "0 0 22px",
            }}
          >
            Filter the archive by model or open a dedicated model research
            page when available.
          </p>

          <div
            className="vehicle-make-filter-list"
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "9px",
            }}
          >
            <Link
              href={`/vehicles/${normalizedMakeSlug}`}
              style={{
                padding: "10px 14px",
                borderRadius: "8px",
                border: "1px solid #d8d8d8",
                textDecoration: "none",
                fontSize: "14px",
                fontWeight: "bold",
                color: selectedModel ? "#171717" : "#ffffff",
                background: selectedModel ? "#ffffff" : "#171717",
              }}
            >
              All {config.displayName}
            </Link>

            {models.map((item) => {
              const active = selectedModel === item.model;

              return (
                <Link
                  key={item.model}
                  href={makeArchiveUrl(
                    normalizedMakeSlug,
                    1,
                    item.model
                  )}
                  style={{
                    padding: "10px 14px",
                    borderRadius: "8px",
                    border: "1px solid #d8d8d8",
                    textDecoration: "none",
                    fontSize: "14px",
                    fontWeight: "600",
                    color: active ? "#ffffff" : "#171717",
                    background: active ? "#171717" : "#ffffff",
                    whiteSpace: "nowrap",
                  }}
                >
                  {displayModel(item.model)} ({item.vehicleCount})
                </Link>
              );
            })}
          </div>

          {selectedModel &&
            LIVE_MODEL_PAGES.has(
              `${normalizedMakeSlug}/${slugifyModel(selectedModel)}`
            ) && (
              <div
                style={{
                  marginTop: "18px",
                }}
              >
                <Link
                  href={`/vehicles/${normalizedMakeSlug}/${slugifyModel(
                    selectedModel
                  )}`}
                  style={{
                    color: "#171717",
                    fontWeight: "bold",
                    fontSize: "14px",
                  }}
                >
                  Explore {config.displayName}{" "}
                  {displayModel(selectedModel)} prices & detailed auction
                  history →
                </Link>
              </div>
            )}
        </section>

        <section style={{ marginBottom: "48px" }}>
          <div
            style={{
              marginBottom: "24px",
            }}
          >
            <h2
              style={{
                fontSize: "28px",
                margin: "0 0 9px",
              }}
            >
              {selectedModel
                ? `${config.displayName} ${displayModel(
                    selectedModel
                  )} Auction Records`
                : `${config.displayName} Auction Records`}
            </h2>

            <p
              style={{
                margin: 0,
                color: "#666666",
                lineHeight: 1.6,
              }}
            >
              {totalCount.toLocaleString()}{" "}
              {totalCount === 1
                ? "archived vehicle"
                : "archived vehicles"}{" "}
              found.
            </p>
          </div>

          {cards.length === 0 ? (
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #e1e1e1",
                borderRadius: "12px",
                padding: "28px",
              }}
            >
              No matching auction records are currently available.
            </div>
          ) : (
            <div
              className="vehicle-make-archive-grid"
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(260px, 1fr))",
                gap: "20px",
              }}
            >
              {cards.map(({ vehicle, lot }) => {
                const modelName = vehicle.model
                  ? displayModel(vehicle.model)
                  : null;

                const vehicleName = [
                  vehicle.year,
                  config.displayName,
                  modelName,
                ]
                  .filter(Boolean)
                  .join(" ");

                const lotUrl = lot
                  ? `/lot/${lot.auction_source.toLowerCase()}/${lot.lot_number}`
                  : null;

                return (
                  <article
                    key={vehicle.vin}
                    className="vehicle-make-archive-card"
                    style={{
                      background: "#ffffff",
                      border: "1px solid #e1e1e1",
                      borderRadius: "12px",
                      overflow: "hidden",
                    }}
                  >
                    {lotUrl ? (
                      <Link
                        href={lotUrl}
                        style={{
                          display: "block",
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
                          {lot?.image_urls?.[0] ? (
                            <img
                              src={lot.image_urls[0]}
                              alt={`${vehicleName} auction vehicle`}
                              loading="lazy"
                              style={{
                                display: "block",
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                height: "100%",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "#777777",
                              }}
                            >
                              No photo available
                            </div>
                          )}
                        </div>
                      </Link>
                    ) : (
                      <div
                        style={{
                          height: "190px",
                          background: "#e9e9e9",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#777777",
                        }}
                      >
                        No photo available
                      </div>
                    )}

                    <div style={{ padding: "18px" }}>
                      {lot && (
                        <div
                          style={{
                            color: "#666666",
                            fontSize: "12px",
                            fontWeight: "bold",
                            textTransform: "uppercase",
                            marginBottom: "7px",
                          }}
                        >
                          {lot.auction_source} •{" "}
                          {formatDate(lot.auction_date)}
                        </div>
                      )}

                      <h3
                        style={{
                          fontSize: "19px",
                          lineHeight: 1.3,
                          margin: "0 0 15px",
                        }}
                      >
                        {vehicleName || vehicle.vin}
                      </h3>

                      {lot && (
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: "14px",
                            marginBottom: "15px",
                          }}
                        >
                          <div>
                            <div
                              style={{
                                color: "#777777",
                                fontSize: "12px",
                                marginBottom: "3px",
                              }}
                            >
                              Final Bid
                            </div>

                            <strong>
                              {formatPrice(lot.final_bid)}
                            </strong>
                          </div>

                          <div>
                            <div
                              style={{
                                color: "#777777",
                                fontSize: "12px",
                                marginBottom: "3px",
                              }}
                            >
                              Mileage
                            </div>

                            <strong>
                              {formatMileage(lot.mileage)}
                            </strong>
                          </div>
                        </div>
                      )}

                      {lot?.primary_damage && (
                        <div
                          style={{
                            borderTop: "1px solid #eeeeee",
                            paddingTop: "13px",
                            marginBottom: "12px",
                            color: "#666666",
                            fontSize: "13px",
                          }}
                        >
                          Damage: {lot.primary_damage}
                        </div>
                      )}

                      {lot && (
                        <div
                          style={{
                            color: "#666666",
                            fontSize: "13px",
                            marginBottom: "9px",
                          }}
                        >
                          Lot #{lot.lot_number}
                        </div>
                      )}

                      <Link
                        href={`/vin/${vehicle.vin}`}
                        style={{
                          color: "#171717",
                          fontSize: "13px",
                          fontWeight: "bold",
                          overflowWrap: "anywhere",
                        }}
                      >
                        VIN: {vehicle.vin}
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {totalPages > 1 && (
            <nav
              aria-label={`${config.displayName} archive pagination`}
              style={{
                marginTop: "36px",
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
              }}
            >
              {page > 1 && (
                <Link
                  href={makeArchiveUrl(
                    normalizedMakeSlug,
                    page - 1,
                    selectedModel
                  )}
                  style={{
                    padding: "9px 12px",
                    border: "1px solid #d8d8d8",
                    borderRadius: "7px",
                    color: "#171717",
                    background: "#ffffff",
                    textDecoration: "none",
                  }}
                >
                  ← Previous
                </Link>
              )}

              {paginationPages.map((pageNumber, index) => {
                const previousPage =
                  paginationPages[index - 1];

                const showEllipsis =
                  previousPage &&
                  pageNumber - previousPage > 1;

                return (
                  <span
                    key={pageNumber}
                    style={{
                      display: "contents",
                    }}
                  >
                    {showEllipsis && (
                      <span
                        style={{
                          padding: "0 4px",
                          color: "#777777",
                        }}
                      >
                        …
                      </span>
                    )}

                    <Link
                      href={makeArchiveUrl(
                        normalizedMakeSlug,
                        pageNumber,
                        selectedModel
                      )}
                      style={{
                        minWidth: "38px",
                        padding: "9px 10px",
                        textAlign: "center",
                        border: "1px solid #d8d8d8",
                        borderRadius: "7px",
                        color:
                          pageNumber === page
                            ? "#ffffff"
                            : "#171717",
                        background:
                          pageNumber === page
                            ? "#171717"
                            : "#ffffff",
                        textDecoration: "none",
                        fontWeight:
                          pageNumber === page
                            ? "bold"
                            : "normal",
                      }}
                    >
                      {pageNumber}
                    </Link>
                  </span>
                );
              })}

              {page < totalPages && (
                <Link
                  href={makeArchiveUrl(
                    normalizedMakeSlug,
                    page + 1,
                    selectedModel
                  )}
                  style={{
                    padding: "9px 12px",
                    border: "1px solid #d8d8d8",
                    borderRadius: "7px",
                    color: "#171717",
                    background: "#ffffff",
                    textDecoration: "none",
                  }}
                >
                  Next →
                </Link>
              )}
            </nav>
          )}
        </section>

        <section
          style={{
            background: "#ffffff",
            border: "1px solid #e1e1e1",
            borderRadius: "12px",
            padding: "28px",
          }}
        >
          <h2
            style={{
              fontSize: "24px",
              margin: "0 0 12px",
            }}
          >
            Research {config.displayName} Salvage Auction History
          </h2>

          <p
            style={{
              color: "#5f5f5f",
              lineHeight: 1.7,
              margin: "0 0 14px",
            }}
          >
            Salvage VIN History archives historical vehicle auction records
            from Copart and IAAI. Available {config.displayName} records may
            include auction dates, final bids, mileage, reported damage,
            auction locations, VIN information and archived photos.
          </p>

          <p
            style={{
              color: "#5f5f5f",
              lineHeight: 1.7,
              margin: 0,
            }}
          >
            Filter the archive by model or open an individual VIN history page
            to review the auction appearances currently available for a
            specific vehicle.
          </p>
        </section>
      </div>
    </main>
  );
}
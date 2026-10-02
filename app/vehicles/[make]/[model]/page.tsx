

import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { supabase } from "../../../../utils/supabase/client";
import {
  displayModel,
  slugifyModel,
  normalizeModelName as sharedNormalizeModelName,
} from "../../../../utils/vehicle-models";
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
  location: string | null;
  primary_damage: string | null;
  image_urls: string[] | null;
};

type AuctionWithVehicle = AuctionLot & {
  vehicle: Vehicle | null;
};

const MIN_MODEL_VEHICLES = 5;
const MODEL_BATCH_SIZE = 1000;
const PAGE_SIZE = 24;
const SUPPORTED_MAKES: Record<
  string,
  {
    databaseMake: string;
    displayName: string;
  }
> = {
  toyota: { databaseMake: "TOYOTA", displayName: "Toyota" },
  ford: { databaseMake: "FORD", displayName: "Ford" },
  honda: { databaseMake: "HONDA", displayName: "Honda" },
  hyundai: { databaseMake: "HYUNDAI", displayName: "Hyundai" },
  bmw: { databaseMake: "BMW", displayName: "BMW" },
  chevrolet: {
    databaseMake: "CHEVROLET",
    displayName: "Chevrolet",
  },
  tesla: { databaseMake: "TESLA", displayName: "Tesla" },
  jeep: { databaseMake: "JEEP", displayName: "Jeep" },
  "mercedes-benz": {
    databaseMake: "MERCEDES-BENZ",
    displayName: "Mercedes-Benz",
  },
  nissan: { databaseMake: "NISSAN", displayName: "Nissan" },
  lexus: { databaseMake: "LEXUS", displayName: "Lexus" },
  kia: { databaseMake: "KIA", displayName: "Kia" },
  audi: { databaseMake: "AUDI", displayName: "Audi" },
  dodge: { databaseMake: "DODGE", displayName: "Dodge" },
  volkswagen: {
    databaseMake: "VOLKSWAGEN",
    displayName: "Volkswagen",
  },
  mazda: { databaseMake: "MAZDA", displayName: "Mazda" },
  "land-rover": {
    databaseMake: "LAND ROVER",
    displayName: "Land Rover",
  },
  volvo: { databaseMake: "VOLVO", displayName: "Volvo" },
  mitsubishi: {
    databaseMake: "MITSUBISHI",
    displayName: "Mitsubishi",
  },
  buick: { databaseMake: "BUICK", displayName: "Buick" },
  chrysler: {
    databaseMake: "CHRYSLER",
    displayName: "Chrysler",
  },
};



const getModelsForMake = cache(async (databaseMake: string) => {
  const models: string[] = [];

  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("vehicles")
      .select("model")
      .ilike("make", databaseMake)
      .not("model", "is", null)
      .range(from, from + MODEL_BATCH_SIZE - 1);

    if (error) {
      console.error("Model lookup error:", error);
      return [];
    }

    if (!data || data.length === 0) {
      break;
    }

    for (const row of data) {
      if (row.model) {
        models.push(row.model);
      }
    }

    if (data.length < MODEL_BATCH_SIZE) {
      break;
    }

    from += MODEL_BATCH_SIZE;
  }

  return models;
});

const getModelConfig = cache(
  async (makeSlug: string, modelSlug: string) => {
    const normalizedMakeSlug = makeSlug.toLowerCase();
    const normalizedModelSlug = modelSlug.toLowerCase();

    const makeConfig = SUPPORTED_MAKES[normalizedMakeSlug];

    if (!makeConfig) {
      return null;
    }

    const models = await getModelsForMake(makeConfig.databaseMake);
if (normalizedMakeSlug === "bmw") {
  const bmwGroups: Record<string, { name: string; prefix: string }> = {
    "1-series": { name: "1 Series", prefix: "1" },
    "2-series": { name: "2 Series", prefix: "2" },
    "3-series": { name: "3 Series", prefix: "3" },
    "4-series": { name: "4 Series", prefix: "4" },
    "5-series": { name: "5 Series", prefix: "5" },
    "6-series": { name: "6 Series", prefix: "6" },
    "7-series": { name: "7 Series", prefix: "7" },
    "8-series": { name: "8 Series", prefix: "8" },
    "z-series": { name: "Z Series", prefix: "Z" },
    "x-series": { name: "X Series", prefix: "X" },
    "m": { name: "M", prefix: "M" },
  };

  const group = bmwGroups[normalizedModelSlug];

  if (group) {
    const rawModels = [
      ...new Set(
        models.filter((model) =>
          displayModel(model)
            .toUpperCase()
            .startsWith(group.prefix.toUpperCase())
        )
      ),
    ];

    if (rawModels.length === 0) {
      return null;
    }

    const vehicleCount = models.filter((model) =>
      rawModels.includes(model)
    ).length;

    if (vehicleCount < MIN_MODEL_VEHICLES) {
      return null;
    }

    return {
      make: makeConfig.databaseMake,
      model: group.name,
      rawModels,
      makeName: makeConfig.displayName,
      modelName: group.name,
      vehicleCount,
    };
  }
}
    const groupedModels = new Map<
  string,
  {
    vehicleCount: number;
    rawModels: Set<string>;
  }
>();

for (const model of models) {
  const normalizedModel = sharedNormalizeModelName(
  makeConfig.databaseMake,
  model
);

  const existingKey = Array.from(groupedModels.keys()).find(
    (key) =>
      key.toLowerCase() === normalizedModel.toLowerCase()
  );

  const groupKey = existingKey || normalizedModel;

  const existing = groupedModels.get(groupKey);

  if (existing) {
    existing.vehicleCount += 1;
    existing.rawModels.add(model);
  } else {
    groupedModels.set(groupKey, {
      vehicleCount: 1,
      rawModels: new Set([model]),
    });
  }
}

const matchingModel = Array.from(groupedModels.entries()).find(
  ([modelName, summary]) =>
    summary.vehicleCount >= MIN_MODEL_VEHICLES &&
    slugifyModel(modelName) === normalizedModelSlug
);

if (!matchingModel) {
  return null;
}

const [modelName, summary] = matchingModel;

return {
  make: makeConfig.databaseMake,
  model: modelName,
  rawModels: Array.from(summary.rawModels),
  makeName: makeConfig.displayName,
  modelName,
  vehicleCount: summary.vehicleCount,
};
  }
);
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



async function getModelData(
  make: string,
  model: string,
  rawModels: string[],
  page: number
) {
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const {
    data: vehicleRows,
    error: vehicleError,
    count: vehicleCount,
  } = await supabase
    .from("vehicles")
    .select("vin", {
      count: "exact",
      head: true,
    })
    .ilike("make", make)
    .in("model", rawModels);

  if (vehicleError) {
    console.error("Model vehicle error:", vehicleError);

    return {
      auctions: [] as AuctionWithVehicle[],
      vehicleCount: 0,
      auctionCount: 0,
    };
  }

  const {
    data,
    error: lotError,
    count: auctionCount,
  } = await supabase
    .from("vehicle_auction_archive")
    .select(
      `
        auction_id,
        auction_source,
        lot_number,
        vin,
        final_bid,
        auction_date,
        mileage,
        primary_damage,
        image_urls,
        year,
        make,
        model,
        trim
      `,
      {
        count: "exact",
      }
    )
    .ilike("make", make)
    .in("model", rawModels)
    .not("auction_date", "is", null)
    .order("auction_date", {
      ascending: false,
      nullsFirst: false,
    })
    .order("auction_id", {
      ascending: false,
    })
    .range(from, to);

  if (lotError) {
    console.error("Model auction error:", lotError);

    return {
      auctions: [] as AuctionWithVehicle[],
      vehicleCount: vehicleCount || 0,
      auctionCount: 0,
    };
  }

  const auctions: AuctionWithVehicle[] = (data || []).map(
    (row) => ({
      id: row.auction_id,
      auction_source: row.auction_source,
      lot_number: row.lot_number,
      vin: row.vin,
      final_bid: row.final_bid,
      auction_date: row.auction_date,
      mileage: row.mileage,
      location: null,
      primary_damage: row.primary_damage,
      image_urls: row.image_urls,
      vehicle: {
        vin: row.vin,
        year: row.year,
        make: row.make,
        model: row.model,
        trim: row.trim,
      },
    })
  );

  return {
    auctions,
    vehicleCount: vehicleCount || 0,
    auctionCount: auctionCount || 0,
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ make: string; model: string }>;
}) {
  const { make: makeSlug, model: modelSlug } = await params;

  const config = await getModelConfig(makeSlug, modelSlug);

  if (!config) {
    return {
      title: "Vehicle Model Not Found",
      robots: {
        index: false,
        follow: true,
      },
    };
  }

  const vehicleName = `${config.makeName} ${config.modelName}`;

  const canonical =
    `https://salvagevinhistory.com/vehicles/` +
    `${makeSlug.toLowerCase()}/${modelSlug.toLowerCase()}`;

  const title = `${vehicleName} Auction History & Prices`;

  const description =
    `Browse historical ${vehicleName} auction records from Copart and IAAI. ` +
    `Research final bids, mileage, damage, auction dates, VINs and archived vehicle photos.`;

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

    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function VehicleModelPage({
  params,
  searchParams,
}: {
  params: Promise<{ make: string; model: string }>;
  searchParams: Promise<{
    page?: string;
  }>;
}) {
  const { make: makeSlug, model: modelSlug } = await params;
const query = await searchParams;
const page = Math.max(1, Number(query.page) || 1);
  const config = await getModelConfig(makeSlug, modelSlug);

  if (!config) {
    notFound();
  }

  const { auctions, vehicleCount, auctionCount } = await getModelData(
  config.make,
  config.model,
  config.rawModels,
  page
);

  if (vehicleCount === 0) {
    notFound();
  }
  const totalPages = Math.max(
  1,
  Math.ceil(auctionCount / PAGE_SIZE)
);

if (page > totalPages && auctionCount > 0) {
  notFound();
}

  const vehicleName = `${config.makeName} ${config.modelName}`;

  const { data: recentBidRows } = await supabase
  .from("vehicle_auction_archive")
  .select("final_bid")
  .ilike("make", config.make)
  .in("model", config.rawModels)
  .not("final_bid", "is", null)
  .not("auction_date", "is", null)
  .order("auction_date", {
    ascending: false,
    nullsFirst: false,
  })
  .order("auction_id", {
    ascending: false,
  })
  .limit(24);

const recentBids = (recentBidRows || [])
  .map((row) => row.final_bid)
  .filter(
    (bid): bid is number =>
      typeof bid === "number"
  );

const averageBid =
  recentBids.length > 0
    ? Math.round(
        recentBids.reduce(
          (total, bid) => total + bid,
          0
        ) / recentBids.length
      )
    : null;

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
        className="vehicle-model-hero"
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
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
    fontSize: "13px",
    color: "#666666",
    marginBottom: "12px",
  }}
>
  <Link
    href="/vehicles"
    style={{
      color: "#666666",
      textDecoration: "none",
    }}
  >
    Vehicles
  </Link>

  <span>›</span>

  <Link
    href={`/vehicles/${makeSlug.toLowerCase()}`}
    style={{
      color: "#666666",
      textDecoration: "none",
    }}
  >
    {config.makeName}
  </Link>

  <span>›</span>

  <span
    style={{
      fontWeight: "bold",
      color: "#171717",
    }}
  >
    {config.modelName}
  </span>
</div>
          <h1
            className="vehicle-model-title"
            style={{
              fontSize: "44px",
              lineHeight: 1.1,
              margin: "0 0 16px",
            }}
          >
            {vehicleName} Auction History & Prices
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
            Research historical {vehicleName} vehicles archived from Copart
            and IAAI. Compare final bids, mileage, reported damage, auction
            dates, VINs and available vehicle photos.
          </p>
        </div>
      </section>

      <div
        className="vehicle-model-content"
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "38px 24px 80px",
        }}
      >
        <section
          className="vehicle-model-stats"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: "14px",
            marginBottom: "44px",
          }}
        >
         

          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e1e1e1",
              borderRadius: "12px",
              padding: "22px",
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
              Auction Records
            </div>

            <strong style={{ fontSize: "27px" }}>
              {auctionCount.toLocaleString()}
            </strong>
          </div>

          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e1e1e1",
              borderRadius: "12px",
              padding: "22px",
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
              Recent Average Bid
            </div>

            <strong style={{ fontSize: "27px" }}>
              {averageBid !== null ? formatPrice(averageBid) : "Unavailable"}
            </strong>
          </div>

           <div
            style={{
              background: "#ffffff",
              border: "1px solid #e1e1e1",
              borderRadius: "12px",
              padding: "22px",
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
              Latest Auction
            </div>

            <strong style={{ fontSize: "27px" }}>
              {auctions.length > 0 && auctions[0].auction_date
  ? formatDate(auctions[0].auction_date)
  : "Unavailable"}
            </strong>
          </div>
        </section>

        <section style={{ marginBottom: "48px" }}>
          <h2
            style={{
              fontSize: "28px",
              margin: "0 0 10px",
            }}
          >
            Recent {vehicleName} Auction Sales
          </h2>

          <p
            style={{
              color: "#666666",
              lineHeight: 1.6,
              margin: "0 0 24px",
            }}
          >
            Browse recent archived {vehicleName} auction records and open any
            vehicle or auction lot for additional historical information.
          </p>

          <div
            className="vehicle-model-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: "20px",
            }}
          >
            {auctions.map((lot) => {
              const vehicle = lot.vehicle;

              const displayVehicleName = [
                vehicle?.year,
                config.makeName,
                config.modelName,
              ]
                .filter(Boolean)
                .join(" ");

              const lotUrl =
                `/lot/${lot.auction_source.toLowerCase()}/` +
                `${lot.lot_number}`;

              return (
                <article
                  key={`${lot.auction_source}-${lot.lot_number}`}
                  className="vehicle-model-card"
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
                      {lot.image_urls?.[0] ? (
                        <img
                          src={lot.image_urls[0]}
                          alt={`${displayVehicleName} auction vehicle`}
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

                  <div style={{ padding: "18px" }}>
                    <div
                      style={{
                        color: "#666666",
                        fontSize: "12px",
                        fontWeight: "bold",
                        textTransform: "uppercase",
                        marginBottom: "7px",
                      }}
                    >
                      {lot.auction_source} • {formatDate(lot.auction_date)}
                    </div>

                    <h3
                      style={{
                        fontSize: "19px",
                        margin: "0 0 15px",
                      }}
                    >
                      <Link
                        href={lotUrl}
                        style={{
                          color: "#171717",
                          textDecoration: "none",
                        }}
                      >
                        {displayVehicleName}
                      </Link>
                    </h3>

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

                        <strong>{formatPrice(lot.final_bid)}</strong>
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

                        <strong>{formatMileage(lot.mileage)}</strong>
                      </div>
                    </div>

                    {lot.primary_damage && (
                      <div
                        style={{
                          borderTop: "1px solid #eeeeee",
                          paddingTop: "13px",
                          color: "#666666",
                          fontSize: "13px",
                          marginBottom: "12px",
                        }}
                      >
                        Damage: {lot.primary_damage}
                      </div>
                    )}

                    <div
                      style={{
                        fontSize: "13px",
                        color: "#666666",
                        marginBottom: "6px",
                      }}
                    >
                      Lot #{lot.lot_number}
                    </div>

                    <Link
                      href={`/vin/${lot.vin}`}
                      style={{
                        color: "#171717",
                        fontSize: "13px",
                        fontWeight: "bold",
                        overflowWrap: "anywhere",
                      }}
                    >
                      VIN: {lot.vin}
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>

          {totalPages > 1 && (
  <nav
    style={{
      marginTop: "36px",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      gap: "8px",
      flexWrap: "wrap",
    }}
  >
    {page > 1 && (
      <Link
        href={`?page=${page - 1}`}
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

    {Array.from({ length: totalPages }, (_, index) => {
      const pageNumber = index + 1;

      return (
        <Link
          key={pageNumber}
          href={`?page=${pageNumber}`}
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
      );
    })}

    {page < totalPages && (
      <Link
        href={`?page=${page + 1}`}
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
            Research {vehicleName} Auction History
          </h2>

          <p
            style={{
              color: "#5f5f5f",
              lineHeight: 1.7,
              margin: "0 0 14px",
            }}
          >
            Salvage VIN History maintains an independent archive of historical
            vehicle auction records. {vehicleName} records may include final
            auction bids, mileage, reported damage, auction location, VIN
            information and archived vehicle photos when available.
          </p>

          <p
            style={{
              color: "#5f5f5f",
              lineHeight: 1.7,
              margin: 0,
            }}
          >
            Auction records are historical reference information and should
            not be treated as a current vehicle condition report or appraisal.
            Open an individual VIN history page to review all auction
            appearances currently available in the archive.
          </p>
        </section>
      </div>
    </main>
  );
}
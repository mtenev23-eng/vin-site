

import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { unstable_cache } from "next/cache";
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
const MAX_ARCHIVE_PAGES = 300;
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

porsche: {
  databaseMake: "PORSCHE",
  displayName: "Porsche",
},

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




const getModelsForMake = cache(async (databaseMake: string): Promise<string[]> => {
 const { data, error } = await supabase.rpc(
  "get_vehicle_model_counts" as any,
  { requested_make: databaseMake } as any
);

  if (error) {
    console.error("Model lookup error:", error);
    return [];
  }

  const rows = (data || []) as {
  model: string;
  vehicle_count: number;
}[];

return rows.flatMap((row) =>
  Array<string>(Number(row.vehicle_count)).fill(row.model)
);
});


const getModelConfig = cache(
  async (makeSlug: string, modelSlug: string) => {
    const normalizedMakeSlug = makeSlug.toLowerCase();
    const normalizedModelSlug = modelSlug.toLowerCase();

    const makeConfig = SUPPORTED_MAKES[normalizedMakeSlug];

    if (!makeConfig) {
      return null;
    }
console.time("MODEL LOOKUP");
    const models = await getModelsForMake(makeConfig.databaseMake);
console.timeEnd("MODEL LOOKUP");
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
        m: { name: "M", prefix: "M" },
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

        if (rawModels.length === 0) return null;

        const vehicleCount = models.filter((model) =>
          rawModels.includes(model)
        ).length;

        if (vehicleCount < MIN_MODEL_VEHICLES) return null;

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

const getCachedModelCounts = unstable_cache(
  async (make: string, rawModels: string[]) => {
    const { count: vehicleCount, error: vehicleError } =
      await supabase
        .from("vehicles")
        .select("vin", { count: "exact", head: true })
        .ilike("make", make)
        .in("model", rawModels);

    if (vehicleError) {
      throw new Error(
        `Model vehicle count failed: ${vehicleError.message}`
      );
    }

   const { data: auctionCount, error: auctionError } =
  await supabase.rpc(
    "get_model_auction_count" as any,
    {
      p_make: make,
      p_models: rawModels,
    } as any
  );

    if (auctionError) {
      throw new Error(
        `Model auction count failed: ${auctionError.message}`
      );
    }

    return {
      vehicleCount: vehicleCount ?? 0,
      auctionCount: auctionCount ?? 0,
    };
  },
  ["model-archive-counts"],
  {
    revalidate: 86400,
    tags: ["model-archive-counts"],
  }
);

async function getModelData(
  make: string,
  model: string,
  rawModels: string[],
  page: number
) {
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

 const { vehicleCount, auctionCount } =
  await getCachedModelCounts(make, rawModels);


const { data, error: lotError } = await supabase.rpc(
  "get_model_auction_page" as any,
  {
    p_make: make,
    p_models: rawModels,
    p_limit: PAGE_SIZE,
    p_offset: from,
  } as any
);


  if (lotError) {
    console.error("Model auction error:", lotError);

    return {
      auctions: [] as AuctionWithVehicle[],
      vehicleCount: vehicleCount || 0,
      auctionCount: 0,
    };
  }

  const auctions: AuctionWithVehicle[] = (
  (data || []) as {
    auction_id: number;
    auction_source: string;
    lot_number: string;
    vin: string;
    final_bid: number | null;
    auction_date: string | null;
    mileage: number | null;
    primary_damage: string | null;
    image_urls: string[] | null;
    year: number | null;
    make: string | null;
    model: string | null;
    trim: string | null;
  }[]
).map(
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
  searchParams,
}: {
  params: Promise<{ make: string; model: string }>;
  searchParams: Promise<{
    page?: string;
  }>;
}) {
  const { make: makeSlug, model: modelSlug } = await params;

  const query = await searchParams;

  const page = Math.max(
    1,
    Number(query.page) || 1
  );

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
  index: page === 1,
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
if (!Number.isInteger(page) || page > MAX_ARCHIVE_PAGES) {
  notFound();
}
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
  Math.min(
    MAX_ARCHIVE_PAGES,
    Math.ceil(auctionCount / PAGE_SIZE)
  )
);

if (page > totalPages && auctionCount > 0) {
  notFound();
}

  const vehicleName = `${config.makeName} ${config.modelName}`;

  const { data: averageBidData, error: averageBidError } =
  await supabase.rpc(
    "get_model_recent_average_bid" as any,
    {
      p_make: config.make,
      p_models: config.rawModels,
    } as any
  );

if (averageBidError) {
  console.error("Model average bid error:", averageBidError);
}

const averageBid =
  !averageBidError && averageBidData !== null
    ? Number(averageBidData)
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
<section
  style={{
    marginBottom: "36px",
    maxWidth: "900px",
  }}
>
  <p
    style={{
      margin: 0,
      color: "#5f5f5f",
      fontSize: "16px",
      lineHeight: 1.7,
    }}
  >
    Our archive currently contains{" "}
    {auctionCount.toLocaleString()} historical{" "}
    {vehicleName} auction records. Recent archived sales
    averaged{" "}
    {averageBid !== null
      ? formatPrice(averageBid)
      : "an unavailable amount"}
    , with records from Copart and IAAI covering a range of
    vehicle years, mileage and reported damage conditions.
  </p>
  <div
  style={{
    marginTop: "14px",
    display: "flex",
    gap: "16px",
    flexWrap: "wrap",
  }}
>
  <Link
    href={`/vehicles/${makeSlug.toLowerCase()}`}
    style={{
      color: "#171717",
      fontSize: "14px",
      fontWeight: "bold",
      textDecoration: "underline",
      textUnderlineOffset: "3px",
    }}
  >
    Browse all {config.makeName} auction history →
  </Link>



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
                    prefetch={false}
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
                        prefetch={false}
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
                      prefetch={false}
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
          prefetch={false}
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

  const shouldShow =
    pageNumber === 1 ||
    pageNumber === totalPages ||
    Math.abs(pageNumber - page) <= 2;

  const showLeadingEllipsis =
    pageNumber === page - 3 &&
    page > 4;

  const showTrailingEllipsis =
    pageNumber === page + 3 &&
    page < totalPages - 3;

  if (showLeadingEllipsis || showTrailingEllipsis) {
    return (
      <span
        key={`ellipsis-${pageNumber}`}
        style={{
          padding: "9px 4px",
          color: "#777777",
        }}
      >
        …
      </span>
    );
  }

  if (!shouldShow) {
    return null;
  }

  return (
    <Link
      key={pageNumber}
      href={`?page=${pageNumber}`}
      prefetch={false}
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
        prefetch={false}
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
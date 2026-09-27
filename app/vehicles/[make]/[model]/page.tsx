import Link from "next/link";
import { notFound } from "next/navigation";

import { supabase } from "../../../../utils/supabase/client";

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

const SUPPORTED_MODELS: Record<
  string,
  {
    make: string;
    model: string;
    makeName: string;
    modelName: string;
  }
> = {
  "bmw/m4": {
    make: "BMW",
    model: "M4",
    makeName: "BMW",
    modelName: "M4",
  },
};

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

function getModelConfig(makeSlug: string, modelSlug: string) {
  return SUPPORTED_MODELS[
    `${makeSlug.toLowerCase()}/${modelSlug.toLowerCase()}`
  ];
}

async function getModelData(make: string, model: string) {
  const {
    data: vehicles,
    error: vehicleError,
    count: vehicleCount,
  } = await supabase
    .from("vehicles")
    .select("vin, year, make, model, trim", {
      count: "exact",
    })
    .eq("make", make)
    .eq("model", model);

  if (vehicleError) {
    console.error("Model vehicle error:", vehicleError);

    return {
      auctions: [] as AuctionWithVehicle[],
      vehicleCount: 0,
      auctionCount: 0,
    };
  }

  if (!vehicles || vehicles.length === 0) {
    return {
      auctions: [] as AuctionWithVehicle[],
      vehicleCount: 0,
      auctionCount: 0,
    };
  }

  const typedVehicles = vehicles as Vehicle[];

  const vehicleMap = new Map<string, Vehicle>(
    typedVehicles.map((vehicle) => [vehicle.vin, vehicle])
  );

  const vins = typedVehicles.map((vehicle) => vehicle.vin);

  const {
    data: lots,
    error: lotError,
    count: auctionCount,
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
        location,
        primary_damage,
        image_urls
      `,
      {
        count: "exact",
      }
    )
    .in("vin", vins)
    .order("auction_date", {
      ascending: false,
      nullsFirst: false,
    })
    .order("id", {
      ascending: false,
    })
    .limit(24);

  if (lotError) {
    console.error("Model auction error:", lotError);

    return {
      auctions: [] as AuctionWithVehicle[],
      vehicleCount: vehicleCount || typedVehicles.length,
      auctionCount: 0,
    };
  }

  const auctions: AuctionWithVehicle[] = ((lots || []) as AuctionLot[]).map(
    (lot) => ({
      ...lot,
      vehicle: vehicleMap.get(lot.vin) || null,
    })
  );

  return {
    auctions,
    vehicleCount: vehicleCount || typedVehicles.length,
    auctionCount: auctionCount || 0,
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ make: string; model: string }>;
}) {
  const { make: makeSlug, model: modelSlug } = await params;

  const config = getModelConfig(makeSlug, modelSlug);

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
}: {
  params: Promise<{ make: string; model: string }>;
}) {
  const { make: makeSlug, model: modelSlug } = await params;

  const config = getModelConfig(makeSlug, modelSlug);

  if (!config) {
    notFound();
  }

  const { auctions, vehicleCount, auctionCount } = await getModelData(
    config.make,
    config.model
  );

  if (vehicleCount === 0) {
    notFound();
  }

  const vehicleName = `${config.makeName} ${config.modelName}`;

  const bids = auctions
    .map((lot) => lot.final_bid)
    .filter((bid): bid is number => bid !== null);

  const averageBid =
    bids.length > 0
      ? Math.round(bids.reduce((total, bid) => total + bid, 0) / bids.length)
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
              Archived Vehicles
            </div>

            <strong style={{ fontSize: "27px" }}>
              {vehicleCount.toLocaleString()}
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
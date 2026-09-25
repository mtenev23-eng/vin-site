import Link from "next/link";
import { supabase } from "../../../utils/supabase/client";

type Vehicle = {
  vin: string;
  year: number | null;
  make: string | null;
  model: string | null;
};

type AuctionLot = {
  auction_source: string;
  lot_number: string;
  vin: string;
  final_bid: number | null;
  auction_date: string | null;
  mileage: number | null;
  primary_damage: string | null;
  image_urls: string[] | null;
};

function formatMake(slug: string) {
  const makeMap: Record<string, string> = {
    bmw: "BMW",
    "mercedes-benz": "MERCEDES-BENZ",
    audi: "AUDI",
    ford: "FORD",
    toyota: "TOYOTA",
    tesla: "TESLA",
    lexus: "LEXUS",
    hyundai: "HYUNDAI",
  };

  return makeMap[slug.toLowerCase()] || slug.toUpperCase();
}

function displayMake(make: string) {
  if (make === "BMW") return "BMW";
  if (make === "MERCEDES-BENZ") return "Mercedes-Benz";

  return make
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatPrice(price: number | null) {
  if (price === null) return "Price unavailable";

  return `$${price.toLocaleString()}`;
}

function formatDate(date: string | null) {
  if (!date) return "Date unavailable";

  return new Date(`${date}T00:00:00`).toLocaleDateString(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    }
  );
}

async function getMakeAuctions(makeSlug: string) {
  const make = formatMake(makeSlug);

  const { data: vehicles, error: vehicleError } =
    await supabase
      .from("vehicles")
      .select("vin, year, make, model")
      .eq("make", make);

  if (vehicleError) {
    console.error("Make vehicle error:", vehicleError);
    return [];
  }

  if (!vehicles || vehicles.length === 0) {
    return [];
  }

  const vehicleMap = new Map<string, Vehicle>(
    vehicles.map((vehicle) => [
      vehicle.vin,
      vehicle,
    ])
  );

  const vins = vehicles.map((vehicle) => vehicle.vin);

  const { data: lots, error: lotError } =
    await supabase
      .from("auction_lots")
      .select(`
        auction_source,
        lot_number,
        vin,
        final_bid,
        auction_date,
        mileage,
        primary_damage,
        image_urls
      `)
      .in("vin", vins)
      .order("auction_date", {
        ascending: false,
        nullsFirst: false,
      })
      .limit(100);

  if (lotError) {
    console.error("Make auction error:", lotError);
    return [];
  }

  return (lots || []).map((lot: AuctionLot) => ({
    ...lot,
    vehicle: vehicleMap.get(lot.vin) || null,
  }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ make: string }>;
}) {
  const { make: makeSlug } = await params;

  const databaseMake = formatMake(makeSlug);
  const makeName = displayMake(databaseMake);

  const canonical =
    `https://salvagevinhistory.com/recent-auctions/${makeSlug.toLowerCase()}`;

  const title =
    `${makeName} Auction History - Copart & IAAI Sales`;

  const description =
    `Browse archived ${makeName} auction history from Copart and IAAI. View VINs, final bids, auction dates, damage information, photos and historical vehicle auction records.`;

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
export default async function MakePage({
  params,
}: {
  params: Promise<{ make: string }>;
}) {
  const { make: makeSlug } = await params;

  const databaseMake = formatMake(makeSlug);
  const makeName = displayMake(databaseMake);
  const auctions = await getMakeAuctions(makeSlug);

  return (
    <main
      style={{
        minHeight: "100vh",
        fontFamily: "Arial, sans-serif",
        color: "#171717",
        background: "#f6f7f8",
      }}
    >
      <header
        style={{
          background: "#ffffff",
          borderBottom: "1px solid #e8e8e8",
        }}
      >
        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            padding: "20px 24px",
          }}
        >
          <Link
            href="/"
            style={{
              color: "#171717",
              textDecoration: "none",
              fontWeight: "bold",
              fontSize: "20px",
            }}
          >
            Salvage VIN History
          </Link>
        </div>
      </header>

      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "60px 24px 90px",
        }}
      >
        <div style={{ marginBottom: "36px" }}>
          <div
            style={{
              fontSize: "13px",
              fontWeight: "bold",
              textTransform: "uppercase",
              letterSpacing: "1px",
              color: "#666",
              marginBottom: "10px",
            }}
          >
            Browse Auction History
          </div>

          <h1
            style={{
              fontSize: "42px",
              margin: "0 0 12px",
            }}
          >
            {makeName} Auction History
          </h1>

          <p
            style={{
              color: "#666",
              fontSize: "17px",
              margin: 0,
            }}
          >
            Browse recently archived {makeName} vehicles
            from Copart and IAAI.
          </p>
        </div>

        {auctions.length === 0 ? (
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e1e1e1",
              borderRadius: "12px",
              padding: "30px",
            }}
          >
            No {makeName} auction records are currently
            available.
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(250px, 1fr))",
              gap: "20px",
            }}
          >
            {auctions.map((lot) => {
              const vehicle = lot.vehicle;

              const vehicleName = [
                vehicle?.year,
                vehicle?.make,
                vehicle?.model,
              ]
                .filter(Boolean)
                .join(" ");

              const lotUrl =
                `/lot/${lot.auction_source.toLowerCase()}/${lot.lot_number}`;

              return (
                <Link
                  key={`${lot.auction_source}-${lot.lot_number}`}
                  href={lotUrl}
                  style={{
                    color: "inherit",
                    textDecoration: "none",
                  }}
                >
                  <article
                    style={{
                      background: "#ffffff",
                      border: "1px solid #e1e1e1",
                      borderRadius: "12px",
                      overflow: "hidden",
                      height: "100%",
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

                    <div style={{ padding: "18px" }}>
                      <div
                        style={{
                          fontSize: "12px",
                          fontWeight: "bold",
                          color: "#666",
                          marginBottom: "7px",
                          textTransform: "uppercase",
                        }}
                      >
                        {lot.auction_source} •{" "}
                        {formatDate(lot.auction_date)}
                      </div>

                      <h2
                        style={{
                          fontSize: "19px",
                          margin: "0 0 16px",
                        }}
                      >
                        {vehicleName || lot.vin}
                      </h2>

                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: "15px",
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontSize: "12px",
                              color: "#777",
                            }}
                          >
                            Final Bid
                          </div>

                          <strong
                            style={{ fontSize: "19px" }}
                          >
                            {formatPrice(lot.final_bid)}
                          </strong>
                        </div>

                        <div
                          style={{ textAlign: "right" }}
                        >
                          <div
                            style={{
                              fontSize: "12px",
                              color: "#777",
                            }}
                          >
                            Lot
                          </div>

                          <strong>
                            #{lot.lot_number}
                          </strong>
                        </div>
                      </div>

                      {lot.primary_damage && (
                        <div
                          style={{
                            borderTop:
                              "1px solid #eeeeee",
                            marginTop: "16px",
                            paddingTop: "13px",
                            fontSize: "13px",
                            color: "#666",
                          }}
                        >
                          Damage: {lot.primary_damage}
                        </div>
                      )}
                    </div>
                  </article>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
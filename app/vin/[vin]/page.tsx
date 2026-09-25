import Link from "next/link";
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
  vin: string;
  auction_source: string;
  lot_number: string;
  final_bid: number | null;
  auction_date: string | null;
  mileage: number | null;
  location: string | null;
  primary_damage: string | null;
  secondary_damage: string | null;
  color: string | null;
  engine: string | null;
  transmission: string | null;
  drivetrain: string | null;
  fuel: string | null;
  image_urls: string[] | null;
  source_url: string | null;
};

type VehicleHistory = {
  vehicle: Vehicle;
  lots: AuctionLot[];
};

async function getVehicleHistory(
  vin: string
): Promise<VehicleHistory | null> {
  const cleanedVin = vin.trim().toUpperCase();

  const { data: vehicle, error: vehicleError } =
    await supabase
      .from("vehicles")
      .select("*")
      .eq("vin", cleanedVin)
      .maybeSingle();

  if (vehicleError) {
    console.error("Vehicle Supabase error:", vehicleError);
    return null;
  }

  if (!vehicle) {
    return null;
  }

  const { data: lots, error: lotsError } =
    await supabase
      .from("auction_lots")
      .select("*")
      .eq("vin", cleanedVin)
      .order("auction_date", {
        ascending: false,
        nullsFirst: false,
      });

  if (lotsError) {
    console.error("Auction lots Supabase error:", lotsError);
    return null;
  }

  return {
    vehicle,
    lots: lots || [],
  };
}

function formatMileage(value: number | null) {
  if (value === null) {
    return "Not available";
  }

  return `${value.toLocaleString()} miles`;
}

function formatBid(value: number | null) {
  if (value === null) {
    return "Not available";
  }

  return `$${value.toLocaleString()}`;
}

function formatDate(value: string | null) {
  if (!value) {
    return "Date not available";
  }

  const date = new Date(`${value}T00:00:00`);

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ vin: string }>;
}) {
  const { vin } = await params;
  const cleanedVin = vin.trim().toUpperCase();
  const history = await getVehicleHistory(cleanedVin);

  const canonicalUrl = `https://salvagevinhistory.com/vin/${cleanedVin}`;

  if (!history) {
    return {
      title: `VIN ${cleanedVin} - Vehicle Auction History`,
      description: `Search archived vehicle auction history for VIN ${cleanedVin}.`,
      robots: {
        index: false,
        follow: true,
      },
    };
  }

  const { vehicle, lots } = history;

  const vehicleName = [
    vehicle.year,
    vehicle.make,
    vehicle.model,
  ]
    .filter(Boolean)
    .join(" ");

  const title = `${vehicleName} Auction History - VIN ${vehicle.vin}`;

  const description =
    `${vehicleName} VIN ${vehicle.vin} auction history. ` +
    `View ${lots.length} archived auction record${lots.length === 1 ? "" : "s"} ` +
    `with sale price, mileage, damage details and auction photos.`;

  const firstImage =
    lots.find(
      (lot) => lot.image_urls && lot.image_urls.length > 0
    )?.image_urls?.[0] || undefined;

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
      ...(firstImage
        ? {
            images: [
              {
                url: firstImage,
                alt: `${vehicleName} auction history`,
              },
            ],
          }
        : {}),
    },

    twitter: {
      card: firstImage ? "summary_large_image" : "summary",
      title,
      description,
      ...(firstImage
        ? {
            images: [firstImage],
          }
        : {}),
    },
  };
}

export default async function VinPage({
  params,
}: {
  params: Promise<{ vin: string }>;
}) {
  const { vin } = await params;
  const history = await getVehicleHistory(vin);

  if (!history) {
    return (
      <main
        style={{
          minHeight: "100vh",
          background: "#fff",
          fontFamily: "Arial, sans-serif",
          color: "#171717",
        }}
      >
        <header
          style={{
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

        <section
          style={{
            maxWidth: "900px",
            margin: "0 auto",
            padding: "80px 24px",
          }}
        >
          <div
            style={{
              fontSize: "13px",
              fontWeight: "bold",
              textTransform: "uppercase",
              letterSpacing: "1px",
              color: "#777",
              marginBottom: "10px",
            }}
          >
            Vehicle Search
          </div>

          <h1
            style={{
              fontSize: "38px",
              margin: "0 0 14px",
            }}
          >
            Vehicle Not Found
          </h1>

          <p
            style={{
              color: "#666",
              fontSize: "16px",
              lineHeight: 1.6,
              marginBottom: "28px",
            }}
          >
            No archived auction history was found for VIN{" "}
            <strong>{vin.toUpperCase()}</strong>.
          </p>

          <Link
            href="/"
            style={{
              display: "inline-block",
              padding: "12px 18px",
              background: "#171717",
              color: "#fff",
              borderRadius: "7px",
              textDecoration: "none",
              fontWeight: "bold",
              fontSize: "14px",
            }}
          >
            Search another vehicle
          </Link>
        </section>
      </main>
    );
  }

  const { vehicle, lots } = history;

  const vehicleName = [
    vehicle.year,
    vehicle.make,
    vehicle.model,
  ]
    .filter(Boolean)
    .join(" ");

  const totalPhotos = lots.reduce(
    (total, lot) =>
      total + (lot.image_urls?.length || 0),
    0
  );

  const latestLot = lots[0] || null;

  return (
    <main
      style={{
        minHeight: "100vh",
        fontFamily: "Arial, sans-serif",
        color: "#171717",
        background: "#ffffff",
      }}
    >
      {/* HEADER */}

      <header
        style={{
          borderBottom: "1px solid #e8e8e8",
          background: "#ffffff",
        }}
      >
        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            padding: "20px 24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "20px",
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

          <Link
            href="/"
            style={{
              color: "#555",
              textDecoration: "none",
              fontSize: "14px",
            }}
          >
            ← Search another vehicle
          </Link>
        </div>
      </header>

      {/* VEHICLE HERO */}

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
            padding: "48px 24px 44px",
          }}
        >
          <div
            style={{
              fontSize: "12px",
              fontWeight: "bold",
              textTransform: "uppercase",
              letterSpacing: "1px",
              color: "#666",
              marginBottom: "10px",
            }}
          >
            Vehicle Auction History
          </div>

          <h1
            style={{
              fontSize: "42px",
              lineHeight: 1.12,
              margin: "0 0 12px",
              letterSpacing: "-0.5px",
            }}
          >
            {vehicleName || vehicle.vin}
          </h1>

          {vehicle.trim && (
            <div
              style={{
                fontSize: "17px",
                color: "#555",
                marginBottom: "16px",
              }}
            >
              {vehicle.trim}
            </div>
          )}

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "10px",
              fontSize: "15px",
              color: "#555",
            }}
          >
            <span>VIN</span>

            <strong
              style={{
                color: "#171717",
                letterSpacing: "0.3px",
              }}
            >
              {vehicle.vin}
            </strong>
          </div>
        </div>
      </section>

      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "34px 24px 80px",
        }}
      >
        {/* SUMMARY */}

        <section
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "14px",
            marginBottom: "48px",
          }}
        >
          <div
            style={{
              padding: "20px 22px",
              border: "1px solid #e2e2e2",
              borderRadius: "10px",
              background: "#fff",
            }}
          >
            <div
              style={{
                fontSize: "12px",
                color: "#777",
                textTransform: "uppercase",
                letterSpacing: "0.7px",
                marginBottom: "7px",
              }}
            >
              Auction Records
            </div>

            <strong style={{ fontSize: "25px" }}>
              {lots.length}
            </strong>
          </div>

          <div
            style={{
              padding: "20px 22px",
              border: "1px solid #e2e2e2",
              borderRadius: "10px",
              background: "#fff",
            }}
          >
            <div
              style={{
                fontSize: "12px",
                color: "#777",
                textTransform: "uppercase",
                letterSpacing: "0.7px",
                marginBottom: "7px",
              }}
            >
              Archived Photos
            </div>

            <strong style={{ fontSize: "25px" }}>
              {totalPhotos}
            </strong>
          </div>

          <div
            style={{
              padding: "20px 22px",
              border: "1px solid #e2e2e2",
              borderRadius: "10px",
              background: "#fff",
            }}
          >
            <div
              style={{
                fontSize: "12px",
                color: "#777",
                textTransform: "uppercase",
                letterSpacing: "0.7px",
                marginBottom: "7px",
              }}
            >
              Latest Auction
            </div>

            <strong
              style={{
                fontSize: "17px",
                lineHeight: 1.4,
              }}
            >
              {latestLot
                ? formatDate(latestLot.auction_date)
                : "Not available"}
            </strong>
          </div>

          <div
            style={{
              padding: "20px 22px",
              border: "1px solid #e2e2e2",
              borderRadius: "10px",
              background: "#fff",
            }}
          >
            <div
              style={{
                fontSize: "12px",
                color: "#777",
                textTransform: "uppercase",
                letterSpacing: "0.7px",
                marginBottom: "7px",
              }}
            >
              Latest Sale
            </div>

            <strong
              style={{
                fontSize: "25px",
              }}
            >
              {latestLot
                ? formatBid(latestLot.final_bid)
                : "N/A"}
            </strong>
          </div>
        </section>

        {/* AUCTION HISTORY HEADING */}

        <section>
          <div
            style={{
              marginBottom: "22px",
            }}
          >
            <h2
              style={{
                fontSize: "29px",
                margin: "0 0 8px",
              }}
            >
              Auction History
            </h2>

            <p
              style={{
                color: "#666",
                fontSize: "15px",
                lineHeight: 1.6,
                margin: 0,
              }}
            >
              Archived auction appearances associated
              with VIN {vehicle.vin}.
            </p>
          </div>

          {lots.length === 0 && (
            <div
              style={{
                padding: "24px",
                border: "1px solid #e2e2e2",
                borderRadius: "10px",
              }}
            >
              No auction lots are currently archived for
              this vehicle.
            </div>
          )}

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "20px",
            }}
          >
            {lots.map((lot) => {
              const source =
                lot.auction_source.toLowerCase();

              const lotUrl =
                `/lot/${source}/${lot.lot_number}`;

              return (
                <article
                  key={`${lot.auction_source}-${lot.lot_number}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "minmax(280px, 380px) 1fr",
                    border: "1px solid #dedede",
                    borderRadius: "12px",
                    overflow: "hidden",
                    background: "#fff",
                  }}
                >
                  {/* PHOTO */}

                  <Link
                    href={lotUrl}
                    style={{
                      display: "block",
                      background: "#f3f3f3",
                      minHeight: "250px",
                    }}
                  >
                    {lot.image_urls &&
                    lot.image_urls.length > 0 ? (
                      <img
                        src={lot.image_urls[0]}
                        alt={`${vehicleName} ${lot.auction_source} auction lot ${lot.lot_number}`}
                        loading="lazy"
                        style={{
                          width: "100%",
                          height: "100%",
                          minHeight: "250px",
                          objectFit: "cover",
                          display: "block",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          height: "100%",
                          minHeight: "250px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#777",
                          fontSize: "14px",
                        }}
                      >
                        No photo available
                      </div>
                    )}
                  </Link>

                  {/* AUCTION DETAILS */}

                  <div
                    style={{
                      padding: "26px 28px",
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: "8px",
                        marginBottom: "9px",
                      }}
                    >
                      <span
  style={{
    display: "inline-block",
    background: "#171717",
    color: "#ffffff",
    padding: "7px 11px",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: "700",
    letterSpacing: "0.7px",
    textTransform: "uppercase",
  }}
>
  {lot.auction_source}
</span>

                      <span
                        style={{
                          color: "#777",
                          fontSize: "13px",
                        }}
                      >
                        {formatDate(lot.auction_date)}
                      </span>
                    </div>

                    <h3
                      style={{
                        margin: "0 0 22px",
                        fontSize: "22px",
                      }}
                    >
                      Lot #{lot.lot_number}
                    </h3>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(2, minmax(130px, 1fr))",
                        gap: "18px 28px",
                        marginBottom: "26px",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            color: "#777",
                            fontSize: "12px",
                            textTransform: "uppercase",
                            letterSpacing: "0.5px",
                            marginBottom: "5px",
                          }}
                        >
                          Final Bid
                        </div>

                        <strong
                          style={{
                            fontSize: "20px",
                          }}
                        >
                          {formatBid(lot.final_bid)}
                        </strong>
                      </div>

                      <div>
                        <div
                          style={{
                            color: "#777",
                            fontSize: "12px",
                            textTransform: "uppercase",
                            letterSpacing: "0.5px",
                            marginBottom: "5px",
                          }}
                        >
                          Mileage
                        </div>

                        <strong>
                          {formatMileage(lot.mileage)}
                        </strong>
                      </div>

                      <div>
                        <div
                          style={{
                            color: "#777",
                            fontSize: "12px",
                            textTransform: "uppercase",
                            letterSpacing: "0.5px",
                            marginBottom: "5px",
                          }}
                        >
                          Primary Damage
                        </div>

                        <strong>
                          {lot.primary_damage ||
                            "Not available"}
                        </strong>
                      </div>

                      <div>
                        <div
                          style={{
                            color: "#777",
                            fontSize: "12px",
                            textTransform: "uppercase",
                            letterSpacing: "0.5px",
                            marginBottom: "5px",
                          }}
                        >
                          Location
                        </div>

                        <strong>
                          {lot.location ||
                            "Not available"}
                        </strong>
                      </div>
                    </div>

                    <div
                      style={{
                        marginTop: "auto",
                        paddingTop: "4px",
                      }}
                    >
                      <Link
                        href={lotUrl}
                        style={{
                          display: "inline-block",
                          background: "#171717",
                          color: "#fff",
                          textDecoration: "none",
                          fontWeight: "bold",
                          fontSize: "14px",
                          padding: "11px 16px",
                          borderRadius: "6px",
                        }}
                      >
                        View auction details →
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* VEHICLE INFORMATION */}

        <section
          style={{
            marginTop: "48px",
            borderTop: "1px solid #e5e5e5",
            paddingTop: "34px",
          }}
        >
          <h2
            style={{
              margin: "0 0 20px",
              fontSize: "24px",
            }}
          >
            Vehicle Information
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(180px, 1fr))",
              border: "1px solid #e2e2e2",
              borderRadius: "10px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "18px 20px",
              }}
            >
              <div
                style={{
                  color: "#777",
                  fontSize: "12px",
                  textTransform: "uppercase",
                  marginBottom: "5px",
                }}
              >
                VIN
              </div>

              <strong>{vehicle.vin}</strong>
            </div>

            <div
              style={{
                padding: "18px 20px",
              }}
            >
              <div
                style={{
                  color: "#777",
                  fontSize: "12px",
                  textTransform: "uppercase",
                  marginBottom: "5px",
                }}
              >
                Year
              </div>

              <strong>
                {vehicle.year || "Not available"}
              </strong>
            </div>

            <div
              style={{
                padding: "18px 20px",
              }}
            >
              <div
                style={{
                  color: "#777",
                  fontSize: "12px",
                  textTransform: "uppercase",
                  marginBottom: "5px",
                }}
              >
                Make
              </div>

              <strong>
                {vehicle.make || "Not available"}
              </strong>
            </div>

            <div
              style={{
                padding: "18px 20px",
              }}
            >
              <div
                style={{
                  color: "#777",
                  fontSize: "12px",
                  textTransform: "uppercase",
                  marginBottom: "5px",
                }}
              >
                Model
              </div>

              <strong>
                {vehicle.model || "Not available"}
              </strong>
            </div>
          </div>
        </section>

        {/* RESEARCH NOTE */}

        <section
          style={{
            marginTop: "42px",
            padding: "24px 26px",
            background: "#f6f7f8",
            borderRadius: "10px",
          }}
        >
          <strong
            style={{
              display: "block",
              marginBottom: "7px",
              fontSize: "15px",
            }}
          >
            About this auction history
          </strong>

          <p
            style={{
              color: "#666",
              fontSize: "14px",
              lineHeight: 1.65,
              margin: 0,
            }}
          >
            Archived auction records reflect information
            associated with the vehicle at the time of each
            auction listing. A vehicle's condition, mileage,
            ownership or other details may have changed
            since the recorded auction date.
          </p>
        </section>
      </div>
    </main>
  );
}
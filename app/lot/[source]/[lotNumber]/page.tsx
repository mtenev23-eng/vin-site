import Link from "next/link";
import { supabase } from "../../../../utils/supabase/client";

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

type Vehicle = {
  vin: string;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
};

type LotRecord = {
  lot: AuctionLot;
  vehicle: Vehicle | null;
};

async function getLot(
  source: string,
  lotNumber: string
): Promise<LotRecord | null> {
  const cleanedSource = source.trim().toUpperCase();
  const cleanedLotNumber = lotNumber.trim();

  const { data: lot, error: lotError } =
    await supabase
      .from("auction_lots")
      .select("*")
      .eq("auction_source", cleanedSource)
      .eq("lot_number", cleanedLotNumber)
      .maybeSingle();

  if (lotError) {
    console.error("Auction lot Supabase error:", lotError);
    return null;
  }

  if (!lot) {
    return null;
  }

  const { data: vehicle, error: vehicleError } =
    await supabase
      .from("vehicles")
      .select("*")
      .eq("vin", lot.vin)
      .maybeSingle();

  if (vehicleError) {
    console.error("Vehicle Supabase error:", vehicleError);
  }

  return {
    lot,
    vehicle: vehicle || null,
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
    return "Not available";
  }

  const date = new Date(`${value}T00:00:00`);

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function display(
  value: string | number | null | undefined
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "Not available";
  }

  return value;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{
    source: string;
    lotNumber: string;
  }>;
}) {
  const { source, lotNumber } = await params;
  const record = await getLot(source, lotNumber);

  if (!record) {
    return {
      title: `Auction Lot ${lotNumber}`,
      description: `Vehicle auction record for lot ${lotNumber}.`,
    };
  }

  const { lot, vehicle } = record;

  const vehicleName = vehicle
    ? [vehicle.year, vehicle.make, vehicle.model]
        .filter(Boolean)
        .join(" ")
    : lot.vin;

  return {
    title: `${vehicleName} - ${lot.auction_source} Lot ${lot.lot_number}`,
    description: `${vehicleName} auction record from ${lot.auction_source}. Lot ${lot.lot_number}, VIN ${lot.vin}, sale price, mileage, damage and auction photos.`,
  };
}

export default async function LotPage({
  params,
}: {
  params: Promise<{
    source: string;
    lotNumber: string;
  }>;
}) {
  const { source, lotNumber } = await params;
  const record = await getLot(source, lotNumber);

  if (!record) {
    return (
      <main
        style={{
          minHeight: "100vh",
          background: "#ffffff",
          color: "#171717",
          fontFamily: "Arial, sans-serif",
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
            Auction Record
          </div>

          <h1
            style={{
              fontSize: "38px",
              margin: "0 0 14px",
            }}
          >
            Auction Lot Not Found
          </h1>

          <p
            style={{
              color: "#666",
              fontSize: "16px",
              lineHeight: 1.6,
              marginBottom: "28px",
            }}
          >
            No archived {source.toUpperCase()} auction
            record was found for lot{" "}
            <strong>{lotNumber}</strong>.
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

  const { lot, vehicle } = record;

  const vehicleName = vehicle
    ? [vehicle.year, vehicle.make, vehicle.model]
        .filter(Boolean)
        .join(" ")
    : lot.vin;

  const details = [
    ["Auction Source", lot.auction_source],
    ["Lot Number", lot.lot_number],
    ["Final Bid", formatBid(lot.final_bid)],
    ["Auction Date", formatDate(lot.auction_date)],
    ["Location", lot.location],
    ["Mileage", formatMileage(lot.mileage)],
    ["Primary Damage", lot.primary_damage],
    ["Secondary Damage", lot.secondary_damage],
    ["Color", lot.color],
    ["Engine", lot.engine],
    ["Transmission", lot.transmission],
    ["Drivetrain", lot.drivetrain],
    ["Fuel", lot.fuel],
  ];

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#ffffff",
        color: "#171717",
        fontFamily: "Arial, sans-serif",
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
            href={`/vin/${lot.vin}`}
            style={{
              color: "#555",
              textDecoration: "none",
              fontSize: "14px",
            }}
          >
            ← View VIN history
          </Link>
        </div>
      </header>

      {/* AUCTION HERO */}

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
            padding: "45px 24px 42px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "10px",
              marginBottom: "13px",
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
                fontSize: "13px",
                color: "#666",
              }}
            >
              Auction Record
            </span>
          </div>

          <h1
            style={{
              fontSize: "42px",
              lineHeight: 1.12,
              margin: "0 0 10px",
              letterSpacing: "-0.5px",
            }}
          >
            {vehicleName}
          </h1>

          {vehicle?.trim && (
            <div
              style={{
                fontSize: "17px",
                color: "#555",
                marginBottom: "15px",
              }}
            >
              {vehicle.trim}
            </div>
          )}

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "20px",
              fontSize: "15px",
              color: "#555",
            }}
          >
            <span>
              Lot{" "}
              <strong style={{ color: "#171717" }}>
                #{lot.lot_number}
              </strong>
            </span>

            <span>
              VIN{" "}
              <Link
                href={`/vin/${lot.vin}`}
                style={{
                  color: "#171717",
                  fontWeight: "bold",
                  textDecoration: "none",
                }}
              >
                {lot.vin}
              </Link>
            </span>
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
        {/* KEY STATS */}

        <section
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "14px",
            marginBottom: "42px",
          }}
        >
          <div
            style={{
              padding: "20px 22px",
              border: "1px solid #e2e2e2",
              borderRadius: "10px",
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
              Final Bid
            </div>

            <strong
              style={{
                fontSize: "26px",
              }}
            >
              {formatBid(lot.final_bid)}
            </strong>
          </div>

          <div
            style={{
              padding: "20px 22px",
              border: "1px solid #e2e2e2",
              borderRadius: "10px",
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
              Mileage
            </div>

            <strong
              style={{
                fontSize: "20px",
              }}
            >
              {formatMileage(lot.mileage)}
            </strong>
          </div>

          <div
            style={{
              padding: "20px 22px",
              border: "1px solid #e2e2e2",
              borderRadius: "10px",
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
              Auction Date
            </div>

            <strong
              style={{
                fontSize: "18px",
              }}
            >
              {formatDate(lot.auction_date)}
            </strong>
          </div>

          <div
            style={{
              padding: "20px 22px",
              border: "1px solid #e2e2e2",
              borderRadius: "10px",
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
              Primary Damage
            </div>

            <strong
              style={{
                fontSize: "17px",
              }}
            >
              {display(lot.primary_damage)}
            </strong>
          </div>
        </section>

        {/* PHOTOS */}

        {lot.image_urls && lot.image_urls.length > 0 && (
          <section
            style={{
              marginBottom: "48px",
            }}
          >
            <div
              style={{
                marginBottom: "18px",
              }}
            >
              <h2
                style={{
                  fontSize: "28px",
                  margin: "0 0 7px",
                }}
              >
                Auction Photos
              </h2>

              <p
                style={{
                  color: "#666",
                  fontSize: "14px",
                  margin: 0,
                }}
              >
                {lot.image_urls.length} archived auction{" "}
                {lot.image_urls.length === 1
                  ? "photo"
                  : "photos"}{" "}
                for this vehicle.
              </p>
            </div>

            {/* MAIN PHOTO */}

            <div
              style={{
                background: "#f3f3f3",
                border: "1px solid #e2e2e2",
                borderRadius: "12px",
                overflow: "hidden",
              }}
            >
              <img
                src={lot.image_urls[0]}
                alt={`${vehicleName} ${lot.auction_source} lot ${lot.lot_number} auction photo`}
                style={{
                  width: "100%",
                  maxHeight: "700px",
                  objectFit: "contain",
                  display: "block",
                }}
              />
            </div>

            {/* OTHER PHOTOS */}

            {lot.image_urls.length > 1 && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(210px, 1fr))",
                  gap: "12px",
                  marginTop: "12px",
                }}
              >
                {lot.image_urls
                  .slice(1)
                  .map((image, index) => (
                    <div
                      key={image}
                      style={{
                        background: "#f3f3f3",
                        border: "1px solid #e5e5e5",
                        borderRadius: "9px",
                        overflow: "hidden",
                      }}
                    >
                      <img
                        src={image}
                        alt={`${vehicleName} ${lot.auction_source} lot ${lot.lot_number} auction photo ${
                          index + 2
                        }`}
                        loading="lazy"
                        style={{
                          width: "100%",
                          height: "190px",
                          objectFit: "cover",
                          display: "block",
                        }}
                      />
                    </div>
                  ))}
              </div>
            )}
          </section>
        )}

        {/* AUCTION DETAILS */}

        <section
          style={{
            marginBottom: "44px",
          }}
        >
          <div
            style={{
              marginBottom: "18px",
            }}
          >
            <h2
              style={{
                fontSize: "28px",
                margin: "0 0 7px",
              }}
            >
              Auction Details
            </h2>

            <p
              style={{
                color: "#666",
                fontSize: "14px",
                lineHeight: 1.6,
                margin: 0,
              }}
            >
              Archived information associated with{" "}
              {lot.auction_source} lot #{lot.lot_number}.
            </p>
          </div>

          <div
            style={{
              border: "1px solid #e2e2e2",
              borderRadius: "10px",
              overflow: "hidden",
            }}
          >
            {details.map(([label, value], index) => (
              <div
                key={String(label)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "220px 1fr",
                  gap: "20px",
                  padding: "15px 22px",
                  background:
                    index % 2 === 0
                      ? "#ffffff"
                      : "#fafafa",
                  borderBottom:
                    index === details.length - 1
                      ? "none"
                      : "1px solid #eeeeee",
                }}
              >
                <span
                  style={{
                    color: "#666",
                    fontSize: "14px",
                  }}
                >
                  {label}
                </span>

                <strong
                  style={{
                    fontSize: "14px",
                  }}
                >
                  {display(value)}
                </strong>
              </div>
            ))}
          </div>
        </section>

        {/* VEHICLE HISTORY */}

        <section
          style={{
            padding: "28px",
            background: "#f6f7f8",
            borderRadius: "10px",
          }}
        >
          <div
            style={{
              fontSize: "12px",
              fontWeight: "bold",
              color: "#777",
              textTransform: "uppercase",
              letterSpacing: "0.7px",
              marginBottom: "8px",
            }}
          >
            Vehicle History
          </div>

          <h2
            style={{
              margin: "0 0 9px",
              fontSize: "23px",
            }}
          >
            View all auction records for this VIN
          </h2>

          <p
            style={{
              margin: "0 0 20px",
              color: "#666",
              fontSize: "15px",
              lineHeight: 1.6,
            }}
          >
            See other archived auction appearances
            associated with VIN {lot.vin}.
          </p>

          <Link
            href={`/vin/${lot.vin}`}
            style={{
              display: "inline-block",
              background: "#171717",
              color: "#ffffff",
              textDecoration: "none",
              fontWeight: "bold",
              fontSize: "14px",
              padding: "11px 16px",
              borderRadius: "6px",
            }}
          >
            View complete VIN history →
          </Link>
        </section>

        {/* ARCHIVE NOTE */}

        <section
          style={{
            marginTop: "32px",
            paddingTop: "28px",
            borderTop: "1px solid #e5e5e5",
          }}
        >
          <p
            style={{
              color: "#777",
              fontSize: "13px",
              lineHeight: 1.65,
              margin: 0,
              maxWidth: "850px",
            }}
          >
            This page contains archived vehicle auction
            information associated with the auction listing
            shown above. Vehicle condition, mileage,
            ownership and other details may have changed
            since the auction date. Archived sale amounts
            may not include auction fees, taxes,
            transportation, repairs or other costs.
          </p>
        </section>
      </div>
    </main>
  );
}
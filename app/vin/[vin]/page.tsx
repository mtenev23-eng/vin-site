import { cache } from "react";
import Link from "next/link";
import { supabase } from "../../../utils/supabase/client";
import VinPhotoGallery from "./VinPhotoGallery";
import RemoveListingButton from "../../components/RemoveListingButton";
import { slugifyModel } from "../../../utils/vehicle-models";
export const revalidate = 86400;
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

  loss_type: string | null;
  start_code: string | null;
  keys_present: boolean | null;
  seller: string | null;
  seller_type: string | null;
  sale_document: string | null;
  body_style: string | null;
  acv: number | null;
  estimated_repair_cost: number | null;

  image_urls: string[] | null;
  source_url: string | null;
};

type VehicleHistory = {
  vehicle: Vehicle;
  lots: AuctionLot[];
};

const getVehicleHistory = cache(async function getVehicleHistory(
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
});
async function getSimilarLots(
  make: string | null,
  model: string | null,
  currentVin: string
) {
  if (!make || !model) {
    return [];
  }

  const { data, error } = await supabase
    .from("vehicle_auction_archive")
    .select(`
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
    `)
    .eq("make", make)
    .eq("model", model)
    .neq("vin", currentVin)
    .not("auction_date", "is", null)
    .order("auction_date", {
      ascending: false,
      nullsFirst: false,
    })
    .limit(24);

  if (error) {
    console.error("Similar VIN lookup error:", error);
    return [];
  }

  const uniqueVins = new Map<string, (typeof data)[number]>();

  for (const row of data || []) {
    if (!uniqueVins.has(row.vin)) {
      uniqueVins.set(row.vin, row);
    }

    if (uniqueVins.size === 8) {
      break;
    }
  }

  return Array.from(uniqueVins.values());
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
function formatLocation(value: string | null) {
  if (!value) {
    return null;
  }

  const cleaned = value.trim();

  const stateCityMatch = cleaned.match(
    /^([A-Z]{2})\s*-\s*(.+)$/i
  );

  if (stateCityMatch) {
    const state = stateCityMatch[1].toUpperCase();

    const city = stateCityMatch[2]
      .trim()
      .toLowerCase()
      .replace(/\b\w/g, (char) =>
        char.toUpperCase()
      );

    return `${city}, ${state}`;
  }

  return cleaned
    .toLowerCase()
    .replace(/\b\w/g, (char) =>
      char.toUpperCase()
    );
}
function displayModel(model: string | null | undefined) {
  if (!model) return null;

  const modelMap: Record<string, string> = {
    "2ER": "2 Series",
    "3ER": "3 Series",
    "4ER": "4 Series",
    "5ER": "5 Series",
    "6ER": "6 Series",
    "7ER": "7 Series",
    "8ER": "8 Series",
  };

  return modelMap[model.toUpperCase()] || model;
}

function titleCaseValue(value: string | null | undefined) {
  if (!value) return null;

  const keepUppercase = new Set([
    "BMW",
    "GMC",
    "RAM",
    "AMG",
    "GT",
    "GTI",
    "EV",
    "AWD",
    "FWD",
    "RWD",
    "4WD",
    "CVT",
    "VIN",
  ]);

  return value
    .toLowerCase()
    .replace(/\b\w+/g, (word) => {
      const upper = word.toUpperCase();

      if (keepUppercase.has(upper)) {
        return upper;
      }

      return word.charAt(0).toUpperCase() + word.slice(1);
    });
}

type ComparableStats = {
  average: number;
  count: number;
  minYear: number | null;
  maxYear: number | null;
};

type ComparableRow = {
  auction_id: number;
  final_bid: number | null;
  year: number | null;
};

async function getComparableStats(
  vehicle: Vehicle,
  currentLotId: number
): Promise<ComparableStats | null> {
  if (!vehicle.make || !vehicle.model) {
    return null;
  }

  async function fetchComparables(
    minYear?: number,
    maxYear?: number
  ): Promise<ComparableRow[]> {
    let query = supabase
      .from("vehicle_auction_archive")
      .select(`
        auction_id,
        final_bid,
        year
      `)
      .eq("make", vehicle.make)
      .eq("model", vehicle.model)
      .neq("auction_id", currentLotId)
      .not("final_bid", "is", null)
      .gte("final_bid", 1000)
      .order("auction_date", {
        ascending: false,
        nullsFirst: false,
      })
      .limit(100);

    if (
      minYear !== undefined &&
      maxYear !== undefined
    ) {
      query = query
        .gte("year", minYear)
        .lte("year", maxYear);
    }

    const { data, error } = await query;

    if (error) {
      console.error(
        "Comparable auction lookup error:",
        error
      );

      return [];
    }

    return ((data || []) as ComparableRow[]).filter(
      (row) =>
        row.final_bid !== null &&
        Number(row.final_bid) >= 1000
    );
  }

  let comparables: ComparableRow[] = [];

  /*
    First preference:
    same make + model + exact model year.
  */
  if (vehicle.year !== null) {
    comparables = await fetchComparables(
      vehicle.year,
      vehicle.year
    );
  }

  /*
    If we don't have enough exact-year sales,
    expand to +/- 2 model years.
  */
  if (
    comparables.length < 5 &&
    vehicle.year !== null
  ) {
    comparables = await fetchComparables(
      vehicle.year - 2,
      vehicle.year + 2
    );
  }

  /*
    If year is unavailable, use make + model.
  */
  if (
    comparables.length < 5 &&
    vehicle.year === null
  ) {
    comparables = await fetchComparables();
  }

  if (comparables.length < 5) {
    return null;
  }

  const bids = comparables.map(
    (row) => Number(row.final_bid)
  );

  const average = Math.round(
    bids.reduce(
      (total, bid) => total + bid,
      0
    ) / bids.length
  );

  const years = comparables
    .map((row) => row.year)
    .filter(
      (year): year is number =>
        typeof year === "number"
    );

  return {
    average,
    count: comparables.length,
    minYear:
      years.length > 0
        ? Math.min(...years)
        : null,
    maxYear:
      years.length > 0
        ? Math.max(...years)
        : null,
  };
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
  displayModel(vehicle.model),
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
  displayModel(vehicle.model),
]
  .filter(Boolean)
  .join(" ");
const makeSlug = vehicle.make
  ? vehicle.make
      .toLowerCase()
      .trim()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
  : null;

  const similarLots = await getSimilarLots(
  vehicle.make,
  vehicle.model,
  vehicle.vin
);
  const totalPhotos = lots.reduce(
    (total, lot) =>
      total + (lot.image_urls?.length || 0),
    0
  );

  const latestLot = lots[0] || null;
  const comparableStats = latestLot
  ? await getComparableStats(
      vehicle,
      latestLot.id
    )
  : null;
const auctionSources = Array.from(
  new Set(
    lots
      .map((lot) => lot.auction_source)
      .filter(Boolean)
  )
);

const cleanedTrim = titleCaseValue(
  vehicle.trim
    ?.replace(
      new RegExp(`^${vehicle.year}\\s+`, "i"),
      ""
    )
    .trim()
);

const overviewVehicleName = [
  vehicle.year,
  titleCaseValue(vehicle.make),
  titleCaseValue(displayModel(vehicle.model)),
]
  .filter(Boolean)
  .join(" ");

let marketComparison: string | null = null;

if (
  latestLot &&
  latestLot.final_bid !== null &&
  comparableStats
) {
  const difference =
    latestLot.final_bid - comparableStats.average;

  const absoluteDifference = Math.abs(difference);

  const comparableYearText =
    comparableStats.minYear !== null &&
    comparableStats.maxYear !== null
      ? comparableStats.minYear === comparableStats.maxYear
        ? `${comparableStats.minYear} `
        : `${comparableStats.minYear}-${comparableStats.maxYear} `
      : "";

  const comparableLabel = `${comparableYearText}${
    titleCaseValue(vehicle.make) || vehicle.make
  } ${
    titleCaseValue(displayModel(vehicle.model)) ||
    displayModel(vehicle.model)
  }`
    .replace(/\s+/g, " ")
    .trim();

  if (absoluteDifference < 250) {
    marketComparison =
      `The archived final bid was ${formatBid(
        latestLot.final_bid
      )}, broadly in line with the ${formatBid(
        comparableStats.average
      )} average for ${comparableLabel} auction records, based on ${
        comparableStats.count
      } comparable records.`;
  } else {
    marketComparison =
      `The archived final bid was ${formatBid(
        latestLot.final_bid
      )}, which was ${formatBid(absoluteDifference)} ${
        difference > 0 ? "above" : "below"
      } the ${formatBid(
        comparableStats.average
      )} average for ${comparableLabel} auction records, based on ${
        comparableStats.count
      } comparable records.`;
  }
}

const vehicleDetailParts = [
  latestLot?.engine
    ? `${latestLot.engine} engine`
    : null,

  latestLot?.transmission
    ? `${titleCaseValue(latestLot.transmission)} transmission`
    : null,

  latestLot?.drivetrain
    ? titleCaseValue(latestLot.drivetrain)
    : null,

  latestLot?.fuel
    ? `${titleCaseValue(latestLot.fuel)} fuel`
    : null,
].filter(Boolean);

const conditionParts = [
  latestLot?.primary_damage
    ? `primary damage listed as ${titleCaseValue(
        latestLot.primary_damage
      )}`
    : null,

  latestLot?.secondary_damage &&
  latestLot.secondary_damage.toUpperCase() !== "UNKNOWN"
    ? `secondary damage listed as ${titleCaseValue(
        latestLot.secondary_damage
      )}`
    : null,

  latestLot?.start_code
    ? `a start code of ${titleCaseValue(latestLot.start_code)}`
    : null,
].filter(Boolean);

const vehicleOverview = latestLot
  ? [
      `${overviewVehicleName || "This vehicle"}${
        cleanedTrim
          ? ` ${cleanedTrim}`
          : ""
      } is archived under VIN ${vehicle.vin}.`,

      vehicleDetailParts.length > 0
        ? `Reported specifications include ${vehicleDetailParts.join(
            ", "
          )}.`
        : null,

      `${
        latestLot.auction_source
          ? `The most recent archived auction appearance was recorded through ${latestLot.auction_source}`
          : "The most recent archived auction appearance"
      }${
        latestLot.auction_date
          ? ` on ${formatDate(latestLot.auction_date)}`
          : ""
      }${
        latestLot.location
  ? ` in ${formatLocation(latestLot.location)}`
  : ""
      }${
        latestLot.mileage !== null
          ? ` with ${formatMileage(latestLot.mileage)}`
          : ""
      }.`,

      conditionParts.length > 0
        ? `The auction record reported ${conditionParts.join(
            ", "
          )}.`
        : null,

      marketComparison ||
        (latestLot.final_bid !== null
          ? `The archived final bid was ${formatBid(
              latestLot.final_bid
            )}.`
          : null),

      latestLot.sale_document
        ? `The sale document was listed as ${latestLot.sale_document}.`
        : null,

      latestLot.acv !== null
        ? `The reported actual cash value was ${formatBid(
            latestLot.acv
          )}${
            latestLot.estimated_repair_cost !==
            null
              ? `, with estimated repair costs of ${formatBid(
                  latestLot.estimated_repair_cost
                )}`
              : ""
          }.`
        : latestLot.estimated_repair_cost !==
            null
          ? `Estimated repair costs were reported at ${formatBid(
              latestLot.estimated_repair_cost
            )}.`
          : null,
    ]

    
      .filter(Boolean)
      .join(" ")
  : `${vehicleName || "This vehicle"} is archived under VIN ${
      vehicle.vin
    }.`;

    const datedLots = lots.filter(
  (lot) => lot.auction_date
);

const earliestLot =
  datedLots.length > 0
    ? datedLots[datedLots.length - 1]
    : null;

const archivedBids = lots
  .map((lot) => lot.final_bid)
  .filter(
    (bid): bid is number =>
      typeof bid === "number" && bid >= 1000
  );

const lowestArchivedBid =
  archivedBids.length > 0
    ? Math.min(...archivedBids)
    : null;

const highestArchivedBid =
  archivedBids.length > 0
    ? Math.max(...archivedBids)
    : null;

const historySummary =
  lots.length > 1
    ? [
        `This VIN has ${lots.length} archived auction appearances${
          auctionSources.length > 0
            ? ` across ${auctionSources.join(" and ")}`
            : ""
        }.`,

        earliestLot?.auction_date &&
        latestLot?.auction_date
          ? `The available history spans from ${formatDate(
              earliestLot.auction_date
            )} through ${formatDate(
              latestLot.auction_date
            )}.`
          : null,

        lowestArchivedBid !== null &&
        highestArchivedBid !== null &&
        lowestArchivedBid !== highestArchivedBid
          ? `Archived final bids range from ${formatBid(
              lowestArchivedBid
            )} to ${formatBid(highestArchivedBid)}.`
          : lowestArchivedBid !== null
            ? `The available archived final bid was ${formatBid(
                lowestArchivedBid
              )}.`
            : null,
      ]
        .filter(Boolean)
        .join(" ")
    : null;
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
    className="vin-hero-inner"
    style={{
      maxWidth: "1200px",
      margin: "0 auto",
      padding: "48px 24px 44px",
      display: "grid",
      gridTemplateColumns: "minmax(0, 1fr) 420px",
      gap: "70px",
      alignItems: "center",
    }}
  >
    {/* VEHICLE IDENTITY */}

    <div>
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
      
        className="vin-vehicle-title"
        style={{
          fontSize: "42px",
          lineHeight: 1.12,
          margin: "0 0 12px",
          letterSpacing: "-0.5px",
        }}
      >
        {vehicleName || vehicle.vin}
      </h1>

{makeSlug && vehicle.make && (
  <div
    style={{
      marginBottom: "14px",
      fontSize: "14px",
    }}
  >
    <Link
      href={`/vehicles/${makeSlug}`}
      style={{
        color: "#555",
        textDecoration: "underline",
        fontWeight: "600",
      }}
    >
      Browse more {vehicle.make} auction records
    </Link>
  </div>
)}

      {vehicle.trim && (
  <div
    style={{
      fontSize: "24px",
      fontWeight: "700",
      color: "#2b2b2b",
      marginBottom: "22px",
      lineHeight: 1.2,
    }}
  >
    {vehicle.trim?.replace(
  new RegExp(`^${vehicle.year}\\s+`, "i"),
  ""
)}
  </div>
)}

      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <span
          style={{
            fontSize: "12px",
            fontWeight: "700",
            textTransform: "uppercase",
            letterSpacing: "1px",
            color: "#777",
          }}
        >
          VIN
        </span>

        <strong
          style={{
            fontSize: "22px",
            lineHeight: 1.2,
            color: "#111",
            letterSpacing: "1px",
            fontFamily: "monospace",
          }}
        >
          {vehicle.vin}
        </strong>
      </div>
    </div>

    {/* ARCHIVE SNAPSHOT */}

    <div
      className="vin-archive-snapshot"
      style={{
        borderLeft: "1px solid #dddddd",
        paddingLeft: "42px",
      }}
    >
      <div
        style={{
          fontSize: "11px",
          fontWeight: "700",
          textTransform: "uppercase",
          letterSpacing: "1px",
          color: "#777",
          marginBottom: "18px",
        }}
      >
        Archive Snapshot
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "22px 28px",
        }}
      >
        <div>
          <strong
            style={{
              display: "block",
              fontSize: "25px",
              lineHeight: 1.1,
              marginBottom: "5px",
            }}
          >
            {lots.length}
          </strong>

          <span
            style={{
              fontSize: "12px",
              color: "#666",
            }}
          >
            {lots.length === 1
              ? "Auction Record"
              : "Auction Records"}
          </span>
        </div>

        <div>
          <strong
            style={{
              display: "block",
              fontSize: "25px",
              lineHeight: 1.1,
              marginBottom: "5px",
            }}
          >
            {totalPhotos}
          </strong>

          <span
            style={{
              fontSize: "12px",
              color: "#666",
            }}
          >
            Archived Photos
          </span>
        </div>

        <div>
          <strong
            style={{
              display: "block",
              fontSize: "21px",
              lineHeight: 1.2,
              marginBottom: "5px",
            }}
          >
            {auctionSources.length > 0
              ? auctionSources.join(" + ")
              : "Not available"}
          </strong>

          <span
            style={{
              fontSize: "12px",
              color: "#666",
            }}
          >
            Auction Source
          </span>
        </div>

        <div>
          <strong
            style={{
              display: "block",
             fontSize: "21px",
              lineHeight: 1.2,
              marginBottom: "5px",
              whiteSpace: "nowrap",
            }}
          >
            {latestLot?.auction_date
              ? formatDate(latestLot.auction_date)
              : "Not available"}
          </strong>

          <span
            style={{
              fontSize: "12px",
              color: "#666",
            }}
          >
            Latest Appearance
          </span>
        </div>
      </div>
    </div>
  </div>
</section>

      <div
  className="vin-page-content"
  style={{
    maxWidth: "1200px",
    margin: "0 auto",
    padding: "34px 24px 80px",
  }}
>
        {/* SUMMARY */}
{latestLot && (
  <section
    className="vin-latest-showcase"
    style={{
      display: "grid",
      gridTemplateColumns: "minmax(0, 1.55fr) minmax(320px, 0.85fr)",
      border: "1px solid #e2e2e2",
      borderRadius: "14px",
      overflow: "hidden",
      background: "#fff",
      marginBottom: "20px",
    }}
  >
   {/* LARGE VEHICLE PHOTO */}
<div
  style={{
    position: "relative",
    background: "#f1f1f1",
    alignSelf: "start",
    width: "100%",
  }}
>
  <VinPhotoGallery
    images={latestLot.image_urls || []}
    vehicleName={vehicleName || vehicle.vin}
  />
</div>

    {/* LATEST AUCTION SNAPSHOT */}
    <div
      style={{
        padding: "30px",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          fontSize: "11px",
          fontWeight: "700",
          textTransform: "uppercase",
          letterSpacing: "1px",
          color: "#777",
          marginBottom: "8px",
        }}
      >
        Latest Auction Record
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "8px",
          marginBottom: "24px",
        }}
      >
        <span
          style={{
            background: "#171717",
            color: "#fff",
            padding: "7px 10px",
            borderRadius: "6px",
            fontSize: "12px",
            fontWeight: "700",
            letterSpacing: "0.6px",
            textTransform: "uppercase",
          }}
        >
          {latestLot.auction_source}
        </span>

        <span
          style={{
            color: "#666",
            fontSize: "13px",
          }}
        >
          Lot #{latestLot.lot_number}
        </span>
      </div>

      <div
        style={{
          marginBottom: "26px",
        }}
      >
        <div
          style={{
            fontSize: "12px",
            color: "#777",
            textTransform: "uppercase",
            letterSpacing: "0.6px",
            marginBottom: "6px",
          }}
        >
          Final Bid
        </div>

        <strong
          style={{
            display: "block",
            fontSize: "38px",
            lineHeight: 1,
            letterSpacing: "-1px",
          }}
        >
          {formatBid(latestLot.final_bid)}
        </strong>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "20px 24px",
          marginBottom: "28px",
        }}
      >
        <div>
          <div
            style={{
              fontSize: "11px",
              color: "#777",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              marginBottom: "5px",
            }}
          >
            Auction Date
          </div>

          <strong
            style={{
              fontSize: "14px",
            }}
          >
            {formatDate(latestLot.auction_date)}
          </strong>
        </div>

        <div>
          <div
            style={{
              fontSize: "11px",
              color: "#777",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              marginBottom: "5px",
            }}
          >
            Mileage
          </div>

          <strong
            style={{
              fontSize: "14px",
            }}
          >
            {formatMileage(latestLot.mileage)}
          </strong>
        </div>

        {latestLot.primary_damage && (
          <div>
            <div
              style={{
                fontSize: "11px",
                color: "#777",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                marginBottom: "5px",
              }}
            >
              Primary Damage
            </div>

            <strong
              style={{
                fontSize: "14px",
              }}
            >
              {latestLot.primary_damage}
            </strong>
          </div>
        )}

        {latestLot.location && (
          <div>
            <div
              style={{
                fontSize: "11px",
                color: "#777",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                marginBottom: "5px",
              }}
            >
              Location
            </div>

            <strong
              style={{
                fontSize: "14px",
              }}
            >
              {formatLocation(latestLot.location)}
            </strong>
          </div>
        )}

        {latestLot.start_code && (
          <div>
            <div
              style={{
                fontSize: "11px",
                color: "#777",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                marginBottom: "5px",
              }}
            >
              Start Code
            </div>

            <strong
              style={{
                fontSize: "14px",
              }}
            >
              {latestLot.start_code}
            </strong>
          </div>
        )}

        {latestLot.keys_present !== null && (
          <div>
            <div
              style={{
                fontSize: "11px",
                color: "#777",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                marginBottom: "5px",
              }}
            >
              Keys
            </div>

            <strong
              style={{
                fontSize: "14px",
              }}
            >
              {latestLot.keys_present
                ? "Present"
                : "Not reported as present"}
            </strong>
          </div>
        )}
      </div>
{/* REMOVAL CTA */}

<div
  style={{
    marginTop: "auto",
    marginBottom: "16px",
    paddingTop: "22px",
    borderTop: "1px solid #e8e8e8",
  }}
>
  <div
    style={{
      fontSize: "14px",
      fontWeight: "700",
      color: "#171717",
      marginBottom: "5px",
    }}
  >
    Want this auction record removed?
  </div>

  <div
    style={{
      fontSize: "12px",
      lineHeight: 1.5,
      color: "#666",
      marginBottom: "13px",
    }}
  >
    Request removal of this listing and its archived photos.
  </div>

  <RemoveListingButton
    vin={latestLot.vin}
    auctionSource={latestLot.auction_source}
    lotNumber={latestLot.lot_number}
  />
</div>
      <Link
        href={`/lot/${latestLot.auction_source.toLowerCase()}/${latestLot.lot_number}`}
        style={{
          display: "block",
          marginTop: "0",
          padding: "13px 16px",
          background: "#171717",
          color: "#fff",
          textDecoration: "none",
          textAlign: "center",
          borderRadius: "7px",
          fontSize: "14px",
          fontWeight: "700",
        }}
      >
        View full auction record →
      </Link>
    </div>
  </section>
)}
       
{/* VEHICLE OVERVIEW */}

<section
  style={{
    marginTop: "28px",
    marginBottom: "38px",
    padding: "26px 28px",
    background: "#f6f7f8",
    border: "1px solid #e6e6e6",
    borderRadius: "10px",
  }}
>
  <div
    style={{
      fontSize: "12px",
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: "0.8px",
      color: "#777",
      marginBottom: "8px",
    }}
  >
    Vehicle Overview
  </div>

  <h2
    style={{
      margin: "0 0 12px",
      fontSize: "24px",
    }}
  >
    About This {titleCaseValue(vehicle.make) || "Vehicle"}
  </h2>

  <p
    style={{
      margin: 0,
      maxWidth: "1000px",
      color: "#555",
      fontSize: "15px",
      lineHeight: 1.75,
    }}
  >
    {vehicleOverview}
  </p>
</section>
      {/* AUCTION HISTORY */}

{lots.length !== 1 && (
<section
  style={{
    marginTop: "42px",
  }}
>
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
  {historySummary ||
    `${lots.length} archived auction appearances associated with VIN ${vehicle.vin}.`}
</p>
  </div>

  {lots.length === 0 ? (
    <div
      style={{
        padding: "24px",
        border: "1px solid #e2e2e2",
        borderRadius: "10px",
      }}
    >
      No auction lots are currently archived for this vehicle.
    </div>
  ) : (
    <div
      style={{
        border: "1px solid #e2e2e2",
        borderRadius: "12px",
        overflow: "hidden",
        background: "#fff",
      }}
    >
      {lots.map((lot, index) => {
        const source = lot.auction_source.toLowerCase();

        const lotUrl =
          `/lot/${source}/${lot.lot_number}`;

        return (
          <div
  key={`${lot.auction_source}-${lot.lot_number}`}
  className="vin-history-row"
  style={{
              display: "grid",
              gridTemplateColumns:
                "140px minmax(0, 1fr) auto",
              alignItems: "center",
              gap: "24px",
              padding: "22px 24px",
              borderBottom:
                index < lots.length - 1
                  ? "1px solid #e8e8e8"
                  : "none",
            }}
          >
            {/* DATE */}
            <div>
              <div
                style={{
                  fontSize: "11px",
                  color: "#777",
                  textTransform: "uppercase",
                  letterSpacing: "0.6px",
                  marginBottom: "5px",
                }}
              >
                Auction Date
              </div>

              <strong
                style={{
                  fontSize: "14px",
                  lineHeight: 1.4,
                }}
              >
                {formatDate(lot.auction_date)}
              </strong>
            </div>

            {/* AUCTION RECORD */}
            <div
              style={{
                minWidth: 0,
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
                    color: "#fff",
                    padding: "5px 8px",
                    borderRadius: "5px",
                    fontSize: "11px",
                    fontWeight: "700",
                    letterSpacing: "0.6px",
                    textTransform: "uppercase",
                  }}
                >
                  {lot.auction_source}
                </span>

                <strong
                  style={{
                    fontSize: "15px",
                  }}
                >
                  Lot #{lot.lot_number}
                </strong>
              </div>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "8px 18px",
                  color: "#555",
                  fontSize: "14px",
                  lineHeight: 1.5,
                }}
              >
                {lot.final_bid !== null && (
                  <span>
                    <strong style={{ color: "#171717" }}>
                      {formatBid(lot.final_bid)}
                    </strong>
                  </span>
                )}

                {lot.mileage !== null && (
                  <span>
                    {formatMileage(lot.mileage)}
                  </span>
                )}

                {lot.primary_damage && (
                  <span>
                    {lot.primary_damage}
                  </span>
                )}

                {lot.location && (
                  <span>
                    {lot.location}
                  </span>
                )}
              </div>
            </div>

            {/* LINK */}
            <Link
              href={lotUrl}
              style={{
                color: "#171717",
                textDecoration: "none",
                fontSize: "14px",
                fontWeight: "700",
                whiteSpace: "nowrap",
              }}
            >
              View record →
            </Link>
          </div>
        );
      })}
    </div>
  )}
</section>
)}

{/* VEHICLE & AUCTION DETAILS */}
{latestLot && (
  <section
    style={{
      marginTop: "48px",
      borderTop: "1px solid #e5e5e5",
      paddingTop: "34px",
    }}
  >
    <div
      style={{
        marginBottom: "22px",
      }}
    >
      <h2
        style={{
          margin: "0 0 7px",
          fontSize: "26px",
        }}
      >
        Vehicle & Auction Details
      </h2>

      <p
        style={{
          margin: 0,
          color: "#666",
          fontSize: "14px",
          lineHeight: 1.6,
        }}
      >
        Details reported for the most recent archived auction record.
      </p>
    </div>

    {/* VEHICLE DETAILS */}
    {(latestLot.body_style ||
  latestLot.color ||
      latestLot.engine ||
      latestLot.transmission ||
      latestLot.drivetrain ||
      latestLot.fuel) && (
      <div
        style={{
          marginBottom: "28px",
        }}
      >
        <h3
          style={{
            margin: "0 0 14px",
            fontSize: "17px",
          }}
        >
          Vehicle
        </h3>

        <div
  className="vin-details-grid"
  style={{
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "12px",
  }}
>
         

          {latestLot.body_style && (
            <div style={{ padding: "18px 20px" }}>
              <div
                style={{
                  color: "#777",
                  fontSize: "11px",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  marginBottom: "5px",
                }}
              >
                Body Style
              </div>
              <strong>{latestLot.body_style}</strong>
            </div>
          )}

          {latestLot.color && (
            <div
  style={{
    padding: "16px 18px",
    background: "#fafafa",
    border: "1px solid #e5e5e5",
    borderRadius: "8px",
  }}
>
              <div
                style={{
                  color: "#777",
                  fontSize: "11px",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  marginBottom: "5px",
                }}
              >
                Color
              </div>
              <strong>{latestLot.color}</strong>
            </div>
          )}

          {latestLot.engine && (
            <div
  style={{
    padding: "16px 18px",
    background: "#fafafa",
    border: "1px solid #e5e5e5",
    borderRadius: "8px",
  }}
>
              <div
                style={{
                  color: "#777",
                  fontSize: "11px",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  marginBottom: "5px",
                }}
              >
                Engine
              </div>
              <strong>{latestLot.engine}</strong>
            </div>
          )}

          {latestLot.transmission && (
            <div
  style={{
    padding: "16px 18px",
    background: "#fafafa",
    border: "1px solid #e5e5e5",
    borderRadius: "8px",
  }}
>
              <div
                style={{
                  color: "#777",
                  fontSize: "11px",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  marginBottom: "5px",
                }}
              >
                Transmission
              </div>
              <strong>{latestLot.transmission}</strong>
            </div>
          )}

          {latestLot.drivetrain && (
            <div
  style={{
    padding: "16px 18px",
    background: "#fafafa",
    border: "1px solid #e5e5e5",
    borderRadius: "8px",
  }}
>
              <div
                style={{
                  color: "#777",
                  fontSize: "11px",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  marginBottom: "5px",
                }}
              >
                Drivetrain
              </div>
              <strong>{latestLot.drivetrain}</strong>
            </div>
          )}

          {latestLot.fuel && (
            <div
  style={{
    padding: "16px 18px",
    background: "#fafafa",
    border: "1px solid #e5e5e5",
    borderRadius: "8px",
  }}
>
              <div
                style={{
                  color: "#777",
                  fontSize: "11px",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  marginBottom: "5px",
                }}
              >
                Fuel
              </div>
              <strong>{latestLot.fuel}</strong>
            </div>
          )}
        </div>
      </div>
    )}

    {/* AUCTION / CONDITION DETAILS */}
    {(latestLot.loss_type ||
      latestLot.primary_damage ||
      latestLot.secondary_damage ||
      latestLot.start_code ||
      latestLot.keys_present !== null ||
      latestLot.seller ||
      latestLot.seller_type ||
      latestLot.sale_document ||
      latestLot.acv !== null ||
      latestLot.estimated_repair_cost !== null) && (
      <div>
        <h3
          style={{
            margin: "0 0 14px",
            fontSize: "17px",
          }}
        >
          Auction & Condition
        </h3>

        <div
  className="vin-condition-grid"
  style={{
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "12px",
  }}
>
          {latestLot.loss_type && (
            <div
  style={{
    padding: "16px 18px",
    background: "#fafafa",
    border: "1px solid #e5e5e5",
    borderRadius: "8px",
  }}
>
              <div
                style={{
                  color: "#777",
                  fontSize: "11px",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  marginBottom: "5px",
                }}
              >
                Loss Type
              </div>
              <strong>{latestLot.loss_type}</strong>
            </div>
          )}

          {latestLot.primary_damage && (
            <div
  style={{
    padding: "16px 18px",
    background: "#fafafa",
    border: "1px solid #e5e5e5",
    borderRadius: "8px",
  }}
>
              <div
                style={{
                  color: "#777",
                  fontSize: "11px",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  marginBottom: "5px",
                }}
              >
                Primary Damage
              </div>
              <strong>{latestLot.primary_damage}</strong>
            </div>
          )}

          {latestLot.secondary_damage && (
            <div
  style={{
    padding: "16px 18px",
    background: "#fafafa",
    border: "1px solid #e5e5e5",
    borderRadius: "8px",
  }}
>
              <div
                style={{
                  color: "#777",
                  fontSize: "11px",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  marginBottom: "5px",
                }}
              >
                Secondary Damage
              </div>
              <strong>{latestLot.secondary_damage}</strong>
            </div>
          )}

          {latestLot.start_code && (
            <div
  style={{
    padding: "16px 18px",
    background: "#fafafa",
    border: "1px solid #e5e5e5",
    borderRadius: "8px",
  }}
>
              <div
                style={{
                  color: "#777",
                  fontSize: "11px",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  marginBottom: "5px",
                }}
              >
                Start Code
              </div>
              <strong>{latestLot.start_code}</strong>
            </div>
          )}

          {latestLot.keys_present !== null && (
            <div
  style={{
    padding: "16px 18px",
    background: "#fafafa",
    border: "1px solid #e5e5e5",
    borderRadius: "8px",
  }}
>
              <div
                style={{
                  color: "#777",
                  fontSize: "11px",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  marginBottom: "5px",
                }}
              >
                Keys
              </div>
              <strong>
                {latestLot.keys_present
                  ? "Present"
                  : "Not reported as present"}
              </strong>
            </div>
          )}

          {latestLot.seller && (
            <div
  style={{
    padding: "16px 18px",
    background: "#fafafa",
    border: "1px solid #e5e5e5",
    borderRadius: "8px",
  }}
>
              <div
                style={{
                  color: "#777",
                  fontSize: "11px",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  marginBottom: "5px",
                }}
              >
                Seller
              </div>
              <strong>{latestLot.seller}</strong>
            </div>
          )}

          {latestLot.seller_type && (
            <div
  style={{
    padding: "16px 18px",
    background: "#fafafa",
    border: "1px solid #e5e5e5",
    borderRadius: "8px",
  }}
>
              <div
                style={{
                  color: "#777",
                  fontSize: "11px",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  marginBottom: "5px",
                }}
              >
                Seller Type
              </div>
              <strong>{latestLot.seller_type}</strong>
            </div>
          )}

          {latestLot.sale_document && (
            <div
  style={{
    padding: "16px 18px",
    background: "#fafafa",
    border: "1px solid #e5e5e5",
    borderRadius: "8px",
  }}
>
              <div
                style={{
                  color: "#777",
                  fontSize: "11px",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  marginBottom: "5px",
                }}
              >
                Sale Document
              </div>
              <strong>{latestLot.sale_document}</strong>
            </div>
          )}

          {latestLot.acv !== null && (
            <div
  style={{
    padding: "16px 18px",
    background: "#fafafa",
    border: "1px solid #e5e5e5",
    borderRadius: "8px",
  }}
>
              <div
                style={{
                  color: "#777",
                  fontSize: "11px",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  marginBottom: "5px",
                }}
              >
                Actual Cash Value
              </div>
              <strong>{formatBid(latestLot.acv)}</strong>
            </div>
          )}

          {latestLot.estimated_repair_cost !== null && (
           <div
  style={{
    padding: "16px 18px",
    background: "#fafafa",
    border: "1px solid #e5e5e5",
    borderRadius: "8px",
  }}
>
              <div
                style={{
                  color: "#777",
                  fontSize: "11px",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  marginBottom: "5px",
                }}
              >
                Estimated Repair Cost
              </div>
              <strong>
                {formatBid(latestLot.estimated_repair_cost)}
              </strong>
            </div>
          )}
        </div>
      </div>
    )}
  </section>
)}

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
        
            {similarLots.length > 0 && (
  <section
    style={{
      marginTop: "48px",
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
        Similar {vehicle.make}{" "}
        {vehicle.model ? displayModel(vehicle.model) : ""} Auction Sales
      </h2>

      <p
        style={{
          color: "#666",
          fontSize: "14px",
          lineHeight: 1.6,
          margin: 0,
        }}
      >
        Compare recent archived auction results for similar vehicles.
      </p>
    </div>

    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
        gap: "16px",
      }}
    >
      {similarLots.map((similarLot) => {
        const similarVinUrl = `/vin/${similarLot.vin}`;

        const similarVehicleName = [
          similarLot.year,
          similarLot.make,
          similarLot.model
            ? displayModel(similarLot.model)
            : null,
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <article
            key={similarLot.auction_id}
            style={{
              background: "#ffffff",
              border: "1px solid #e1e1e1",
              borderRadius: "10px",
              overflow: "hidden",
            }}
          >
            <Link
              href={similarVinUrl}
              style={{
                display: "block",
                color: "inherit",
                textDecoration: "none",
              }}
            >
              <div
                style={{
                  height: "170px",
                  background: "#eeeeee",
                }}
              >
                {similarLot.image_urls?.[0] ? (
                  <img
                    src={similarLot.image_urls[0]}
                    alt={`${similarVehicleName} auction vehicle`}
                    loading="lazy"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                ) : null}
              </div>

              <div
                style={{
                  padding: "16px",
                }}
              >
                <div
                  style={{
                    fontSize: "12px",
                    color: "#777",
                    fontWeight: "700",
                    textTransform: "uppercase",
                    marginBottom: "8px",
                  }}
                >
                  {similarLot.auction_source}
                  {similarLot.auction_date
                    ? ` • ${formatDate(similarLot.auction_date)}`
                    : ""}
                </div>

                <h3
                  style={{
                    fontSize: "18px",
                    margin: "0 0 5px",
                  }}
                >
                  {similarVehicleName}
                </h3>

                {similarLot.trim && (
                  <div
                    style={{
                      fontSize: "14px",
                      fontWeight: "600",
                      color: "#555",
                      marginBottom: "16px",
                    }}
                  >
                    {similarLot.trim.replace(
                      new RegExp(`^${similarLot.year}\\s+`, "i"),
                      ""
                    )}
                  </div>
                )}

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "12px",
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

                    <strong>
                      {formatBid(similarLot.final_bid)}
                    </strong>
                  </div>

                  <div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#777",
                        marginBottom: "3px",
                      }}
                    >
                      Mileage
                    </div>

                    <strong>
                      {formatMileage(similarLot.mileage)}
                    </strong>
                  </div>
                </div>
              </div>
            </Link>
          </article>
        );
      })}
        </div>

    {makeSlug && vehicle.model && (
      <div
        style={{
          marginTop: "22px",
        }}
      >
        <Link
          href={`/vehicles/${makeSlug}/${slugifyModel(vehicle.model)}`}
          style={{
            display: "inline-block",
            color: "#171717",
            fontSize: "16px",
            fontWeight: "800",
            textDecoration: "none",
            padding: "10px 0",
          }}
        >
          View all {vehicle.make} {displayModel(vehicle.model)} auctions →
        </Link>
      </div>
    )}
  </section>
)}
            </div>

      <style>{`
        @media (max-width: 800px) {
        .vin-hero-inner {
  grid-template-columns: 1fr !important;
  gap: 30px !important;
}

.vin-archive-snapshot {
  border-left: none !important;
  border-top: 1px solid #dddddd;
  padding-left: 0 !important;
  padding-top: 28px;
}
          .vin-latest-showcase {
            grid-template-columns: 1fr !important;
          }

          .vin-latest-showcase > div:first-child {
            min-height: 280px !important;
          }

          .vin-latest-showcase > div:first-child img {
            min-height: 280px !important;
            height: 280px !important;
          }

          .vin-latest-showcase > div:last-child {
            padding: 24px !important;
          }

          .vin-history-row {
  grid-template-columns: 1fr !important;
  gap: 14px !important;
  padding: 20px !important;
  align-items: start !important;
}

.vin-history-row > a {
  margin-top: 2px;
}

.vin-details-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
}

.vin-condition-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
}
        }
      `}</style>
    </main>
  );

  
}
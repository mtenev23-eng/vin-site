import { getVinSpecifications } from "../../../../utils/nhtsa-vin";
import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase } from "../../../../utils/supabase/client";
import AuctionPhotoGallery from "../../../components/AuctionPhotoGallery";
import RemoveListingButton from "../../../components/RemoveListingButton";
import { slugifyModel } from "../../../../utils/vehicle-models";
import { unstable_cache } from "next/cache";
export const dynamic = "force-dynamic";
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

type LotRecord = { vehicle: Vehicle; lot: AuctionLot; otherLots: AuctionLot[] };

const getLotRecord = cache(async function getLotRecord(
  source: string, lotNumber: string
): Promise<LotRecord | null> {
  const cleanedSource = source.trim().toUpperCase();
  const cleanedLot = lotNumber.trim();
  const { data: lot, error: lotError } = await supabase
    .from("auction_lots").select("*")
    .eq("auction_source", cleanedSource)
    .eq("lot_number", cleanedLot).maybeSingle();
  if (lotError) {
    console.error("Auction lot Supabase error:", lotError);
    throw new Error("Failed to load auction lot");
  }
  if (!lot) return null;
  const { data: vehicle, error: vehicleError } = await supabase
    .from("vehicles").select("*").eq("vin", lot.vin).maybeSingle();
  if (vehicleError) {
    console.error("Vehicle Supabase error:", vehicleError);
    throw new Error("Failed to load vehicle");
  }
  if (!vehicle) return null;
  const { data: otherLots, error: otherError } = await supabase
    .from("auction_lots")
    .select("*")
    .eq("vin", lot.vin)
    .neq("id", lot.id)
    .order("auction_date", { ascending: false, nullsFirst: false });
  if (otherError) {
    console.error("Related auction lots error:", otherError);
  }
  return { vehicle, lot, otherLots: otherLots || [] };
});

const getCachedSimilarLots = unstable_cache(
  async (vin: string) => {
    const { data, error } = await supabase.rpc(
      "test_similar_vin_auctions_v3",
      {
        p_vin: vin,
      }
    );

    if (error) {
      console.error("Similar VIN lookup error:", error);
      throw new Error("Failed to load similar VINs");
    }

    return data || [];
  },
  ["vin-similar-lots-v3-full"],
  {
    revalidate: 86400,
    tags: ["vin-similar-lots"],
  }
);

async function getSimilarLots(currentVin: string) {
  if (!currentVin) return [];

  try {
    const data = await getCachedSimilarLots(
      currentVin.trim().toUpperCase()
    );

    const uniqueVins = new Map<
      string,
      (typeof data)[number]
    >();

    for (const row of data) {
      // Only link to auction records with a valid LOT destination.
      if (!row.auction_source || !row.lot_number) continue;
      if (row.vin === currentVin) continue;

      if (!uniqueVins.has(row.vin)) {
        uniqueVins.set(row.vin, row);
      }

      if (uniqueVins.size === 8) break;
    }

    return Array.from(uniqueVins.values());
  } catch (error) {
    console.error("Cached similar VIN lookup error:", error);
    return [];
  }
}

const getCachedModelAuctionCount = unstable_cache(
  async (make: string, model: string) => {
    const { count, error } = await supabase
      .from("vehicle_auction_archive")
      .select("auction_id", {
        count: "exact",
        head: true,
      })
      .eq("make", make)
      .eq("model", model);

    if (error) {
      console.error("Model auction count lookup error:", error);
      return 0;
    }

    return count || 0;
  },
  ["vin-model-auction-count-v1"],
  {
    revalidate: 86400,
    tags: ["vin-model-auction-count"],
  }
);

async function getModelAuctionCount(
  make: string | null,
  model: string | null
) {
  if (!make || !model) {
    return 0;
  }

  try {
    return await getCachedModelAuctionCount(make, model);
  } catch (error) {
    console.error("Cached model auction count error:", error);
    return 0;
  }
}
function formatBid(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return "Not available";
  }

  return `$${value.toLocaleString()}`;
}

function formatMileage(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return "Not available";
  }

  return `${value.toLocaleString()} miles`;
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


const getCachedComparableStats = unstable_cache(
  async (
    vin: string,
    currentLotId: number
  ): Promise<ComparableStats | null> => {
    const { data, error } = await supabase.rpc(
      "get_vin_comparable_stats_v2",
      {
        p_vin: vin,
        p_exclude_auction_id: currentLotId,
      }
    );

    if (error) {
      console.error("Comparable stats RPC error:", error);
      throw new Error("Failed to load comparable stats");
    }

    const row = data?.[0];

    if (!row || Number(row.comparable_count) < 5) {
      return null;
    }

    const average = Number(row.average_bid);
    const count = Number(row.comparable_count);

    if (!Number.isFinite(average) ||
        !Number.isFinite(count)) {
      return null;
    }

    return {
      average,
      count,
      minYear: row.min_year ?? null,
      maxYear: row.max_year ?? null,
    };
  },
  ["vin-comparable-stats-v2"],
  {
    revalidate: 86400,
    tags: ["vin-comparable-auctions"],
  }
);

async function getComparableStats(
  vehicle: Vehicle,
  currentLotId: number
): Promise<ComparableStats | null> {
  if (!vehicle.vin) return null;

  try {
    return await getCachedComparableStats(
      vehicle.vin.trim().toUpperCase(),
      currentLotId
    );
  } catch (error) {
    console.error("Cached comparable stats error:", error);
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ source: string; lotNumber: string }>;
}) {
  const { source, lotNumber } = await params;
  const record = await getLotRecord(source, lotNumber);
  if (!record) return { title: "Auction Lot Not Found", robots: { index: false, follow: true } };
  const { vehicle, lot } = record;
  const vehicleName = [vehicle.year, vehicle.make, displayModel(vehicle.model)]
    .filter(Boolean).join(" ");
  const title = `${vehicleName} ${lot.vin} - ${lot.auction_source} Lot ${lot.lot_number}`;
  const description = [
    `${vehicleName} auction record from ${lot.auction_source} lot ${lot.lot_number}.`,
    `VIN ${lot.vin}.`,
    lot.final_bid !== null ? `Final bid ${formatBid(lot.final_bid)}.` : null,
    lot.mileage !== null ? `Mileage ${formatMileage(lot.mileage)}.` : null,
    lot.primary_damage ? `Reported damage: ${lot.primary_damage}.` : null,
  ].filter(Boolean).join(" ");
  const canonical = `https://salvagevinhistory.com/lot/${lot.auction_source.toLowerCase()}/${lot.lot_number}`;
  const firstImage = lot.image_urls?.[0];
  return {
    title, description,
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: {
      title, description, url: canonical, type: "website",
      siteName: "Salvage VIN History",
      ...(firstImage ? { images: [{ url: firstImage, alt: title }] } : {}),
    },
    twitter: {
      card: firstImage ? "summary_large_image" : "summary",
      title, description,
      ...(firstImage ? { images: [firstImage] } : {}),
    },
  };
}

export default async function LotPage({
  params,
}: {
  params: Promise<{ source: string; lotNumber: string }>;
}) {
  const { source, lotNumber } = await params;
  const history = await getLotRecord(source, lotNumber);


 if (!history) {
  notFound();
}

  const { vehicle, lot: latestLot, otherLots } = history;
  const lots = [latestLot];

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

  const vinSpecifications = await getVinSpecifications(vehicle.vin);
  const candidateSimilarLots = await getSimilarLots(vehicle.vin);
  const trim = (vehicle.trim || "").toUpperCase();
  const specialVariant = trim.includes("HELLCAT") ? "HELLCAT"
    : trim.includes("TRACKHAWK") ? "TRACKHAWK"
    : trim.includes("TYPE R") ? "TYPE R"
    : null;
  // Do not present base trims as comparable sales for a specialized variant.
  // This filters the existing RPC results; it does not yet discover more matches.
  const similarLots = specialVariant
    ? candidateSimilarLots.filter(row =>
        (row.trim || "").toUpperCase().includes(specialVariant)
      )
    : candidateSimilarLots;
const modelAuctionCount =
  await getModelAuctionCount(
    vehicle.make,
    vehicle.model
  );
  const totalPhotos = lots.reduce(
    (total, lot) =>
      total + (lot.image_urls?.length || 0),
    0
  );

  // The displayed auction is always the lot identified by this URL.
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

const conditionSummary = [
  latestLot.primary_damage ? `primary damage reported as ${titleCaseValue(latestLot.primary_damage)}` : null,
  latestLot.secondary_damage && latestLot.secondary_damage.toUpperCase() !== "UNKNOWN"
    ? `secondary damage reported as ${titleCaseValue(latestLot.secondary_damage)}` : null,
  latestLot.start_code ? `start condition listed as ${titleCaseValue(latestLot.start_code)}` : null,
].filter(Boolean);
const vehicleOverview = [
  `${overviewVehicleName}${cleanedTrim ? ` ${cleanedTrim}` : ""} was listed in ${latestLot.auction_source} lot ${latestLot.lot_number}.`,
  conditionSummary.length
    ? `The auction listing described ${conditionSummary.join(", ")}.`
    : "Condition details were not available in the archived record.",
  latestLot.sale_document ? `The reported sale document was ${latestLot.sale_document}.` : null,
  "These details come from the auction listing and do not represent an independent inspection.",
].filter(Boolean).join(" ");

  return (
    <main
      style={{
        minHeight: "100vh",
        fontFamily: "Arial, sans-serif",
        color: "#171717",
        background: "#ffffff",
      }}
    >
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
        Archived Auction Record
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
    flexDirection: "column",
    gap: "7px",
  }}
>
  <span
    style={{
      fontSize: "15px",
      fontWeight: "900",
      textTransform: "uppercase",
      letterSpacing: "1px",
      color: "#444",
    }}
  >
    VIN
  </span>

  <strong
    style={{
      fontSize: "40px",
      lineHeight: 1.08,
      color: "#171717",
      letterSpacing: "0.8px",
      fontWeight: "900",
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
        Auction Snapshot
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
            #{latestLot.lot_number}
          </strong>

          <span
            style={{
              fontSize: "12px",
              color: "#666",
            }}
          >
            {latestLot.auction_source} Lot Number
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
            Auction Date
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
  className="vin-gallery-wrapper"
  style={{
    display: "contents",
  }}
>

  <AuctionPhotoGallery
    images={latestLot.image_urls || []}
    vehicleName={vehicleName || vehicle.vin}
    auctionSource={latestLot.auction_source}
    lotNumber={latestLot.lot_number}
  />

</div>

    {/* LATEST AUCTION SNAPSHOT */}
<div
  className="vin-auction-details"
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
        Auction Record
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
        Details reported for this specific auction record.
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
            About this auction record
          </strong>

          <p
            style={{
              color: "#666",
              fontSize: "14px",
              lineHeight: 1.65,
              margin: 0,
            }}
          >

            These details reflect information reported for this particular auction lot.
            Vehicle condition, mileage and ownership may have changed since the auction date.
            This archive does not represent an independent vehicle inspection.
          </p>
        </section>
        
            {/* ADDITIONAL VEHICLE SPECIFICATIONS */}
{vinSpecifications.length > 0 && (
  <section
    style={{
      marginTop: "48px",
      marginBottom: "48px",
      borderTop: "1px solid #e5e5e5",
      paddingTop: "34px",
    }}
  >
    <h2
      style={{
        fontSize: "26px",
        margin: "0 0 8px",
      }}
    >
      Additional Vehicle Specifications
    </h2>

    <p
      style={{
        color: "#666",
        fontSize: "14px",
        margin: "0 0 24px",
        lineHeight: 1.6,
      }}
    >
      Additional technical specifications decoded from the VIN.
    </p>

    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: "22px",
      }}
    >
      {vinSpecifications.map((spec) => (
        <div key={spec.label}>
          <div
            style={{
              fontSize: "12px",
              color: "#777",
              textTransform: "uppercase",
              marginBottom: "6px",
              fontWeight: 600,
            }}
          >
            {spec.label}
          </div>

          <div
            style={{
              fontSize: "16px",
              fontWeight: 600,
              color: "#222",
            }}
          >
            {spec.value}
          </div>
        </div>
      ))}
    </div>

    <p
      style={{
        fontSize: "12px",
        color: "#888",
        marginTop: "22px",
      }}
    >
      Source: NHTSA VIN Decoder. Specifications are manufacturer-reported
      and may vary by vehicle.
    </p>
  </section>
)}
{/* OTHER AUCTIONS FOR THIS VIN — only when separate lots exist */}
{otherLots.length > 0 && (
  <section style={{ marginTop: "40px", borderTop: "1px solid #e5e5e5", paddingTop: "30px" }}>
    <h2 style={{ fontSize: "26px", margin: "0 0 8px" }}>Other Auctions for This VIN</h2>
    <p style={{ color: "#666", margin: "0 0 18px", lineHeight: 1.6 }}>
      These are separate auction records for the same vehicle. Each has its own details and photos.
    </p>
    <div style={{ display: "grid", gap: "12px" }}>
      {otherLots.map((other) => (
        <Link
          key={other.id}
          href={`/lot/${other.auction_source.toLowerCase()}/${other.lot_number}`}
          style={{
            display: "flex", flexWrap: "wrap", justifyContent: "space-between",
            gap: "12px", padding: "18px 20px", border: "1px solid #e5e5e5",
            borderRadius: "10px", color: "#171717", textDecoration: "none",
          }}
        >
          <strong>{other.auction_source} Lot #{other.lot_number}</strong>
          <span>{formatDate(other.auction_date)}</span>
          <span>{formatBid(other.final_bid)}</span>
          <span>View auction →</span>
        </Link>
      ))}
    </div>
  </section>
)}

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
        gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 240px), 1fr))",
        gap: "16px",
      }}
    >
      {similarLots.map((similarLot) => {
        const similarLotUrl = `/lot/${similarLot.auction_source.toLowerCase()}/${similarLot.lot_number}`;

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
  href={similarLotUrl}
  prefetch={false}
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
  ? ` \u2022 ${formatDate(similarLot.auction_date)}`
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

    {makeSlug && vehicle.make && (
  <div
    style={{
      marginTop: "22px",
    }}
  >
    <Link
      href={
        vehicle.model && modelAuctionCount >= 5
          ? `/vehicles/${makeSlug}/${slugifyModel(vehicle.model)}`
          : `/vehicles/${makeSlug}`
      }
      style={{
        display: "inline-block",
        color: "#171717",
        fontSize: "16px",
        fontWeight: "800",
        textDecoration: "none",
        padding: "10px 0",
      }}
    >
     {vehicle.model && modelAuctionCount >= 5
  ? `View all ${vehicle.make} ${displayModel(vehicle.model)} auctions`
  : `View all ${vehicle.make} auctions`}
{" "}<span aria-hidden="true">&rarr;</span>
    </Link>
  </div>
)}
  </section>
)}
            </div>

      <style>{`
      .vin-gallery-main {
  grid-column: 1;
  grid-row: 1;
}

.vin-auction-details {
  grid-column: 2;
  grid-row: 1;
  min-width: 0;
}

.vin-gallery-thumbnails {
  grid-column: 1 / -1;
  grid-row: 2;
  grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
}
      @media (max-width: 800px) {
  .vin-hero-inner {
    grid-template-columns: 1fr !important;
    gap: 30px !important;
  }

  .vin-latest-showcase {
    grid-template-columns: minmax(0, 1fr) !important;
  }

  .vin-gallery-main {
    grid-column: 1;
    grid-row: 1;
  }

  .vin-auction-details {
    grid-column: 1;
    grid-row: 2;
  }

  .vin-gallery-thumbnails {
    grid-column: 1;
    grid-row: 3;
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }

.vin-archive-snapshot {
  border-left: none !important;
  border-top: 1px solid #dddddd;
  padding-left: 0 !important;
  padding-top: 28px;
}
          

       \
          .vin-auction-details {
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



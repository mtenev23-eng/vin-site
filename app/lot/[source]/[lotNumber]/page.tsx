import Link from "next/link";
import { cache } from "react";

import { supabase } from "../../../../utils/supabase/client";
import RemoveListingButton from "../../../components/RemoveListingButton";
import AuctionPhotoGallery from "../../../components/AuctionPhotoGallery";
export const revalidate = 86400;

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



const getLot = cache(async function getLot(

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
});
async function getSimilarLots(
  make: string | null,
  model: string | null,
  currentLotId: number
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
    .neq("auction_id", currentLotId)
    .not("auction_date", "is", null)
    .order("auction_date", {
      ascending: false,
      nullsFirst: false,
    })
    .limit(8);

  if (error) {
    console.error(
      "Similar auction lookup error:",
      error
    );
    return [];
  }

  return data || [];
}
async function getModelAuctionCount(
  make: string | null,
  model: string | null
) {
  if (!make || !model) {
    return 0;
  }

  const { count, error } = await supabase
    .from("vehicle_auction_archive")
    .select("auction_id", {
      count: "exact",
      head: true,
    })
    .eq("make", make)
    .eq("model", model);

  if (error) {
    console.error(
      "Model auction count lookup error:",
      error
    );

    return 0;
  }

  return count || 0;
}
async function getComparablePriceStats(
  make: string | null,
  model: string | null,
  year: number | null,
  currentLotId: number
) {
  if (!make || !model) {
    return null;
  }

  const getRecords = async (
    minYear?: number,
    maxYear?: number
  ) => {
    let query = supabase
      .from("vehicle_auction_archive")
      .select("auction_id, final_bid, year")
      .eq("make", make)
      .eq("model", model)
      .neq("auction_id", currentLotId)
      .not("final_bid", "is", null)
      .gte("final_bid", 1000)
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
        "Comparable auction price lookup error:",
        error
      );
      return [];
    }

    return data || [];
  };

  let records =
    year !== null
      ? await getRecords(year, year)
      : await getRecords();

  let minYear = year;
  let maxYear = year;

  if (
    records.length < 5 &&
    year !== null
  ) {
    minYear = year - 2;
    maxYear = year + 2;

    records = await getRecords(
      minYear,
      maxYear
    );
  }

  const prices = records
    .map((record) => Number(record.final_bid))
    .filter(
      (price) =>
        Number.isFinite(price) &&
        price >= 1000
    );

  if (prices.length < 5) {
    return null;
  }

  const average =
    prices.reduce(
      (sum, price) => sum + price,
      0
    ) / prices.length;

  return {
    average: Math.round(average),
    count: prices.length,
    minYear,
    maxYear,
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
function toSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
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

  const cleanedSource = source.trim().toLowerCase();
  const cleanedLotNumber = lotNumber.trim();

  const record = await getLot(cleanedSource, cleanedLotNumber);

  const canonicalUrl =
    `https://salvagevinhistory.com/lot/${cleanedSource}/${cleanedLotNumber}`;

  if (!record) {
    return {
      title: `${source.toUpperCase()} Lot ${cleanedLotNumber} - Auction Record`,
      description: `Archived vehicle auction record for ${source.toUpperCase()} lot ${cleanedLotNumber}.`,
      robots: {
        index: false,
        follow: true,
      },
    };
  }

  const { lot, vehicle } = record;

  const vehicleName = vehicle
  ? [vehicle.year, vehicle.make, displayModel(vehicle.model)]
      .filter(Boolean)
      .join(" ")
  : lot.vin;

  const title =
  `${vehicleName} ${lot.vin} - ${lot.auction_source} Lot ${lot.lot_number}`;

  const descriptionParts = [
    `${vehicleName} auction history for ${lot.auction_source} lot ${lot.lot_number}.`,
    `VIN ${lot.vin}.`,
  ];

  if (lot.final_bid !== null) {
    descriptionParts.push(
      `Final bid ${formatBid(lot.final_bid)}.`
    );
  }

  if (lot.mileage !== null) {
    descriptionParts.push(
      `Mileage ${formatMileage(lot.mileage)}.`
    );
  }

  if (lot.primary_damage) {
    descriptionParts.push(
      `Primary damage: ${lot.primary_damage}.`
    );
  }

  const description = descriptionParts.join(" ");

  const firstImage =
    lot.image_urls && lot.image_urls.length > 0
      ? lot.image_urls[0]
      : undefined;

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
                alt: `${vehicleName} ${lot.auction_source} lot ${lot.lot_number}`,
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

const similarLots = await getSimilarLots(
  vehicle?.make || null,
  vehicle?.model || null,
  lot.id
);

const modelAuctionCount =
  await getModelAuctionCount(
    vehicle?.make || null,
    vehicle?.model || null
  );

const comparablePriceStats =
  await getComparablePriceStats(
    vehicle?.make || null,
    vehicle?.model || null,
    vehicle?.year || null,
    lot.id
  );
  const vehicleName = vehicle
  ? [vehicle.year, vehicle.make, displayModel(vehicle.model)]
      .filter(Boolean)
      .join(" ")
  : lot.vin;


 const vehicleDetails = [
  ["Body Style", lot.body_style],
  ["Color", lot.color],
  ["Engine", lot.engine],
  ["Transmission", lot.transmission],
  ["Drivetrain", lot.drivetrain],
  ["Fuel", lot.fuel],
];

const auctionDetails = [
  ["Auction Source", lot.auction_source],
  ["Lot Number", lot.lot_number],
  ["Final Bid", formatBid(lot.final_bid)],
  ["Auction Date", formatDate(lot.auction_date)],
  ["Location", lot.location],
  ["Mileage", formatMileage(lot.mileage)],
  ["Loss Type", lot.loss_type],
  ["Primary Damage", lot.primary_damage],
  ["Secondary Damage", lot.secondary_damage],
  ["Start Code", lot.start_code],
  [
    "Keys",
    lot.keys_present === null
      ? null
      : lot.keys_present
      ? "Present"
      : "Not reported as present",
  ],
  ["Seller", lot.seller],
  ["Seller Type", lot.seller_type],
  ["Title / Sale Document", lot.sale_document],
  [
    "Actual Cash Value",
    lot.acv !== null
      ? formatBid(lot.acv)
      : null,
  ],
  [
    "Estimated Repair Cost",
    lot.estimated_repair_cost !== null
      ? formatBid(lot.estimated_repair_cost)
      : null,
  ],
];
const overviewVehicleName = vehicle
  ? [
      vehicle.year,
    vehicle.make?.toUpperCase() === "BMW"
  ? "BMW"
  : vehicle.make,
      displayModel(vehicle.model),
      vehicle.trim
        ?.replace(
          new RegExp(`^${vehicle.year}\\s+`, "i"),
          ""
        ),
    ]
      .filter(Boolean)
      .join(" ")
  : lot.vin;

const overviewParts: string[] = [];

let openingSentence =
  `${overviewVehicleName} was archived from ` +
  `${lot.auction_source} lot ${lot.lot_number}`;

if (lot.auction_date) {
  openingSentence +=
    ` with an auction date of ${formatDate(lot.auction_date)}`;
}

if (lot.location) {
  openingSentence += ` in ${formatLocation(lot.location)}`;
}

openingSentence += ".";

overviewParts.push(openingSentence);

const conditionParts: string[] = [];

if (lot.mileage !== null) {
  conditionParts.push(
  `mileage of ${formatMileage(lot.mileage)}`
);

}

if (lot.primary_damage) {
  conditionParts.push(
    `primary damage listed as ${lot.primary_damage}`
  );
}

if (lot.secondary_damage) {
  conditionParts.push(
    `secondary damage listed as ${lot.secondary_damage}`
  );
}

if (lot.start_code) {
  conditionParts.push(
    `a start code of ${lot.start_code}`
  );
}

if (conditionParts.length > 0) {
  overviewParts.push(
    `The auction record reported ${conditionParts.join(
      ", "
    )}.`
  );
}

if (lot.final_bid !== null) {
  let bidSentence =
    `The archived final bid was ${formatBid(
      lot.final_bid
    )}`;

  if (comparablePriceStats) {
    const difference =
      lot.final_bid -
      comparablePriceStats.average;

    const differenceAmount =
      Math.abs(difference);

    const comparisonDirection =
      difference < 0
        ? "below"
        : difference > 0
        ? "above"
        : "equal to";

    const yearDescription =
      comparablePriceStats.minYear !== null &&
      comparablePriceStats.maxYear !== null &&
      comparablePriceStats.minYear !==
        comparablePriceStats.maxYear
        ? `${comparablePriceStats.minYear}–${comparablePriceStats.maxYear}`
        : comparablePriceStats.minYear !== null
        ? String(
            comparablePriceStats.minYear
          )
        : "";

    if (difference === 0) {
      bidSentence +=
        `, equal to the ${formatBid(
          comparablePriceStats.average
        )} average for comparable ${yearDescription} ${
          vehicle?.make?.toUpperCase() === "BMW"
  ? "BMW"
  : vehicle?.make || ""
        } ${
          displayModel(vehicle?.model) || ""
        } auction records, based on ${
          comparablePriceStats.count
        } comparable sales`;
    } else {
      bidSentence +=
        `, which was ${formatBid(
          differenceAmount
        )} ${comparisonDirection} the ${formatBid(
          comparablePriceStats.average
        )} average for comparable ${yearDescription} ${
          vehicle?.make?.toUpperCase() === "BMW"
  ? "BMW"
  : vehicle?.make || ""
        } ${
          displayModel(vehicle?.model) || ""
        } auction records, based on ${
          comparablePriceStats.count
        } comparable sales`;
    }
  }

  overviewParts.push(
    `${bidSentence}.`
  );
}

const valueParts: string[] = [];

if (lot.sale_document) {
  valueParts.push(
    `The sale document was listed as ${lot.sale_document}`
  );
}

if (lot.acv !== null) {
  valueParts.push(
    `reported actual cash value was ${formatBid(lot.acv)}`
  );
}

if (lot.estimated_repair_cost !== null) {
  valueParts.push(
    `estimated repair cost was ${formatBid(
      lot.estimated_repair_cost
    )}`
  );
}

if (valueParts.length > 0) {
  if (valueParts.length === 1) {
    overviewParts.push(
      `${valueParts[0]}.`
    );
  } else {
    overviewParts.push(
      `${valueParts[0]}. ${valueParts
        .slice(1)
        .map(
          (part) =>
            part.charAt(0).toUpperCase() +
            part.slice(1)
        )
        .join(". ")}.`
    );
  }
}
function formatLocation(value: string | null) {
  if (!value) return null;

  const match = value.match(
    /^([A-Z]{2})\s*-\s*(.+?)\s*\(\1\)$/i
  );

  if (match) {
    return `${match[2]}, ${match[1].toUpperCase()}`;
  }

  return value;
}
const auctionOverview =
  overviewParts.join(" ");


  return (

    <main

      style={{

        minHeight: "100vh",

        background: "#ffffff",

        color: "#171717",

        fontFamily: "Arial, sans-serif",

      }}

    >

      



      {/* AUCTION HERO */}



      <section

        style={{

          background: "#f6f7f8",

          borderBottom: "1px solid #e8e8e8",

        }}

      >

        <div
  className="lot-hero-inner"
  style={{
    maxWidth: "1200px",
    margin: "0 auto",
    padding: "24px",
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "34px",
    alignItems: "center",
  }}
>
  <div>
<div
  style={{
    marginBottom: "10px",
  }}
>
  <Link
    href={`/vin/${lot.vin}`}
    style={{
      color: "#555",
      textDecoration: "none",
      fontSize: "13px",
      fontWeight: "600",
    }}
  >
    ← Full VIN history
  </Link>
</div>
  {vehicle?.make && vehicle?.model && (
  <div
    style={{
      display: "flex",
      flexWrap: "wrap",
      gap: "7px",
      alignItems: "center",
      marginBottom: "16px",
      fontSize: "13px",
      color: "#777",
    }}
  >
    <Link
      href="/vehicles"
      style={{
        color: "#666",
        textDecoration: "none",
      }}
    >
      Vehicles
    </Link>

    <span>›</span>

    <Link
  href={`/vehicles/${toSlug(vehicle.make)}`}
  style={{
    color: "#444",
    fontWeight: "600",
    textDecoration: "none",
  }}
>
  {vehicle.make}
</Link>

    <span>›</span>

    <Link
      href={`/vehicles/${toSlug(vehicle.make)}/${toSlug(
        displayModel(vehicle.model) || vehicle.model
      )}`}
      style={{
        color: "#171717",
        fontWeight: "700",
        textDecoration: "none",
      }}
    >
      {displayModel(vehicle.model)}
    </Link>
  </div>
)}
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
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: "6px",
    background: "#e9ecef",
    color: "#4f4f4f",
    fontSize: "12px",
    fontWeight: "700",
    letterSpacing: "0.6px",
    textTransform: "uppercase",
  }}
>
  Archived Auction
</span>

          </div>



         <h1
  className="lot-vehicle-title"
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
      fontSize: "24px",
      fontWeight: "700",
      color: "#2b2b2b",
      marginBottom: "18px",
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
    gap: "12px",
  }}
>
  <div>
    <div
      style={{
  fontSize: "15px",
  color: "#444",
  textTransform: "uppercase",
  letterSpacing: "1px",
  fontWeight: "900",
  marginBottom: "7px",
}}
    >
      VIN
    </div>

    <Link
      href={`/vin/${lot.vin}`}
      style={{
  display: "inline-block",
  color: "#171717",
  fontSize: "40px",
  fontWeight: "900",
  letterSpacing: "0.8px",
  textDecoration: "none",
  lineHeight: 1.08,
  marginBottom: "4px",
}}
    >
      {lot.vin}
    </Link>
  </div>

  <div
  style={{
    fontSize: "16px",
    color: "#555",
    fontWeight: "600",
  }}
>
  {lot.auction_source} Lot{" "}
  <strong
    style={{
      color: "#171717",
      fontWeight: "800",
    }}
  >
    #{lot.lot_number}
  </strong>
</div>
</div>
</div>
          
<section
  className="lot-stats-grid"
  style={{
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "12px",
  }}
>
  <div
    style={{
      padding: "20px",
      border: "1px solid #171717",
      borderRadius: "10px",
      background: "#171717",
      color: "#ffffff",
    }}
  >
    <div
      style={{
        fontSize: "11px",
        color: "#cfcfcf",
        textTransform: "uppercase",
        letterSpacing: "0.7px",
        marginBottom: "7px",
        fontWeight: "bold",
      }}
    >
      Final Auction Bid
    </div>

    <strong
      style={{
        fontSize: "30px",
        lineHeight: 1.1,
      }}
    >
      {formatBid(lot.final_bid)}
    </strong>

    <div
      style={{
        marginTop: "8px",
        fontSize: "12px",
        color: "#cfcfcf",
      }}
    >
      Archived {lot.auction_source} auction result
    </div>
  </div>

  <div
    style={{
      padding: "20px",
      border: "1px solid #e2e2e2",
      borderRadius: "10px",
      background: "#ffffff",
    }}
  >
    <div
      style={{
        fontSize: "11px",
        color: "#777",
        textTransform: "uppercase",
        letterSpacing: "0.7px",
        marginBottom: "7px",
      }}
    >
      Mileage
    </div>

    <strong style={{ fontSize: "18px" }}>
      {formatMileage(lot.mileage)}
    </strong>
  </div>

  <div
    style={{
      padding: "20px",
      border: "1px solid #e2e2e2",
      borderRadius: "10px",
      background: "#ffffff",
    }}
  >
    <div
      style={{
        fontSize: "11px",
        color: "#777",
        textTransform: "uppercase",
        letterSpacing: "0.7px",
        marginBottom: "7px",
      }}
    >
      Auction Date
    </div>

    <strong style={{ fontSize: "17px" }}>
      {formatDate(lot.auction_date)}
    </strong>
  </div>

  <div
    style={{
      padding: "20px",
      border: "1px solid #e2e2e2",
      borderRadius: "10px",
      background: "#ffffff",
    }}
  >
    <div
      style={{
        fontSize: "11px",
        color: "#777",
        textTransform: "uppercase",
        letterSpacing: "0.7px",
        marginBottom: "7px",
      }}
    >
      Primary Damage
    </div>

    <strong style={{ fontSize: "17px" }}>
      {display(lot.primary_damage)}
    </strong>
  </div>
</section>

</div>

</section>



      <div
  className="lot-page-content"
  style={{
    maxWidth: "1200px",

          margin: "0 auto",

         padding: "22px 24px 80px",

        }}

      >

       


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



           <AuctionPhotoGallery
  images={lot.image_urls}
  vehicleName={vehicleName}
  auctionSource={lot.auction_source}
  lotNumber={lot.lot_number}
/>

          </section>

        )}
{/* REMOVAL CTA */}

          <div
            style={{
              marginTop: "26px",
              padding: "20px 22px",
              background: "#ffffff",
              border: "1px solid #dedede",
              borderRadius: "10px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "22px",
              flexWrap: "wrap",
            }}
          >
            <div style={{ flex: "1 1 420px" }}>
              <div
                style={{
                  fontSize: "17px",
                  fontWeight: "800",
                  marginBottom: "5px",
                  color: "#171717",
                }}
              >
                Want this auction record removed?
              </div>

              <div
                style={{
                  fontSize: "14px",
                  lineHeight: 1.55,
                  color: "#666",
                }}
              >
                Request removal of this vehicle&apos;s auction listing
                and archived photos from Salvage VIN History.
              </div>
            </div>

            <RemoveListingButton
              vin={lot.vin}
              auctionSource={lot.auction_source}
              lotNumber={lot.lot_number}
            />
          </div>

{/* AUCTION OVERVIEW */}

<section
  style={{
    marginTop: "34px",
    marginBottom: "44px",
    padding: "28px",
    background: "#f6f7f8",
    border: "1px solid #e1e1e1",
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
    Auction Overview
  </div>

  <h2
    style={{
      margin: "0 0 14px",
      fontSize: "24px",
      lineHeight: 1.3,
    }}
  >
    About This{" "}
{vehicle?.make?.toUpperCase() === "BMW"
  ? "BMW"
  : vehicle?.make || "Vehicle"}{" "}
Auction
  </h2>

  <p
    style={{
      margin: 0,
      color: "#444",
      fontSize: "15px",
      lineHeight: 1.75,
      maxWidth: "1050px",
    }}
  >
    {auctionOverview}
  </p>
</section>
{/* VEHICLE DETAILS */}

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
      Vehicle Details
    </h2>

    <p
      style={{
        color: "#666",
        fontSize: "14px",
        lineHeight: 1.6,
        margin: 0,
      }}
    >
      Vehicle specifications recorded with this archived auction listing.
    </p>
  </div>

  <div
    style={{
      display: "grid",
      gridTemplateColumns:
        "repeat(auto-fit, minmax(320px, 1fr))",
      gap: "12px",
    }}
  >
    {vehicleDetails
      .filter(([, value]) => {
        return (
          value !== null &&
          value !== undefined &&
          value !== "" &&
          value !== "Not available"
        );
      })
      .map(([label, value]) => (
        <div
          key={String(label)}
          className="lot-detail-row"
          style={{
            display: "grid",
            gridTemplateColumns: "150px 1fr",
            gap: "16px",
            padding: "16px 18px",
            background: "#fafafa",
            border: "1px solid #e5e5e5",
            borderRadius: "8px",
            alignItems: "center",
          }}
        >
          <span
            style={{
              color: "#777",
              fontSize: "13px",
            }}
          >
            {label}
          </span>

          <strong
            style={{
              fontSize: "14px",
              fontWeight: "700",
              color: "#171717",
            }}
          >
            {display(value)}
          </strong>
        </div>
      ))}
  </div>
</section>

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

              Auction & Condition

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
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: "12px",
  }}
>
          {auctionDetails
  .filter(([, value]) => {
    return (
      value !== null &&
      value !== undefined &&
      value !== "" &&
      value !== "Not available"
    );
  })
  .map(([label, value], index) => (

             <div
  key={String(label)}
  className="lot-detail-row"
  style={{
  display: "grid",
  gridTemplateColumns: "150px 1fr",
  gap: "16px",
  padding: "16px 18px",
  background: "#fafafa",
  border: "1px solid #e5e5e5",
  borderRadius: "8px",
  alignItems: "center",
}}

              >

                <span

                  style={{
  color: "#777",
  fontSize: "13px",
}}

                >

                  {label}

                </span>



                <strong

                  style={{
  fontSize: "14px",
  fontWeight: "700",
  color: "#171717",
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
        Similar {vehicle?.make}{" "}
        {vehicle?.model ? displayModel(vehicle.model) : ""} Auction Sales
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
        const similarLotUrl =
          `/lot/${similarLot.auction_source.toLowerCase()}/` +
          `${similarLot.lot_number}`;

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
                ) : (
                  <div
                    style={{
                      height: "100%",
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
              </div>

              <div
                style={{
                  padding: "16px",
                }}
              >
                <div
                  style={{
                    fontSize: "12px",
                    color: "#666",
                    fontWeight: "bold",
                    textTransform: "uppercase",
                    marginBottom: "7px",
                  }}
                >
                  {similarLot.auction_source} •{" "}
                  {formatDate(similarLot.auction_date)}
                </div>

                <div
  style={{
    marginBottom: "14px",
  }}
>
  <div
    style={{
      fontSize: "18px",
      fontWeight: "700",
      marginBottom: similarLot.trim ? "4px" : "0",
    }}
  >
    {similarVehicleName}
  </div>

  {similarLot.trim && (
    <div
      style={{
        fontSize: "14px",
        fontWeight: "600",
        color: "#555",
      }}
    >
      {similarLot.trim.replace(
        new RegExp(`^${similarLot.year}\\s+`, "i"),
        ""
      )}
    </div>
  )}
</div>

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

    {vehicle?.make && (
  <div
    style={{
      marginTop: "22px",
    }}
  >
    <Link
      href={
        vehicle.model && modelAuctionCount >= 5
          ? `/vehicles/${toSlug(vehicle.make)}/${toSlug(
              displayModel(vehicle.model) || vehicle.model
            )}`
          : `/vehicles/${toSlug(vehicle.make)}`
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
        ? `View all ${vehicle.make} ${
            displayModel(vehicle.model) || vehicle.model
          } auctions →`
        : `View all ${vehicle.make} auctions →`}
    </Link>
  </div>
)}
  </section>
)}

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
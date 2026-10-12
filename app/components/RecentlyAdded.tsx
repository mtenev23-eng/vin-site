
import Link from "next/link";
import { unstable_cache } from "next/cache";
import { supabase } from "../../utils/supabase/client";

type RecentLot = {
  id: number;
  vin: string;
  auction_source: string;
  lot_number: string;
  created_at: string | null;
};

type Vehicle = {
  vin: string;
  year: number | null;
  make: string | null;
  model: string | null;
};

const getRecentlyAdded = unstable_cache(
  async () => {
    const { data: lots, error } = await supabase
      .from("auction_lots")
      .select(
        "id, vin, auction_source, lot_number, created_at"
      )
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(24);

    if (error) {
      console.error("Recently added lots error:", error);
      return [];
    }

    const recentLots = (lots || []) as RecentLot[];

    const vins = [
      ...new Set(recentLots.map((lot) => lot.vin)),
    ];

    if (vins.length === 0) return [];

    const { data: vehicles, error: vehicleError } =
      await supabase
        .from("vehicles")
        .select("vin, year, make, model")
        .in("vin", vins);

    if (vehicleError) {
      console.error(
        "Recently added vehicles error:",
        vehicleError
      );
      return [];
    }

    const vehicleMap = new Map(
      ((vehicles || []) as Vehicle[]).map((vehicle) => [
        vehicle.vin,
        vehicle,
      ])
    );

    return recentLots.map((lot) => ({
      ...lot,
      vehicle: vehicleMap.get(lot.vin) || null,
    }));
  },
  ["recently-added-auction-lots-v1"],
  { revalidate: 300 }
);

export default async function RecentlyAdded() {
  const lots = await getRecentlyAdded();

  if (lots.length === 0) return null;

  return (
    <section
      style={{
        background: "#ffffff",
        borderTop: "1px solid #eeeeee",
      }}
    >
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "42px 24px 55px",
        }}
      >
        <h2
          style={{
            fontSize: "28px",
            margin: "0 0 10px",
          }}
        >
          Recently Added to Our Archive
        </h2>

        <p
          style={{
            color: "#666666",
            fontSize: "15px",
            lineHeight: 1.6,
            margin: "0 0 24px",
          }}
        >
          Explore newly archived Copart and IAAI
          auction records, including historical
          vehicle sales recently added to our database.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(250px, 1fr))",
            gap: "14px",
          }}
        >
          {lots.map((lot) => {
            const name = [
              lot.vehicle?.year,
              lot.vehicle?.make,
              lot.vehicle?.model,
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <article
                key={`${lot.auction_source}-${lot.lot_number}`}
                style={{
                  border: "1px solid #e5e5e5",
                  borderRadius: "9px",
                  padding: "16px",
                }}
              >
                <div
                  style={{
                    fontSize: "12px",
                    color: "#777",
                    marginBottom: "7px",
                  }}
                >
                  {lot.auction_source} ·
                  Lot #{lot.lot_number}
                </div>

                <h3
                  style={{
                    fontSize: "17px",
                    margin: "0 0 12px",
                  }}
                >
                  <Link
                    href={`/lot/${lot.auction_source.toLowerCase()}/${lot.lot_number}`}
                    style={{ color: "#171717" }}
                  >
                    {name || `VIN ${lot.vin}`}
                  </Link>
                </h3>

                <Link
                  href={`/vin/${lot.vin}`}
                  style={{
                    color: "#555555",
                    fontSize: "13px",
                    overflowWrap: "anywhere",
                  }}
                >
                  VIN: {lot.vin}
                </Link>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

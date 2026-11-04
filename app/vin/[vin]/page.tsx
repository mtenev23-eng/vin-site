import { cache } from "react";
import { notFound, permanentRedirect } from "next/navigation";
import { supabase } from "../../../utils/supabase/client";

export const dynamic = "force-dynamic";

type VinPageProps = {
  params: Promise<{ vin: string }>;
};

const getPrimaryLotUrl = cache(async (rawVin: string): Promise<string | null> => {
  const vin = rawVin.trim().toUpperCase();

  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) return null;

  // An approved removal deletes the vehicle and its lots. Do not redirect
  // orphaned auction rows or expose records for a deleted vehicle.
  const { data: vehicle, error: vehicleError } = await supabase
    .from("vehicles")
    .select("vin")
    .eq("vin", vin)
    .maybeSingle();

  if (vehicleError) {
    console.error("VIN redirect vehicle lookup failed:", vehicleError);
    throw new Error("Unable to resolve VIN history");
  }
  if (!vehicle) return null;

  const { data: lot, error: lotError } = await supabase
    .from("auction_lots")
    .select("auction_source, lot_number")
    .eq("vin", vin)
    .order("auction_date", { ascending: false, nullsFirst: false })
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lotError) {
    console.error("VIN redirect auction lookup failed:", lotError);
    throw new Error("Unable to resolve VIN auction lot");
  }
  if (!lot) return null;

  const source = String(lot.auction_source || "").toLowerCase();
  const number = String(lot.lot_number || "").trim();
  if (!(["copart", "iaai"].includes(source) && /^[A-Za-z0-9_-]+$/.test(number))) {
    console.error("VIN redirect found invalid auction lot identifier", { vin, source });
    return null;
  }

  return `/lot/${source}/${number}`;
});

export async function generateMetadata({ params }: VinPageProps) {
  const { vin } = await params;
  const destination = await getPrimaryLotUrl(vin);
  return {
    title: "Vehicle Auction History",
    robots: { index: false, follow: true },
    ...(destination ? { alternates: { canonical: `https://salvagevinhistory.com${destination}` } } : {}),
  };
}

export default async function VinPage({ params }: VinPageProps) {
  const { vin } = await params;
  const destination = await getPrimaryLotUrl(vin);
  if (!destination) notFound();
  permanentRedirect(destination);
}

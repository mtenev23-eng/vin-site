import { NextResponse } from "next/server";
import { supabase } from "../../../utils/supabase/client";

export async function GET() {
  const { data: lots, error } = await supabase
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
    .not("auction_date", "is", null)
    .order("auction_date", {
      ascending: false,
    })
    .limit(12);

  if (error) {
    console.error("Recent auctions error:", error);

    return NextResponse.json(
      { error: "Could not load recent auctions." },
      { status: 500 }
    );
  }

  if (!lots || lots.length === 0) {
    return NextResponse.json([]);
  }

  const vins = [...new Set(lots.map((lot) => lot.vin))];

  const { data: vehicles, error: vehicleError } =
    await supabase
      .from("vehicles")
      .select("vin, year, make, model")
      .in("vin", vins);

  if (vehicleError) {
    console.error(
      "Recent auction vehicle error:",
      vehicleError
    );

    return NextResponse.json(
      { error: "Could not load vehicle information." },
      { status: 500 }
    );
  }

  const vehicleMap = new Map(
    (vehicles || []).map((vehicle) => [
      vehicle.vin,
      vehicle,
    ])
  );

  const results = lots.map((lot) => ({
    ...lot,
    vehicle: vehicleMap.get(lot.vin) || null,
  }));

  return NextResponse.json(results);
}
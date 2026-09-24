import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY as string
);

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      vin,
      auctionSource,
      lotNumber,
    } = body;

    if (!vin || !auctionSource || !lotNumber) {
      return NextResponse.json(
        { error: "Missing listing information." },
        { status: 400 }
      );
    }

    const origin =
      request.headers.get("origin") ||
      "http://localhost:3000";

    const session =
      await stripe.checkout.sessions.create({
        mode: "payment",

        line_items: [
          {
            price_data: {
              currency: "usd",

              product_data: {
                name: "Auction Listing Removal",
                description: `${auctionSource} lot #${lotNumber} — VIN ${vin}`,
              },

              unit_amount: 3900,
            },

            quantity: 1,
          },
        ],

        metadata: {
          vin,
          auctionSource,
          lotNumber,
          service: "listing_removal",
        },

        success_url:
          `${origin}/removal-success?session_id={CHECKOUT_SESSION_ID}`,

        cancel_url:
          `${origin}/lot/${auctionSource.toLowerCase()}/${lotNumber}`,
      });

    return NextResponse.json({
      url: session.url,
    });
  } catch (error) {
    console.error(
      "Stripe checkout error:",
      error
    );

    return NextResponse.json(
      { error: "Could not create checkout session." },
      { status: 500 }
    );
  }
}
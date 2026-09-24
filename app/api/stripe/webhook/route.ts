import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY as string
);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SECRET_KEY as string
);

export async function POST(request: Request) {
  try {
    const body = await request.text();

    const signature =
      request.headers.get("stripe-signature");

    if (!signature) {
      return NextResponse.json(
        { error: "Missing Stripe signature." },
        { status: 400 }
      );
    }

    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET as string
    );

    if (event.type === "checkout.session.completed") {
      const session =
        event.data.object as Stripe.Checkout.Session;

      const vin = session.metadata?.vin;
      const auctionSource =
        session.metadata?.auctionSource;
      const lotNumber =
        session.metadata?.lotNumber;

      if (!vin || !auctionSource || !lotNumber) {
        throw new Error(
          "Stripe session is missing listing metadata."
        );
      }

      const { error } = await supabase
        .from("removal_requests")
        .upsert(
          {
            vin,
            auction_source: auctionSource,
            lot_number: lotNumber,
            customer_email:
              session.customer_details?.email ?? null,
            stripe_session_id: session.id,
            stripe_payment_intent_id:
              typeof session.payment_intent === "string"
                ? session.payment_intent
                : null,
            amount_paid: session.amount_total,
            currency: session.currency,
            payment_status:
              session.payment_status,
            removal_status: "pending_review",
          },
          {
            onConflict: "stripe_session_id",
          }
        );

      if (error) {
        throw error;
      }

      console.log(
        `Removal request saved: ${vin} / ${auctionSource} / ${lotNumber}`
      );
    }

    return NextResponse.json({
      received: true,
    });
  } catch (error) {
    console.error(
      "Stripe webhook error:",
      error
    );

    return NextResponse.json(
      { error: "Webhook processing failed." },
      { status: 400 }
    );
  }
}
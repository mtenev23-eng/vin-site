import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { sendRemovalNotification } from "@/lib/sendRemovalNotification";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SECRET_KEY as string
);

function sortObject(value: any): any {
  if (Array.isArray(value)) {
    return value.map(sortObject);
  }

  if (
    value !== null &&
    typeof value === "object"
  ) {
    return Object.keys(value)
      .sort()
      .reduce((result: Record<string, any>, key) => {
        result[key] = sortObject(value[key]);
        return result;
      }, {});
  }

  return value;
}

export async function POST(request: Request) {
  try {
    const ipnSecret =
      process.env.NOWPAYMENTS_IPN_SECRET;

    if (!ipnSecret) {
      throw new Error(
        "NOWPAYMENTS_IPN_SECRET is missing."
      );
    }

    const signature =
      request.headers.get("x-nowpayments-sig");

    if (!signature) {
      return NextResponse.json(
        { error: "Missing NOWPayments signature." },
        { status: 400 }
      );
    }

    const rawBody = await request.text();
    const payment = JSON.parse(rawBody);

    const sortedBody = sortObject(payment);
    const sortedJson = JSON.stringify(sortedBody);

    const expectedSignature = crypto
      .createHmac("sha512", ipnSecret)
      .update(sortedJson)
      .digest("hex");

    const signatureBuffer = Buffer.from(
      signature,
      "hex"
    );

    const expectedBuffer = Buffer.from(
      expectedSignature,
      "hex"
    );

    if (
      signatureBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(
        signatureBuffer,
        expectedBuffer
      )
    ) {
      return NextResponse.json(
        { error: "Invalid NOWPayments signature." },
        { status: 401 }
      );
    }

    const {
      payment_id,
      payment_status,
      pay_amount,
      pay_currency,
      price_amount,
      price_currency,
      order_id,
      order_description,
    } = payment;

    console.log(
      `NOWPayments IPN: ${payment_id} / ${payment_status}`
    );

    /*
     * NOWPayments sends several status updates while
     * a transaction progresses.
     *
     * We only create the removal request once the
     * payment reaches the final "finished" status.
     */
    if (payment_status !== "finished") {
      return NextResponse.json({
        received: true,
      });
    }

    if (!payment_id || !order_id) {
      throw new Error(
        "NOWPayments IPN is missing payment information."
      );
    }

    /*
     * Our checkout creates order IDs like:
     *
     * removal-COPART-56723316-1234567890
     */
    const orderMatch = String(order_id).match(
      /^removal-(COPART|IAAI)-([^-]+)-\d+$/
    );

    if (!orderMatch) {
      throw new Error(
        "Invalid NOWPayments order ID."
      );
    }

    const auctionSource = orderMatch[1];
    const lotNumber = orderMatch[2];

    /*
     * The VIN is also included in the order
     * description created by our checkout route.
     */
    const descriptionMatch = String(
      order_description ?? ""
    ).match(/VIN\s+([A-HJ-NPR-Z0-9]{17})/i);

    if (!descriptionMatch) {
      throw new Error(
        "Could not determine VIN from NOWPayments order."
      );
    }

    const vin = descriptionMatch[1].toUpperCase();

    /*
     * Verify that this is our expected $39 USD
     * removal product before recording it.
     */
    if (
      Number(price_amount) !== 39 ||
      String(price_currency).toLowerCase() !== "usd"
    ) {
      throw new Error(
        "NOWPayments payment amount does not match removal fee."
      );
    }

    const { error } = await supabase
      .from("removal_requests")
      .upsert(
        {
          vin,
          auction_source: auctionSource,
          lot_number: lotNumber,

          payment_provider: "nowpayments",

          nowpayments_payment_id:
            String(payment_id),

          nowpayments_order_id:
            String(order_id),

          crypto_currency:
            pay_currency
              ? String(pay_currency).toUpperCase()
              : null,

          crypto_amount:
            pay_amount !== undefined
              ? Number(pay_amount)
              : null,

          /*
           * Keep amount_paid consistent with Stripe:
           * Stripe stores cents, so $39 = 3900.
           */
          amount_paid: 3900,
          currency: "usd",

          payment_status: "finished",
          removal_status: "pending_review",
        },
        {
          onConflict: "nowpayments_payment_id",
        }
      );

    if (error) {
  throw error;
}

console.log(
  `Crypto removal request saved: ${vin} / ${auctionSource} / ${lotNumber}`
);

await sendRemovalNotification({
  vin,
  auctionSource,
  lotNumber,
  paymentMethod: "NOWPayments",
  amount: "$39.00",
  paymentId: String(payment_id),
});
    return NextResponse.json({
      received: true,
    });
  } catch (error) {
    console.error(
      "NOWPayments webhook error:",
      error
    );

    return NextResponse.json(
      { error: "Webhook processing failed." },
      { status: 400 }
    );
  }
}
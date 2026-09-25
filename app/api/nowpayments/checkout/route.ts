import { NextResponse } from "next/server";

const NOWPAYMENTS_API_URL =
  "https://api.nowpayments.io/v1/invoice";

const SITE_URL = "https://salvagevinhistory.com";

export async function POST(request: Request) {
  try {
    const apiKey = process.env.NOWPAYMENTS_API_KEY;

    if (!apiKey) {
      console.error("NOWPAYMENTS_API_KEY is missing");

      return NextResponse.json(
        { error: "Crypto payments are not configured." },
        { status: 500 }
      );
    }

    const body = await request.json();

    const vin =
      typeof body.vin === "string"
        ? body.vin.trim().toUpperCase()
        : "";

    const auctionSource =
      typeof body.auctionSource === "string"
        ? body.auctionSource.trim().toUpperCase()
        : "";

    const lotNumber =
      typeof body.lotNumber === "string"
        ? body.lotNumber.trim()
        : "";

    if (!vin || !auctionSource || !lotNumber) {
      return NextResponse.json(
        { error: "Missing listing information." },
        { status: 400 }
      );
    }

    const orderId = `removal-${auctionSource}-${lotNumber}-${Date.now()}`;

    const response = await fetch(NOWPAYMENTS_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        price_amount: 39,
        price_currency: "usd",

        order_id: orderId,

        order_description:
          `Auction listing removal request - VIN ${vin} - ${auctionSource} lot ${lotNumber}`,

        ipn_callback_url:
          `${SITE_URL}/api/nowpayments/webhook`,

        success_url:
          `${SITE_URL}/removal-success?payment=crypto`,

        cancel_url:
          `${SITE_URL}/lot/${auctionSource.toLowerCase()}/${lotNumber}`,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(
        "NOWPayments invoice creation failed:",
        data
      );

      return NextResponse.json(
        {
          error: "Could not create crypto payment.",
        },
        { status: 500 }
      );
    }

    if (!data.invoice_url) {
      console.error(
        "NOWPayments did not return invoice_url:",
        data
      );

      return NextResponse.json(
        {
          error: "Crypto checkout URL was not returned.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      url: data.invoice_url,
    });
  } catch (error) {
    console.error(
      "NOWPayments checkout error:",
      error
    );

    return NextResponse.json(
      {
        error: "Could not start crypto payment.",
      },
      { status: 500 }
    );
  }
}
import { NextResponse } from "next/server";
import { sendRemovalNotification } from "@/lib/sendRemovalNotification";

export async function GET() {
  try {
    await sendRemovalNotification({
      vin: "TESTVIN1234567890",
      auctionSource: "COPART",
      lotNumber: "12345678",
      paymentMethod: "Stripe",
      amount: "$39.00",
      paymentId: "TEST-PAYMENT",
    });

    return NextResponse.json({
      success: true,
      message: "Test removal notification triggered.",
    });
  } catch (error) {
    console.error("Test email error:", error);

    return NextResponse.json(
      { error: "Test email failed." },
      { status: 500 }
    );
  }
}
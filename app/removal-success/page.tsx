import Link from "next/link";
import Stripe from "stripe";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Removal Request",
  description:
    "Removal request payment confirmation for Salvage VIN History.",

  robots: {
    index: false,
    follow: false,
  },

  alternates: {
    canonical: "/removal-success",
  },

  openGraph: {
    title: "Removal Request",
    description:
      "Removal request payment confirmation for Salvage VIN History.",
    url: "/removal-success",
    type: "website",
    siteName: "Salvage VIN History",
  },

  twitter: {
    card: "summary",
    title: "Removal Request",
    description:
      "Removal request payment confirmation for Salvage VIN History.",
  },
};

const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY as string
);

type Props = {
  searchParams: Promise<{
    session_id?: string;
  }>;
};

export default async function RemovalSuccessPage({
  searchParams,
}: Props) {
  const { session_id } = await searchParams;

  let paymentVerified = false;

  if (session_id) {
    try {
      const session =
        await stripe.checkout.sessions.retrieve(
          session_id
        );

      paymentVerified =
        session.payment_status === "paid" &&
        session.amount_total === 3900 &&
        session.currency === "usd" &&
        session.metadata?.service ===
          "listing_removal";
    } catch (error) {
      console.error(
        "Could not verify Stripe session:",
        error
      );
    }
  }

  if (!paymentVerified) {
    return (
      <main
        style={{
          maxWidth: "760px",
          margin: "0 auto",
          padding: "100px 24px",
          textAlign: "center",
        }}
      >
        <h1
          style={{
            fontSize: "36px",
            marginBottom: "16px",
          }}
        >
          Payment not verified
        </h1>

        <p
          style={{
            fontSize: "17px",
            lineHeight: "1.6",
            color: "#555",
            marginBottom: "36px",
          }}
        >
          We could not verify a completed payment
          for this removal request.
        </p>

        <Link
          href="/"
          style={{
            display: "inline-block",
            background: "#111",
            color: "#fff",
            padding: "14px 24px",
            borderRadius: "6px",
            textDecoration: "none",
            fontWeight: 700,
          }}
        >
          RETURN TO SALVAGE VIN HISTORY
        </Link>
      </main>
    );
  }

  return (
    <main
      style={{
        maxWidth: "760px",
        margin: "0 auto",
        padding: "100px 24px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: "52px",
          marginBottom: "20px",
        }}
      >
        ✓
      </div>

      <h1
        style={{
          fontSize: "36px",
          marginBottom: "16px",
        }}
      >
        Payment received
      </h1>

      <p
        style={{
          fontSize: "18px",
          lineHeight: "1.6",
          color: "#555",
          marginBottom: "12px",
        }}
      >
        Your auction listing removal request has
        been submitted successfully.
      </p>

      <p
        style={{
          fontSize: "16px",
          lineHeight: "1.6",
          color: "#666",
          marginBottom: "36px",
        }}
      >
        We will review the request and process
        eligible removals. Payment does not
        guarantee removal if the request does not
        meet our removal requirements.
      </p>

      <Link
        href="/"
        style={{
          display: "inline-block",
          background: "#111",
          color: "#fff",
          padding: "14px 24px",
          borderRadius: "6px",
          textDecoration: "none",
          fontWeight: 700,
        }}
      >
        RETURN TO SALVAGE VIN HISTORY
      </Link>
    </main>
  );
}
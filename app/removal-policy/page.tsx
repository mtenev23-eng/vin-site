import Link from "next/link";

export const metadata = {
  title: "Removal Policy",
  description:
    "Learn how to request removal of archived vehicle auction listings and photos from Salvage VIN History, including eligibility, processing and refund information.",

  alternates: {
    canonical: "/removal-policy",
  },

  robots: {
    index: true,
    follow: true,
  },

  openGraph: {
    title: "Removal Policy",
    description:
      "Learn how to request removal of archived vehicle auction listings and photos from Salvage VIN History, including eligibility, processing and refund information.",
    url: "/removal-policy",
    type: "website",
    siteName: "Salvage VIN History",
  },

  twitter: {
    card: "summary",
    title: "Removal Policy",
    description:
      "Learn how to request removal of archived vehicle auction listings and photos from Salvage VIN History, including eligibility, processing and refund information.",
  },
};

const sectionStyle = {
  marginTop: "42px",
};

const headingStyle = {
  fontSize: "22px",
  margin: "0 0 14px",
  color: "#171717",
};

const paragraphStyle = {
  color: "#555",
  fontSize: "16px",
  lineHeight: 1.75,
  margin: "0 0 14px",
};

const listStyle = {
  color: "#555",
  lineHeight: 1.8,
  paddingLeft: "22px",
  margin: "16px 0 0",
  listStyleType: "disc",
  listStylePosition: "outside" as const,
};

export default function RemovalPolicyPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#ffffff",
        color: "#171717",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: "850px",
          margin: "0 auto",
          padding: "70px 24px 100px",
        }}
      >
        {/* PAGE INTRO */}

        <div
          style={{
            borderBottom: "1px solid #e5e5e5",
            paddingBottom: "34px",
          }}
        >
          <div
            style={{
              fontSize: "13px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "1px",
              color: "#666",
              marginBottom: "10px",
            }}
          >
            Salvage VIN History
          </div>

          <h1
            style={{
              fontSize: "42px",
              margin: "0 0 12px",
            }}
          >
            Removal Policy
          </h1>

          <p
            style={{
              color: "#777",
              margin: 0,
              fontSize: "14px",
            }}
          >
            Last updated: September 25, 2026
          </p>
        </div>

        {/* LISTING REMOVAL */}

        <section style={sectionStyle}>
          <h2 style={headingStyle}>Listing Removal Requests</h2>

          <p style={paragraphStyle}>
            Salvage VIN History maintains an archive of historical vehicle
            auction information. Vehicle owners or authorized representatives
            may submit a request to remove a vehicle&apos;s auction listing and
            archived photos from Salvage VIN History.
          </p>
        </section>

        {/* FEE */}

        <section style={sectionStyle}>
          <h2 style={headingStyle}>Removal Request Fee</h2>

          <div
            style={{
              background: "#f7f7f7",
              border: "1px solid #e5e5e5",
              borderRadius: "8px",
              padding: "22px 24px",
            }}
          >
            <div
              style={{
                fontSize: "28px",
                fontWeight: 700,
                marginBottom: "8px",
              }}
            >
              $39 processing fee
            </div>

            <p
              style={{
                ...paragraphStyle,
                marginBottom: 0,
              }}
            >
              The fee covers the review and processing of a paid removal
              request. Payment does not automatically guarantee removal. Each
              request is reviewed before action is taken.
            </p>
          </div>
        </section>

        {/* ELIGIBILITY */}

        <section style={sectionStyle}>
          <h2 style={headingStyle}>Eligibility and Verification</h2>

          <p style={paragraphStyle}>
            We may request reasonable information to verify that the person
            submitting the request is the vehicle owner or is authorized to
            act on behalf of the vehicle owner.
          </p>

          <ul style={listStyle}>
            <li>Vehicle owners may submit a removal request.</li>

            <li>
              Authorized representatives may submit a request on behalf of
              the vehicle owner.
            </li>

            <li>
              Additional information may be requested for verification.
            </li>

            <li>
              Inaccurate, incomplete, fraudulent, or unverifiable requests
              may be declined.
            </li>
          </ul>
        </section>

        {/* WHAT REMOVAL COVERS */}

        <section style={sectionStyle}>
          <h2 style={headingStyle}>What Removal Covers</h2>

          <p style={paragraphStyle}>
            An approved removal applies to the applicable auction record and
            archived images displayed on Salvage VIN History.
          </p>

          <p style={paragraphStyle}>
            Removal from Salvage VIN History does not remove information from
            independent third-party sources.
          </p>

          <ul style={listStyle}>
            <li>Auction company websites</li>
            <li>Search engine caches or search results</li>
            <li>Other vehicle-history websites</li>
            <li>Public records</li>
            <li>Other independent archives or third-party sources</li>
          </ul>
        </section>

        {/* REFUNDS */}

        <section style={sectionStyle}>
          <h2 style={headingStyle}>Refunds</h2>

          <p style={paragraphStyle}>
            If we determine that we cannot process an eligible removal
            request, we may issue a refund of the removal fee.
          </p>

          <p style={paragraphStyle}>
            A refund generally will not be issued after an eligible removal
            request has been processed and the applicable listing has been
            removed from Salvage VIN History.
          </p>
        </section>

        {/* PROCESSING */}

        <section style={sectionStyle}>
          <h2 style={headingStyle}>Processing</h2>

          <p style={paragraphStyle}>
            Removal requests are reviewed manually. Processing times may vary
            depending on the information provided and whether additional
            verification is required.
          </p>
        </section>

        {/* CONTACT */}

        <section
          style={{
            ...sectionStyle,
            background: "#f7f7f7",
            borderRadius: "8px",
            padding: "26px",
          }}
        >
          <h2
            style={{
              ...headingStyle,
              marginTop: 0,
            }}
          >
            Questions About a Removal?
          </h2>

          <p
            style={{
              ...paragraphStyle,
              marginBottom: 0,
            }}
          >
            Questions regarding a removal request can be directed to us
            through the contact method provided during the removal process.
          </p>
        </section>

        {/* RETURN */}

        <div
          style={{
            marginTop: "50px",
            paddingTop: "30px",
            borderTop: "1px solid #e5e5e5",
          }}
        >
          <Link
            href="/"
            style={{
              display: "inline-block",
              background: "#111",
              color: "#fff",
              padding: "13px 22px",
              borderRadius: "6px",
              textDecoration: "none",
              fontWeight: 700,
              fontSize: "14px",
            }}
          >
            RETURN TO SALVAGE VIN HISTORY
          </Link>
        </div>
      </div>
    </main>
  );
}
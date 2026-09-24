import Link from "next/link";

export const metadata = {
  title: "Removal Policy | Salvage VIN History",
  description:
    "Removal request policy for archived vehicle auction listings on Salvage VIN History.",
};

export default function RemovalPolicyPage() {
  return (
    <main
      style={{
        maxWidth: "900px",
        margin: "0 auto",
        padding: "70px 24px 100px",
        lineHeight: "1.7",
      }}
    >
      <h1 style={{ fontSize: "38px", marginBottom: "12px" }}>
        Removal Policy
      </h1>

      <p style={{ color: "#666", marginBottom: "40px" }}>
        Last updated: September 25, 2026
      </p>

      <h2>Listing Removal Requests</h2>

      <p>
        Salvage VIN History maintains an archive of historical vehicle
        auction information. Vehicle owners or authorized representatives
        may submit a request to remove a vehicle&apos;s auction listing and
        archived photos from Salvage VIN History.
      </p>

      <h2>Removal Request Fee</h2>

      <p>
        A $39 processing fee applies to paid removal requests. The fee
        covers the review and processing of the request.
      </p>

      <p>
        Payment does not automatically guarantee removal. Each request is
        reviewed before action is taken.
      </p>

      <h2>Eligibility and Verification</h2>

      <p>
        We may request reasonable information to verify that the person
        submitting the request is the vehicle owner or is authorized to
        act on behalf of the vehicle owner.
      </p>

      <p>
        Requests containing inaccurate, incomplete, fraudulent, or
        unverifiable information may be declined.
      </p>

      <h2>What Removal Covers</h2>

      <p>
        An approved removal applies to the applicable auction record and
        archived images displayed on Salvage VIN History.
      </p>

      <p>
        Removal from Salvage VIN History does not remove information from
        auction companies, search engines, third-party websites, public
        records, cached pages, or other independent sources.
      </p>

      <h2>Refunds</h2>

      <p>
        If we determine that we cannot process an eligible removal request,
        we may issue a refund of the removal fee.
      </p>

      <p>
        A refund generally will not be issued after an eligible removal
        request has been processed and the applicable listing has been
        removed from Salvage VIN History.
      </p>

      <h2>Processing</h2>

      <p>
        Removal requests are reviewed manually. Processing times may vary
        depending on the information provided and whether additional
        verification is required.
      </p>

      <h2>Contact</h2>

      <p>
        Questions regarding a removal request can be directed to us
        through the contact method provided during the removal process.
      </p>

      <div style={{ marginTop: "45px" }}>
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
          }}
        >
          RETURN TO SALVAGE VIN HISTORY
        </Link>
      </div>
    </main>
  );
}
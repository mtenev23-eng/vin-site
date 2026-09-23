import Link from "next/link";

const faqs = [
  {
    question: "What is Salvage VIN History?",
    answer:
      "Salvage VIN History is a vehicle auction archive that helps you research vehicles previously listed or sold through Copart and IAAI. Archived records may include auction photos, sale prices, mileage, damage information, lot numbers and other vehicle details.",
  },
  {
    question: "How can I search for a vehicle?",
    answer:
      "You can search using a 17-character VIN or an auction lot number. A VIN search opens the vehicle's auction history, while a lot number search opens the specific archived auction record when available.",
  },
  {
    question: "What is a VIN?",
    answer:
      "A VIN, or Vehicle Identification Number, is a unique 17-character identifier assigned to a vehicle. It can be used to distinguish one vehicle from another and connect auction records belonging to the same vehicle.",
  },
  {
    question: "What information can an auction record contain?",
    answer:
      "Depending on the available archived data, a record may contain the VIN, auction company, lot number, sale price, auction date, mileage, auction location, primary and secondary damage, vehicle specifications and auction photos.",
  },
  {
    question: "Why can the same VIN have multiple auction records?",
    answer:
      "A vehicle can appear at auction more than once. It may be relisted, sold again at a later date or appear in another auction event. When multiple records are available, Salvage VIN History can display them together under the same VIN.",
  },
  {
    question: "What is an auction lot number?",
    answer:
      "A lot number identifies a particular vehicle listing or auction event. Unlike a VIN, which identifies the vehicle itself, a lot number relates to a specific auction record.",
  },
  {
    question: "What does primary damage mean?",
    answer:
      "Primary damage is the main damage classification recorded for an auction listing. Examples can include front end, rear end, side, water or flood, mechanical damage and other classifications.",
  },
  {
    question: "Does an auction sale price show the total cost of the vehicle?",
    answer:
      "Not necessarily. An archived sale or final bid amount generally does not represent every cost associated with purchasing the vehicle. Auction fees, taxes, transportation, repairs and other expenses may be additional.",
  },
  {
    question: "Are all vehicles in the archive salvage vehicles?",
    answer:
      "Not necessarily. Auction platforms can list vehicles with different title types, conditions and reasons for sale. The available auction record should be reviewed for information specific to that vehicle.",
  },
  {
    question: "Does an old auction record describe the vehicle's current condition?",
    answer:
      "No. An archived auction record reflects information associated with the vehicle at the time of that auction listing. The vehicle may have been repaired, damaged again, modified or changed ownership since then.",
  },
  {
    question: "Can auction photos help when buying a used vehicle?",
    answer:
      "Historical auction photos can provide useful context about how a vehicle appeared during a previous auction listing. They should be considered alongside a current inspection, title research and other available vehicle-history information.",
  },
  {
    question: "Why can't I find a VIN or lot number?",
    answer:
      "The vehicle or auction event may not currently exist in our archive. Salvage VIN History does not contain every vehicle ever listed by Copart or IAAI, and archive coverage can vary.",
  },
];

export default function FAQPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        fontFamily: "Arial, sans-serif",
        color: "#171717",
        background: "#ffffff",
      }}
    >
      {/* HEADER */}

      <header
        style={{
          borderBottom: "1px solid #e8e8e8",
          background: "#ffffff",
        }}
      >
        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            padding: "20px 24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Link
            href="/"
            style={{
              color: "#171717",
              textDecoration: "none",
              fontWeight: "bold",
              fontSize: "20px",
            }}
          >
            Salvage VIN History
          </Link>

          <Link
            href="/"
            style={{
              color: "#555",
              textDecoration: "none",
              fontSize: "14px",
            }}
          >
            ← Back to search
          </Link>
        </div>
      </header>

      {/* FAQ */}

      <section
        style={{
          maxWidth: "900px",
          margin: "0 auto",
          padding: "65px 24px 90px",
        }}
      >
        <div
          style={{
            marginBottom: "42px",
          }}
        >
          <div
            style={{
              fontSize: "13px",
              fontWeight: "bold",
              textTransform: "uppercase",
              letterSpacing: "1px",
              color: "#666",
              marginBottom: "10px",
            }}
          >
            Help & Vehicle Research
          </div>

          <h1
            style={{
              fontSize: "42px",
              margin: "0 0 14px",
            }}
          >
            Frequently Asked Questions
          </h1>

          <p
            style={{
              fontSize: "17px",
              lineHeight: 1.6,
              color: "#666",
              margin: 0,
              maxWidth: "700px",
            }}
          >
            Learn how vehicle auction history works and
            how to use archived Copart and IAAI records
            when researching a vehicle.
          </p>
        </div>

        <div>
          {faqs.map((faq, index) => (
            <details
              key={faq.question}
              style={{
                borderTop: "1px solid #e5e5e5",
                borderBottom:
                  index === faqs.length - 1
                    ? "1px solid #e5e5e5"
                    : undefined,
                padding: "20px 0",
              }}
            >
              <summary
                style={{
                  cursor: "pointer",
                  fontSize: "18px",
                  fontWeight: "600",
                  lineHeight: 1.4,
                }}
              >
                {faq.question}
              </summary>

              <p
                style={{
                  color: "#5d5d5d",
                  lineHeight: 1.7,
                  fontSize: "15px",
                  maxWidth: "780px",
                  margin: "14px 0 0",
                }}
              >
                {faq.answer}
              </p>
            </details>
          ))}
        </div>
      </section>
    </main>
  );
}
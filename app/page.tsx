"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type MultipleLotResult = {
  auction_source: string;
  lot_number: string;
  url: string;
};

type RecentAuction = {
  auction_source: string;
  lot_number: string;
  vin: string;
  final_bid: number | null;
  auction_date: string | null;
  mileage: number | null;
  primary_damage: string | null;
  image_urls: string[] | null;

  vehicle: {
    vin: string;
    year: number | null;
    make: string | null;
    model: string | null;
  } | null;
};

function formatPrice(price: number | null) {
  if (price === null) {
    return "Price unavailable";
  }

  return `$${price.toLocaleString()}`;
}

function formatDate(date: string | null) {
  if (!date) {
    return "Date unavailable";
  }

  return new Date(`${date}T00:00:00`).toLocaleDateString(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    }
  );
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [searching, setSearching] = useState(false);
  const [multipleLots, setMultipleLots] = useState<
    MultipleLotResult[]
  >([]);

  const [recentAuctions, setRecentAuctions] =
    useState<RecentAuction[]>([]);

  const [loadingRecent, setLoadingRecent] =
    useState(true);

  const router = useRouter();

  useEffect(() => {
    async function loadRecentAuctions() {
      try {
        const response = await fetch(
          "/api/recent-auctions"
        );

        if (!response.ok) {
          throw new Error(
            "Could not load recent auctions"
          );
        }

        const data = await response.json();

        setRecentAuctions(data);
      } catch (error) {
        console.error(error);
      } finally {
        setLoadingRecent(false);
      }
    }

    loadRecentAuctions();
  }, []);

  async function handleSearch(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    const cleanedQuery = query.trim();

    if (!cleanedQuery) {
      setMessage("Enter a VIN or auction lot number.");
      return;
    }

    setSearching(true);
    setMessage("");
    setMultipleLots([]);

    try {
      const response = await fetch(
        `/api/search?q=${encodeURIComponent(
          cleanedQuery
        )}`
      );

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 404) {
          setMessage(
            "No archived vehicle or auction lot was found."
          );
        } else {
          setMessage(
            data.error ||
              "Something went wrong with the search."
          );
        }

        return;
      }

      if (data.type === "multiple_lots") {
        setMultipleLots(data.results);
        return;
      }

      if (data.url) {
        router.push(data.url);
      }
    } catch {
      setMessage(
        "Something went wrong with the search."
      );
    } finally {
      setSearching(false);
    }
  }

  const makes = [
    { name: "BMW", slug: "bmw" },
    {
      name: "Mercedes-Benz",
      slug: "mercedes-benz",
    },
    { name: "Audi", slug: "audi" },
    { name: "Ford", slug: "ford" },
    { name: "Toyota", slug: "toyota" },
    { name: "Tesla", slug: "tesla" },
    { name: "Lexus", slug: "lexus" },
    { name: "Hyundai", slug: "hyundai" },
  ];

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
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <strong
            style={{
              fontSize: "20px",
            }}
          >
            Salvage VIN History
          </strong>

          <nav
  style={{
    display: "flex",
    gap: "24px",
    fontSize: "14px",
  }}
>
  <a
    href="#recent-auctions"
    style={{
      color: "#171717",
      textDecoration: "none",
      cursor: "pointer",
    }}
  >
    Recent Auctions
  </a>

  <a
    href="#browse-makes"
    style={{
      color: "#171717",
      textDecoration: "none",
      cursor: "pointer",
    }}
  >
    Browse Makes
  </a>

  <a
    href="#faq"
    style={{
      color: "#171717",
      textDecoration: "none",
      cursor: "pointer",
    }}
  >
    FAQ
  </a>
</nav>
        </div>
      </header>

      {/* HERO */}

      <section
        style={{
          background: "#f6f7f8",
          borderBottom: "1px solid #e8e8e8",
        }}
      >
        <div
          style={{
            maxWidth: "900px",
            margin: "0 auto",
            padding: "48px 24px 52px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: "14px",
              fontWeight: "bold",
              marginBottom: "14px",
              textTransform: "uppercase",
              letterSpacing: "1px",
            }}
          >
            Vehicle Auction Archive
          </div>

          <h1
            style={{
              fontSize: "48px",
lineHeight: 1.08,
margin: "0 0 14px",
            }}
          >
            Search Vehicle Auction History
          </h1>

          <p
            style={{
              maxWidth: "700px",
              margin: "0 auto 24px",
fontSize: "18px",
              lineHeight: 1.6,
              color: "#5d5d5d",
            }}
          >
            Search historical Copart and IAAI auction
            records by VIN or auction lot number.
          </p>

          <form
            onSubmit={handleSearch}
            style={{
              maxWidth: "760px",
              margin: "0 auto",
              display: "flex",
              gap: "10px",
              padding: "8px",
              background: "#ffffff",
              border: "1px solid #d8d8d8",
              borderRadius: "14px",
              boxShadow:
                "0 10px 30px rgba(0,0,0,0.06)",
            }}
          >
            <input
              type="text"
              placeholder="Enter VIN or auction lot number"
              value={query}
              onChange={(e) =>
                setQuery(e.target.value)
              }
              style={{
                flex: 1,
                minWidth: 0,
                padding: "16px",
                fontSize: "17px",
                border: "none",
                outline: "none",
                background: "transparent",
              }}
            />

            <button
              type="submit"
              disabled={searching}
              style={{
                padding: "16px 28px",
                fontSize: "16px",
                fontWeight: "bold",
                borderRadius: "9px",
                border: "none",
                background: "#171717",
                color: "#ffffff",
                cursor: searching
                  ? "default"
                  : "pointer",
              }}
            >
              {searching ? "Searching..." : "Search"}
            </button>
          </form>

          {message && (
            <div
              style={{
                marginTop: "18px",
                color: "#b42318",
                fontSize: "15px",
              }}
            >
              {message}
            </div>
          )}

          {multipleLots.length > 0 && (
            <div
              style={{
                maxWidth: "760px",
                margin: "20px auto 0",
                padding: "20px",
                background: "#ffffff",
                border: "1px solid #ddd",
                borderRadius: "12px",
                textAlign: "left",
              }}
            >
              <strong>
                Multiple auction records found:
              </strong>

              {multipleLots.map((lot) => (
                <div
                  key={`${lot.auction_source}-${lot.lot_number}`}
                  style={{
                    marginTop: "12px",
                  }}
                >
                  <button
                    onClick={() =>
                      router.push(lot.url)
                    }
                    style={{
                      background: "none",
                      border: "none",
                      padding: 0,
                      cursor: "pointer",
                      fontSize: "16px",
                      textDecoration: "underline",
                    }}
                  >
                    {lot.auction_source} — Lot{" "}
                    {lot.lot_number}
                  </button>
                </div>
              ))}
            </div>
          )}

          <div
            style={{
              marginTop: "11px",
              color: "#777",
              fontSize: "13px",
            }}
          >
            Example: 1FTFW1ED2MFB20220 or 72413505
          </div>
        </div>
      </section>

      {/* BROWSE BY MAKE */}

      <section
  id="browse-makes"
  style={{
          background: "#ffffff",
        }}
      >
        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            padding: "30px 24px 34px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "12px",
              marginBottom: "18px",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: "bold",
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                  color: "#666",
                  marginBottom: "6px",
                }}
              >
                Browse Vehicles
              </div>

              <h2
                style={{
                  fontSize: "26px",
                  margin: 0,
                }}
              >
                Browse by Make
              </h2>
            </div>

            <div
              style={{
                color: "#777",
                fontSize: "14px",
              }}
            >
              Explore auction records by manufacturer
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "9px",
            }}
          >
            {makes.map((make) => (
              <button
                key={make.slug}
                onClick={() =>
                  router.push(
                    `/recent-auctions/${make.slug}`
                  )
                }
                style={{
                  padding: "9px 14px",
                  background: "#ffffff",
                  border: "1px solid #d8d8d8",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "#171717",
                  whiteSpace: "nowrap",
                }}
              >
                {make.name}

                <span
                  style={{
                    marginLeft: "8px",
                    color: "#888",
                  }}
                >
                  →
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* RECENT AUCTIONS */}

      <section
  id="recent-auctions"
  style={{
          background: "#f6f7f8",
          borderTop: "1px solid #e8e8e8",
        }}
      >
        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            padding: "38px 24px 60px",
          }}
        >
          <div
            style={{
              marginBottom: "24px",
            }}
          >
            <div
              style={{
                fontSize: "12px",
                fontWeight: "bold",
                textTransform: "uppercase",
                letterSpacing: "1px",
                marginBottom: "7px",
                color: "#666",
              }}
            >
              Auction Archive
            </div>

            <h2
              style={{
                fontSize: "30px",
                margin: "0 0 8px",
              }}
            >
              Recent Auction Sales
            </h2>

            <p
              style={{
                margin: 0,
                color: "#666",
                fontSize: "15px",
              }}
            >
              Recently archived Copart and IAAI vehicle
              auction records.
            </p>
          </div>

          {loadingRecent && (
            <p style={{ color: "#666" }}>
              Loading recent auctions...
            </p>
          )}

          {!loadingRecent &&
            recentAuctions.length === 0 && (
              <p style={{ color: "#666" }}>
                No recent auction records available.
              </p>
            )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(250px, 1fr))",
              gap: "20px",
            }}
          >
            {recentAuctions.map((lot) => {
              const vehicleName = [
                lot.vehicle?.year,
                lot.vehicle?.make,
                lot.vehicle?.model,
              ]
                .filter(Boolean)
                .join(" ");

              const lotUrl =
                `/lot/${lot.auction_source.toLowerCase()}/${lot.lot_number}`;

              return (
                <article
                  key={`${lot.auction_source}-${lot.lot_number}`}
                  onClick={() => router.push(lotUrl)}
                  style={{
                    background: "#ffffff",
                    border: "1px solid #e1e1e1",
                    borderRadius: "12px",
                    overflow: "hidden",
                    cursor: "pointer",
                  }}
                >
                  {/* VEHICLE PHOTO */}

                  <div
                    style={{
                      height: "190px",
                      background: "#e9e9e9",
                    }}
                  >
                    {lot.image_urls &&
                    lot.image_urls.length > 0 ? (
                      <img
                        src={lot.image_urls[0]}
                        alt={
                          vehicleName ||
                          `Auction lot ${lot.lot_number}`
                        }
                        loading="lazy"
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          display: "block",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          height: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#777",
                        }}
                      >
                        No photo available
                      </div>
                    )}
                  </div>

                  {/* AUCTION INFORMATION */}

                  <div
                    style={{
                      padding: "18px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "12px",
                        fontWeight: "bold",
                        color: "#666",
                        marginBottom: "7px",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                      }}
                    >
                      {lot.auction_source} •{" "}
                      {formatDate(lot.auction_date)}
                    </div>

                    <h3
                      style={{
                        fontSize: "19px",
                        lineHeight: 1.3,
                        margin: "0 0 14px",
                      }}
                    >
                      {vehicleName ||
                        `VIN ${lot.vin}`}
                    </h3>

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "12px",
                        alignItems: "flex-end",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: "12px",
                            color: "#777",
                            marginBottom: "3px",
                          }}
                        >
                          Final Bid
                        </div>

                        <strong
                          style={{
                            fontSize: "19px",
                          }}
                        >
                          {formatPrice(lot.final_bid)}
                        </strong>
                      </div>

                      <div
                        style={{
                          textAlign: "right",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "12px",
                            color: "#777",
                            marginBottom: "3px",
                          }}
                        >
                          Lot
                        </div>

                        <strong>
                          #{lot.lot_number}
                        </strong>
                      </div>
                    </div>

                    {lot.primary_damage && (
                      <div
                        style={{
                          borderTop:
                            "1px solid #eeeeee",
                          marginTop: "16px",
                          paddingTop: "13px",
                          fontSize: "13px",
                          color: "#666",
                        }}
                      >
                        Damage: {lot.primary_damage}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* ABOUT */}

      <section
        style={{
          background: "#ffffff",
          borderTop: "1px solid #eeeeee",
        }}
      >
        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            padding: "50px 24px 60px",
          }}
        >
          <div
            style={{
              maxWidth: "760px",
            }}
          >
            <div
              style={{
                fontSize: "12px",
                fontWeight: "bold",
                textTransform: "uppercase",
                letterSpacing: "1px",
                color: "#666",
                marginBottom: "8px",
              }}
            >
              Vehicle Research
            </div>

            <h2
              style={{
                fontSize: "30px",
                margin: "0 0 14px",
              }}
            >
              Research a vehicle before you buy
            </h2>

            <p
              style={{
                fontSize: "16px",
                lineHeight: 1.7,
                color: "#555",
                margin: 0,
              }}
            >
              Salvage VIN History is a free vehicle
              auction archive that helps you research
              cars previously listed and sold through
              Copart and IAAI. Search by VIN or auction
              lot number to explore historical auction
              records, sale prices, vehicle details,
              photos, mileage and damage information.
            </p>
          </div>
        </div>
      </section>
      {/* FAQ PREVIEW */}

      <section
        id="faq"
        style={{
          background: "#f6f7f8",
          borderTop: "1px solid #e8e8e8",
        }}
      >
        <div
          style={{
            maxWidth: "900px",
            margin: "0 auto",
            padding: "55px 24px 65px",
          }}
        >
          <div
            style={{
              marginBottom: "30px",
            }}
          >
            <div
              style={{
                fontSize: "12px",
                fontWeight: "bold",
                textTransform: "uppercase",
                letterSpacing: "1px",
                color: "#666",
                marginBottom: "8px",
              }}
            >
              Vehicle Auction Research
            </div>

            <h2
              style={{
                fontSize: "30px",
                margin: "0 0 12px",
              }}
            >
              Frequently Asked Questions
            </h2>

            <p
              style={{
                fontSize: "16px",
                lineHeight: 1.6,
                color: "#666",
                margin: 0,
              }}
            >
              Common questions about VIN searches,
              auction history and archived Copart and
              IAAI records.
            </p>
          </div>

          <div>
            {[
              {
                question:
                  "What information can I find in a vehicle auction record?",
                answer:
                  "Depending on the available archived data, a vehicle auction record may include the VIN, auction company, lot number, sale price, auction date, mileage, damage information, vehicle specifications and auction photos.",
              },
              {
                question:
                  "Can I search Copart and IAAI auction history by VIN?",
                answer:
                  "Yes. Enter a 17-character VIN into the search above to check whether the vehicle has archived Copart or IAAI auction records available in Salvage VIN History.",
              },
              {
                question:
                  "Why can the same VIN have multiple auction records?",
                answer:
                  "A vehicle can appear at auction more than once. It may be relisted or appear in another auction event later. When multiple records are available, they can be grouped under the same VIN history.",
              },
              {
                question:
                  "What is an auction lot number?",
                answer:
                  "A VIN identifies the vehicle itself, while a lot number identifies a particular auction listing or event. Salvage VIN History allows you to search using either identifier.",
              },
              {
                question:
                  "Does the final bid include auction fees and other costs?",
                answer:
                  "Not necessarily. An archived final bid or sale amount generally does not represent every cost associated with purchasing the vehicle. Auction fees, taxes, transportation, repairs and other expenses may be additional.",
              },
              {
                question:
                  "Why can't I find a VIN in the archive?",
                answer:
                  "The vehicle may not currently exist in our archive. Salvage VIN History does not contain every vehicle ever listed by Copart or IAAI, and archive coverage can vary.",
              },
            ].map((faq, index, items) => (
              <details
                key={faq.question}
                style={{
                  borderTop: "1px solid #dddddd",
                  borderBottom:
                    index === items.length - 1
                      ? "1px solid #dddddd"
                      : undefined,
                  padding: "18px 0",
                }}
              >
                <summary
                  style={{
                    cursor: "pointer",
                    fontSize: "17px",
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
                    margin: "13px 0 0",
                    maxWidth: "800px",
                  }}
                >
                  {faq.answer}
                </p>
              </details>
            ))}
          </div>

          <div
            style={{
              marginTop: "28px",
            }}
          >
            <a
              href="/faq"
              style={{
                display: "inline-block",
                color: "#171717",
                fontWeight: "bold",
                fontSize: "15px",
                textDecoration: "none",
              }}
            >
              View all frequently asked questions →
            </a>
          </div>
        </div>
      </section>

    </main>
  );
}
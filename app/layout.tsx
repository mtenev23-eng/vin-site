import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import Image from "next/image";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Salvage VIN History",
    template: "%s | Salvage VIN History",
  },
  description:
    "Search historical Copart and IAAI vehicle auction records by VIN or lot number. View archived auction photos, sale prices, mileage, damage information and vehicle history.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body
        className="min-h-full flex flex-col"
        style={{
          margin: 0,
          color: "#171717",
          background: "#ffffff",
        }}
      >
        {/* GLOBAL HEADER */}

        <header
          style={{
            background: "#ffffff",
            borderBottom: "1px solid #e8e8e8",
            position: "relative",
            zIndex: 100,
          }}
        >
          <div
            style={{
              maxWidth: "1200px",
              margin: "0 auto",
              padding: "14px 24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "24px",
            }}
          >
            {/* LOGO */}

            <Link
              href="/"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "11px",
                color: "#171717",
                textDecoration: "none",
                flexShrink: 0,
              }}
            >
              <Image
  src="/logo.png"
  alt="Salvage VIN History"
  width={300}
  height={60}
  priority
  style={{
    width: "300px",
    height: "auto",
  }}
/>

              
            </Link>

            {/* NAVIGATION */}

            <nav
              style={{
                display: "flex",
                alignItems: "center",
                gap: "26px",
                fontSize: "14px",
              }}
            >
              <Link
                href="/#recent-auctions"
                style={{
                  color: "#444",
                  textDecoration: "none",
                }}
              >
                Recent Auctions
              </Link>

              <Link
                href="/#browse-makes"
                style={{
                  color: "#444",
                  textDecoration: "none",
                }}
              >
                Browse Makes
              </Link>

              <Link
                href="/faq"
                style={{
                  color: "#444",
                  textDecoration: "none",
                }}
              >
                FAQ
              </Link>
            </nav>
          </div>
        </header>

        {children}
      </body>
    </html>
  );
}
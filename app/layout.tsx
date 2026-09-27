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
  metadataBase: new URL("https://salvagevinhistory.com"),

  title: {
    default: "Salvage VIN History - Copart & IAAI Auction Records",
    template: "%s | Salvage VIN History",
  },

  description:
    "Search historical Copart and IAAI vehicle auction records by VIN or lot number. View archived auction photos, sale prices, mileage, damage information and vehicle history.",

  alternates: {
    canonical: "/",
  },

  robots: {
    index: true,
    follow: true,
  },

  openGraph: {
    type: "website",
    siteName: "Salvage VIN History",
    title: "Salvage VIN History - Copart & IAAI Auction Records",
    description:
      "Search historical Copart and IAAI vehicle auction records by VIN or lot number. View archived auction photos, sale prices, mileage, damage information and vehicle history.",
    url: "/",
  },

  twitter: {
    card: "summary",
    title: "Salvage VIN History - Copart & IAAI Auction Records",
    description:
      "Search historical Copart and IAAI vehicle auction records by VIN or lot number. View archived auction photos, sale prices, mileage, damage information and vehicle history.",
  },
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

<header className="site-header">
  <div className="site-header-inner">
    {/* LOGO */}

    <Link href="/" className="site-logo-link">
      <Image
        src="/logo.png"
        alt="Salvage VIN History"
        width={300}
        height={60}
        priority
        className="site-logo"
      />
    </Link>

    {/* NAVIGATION */}

    <nav className="site-nav" aria-label="Main navigation">
      <Link href="/vin">VIN History</Link>

      <Link href="/#recent-auctions">
        Recent Auctions
      </Link>

      <Link href="/#browse-makes">
        Browse Makes
      </Link>

      <Link href="/faq">FAQ</Link>
    </nav>
  </div>
</header>

        {children}
      </body>
    </html>
  );
}
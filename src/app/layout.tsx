import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Literata } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const literata = Literata({
  variable: "--font-literata",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Gov Directory — Free City Data Profiles | Hamlet",
  description:
    "Free public data profiles for 290 local governments. Economy, safety, education, housing, governance, and environment data from federal and local sources.",
  metadataBase: new URL("https://directory.myhamlet.com"),
  openGraph: {
    title: "Gov Directory — Free City Data Profiles",
    description:
      "Free public data for 290 cities. Economy, safety, education, housing, governance data from government sources.",
    type: "website",
    siteName: "Gov Directory",
  },
  twitter: {
    card: "summary_large_image",
    title: "Gov Directory — Free City Data",
    description:
      "Free public data profiles for 290 local governments.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} ${literata.variable}`}>
        <header className="site-header">
          <Link href="/" className="site-header-brand">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
            </svg>
            Gov Directory
          </Link>
          <div className="site-header-hamlet">
            by <a href="https://myhamlet.com" target="_blank" rel="noopener noreferrer">Hamlet</a>
          </div>
        </header>

        {children}

        <footer className="site-footer">
          Free public data from government sources. A <a href="https://myhamlet.com" target="_blank" rel="noopener noreferrer">Hamlet</a> project.
        </footer>
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import { SITE_ORIGIN } from "./_lib/seo";
import "./globals.css";
import "./home-v5.css";
import "./home-v6.css";
import "./workspace-v2.css";
import "./retail-v2.css";
import "./offer-pages.css";
import "./catalog-v26.css";
import "./home-v26.css";
import "./symbiose-brand.css";
import "./support-pages.css";
import "./cta-swipe.css";
import "./plan-card-motion.css";
import "./account-page.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: {
    default: "Symbiome — High-quality instrumental music for creators and businesses",
    template: "%s — Symbiome",
  },
  description: "High-quality human-made instrumental music for creators and businesses, with a live catalogue for videos, streams and commercial projects.",
  applicationName: "Symbiome",
  keywords: ["music licensing", "background music", "instrumental music", "human-made music", "creator music", "sync licensing", "Lofi Girl"],
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Symbiome",
    title: "Symbiome — High-quality instrumental music",
    description: "A live catalogue of human-made instrumental tracks for creators and businesses. Zero AI-generated music.",
    images: [{ url: "/og.png", width: 1732, height: 876, alt: "Symbiome high-quality human-made instrumental music catalogue" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Symbiome — High-quality instrumental music",
    description: "Human-made instrumental music for creators and businesses. Real artists, credited and paid directly.",
    images: ["/og.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#f7ebdd",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}

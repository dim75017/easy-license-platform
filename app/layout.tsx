import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./home-v5.css";
import "./home-v6.css";
import "./workspace-v2.css";
import "./retail-v2.css";
import "./offer-pages.css";
import "./catalog-v26.css";
import "./home-v26.css";
import "./symbiose-brand.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://dim75017.github.io/easy-license-platform/"),
  title: {
    default: "Symbiose — High-quality instrumental music for creators and businesses",
    template: "%s — Symbiose",
  },
  description: "High-quality instrumental music for creators and businesses. Browse more than 10,000 human-made tracks for videos, streams and commercial projects.",
  applicationName: "Symbiose",
  keywords: ["music licensing", "background music", "instrumental music", "human-made music", "creator music", "sync licensing", "Lofi Girl"],
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    url: "https://dim75017.github.io/easy-license-platform/",
    siteName: "Symbiose",
    title: "Symbiose — High-quality instrumental music",
    description: "More than 10,000 human-made instrumental tracks for creators and businesses. Zero AI-generated music.",
    images: [{ url: "https://dim75017.github.io/easy-license-platform/og.png", width: 1732, height: 876, alt: "Symbiose high-quality human-made instrumental music catalogue" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Symbiose — High-quality instrumental music",
    description: "Human-made instrumental music for creators and businesses. Real artists, credited and paid directly.",
    images: ["https://dim75017.github.io/easy-license-platform/og.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#f3ece0",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}

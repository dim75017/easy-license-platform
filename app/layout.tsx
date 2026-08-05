import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./home-v5.css";
import "./home-v6.css";
import "./workspace-v2.css";
import "./retail-v2.css";
import "./offer-pages.css";
import "./catalog-v26.css";
import "./home-v26.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://dim75017.github.io/easy-license-platform/"),
  title: {
    default: "Easy License — Human-made music licensing",
    template: "%s — Easy License",
  },
  description: "Browse more than 10,000 human-made instrumental and background tracks for videos, streams and commercial projects. Professionally curated and powered by Lofi Girl.",
  applicationName: "Easy License",
  keywords: ["music licensing", "background music", "instrumental music", "human-made music", "creator music", "sync licensing", "Lofi Girl"],
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    url: "https://dim75017.github.io/easy-license-platform/",
    siteName: "Easy License",
    title: "10,000+ human-made tracks. Zero AI-generated music.",
    description: "10,000+ human-made tracks selected by music professionals for quality, consistency and real-world use. For creators and businesses.",
    images: [{ url: "https://dim75017.github.io/easy-license-platform/og.png", width: 1732, height: 876, alt: "Easy License premium human-made music catalogue" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "10,000+ human-made tracks. Zero AI-generated music.",
    description: "Professionally curated instrumental and background music for creators and businesses. Real artists, credited and paid directly.",
    images: ["https://dim75017.github.io/easy-license-platform/og.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#040b18",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}

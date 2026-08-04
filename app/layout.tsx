import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./home-v5.css";
import "./home-v6.css";
import "./workspace-v2.css";
import "./retail-v2.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://dim75017.github.io/easy-license-platform/"),
  title: {
    default: "Easy License — 10,000+ human-made tracks",
    template: "%s — Easy License",
  },
  description: "Premium instrumental and background music for creators and brands. Explore 10,000+ human-made tracks, with zero AI-generated music and clear licensing. Powered by Lofi Girl.",
  applicationName: "Easy License",
  keywords: ["music licensing", "background music", "instrumental music", "human-made music", "creator music", "sync licensing", "Lofi Girl"],
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    url: "https://dim75017.github.io/easy-license-platform/",
    siteName: "Easy License",
    title: "10,000+ human-made tracks. Zero AI-generated music.",
    description: "Premium instrumental and background music for videos, livestreams, podcasts, brands, films and games. Artists are credited and paid directly.",
    images: [{ url: "https://dim75017.github.io/easy-license-platform/og.png", width: 1732, height: 876, alt: "Easy License premium human-made music catalogue" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "10,000+ human-made tracks. Zero AI-generated music.",
    description: "Premium instrumental and background music for creators and brands. Real artists, credited and paid directly.",
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

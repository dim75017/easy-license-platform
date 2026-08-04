import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./home-v5.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://dim75017.github.io/easy-license-platform/"),
  title: {
    default: "Easy License — Clear the track",
    template: "%s — Easy License",
  },
  description: "Artist-made music with clear licensing for creators, client work and commercial stories. Powered by Lofi Girl.",
  applicationName: "Easy License",
  keywords: ["music licensing", "creator music", "sync licensing", "Lofi Girl"],
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    url: "https://dim75017.github.io/easy-license-platform/",
    siteName: "Easy License",
    title: "Easy License — Clear the track",
    description: "Artist-made music, clear rights and a direct route from track to publish.",
    images: [{ url: "https://dim75017.github.io/easy-license-platform/og.png", width: 1732, height: 876, alt: "Easy License music clearance signal router" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Easy License — Clear the track",
    description: "Artist-made music, clear rights and a direct route from track to publish.",
    images: ["https://dim75017.github.io/easy-license-platform/og.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#514cff",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}

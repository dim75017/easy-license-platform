import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Easy License — Music licensing made simple",
    template: "%s — Easy License",
  },
  description: "A simple music licensing platform for creators, brands and spaces. Powered by Lofi Girl.",
  applicationName: "Easy License",
  keywords: ["music licensing", "creator music", "sync licensing", "Lofi Girl"],
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#07080d",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}

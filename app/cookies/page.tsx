import type { Metadata } from "next";
import Link from "next/link";
import { EditorialInfoPage } from "../components/EditorialInfoPage";

export const metadata: Metadata = {
  title: "Cookies",
  description: "An explanation of cookies, local browser preferences and third-party music players on the current Symbiome site.",
};

export default function CookiesPage() {
  return (
    <EditorialInfoPage
      eyebrow="Cookies"
      title={<>A small amount of browser state,<br />explained clearly.</>}
      lead="The current Symbiome public site does not include a first-party advertising or analytics cookie system. Some interactive features can still use local browser storage or load a third-party music player."
      actions={[
        { label: "Read the Privacy page", href: "/privacy" },
        { label: "Open the Help Center", href: "/help", secondary: true },
      ]}
      sections={[
        {
          id: "current-use",
          eyebrow: "Current use",
          title: "No first-party advertising cookies are set by the public site.",
          content: (
            <>
              <p>No advertising analytics tool, behavioural advertising system or first-party advertising cookie has been identified in the current Symbiome public code.</p>
              <p>The service may change as production features are introduced. Any non-essential cookie or similar technology should be documented here and, where required, placed behind an appropriate consent choice before it is used.</p>
            </>
          ),
        },
        {
          id: "local-storage",
          eyebrow: "Local preference",
          title: "The connected workspace can remember one setup choice.",
          content: (
            <>
              <p>The creator workspace may store one preference in the browser&apos;s local storage. It records that the introductory music-library setup has been completed, so the same prompt does not open on every visit.</p>
              <p>This is a device-level interface preference rather than an advertising profile. Clearing site data in the browser removes it and may cause the setup prompt to appear again.</p>
            </>
          ),
        },
        {
          id: "spotify-players",
          eyebrow: "Third-party players",
          title: "Playing a track can connect the browser to Spotify.",
          content: (
            <>
              <p>Symbiome can load an embedded Spotify player after a visitor selects a track. The player is provided by Spotify and may use cookies or similar technologies according to Spotify&apos;s own settings and policies.</p>
              <p>Visitors can review the <a href="https://www.spotify.com/legal/cookies-policy/" target="_blank" rel="noreferrer">Spotify Cookie Policy</a>. External playlist links also leave Symbiome and open Spotify directly.</p>
            </>
          ),
        },
        {
          id: "manage-and-updates",
          eyebrow: "Control and updates",
          title: "Browser controls remain available to you.",
          content: (
            <>
              <p>Browser settings can remove local storage, block or clear cookies and restrict third-party content. Blocking a Spotify player may prevent track previews from loading, but the rest of the catalogue can still be browsed.</p>
              <p>For the wider treatment of request information and third-party services, read the <Link href="/privacy">Privacy page</Link>.</p>
              <p className="support-notice">Last updated: 11 August 2026. This page should be reviewed whenever analytics, authentication, payments or new embedded services are introduced.</p>
            </>
          ),
        },
      ]}
    />
  );
}

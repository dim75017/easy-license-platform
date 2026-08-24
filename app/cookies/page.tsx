import { pageMetadata } from "../_lib/seo";
import Link from "next/link";
import { EditorialInfoPage } from "../components/EditorialInfoPage";

export const metadata = pageMetadata("Cookies and browser storage", "The cookies and browser storage used by the live Symbiome beta.", "/cookies");

export default function CookiesPage() {
  return (
    <EditorialInfoPage
      eyebrow="Cookies and browser storage"
      title={<>Useful browser state,<br />without advertising trackers.</>}
      lead="Symbiome does not currently use advertising or behavioural-analytics cookies. Secure account access and the library features you choose still require essential session state or local browser storage."
      actions={[
        { label: "Read the Privacy page", href: "/privacy" },
        { label: "Open the Help Center", href: "/help", secondary: true },
      ]}
      sections={[
        {
          id: "account-session",
          eyebrow: "Secure account session",
          title: "The hosting identity service manages sign-in state.",
          content: (
            <>
              <p>The live Sites deployment uses essential authentication state to recognise a signed-in visitor and protect account or admin requests. Symbiome does not receive or store your sign-in password.</p>
              <p>The exact cookie names and lifetimes are controlled by the hosting identity service rather than the Symbiome application code.</p>
            </>
          ),
        },
        {
          id: "local-storage",
          eyebrow: "Local storage",
          title: "Likes, playlists and listening-copy history stay on this device.",
          content: (
            <ul className="support-list">
              <li><strong>symbiome-liked-tracks</strong><span>The track identifiers you have liked.</span></li>
              <li><strong>symbiome-personal-playlists-v1</strong><span>Your playlist names, descriptions, artwork references and track identifiers.</span></li>
              <li><strong>symbiome-preview-downloads-v1</strong><span>The identifiers of compressed listening copies downloaded in this browser.</span></li>
              <li><strong>IndexedDB · symbiome-personal-library-v1</strong><span>The compressed artwork you select for personal playlists.</span></li>
            </ul>
          ),
        },
        {
          id: "session-storage",
          eyebrow: "Request drafts",
          title: "An unfinished business brief can be remembered for the session.",
          content: (
            <>
              <p>The keys <strong>symbiome-business-request-draft-v1:license</strong> and <strong>symbiome-business-request-draft-v1:custom</strong> can hold an unfinished licence or custom-music brief. A draft is cleared after a successful submission, a manual clear or the end of the browser session.</p>
              <p>A submitted request is different: on the live site it is transmitted and stored as described in the <Link href="/privacy">Privacy notice</Link>.</p>
            </>
          ),
        },
        {
          id: "external-links",
          eyebrow: "External music links",
          title: "Spotify is an optional fallback link, not an embedded player.",
          content: <p>When an internal listening copy is unavailable, Symbiome may offer a link to listen on Spotify. No Spotify player is embedded by the current application code. Spotify&apos;s own policies apply after you follow that external link.</p>,
        },
        {
          id: "controls",
          eyebrow: "Your controls",
          title: "Remove an item in the workspace or clear this site&apos;s data.",
          content: (
            <>
              <p>Deleting a personal playlist removes its locally stored playlist record and artwork. You can also clear Symbiome site data in your browser to remove all local library state and sign-in cookies.</p>
              <p>If non-essential analytics, advertising or embedded services are introduced later, this page and the relevant consent controls will be updated before those tools are enabled.</p>
              <p className="support-notice">Last updated: 24 August 2026.</p>
            </>
          ),
        },
      ]}
    />
  );
}

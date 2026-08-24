import { pageMetadata } from "../_lib/seo";
import Link from "next/link";
import { EditorialInfoPage } from "../components/EditorialInfoPage";
import { LofiGirlWordmark } from "../components/LofiGirlWordmark";

export const metadata = pageMetadata("Legal information and beta terms", "Terms for browsing the Symbiome public beta, downloading listening copies and sending music requests.", "/legal");

export default function LegalPage() {
  return (
    <EditorialInfoPage
      eyebrow="Legal information"
      title={<>The rules of the public beta,<br />in plain language.</>}
      lead="Browsing, saving, previewing, downloading a listening copy or sending a brief does not grant permission to publish or commercially use a track."
      actions={[
        { label: "Read licensing answers", href: "/help#business-licensing" },
        { label: "Send a business request", href: "/pricing#business-request", secondary: true },
      ]}
      sections={[
        {
          id: "service-status",
          eyebrow: "Public beta",
          title: "What the live service does today.",
          content: (
            <>
              <p>Symbiome provides a public human-made music catalogue, a secure account profile, browser-local likes and playlists, compressed listening copies and forms for licensing, custom-music and retail enquiries.</p>
              <p>Account setup records a plan preference only. Checkout, paid subscriptions, automatic master delivery and automatic licence issuance are not enabled in the current beta.</p>
            </>
          ),
        },
        {
          id: "listening-copies",
          eyebrow: "Listening copies",
          title: "Downloaded previews are for private evaluation only.",
          content: (
            <>
              <p>A compressed listening copy may be used privately to evaluate, shortlist or discuss a track. It may not be published, synchronised to content, publicly performed, redistributed, resold, registered in Content ID or used to train or improve a generative model.</p>
              <p>A WAV master or broader usage permission is supplied only under a separately confirmed written licence or agreement.</p>
            </>
          ),
        },
        {
          id: "requests-and-licensing",
          eyebrow: "Requests and licensing",
          title: "A submitted request starts a conversation, not a licence.",
          content: (
            <>
              <ul className="support-list">
                <li><strong>Creator route</strong><span>Any future coverage depends on an active plan, eligible tracks, connected channels and the final creator terms.</span></li>
                <li><strong>Commercial Sync</strong><span>Media, territories, duration, campaign and price must be confirmed for the specific project.</span></li>
                <li><strong>Custom Commission</strong><span>Deliverables, revisions, rights, exclusivity, timing and price must be agreed in writing.</span></li>
                <li><strong>Physical spaces</strong><span>Music for Retail remains an early-access route; submitting interest does not create a licence.</span></li>
              </ul>
              <p>If a website summary conflicts with an executed licence or project agreement, the executed document governs.</p>
            </>
          ),
        },
        {
          id: "acceptable-use",
          eyebrow: "Accounts and catalogue",
          title: "Use the service normally and respect the catalogue.",
          content: (
            <>
              <p>Provide accurate account and request information, keep access to your identity method secure and do not attempt to bypass technical limits, extract the catalogue in bulk or interfere with other visitors.</p>
              <p>Music, recordings, artist names, artwork, photographs, written copy, product design and brand elements remain the property of their respective rights holders. Access to the site does not transfer ownership.</p>
            </>
          ),
        },
        {
          id: "operator-information",
          eyebrow: "Publisher details",
          title: "Commercial operator details are still to be completed.",
          content: (
            <>
              <p>The verified legal identity, registered address, company-registration details, publication director, dedicated rights contact and complete commercial terms for the Symbiome operator are not yet published. For that reason, the beta does not accept payment or issue automatic licences.</p>
              <p>Until those details are completed, general or rights-related enquiries can use the <a href="https://www.lofigirl.com/contact" target="_blank" rel="noreferrer">official <LofiGirlWordmark className="lofi-girl-wordmark-inline" /> contact form</a>. The current <LofiGirlWordmark className="lofi-girl-wordmark-inline" /> website terms are available on its <a href="https://www.lofigirl.com/terms" target="_blank" rel="noreferrer">official legal page</a>.</p>
              <p>For personal data and browser storage, read the <Link href="/privacy">Privacy notice</Link> and <Link href="/cookies">Cookies and browser storage page</Link>.</p>
              <p className="support-notice">Effective: 24 August 2026 · Public beta terms.</p>
            </>
          ),
        },
      ]}
    />
  );
}

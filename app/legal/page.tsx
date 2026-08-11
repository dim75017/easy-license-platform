import type { Metadata } from "next";
import Link from "next/link";
import { EditorialInfoPage } from "../components/EditorialInfoPage";

export const metadata: Metadata = {
  title: "Legal Information",
  description: "Plain-language legal information about browsing Symbiome, requesting music rights and using licensed music.",
};

export default function LegalPage() {
  return (
    <EditorialInfoPage
      eyebrow="Legal information"
      title={<>The terms behind the service,<br />in plain language.</>}
      lead="Browsing music, saving a shortlist or sending a brief does not grant permission to use a track. Rights begin only through the licence or agreement that applies to the approved use."
      actions={[
        { label: "Read licensing answers", href: "/help#business-licensing" },
        { label: "View pricing routes", href: "/pricing", secondary: true },
      ]}
      sections={[
        {
          id: "service-status",
          eyebrow: "The service",
          title: "What the public site does and does not do.",
          content: (
            <>
              <p>Symbiome presents a human-made music catalogue and the available licensing routes for creators and businesses. The public pages help visitors explore music, compare creator plans and prepare a commercial request.</p>
              <p>A track preview, catalogue page, playlist, shortlist, account screen, price display or submitted request is not itself a licence. Music may only be used after the applicable licence conditions have been accepted and any required payment, scope approval or agreement has been completed.</p>
            </>
          ),
        },
        {
          id: "licensing",
          eyebrow: "Licensing",
          title: "The approved agreement controls the use.",
          content: (
            <>
              <ul className="support-list">
                <li><strong>Creator use</strong><span>Coverage depends on the active plan, eligible tracks, supported platforms, connected channels and the creator licence terms in force at the time.</span></li>
                <li><strong>Commercial Sync</strong><span>Rights are defined for the specific media, territories, duration, campaign or production described in the approved scope.</span></li>
                <li><strong>Custom Commission</strong><span>Creative deliverables, revisions, rights, exclusivity, timing and price must be confirmed in the project agreement.</span></li>
                <li><strong>Physical spaces</strong><span>Music for Retail is marked as coming soon. Joining an early-access list does not create a music licence.</span></li>
              </ul>
              <p>If a summary on the website conflicts with an executed licence or project agreement, the executed document governs the licensed use.</p>
            </>
          ),
        },
        {
          id: "intellectual-property",
          eyebrow: "Intellectual property",
          title: "The music and creative work remain protected.",
          content: (
            <>
              <p>Music, recordings, artist names, artwork, photographs, written copy, product design and brand elements remain the property of their respective rights holders. Access to the site does not transfer ownership.</p>
              <p>Content may not be copied, redistributed, resold, falsely credited, used to train or improve a generative model, or used outside the permission granted by the relevant licence or rights holder.</p>
            </>
          ),
        },
        {
          id: "operator-information",
          eyebrow: "Publisher details",
          title: "Final operator details will accompany the commercial service.",
          content: (
            <>
              <p>Symbiome is currently presented as a pre-launch service. The legal identity of the operator, registered address, company registration details and publication director will be published here before Symbiome issues licences or accepts payments.</p>
              <p>Until that commercial launch, general legal enquiries can use the <a href="https://www.lofigirl.com/contact" target="_blank" rel="noreferrer">official Lofi Girl contact form</a>. The current Lofi Girl website terms are available on its <a href="https://www.lofigirl.com/terms" target="_blank" rel="noreferrer">official legal page</a>.</p>
              <p>For information about personal data and browser storage, read the <Link href="/privacy">Privacy page</Link> and <Link href="/cookies">Cookies page</Link>.</p>
            </>
          ),
        },
      ]}
    />
  );
}

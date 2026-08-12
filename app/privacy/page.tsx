import type { Metadata } from "next";
import Link from "next/link";
import { EditorialInfoPage } from "../components/EditorialInfoPage";
import { LofiGirlWordmark } from "../components/LofiGirlWordmark";

export const metadata: Metadata = {
  title: "Privacy",
  description: "How the current Symbiome public site and its request forms handle personal information.",
};

export default function PrivacyPage() {
  return (
    <EditorialInfoPage
      eyebrow="Privacy"
      title={<>Clear information about<br />the data behind a request.</>}
      lead="Symbiome should collect only the information needed to answer a creator support question, review a business brief or manage early access. This page describes the current public version and identifies the details still required before production launch."
      actions={[
        { label: "Read about browser storage", href: "/cookies" },
        { label: <><LofiGirlWordmark className="lofi-girl-wordmark-inline" /> privacy policy</>, ariaLabel: "Lofi Girl privacy policy", href: "https://www.lofigirl.com/privacy", external: true, secondary: true },
      ]}
      sections={[
        {
          id: "current-public-site",
          eyebrow: "Current public version",
          title: "The GitHub Pages form does not send or store submissions.",
          content: (
            <>
              <p>The current public Symbiome site is a static GitHub Pages version. Its business and early-access forms display the interface, but the submitted information is not transmitted or stored by Symbiome in that public version.</p>
              <p>This behaviour is stated beside the form when the static version is running. A production version with live request handling will require a complete privacy notice before collection begins.</p>
            </>
          ),
        },
        {
          id: "production-requests",
          eyebrow: "Production request forms",
          title: "What a live brief may need to collect.",
          content: (
            <>
              <p>When live request handling is enabled, a business licensing or early-access request may include the information a visitor enters into the form.</p>
              <ul className="support-list">
                <li><strong>Identity and contact</strong><span>Name, work email and company, channel or venue.</span></li>
                <li><strong>Project context</strong><span>The requested service, project description, intended use, timing and indicative budget.</span></li>
                <li><strong>Physical-space interest</strong><span>The type of venue or multi-location group interested in the planned service.</span></li>
              </ul>
              <p>The information should be used to review the request, clarify the licence or creative route, respond to the sender and maintain the records required for that conversation.</p>
            </>
          ),
        },
        {
          id: "services-and-storage",
          eyebrow: "Services and storage",
          title: "Some features involve services outside the page itself.",
          content: (
            <>
              <p>The music catalogue can load embedded Spotify players after a visitor chooses to play a track. Spotify operates that player under its own policies. The connected creator workspace also stores one local browser preference so the introductory music setup is not shown repeatedly on the same device.</p>
              <p>No advertising analytics integration or first-party advertising cookie has been identified in the current Symbiome public code. Read the <Link href="/cookies">Cookies page</Link> for the browser-storage detail.</p>
            </>
          ),
        },
        {
          id: "rights-and-details",
          eyebrow: "Your rights",
          title: "Your rights will remain part of the production policy.",
          content: (
            <>
              <p>Depending on applicable law, people may have rights to access, correct, delete, restrict or object to the processing of their personal information. A production privacy policy must identify the verified data controller, lawful bases, service providers, international transfers, retention periods and the route for exercising those rights.</p>
              <p>Those Symbiome-specific details will be published before live data collection begins. For the separate <LofiGirlWordmark className="lofi-girl-wordmark-inline" /> website and its associated domains, consult the <a href="https://www.lofigirl.com/privacy" target="_blank" rel="noreferrer">official <LofiGirlWordmark className="lofi-girl-wordmark-inline" /> privacy policy</a>.</p>
              <p className="support-notice">Last updated: 11 August 2026. This page should be updated before any production collection or material change in the service.</p>
            </>
          ),
        },
      ]}
    />
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { EditorialInfoPage } from "../components/EditorialInfoPage";
import { LofiGirlWordmark } from "../components/LofiGirlWordmark";

export const metadata: Metadata = {
  title: "Contact",
  description: "Find the right Symbiome contact route for creator support, commercial music licensing, original commissions, press and general questions.",
};

export default function ContactPage() {
  return (
    <EditorialInfoPage
      eyebrow="Contact"
      title={<>Start in the<br />right place.</>}
      lead="The quickest route depends on what you are trying to do. Use the Help Center for licensing questions, or send a focused business brief when music is needed for a commercial project."
      actions={[
        { label: "Open the Help Center", href: "/help" },
        { label: <>Official <LofiGirlWordmark className="lofi-girl-wordmark-inline" /> contact</>, ariaLabel: "Official Lofi Girl contact", href: "https://www.lofigirl.com/contact", external: true, secondary: true },
      ]}
      sections={[
        {
          id: "creator-support",
          eyebrow: "Creator support",
          title: "Questions about channels, plans or Content ID.",
          content: (
            <>
              <p>The Help Center explains how creator coverage works, which uses need a business licence, how channel records are organised and what to prepare if an automated Content ID claim appears.</p>
              <div className="support-route-grid">
                <Link className="support-route-card" href="/help#creator-licensing"><small>Creator licences</small><strong>Understand what a creator plan covers.</strong><span>Read the detailed answers →</span></Link>
                <Link className="support-route-card" href="/pricing#creator-pricing-title"><small>Plans</small><strong>Compare Creator and Pro.</strong><span>View creator pricing →</span></Link>
              </div>
            </>
          ),
        },
        {
          id: "business-projects",
          eyebrow: "Business projects",
          title: "Send the brief through the matching form.",
          content: (
            <>
              <p>Commercial Sync and original commissions are quoted around the actual use. Choose the matching route below and the form will open with that service already selected.</p>
              <ul className="support-list">
                <li><strong><Link href="/pricing?business_need=existing_track#business-request">License an existing track</Link></strong><span>For campaigns, films, series, games, branded content, events and other defined commercial uses.</span></li>
                <li><strong><Link href="/pricing?business_need=custom_music#business-request">Commission original music</Link></strong><span>For a project that needs music composed and produced from its own creative brief.</span></li>
                <li><strong><Link href="/pricing?business_need=physical_places#business-request">Music for physical places</Link></strong><span>The service is coming soon. The current page lets you preview the early-access route before submissions open.</span></li>
              </ul>
            </>
          ),
        },
        {
          id: "press-and-partnerships",
          eyebrow: "Press and general enquiries",
          title: <>Use the official contact route for the wider <LofiGirlWordmark className="lofi-girl-wordmark-inline" /> team.</>,
          content: (
            <>
              <p>For press, partnerships or questions that are not about a Symbiome creator plan or business quote, use the <a href="https://www.lofigirl.com/contact" target="_blank" rel="noreferrer">official <LofiGirlWordmark className="lofi-girl-wordmark-inline" /> contact form</a>. Give the enquiry a clear subject so it can reach the appropriate team.</p>
              <p className="support-notice">A dedicated Symbiome support address is not published yet. Confirmed service contacts will be added here before direct support opens.</p>
            </>
          ),
        },
        {
          id: "what-to-include",
          eyebrow: "Before you send",
          title: "A useful message gets to an answer faster.",
          content: (
            <>
              <p>For a licensing request, include enough practical context for the team to understand the project without guessing.</p>
              <ul className="support-list">
                <li><strong>The project</strong><span>What you are making and the role the music should play.</span></li>
                <li><strong>The use</strong><span>Channels, media, markets, duration and launch timing.</span></li>
                <li><strong>The music</strong><span>A specific track, artist or reference, or the direction for an original composition.</span></li>
                <li><strong>The practical frame</strong><span>Indicative budget, deadline and the company or channel responsible for the use.</span></li>
              </ul>
            </>
          ),
        },
      ]}
    />
  );
}

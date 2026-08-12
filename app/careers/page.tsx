import type { Metadata } from "next";
import Link from "next/link";
import { EditorialInfoPage } from "../components/EditorialInfoPage";
import { LofiGirlWordmark } from "../components/LofiGirlWordmark";

export const metadata: Metadata = {
  title: "Careers",
  description: "Learn about the work and values behind Symbiome and check the current status of open roles.",
};

export default function CareersPage() {
  return (
    <EditorialInfoPage
      eyebrow="Careers"
      title={<>Help make music easier to use<br />without losing the people behind it.</>}
      lead="Symbiome sits where music, product, rights and creator support meet. The aim is practical: make excellent instrumental music easier to find and license while keeping artists visible in the process."
      actions={[
        { label: "Learn about Symbiome", href: "/about" },
        { label: <><LofiGirlWordmark className="lofi-girl-wordmark-inline" /> careers</>, ariaLabel: "Lofi Girl careers", href: "https://studio.lofigirl.com/careers", external: true, secondary: true },
      ]}
      sections={[
        {
          id: "the-work",
          eyebrow: "The work",
          title: "Music knowledge meets product thinking.",
          content: (
            <>
              <p>Building Symbiome involves more than putting tracks in a grid. The service has to understand how creators search, how a business brief becomes a rights scope, how artists are represented and how support stays clear when a project is moving quickly.</p>
              <ul className="support-list">
                <li><strong>Music and editorial</strong><span>Catalogue knowledge, metadata, moods, uses and playlists that make discovery useful.</span></li>
                <li><strong>Licensing and operations</strong><span>Clear scopes, practical workflows and reliable records for creator and business use.</span></li>
                <li><strong>Product and design</strong><span>A calm interface that can make a large catalogue feel understandable rather than overwhelming.</span></li>
                <li><strong>Artist and customer support</strong><span>Thoughtful communication with the people making the music and the people using it.</span></li>
              </ul>
            </>
          ),
        },
        {
          id: "how-we-think",
          eyebrow: "Principles",
          title: "Human-made is a working principle.",
          content: (
            <>
              <p>The catalogue does not accept generative AI music. That position also shapes how the product is built: make decisions deliberately, credit the work properly and use technology to support people rather than erase them.</p>
              <p>Good candidates for future roles should care about music quality, clarity, fairness and the practical detail required to make licensing trustworthy.</p>
            </>
          ),
        },
        {
          id: "open-roles",
          eyebrow: "Open roles",
          title: "No confirmed Symbiome openings are listed today.",
          content: (
            <>
              <p>This page will list active Symbiome opportunities when roles are ready to be advertised. If a role is not shown here, there is no confirmed opening to apply for through the Symbiome site.</p>
              <p>Open roles for the wider <LofiGirlWordmark className="lofi-girl-wordmark-inline" /> team are published on the <a href="https://studio.lofigirl.com/careers" target="_blank" rel="noreferrer">official <LofiGirlWordmark className="lofi-girl-wordmark-inline" /> careers page</a>.</p>
              <p className="support-notice">A future listing should always include the team, location or working arrangement, responsibilities, expected experience and a verified application route.</p>
            </>
          ),
        },
        {
          id: "stay-close",
          eyebrow: "Keep exploring",
          title: "Understand the product before the next opening.",
          content: (
            <>
              <p>The best introduction to the work is the service itself. Explore how the catalogue is organised, how creator licensing works and how a commercial music brief is handled.</p>
              <div className="support-route-grid">
                <Link className="support-route-card" href="/catalog"><small>The catalogue</small><strong>Explore the music and playlists.</strong><span>Open Music →</span></Link>
                <Link className="support-route-card" href="/business"><small>The service</small><strong>See how a brief becomes a licence.</strong><span>Open For Businesses →</span></Link>
              </div>
            </>
          ),
        },
      ]}
    />
  );
}

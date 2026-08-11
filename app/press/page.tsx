import type { Metadata } from "next";
import { EditorialInfoPage } from "../components/EditorialInfoPage";

export const metadata: Metadata = {
  title: "Press",
  description: "Key facts, positioning and official contact routes for press enquiries about Symbiome.",
};

export default function PressPage() {
  return (
    <EditorialInfoPage
      eyebrow="Press"
      title={<>A human-made music library<br />for modern creative work.</>}
      lead="Symbiome is a music discovery and licensing service for creators and businesses. It combines a broad instrumental catalogue with clear routes for creator channels, commercial projects and original commissions."
      actions={[
        { label: "Read the Symbiome story", href: "/about" },
        { label: "Visit Lofi Girl", href: "https://www.lofigirl.com/", external: true, secondary: true },
      ]}
      highlights={[
        { value: "10,000+", label: "instrumental and background tracks" },
        { value: "1,000+", label: "artists represented worldwide" },
        { value: "0", label: "AI-generated tracks accepted" },
      ]}
      sections={[
        {
          id: "short-description",
          eyebrow: "In one paragraph",
          title: "What Symbiome is.",
          content: (
            <>
              <p>Symbiome helps creators and businesses find and license high-quality instrumental music made by real artists. Creator plans are designed for eligible content published on the creator&apos;s own channels. Business licensing covers defined commercial uses and original music commissions, with rights and quotes shaped around each brief.</p>
              <p className="support-notice">Symbiome is presented as an independent product powered by Lofi Girl.</p>
            </>
          ),
        },
        {
          id: "key-facts",
          eyebrow: "Key facts",
          title: "The points that define the service.",
          content: (
            <ul className="support-list">
              <li><strong>Human-made catalogue</strong><span>Generative AI music is not accepted into the catalogue.</span></li>
              <li><strong>Artist-led economics</strong><span>Artists remain credited and are paid directly and fairly when their music is licensed through Symbiome.</span></li>
              <li><strong>Two licensing routes</strong><span>Fixed creator plans for owned channels, plus project-based quotes for commercial use and original music.</span></li>
              <li><strong>Instrumental breadth</strong><span>Lofi hip-hop, ambient, jazz, piano, electronic, cinematic, house and acoustic directions are represented across the featured playlists.</span></li>
              <li><strong>Physical spaces</strong><span>A background music service for venues is planned and currently marked as coming soon.</span></li>
            </ul>
          ),
        },
        {
          id: "brand-relationship",
          eyebrow: "Brand relationship",
          title: "Powered by Lofi Girl.",
          content: (
            <>
              <p>The relationship is stated directly in the Symbiome identity: Symbiome is an independent product powered by Lofi Girl. The service extends a music and artist ecosystem already recognised for instrumental listening into practical licensing for people making content and commercial work.</p>
              <p>Official Lofi Girl music, livestreams and releases remain available through <a href="https://www.lofigirl.com/" target="_blank" rel="noreferrer">lofigirl.com</a>.</p>
            </>
          ),
        },
        {
          id: "press-requests",
          eyebrow: "Press enquiries",
          title: "Send a clear request through the official contact form.",
          content: (
            <>
              <p>For a press request concerning Symbiome or the wider Lofi Girl universe, use the <a href="https://www.lofigirl.com/contact" target="_blank" rel="noreferrer">official Lofi Girl contact form</a>. Include the publication, subject, deadline and the format of the request.</p>
              <p>No downloadable press kit or dedicated Symbiome press email is currently published on this site. They should only be added once confirmed.</p>
            </>
          ),
        },
      ]}
    />
  );
}

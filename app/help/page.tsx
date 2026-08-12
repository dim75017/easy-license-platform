import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { PublicShell } from "../components/PublicShell";

export const metadata: Metadata = {
  title: "Help Center",
  description: "Clear answers about the Symbiome music catalogue, creator plans and business licensing.",
};

type Faq = {
  question: string;
  answer: ReactNode;
};

type HelpCategory = {
  id: string;
  number: string;
  label: string;
  title: string;
  introduction: string;
  questions: Faq[];
};

const categories: HelpCategory[] = [
  {
    id: "getting-started",
    number: "01",
    label: "Getting started",
    title: "Start with the music.",
    introduction: "What Symbiome is, what you can explore now and when a licence is required.",
    questions: [
      {
        question: "What is Symbiome?",
        answer: <>Symbiome is a human-made instrumental music catalogue and licensing platform for creators and businesses, powered by Lofi Girl.</>,
      },
      {
        question: "Can I listen before choosing a licence?",
        answer: <>Yes. You can <Link href="/catalog">browse the music library</Link>, open playlists and listen to the available track previews before choosing a creator plan or requesting a business licence.</>,
      },
      {
        question: "Does listening to a preview give me permission to use the music?",
        answer: <>No. A preview helps you choose a track, but it does not grant usage rights. Before publishing, the track and intended use must be eligible for your plan or covered by a confirmed business licence.</>,
      },
      {
        question: "Is the full catalogue available on this website?",
        answer: <>The public site currently presents selected playlists and tracks from the wider catalogue. It is a catalogue preview rather than the complete production library.</>,
      },
      {
        question: "Where should I begin if I do not know which licence I need?",
        answer: <>Start by finding the music that fits your project. If you publish on channels you own, review <Link href="/creators">Symbiome for Creators</Link>. If the music is for a campaign, brand, film, game or client project, begin with <Link href="/business">Symbiome for Businesses</Link>.</>,
      },
    ],
  },
  {
    id: "creator-licensing",
    number: "02",
    label: "Creator licensing",
    title: "For the channels you own.",
    introduction: "Coverage for videos, livestreams, podcasts and social content, with clear limits for commercial work.",
    questions: [
      {
        question: "What can a Creator licence cover?",
        answer: <>Eligible music can cover content published on your own supported video, livestream, podcast and social channels. The exact track eligibility and channel coverage are recorded with the applicable licence.</>,
      },
      {
        question: "What is the difference between Creator and Pro?",
        answer: <>Creator is presented for one channel per supported platform. Pro is designed for multi-channel creators and teams, with up to three channels per supported platform and a shared licence workspace.</>,
      },
      {
        question: "Can I use the music in monetised content?",
        answer: <>The current Creator plans are designed for eligible monetised videos and livestreams on the channels covered by your plan. A track still needs to be eligible for that use.</>,
      },
      {
        question: "Which creator platforms are supported?",
        answer: <>The current Creator presentation includes YouTube, Twitch, TikTok, Instagram, Kick and podcast or Spotify publishing contexts. Final coverage is defined by the plan and licence terms attached to your account.</>,
      },
      {
        question: "Does a Creator plan cover advertising, client work or a brand campaign?",
        answer: <>No. Paid advertising, branded productions, films, games and broader commercial uses require a project-based licence through <Link href="/business">Symbiome for Businesses</Link>.</>,
      },
      {
        question: "What should I do if I receive a Content ID claim?",
        answer: <>Automated claims can still happen. Keep the relevant track, channel and licence record together so the support team can review the claim. Content ID support does not guarantee a particular outcome or resolution time.</>,
      },
    ],
  },
  {
    id: "business-licensing",
    number: "03",
    label: "Business licensing",
    title: "Rights shaped around the project.",
    introduction: "Choose an existing track or commission original music, then confirm the exact commercial scope.",
    questions: [
      {
        question: "What is Commercial Sync?",
        answer: <>Commercial Sync is the route for licensing an existing catalogue track for a defined project, such as advertising, film, series, games, trailers, branded content or events.</>,
      },
      {
        question: "When should I choose a Custom Commission?",
        answer: <>Choose a Custom Commission when the project needs original music created from the brief. The route can include creative direction, composition, revisions and agreed final deliverables.</>,
      },
      {
        question: "How is a business quote determined?",
        answer: <>The quote reflects the music route, media, territories, duration, exclusivity, deliverables, timing, budget and other relevant project details. Rights are scoped to the actual use rather than assumed from a standard package.</>,
      },
      {
        question: "What information should I include in my brief?",
        answer: <>Share what you are making, the track or musical direction, where the project will appear, the intended markets, timing and an indicative budget. You do not need to identify every right before you start.</>,
      },
      {
        question: "When can I start using the music?",
        answer: <>A brief, shortlist or proposal does not grant rights. Use can begin only after the scope has been approved, the agreement signed and any required payment completed.</>,
      },
      {
        question: "How do I request a licence or commission?",
        answer: <>Choose the relevant option in the <Link href="/pricing#business-request">Business music request</Link>. You can preselect <Link href="/pricing?business_need=existing_track#business-request">an existing track</Link> or <Link href="/pricing?business_need=custom_music#business-request">original music</Link>.</>,
      },
      {
        question: "Is music for physical spaces available?",
        answer: <>Not yet. Music for Retail is in development for stores, offices, restaurants, hotels, gyms and spas. You can select <Link href="/pricing?business_need=physical_places#business-request">physical places</Link> to view the current early-access route.</>,
      },
    ],
  },
  {
    id: "catalogue-artists",
    number: "04",
    label: "Catalogue & artists",
    title: "Music made by people.",
    introduction: "How the catalogue is organised, what eligibility means and who is behind the tracks.",
    questions: [
      {
        question: "Is AI-generated music accepted into the catalogue?",
        answer: <>No. Generative-AI music is not accepted into the Symbiome catalogue. The music presented by Symbiome is written and produced by artists.</>,
      },
      {
        question: "Who makes the music?",
        answer: <>More than 1,000 artists are represented across the catalogue. Artist names remain attached to their work so you can see who made the track you are considering.</>,
      },
      {
        question: "How are artists paid when their music is licensed?",
        answer: <>Symbiome is designed so licensing income is paid directly and fairly to the artists whose work is used. Individual commercial terms are not published in this public preview.</>,
      },
      {
        question: "How can I find music for a specific situation?",
        answer: <>Use the library search and filters to start from a mood, style or intended use. You can also begin with a professionally prepared playlist for common needs such as study, livestreaming, travel, podcasts or wellness.</>,
      },
      {
        question: "Is every track available for every type of project?",
        answer: <>Not necessarily. Track eligibility and rights can vary by plan and intended use. A track must be shown as eligible for your creator route or included in a confirmed business agreement before it is used.</>,
      },
      {
        question: "Why do some previews open a Spotify player?",
        answer: <>Spotify is currently used to provide listening previews for selected tracks and public playlists. Loading or following a Spotify player connects you to a third-party service governed by Spotify&apos;s own terms and privacy practices.</>,
      },
    ],
  },
  {
    id: "account-billing-support",
    number: "05",
    label: "Account & support",
    title: "Plans, accounts and the public preview.",
    introduction: "Current pricing, what the demo can do and where to go when your question is more specific.",
    questions: [
      {
        question: "How much do the Creator plans cost?",
        answer: <>Creator is currently presented at €7.99 per month or €79.99 billed yearly, equivalent to €6.67 per month. Pro is presented at €19.99 per month or €199.99 billed yearly, equivalent to €16.67 per month. See <Link href="/pricing">Pricing</Link> for the current presentation.</>,
      },
      {
        question: "How does yearly billing work?",
        answer: <>The yearly option shows its monthly equivalent for comparison, but the displayed annual amount is billed as one yearly payment. Monthly billing shows the price charged each month.</>,
      },
      {
        question: "Can I create a paid account or purchase a licence in this preview?",
        answer: <>Not yet. The public website currently demonstrates the music library, account workspace and licensing routes. Authentication, checkout, production downloads and licence issuance are not active on this GitHub Pages preview.</>,
      },
      {
        question: "Does the public business form send my information?",
        answer: <>No. On this public prototype, submitting a business or early-access form displays a confirmation locally, but no information is sent or stored.</>,
      },
      {
        question: "What is saved in my browser?",
        answer: <>The current workspace stores one local preference so the introductory library setup does not reopen every time. Symbiome does not include advertising or analytics cookies in this prototype. External services and the hosting provider may apply their own policies; see <Link href="/cookies">Cookies</Link> and <Link href="/privacy">Privacy</Link>.</>,
      },
      {
        question: "Where can I ask a question that is not answered here?",
        answer: <>Use the <Link href="/contact">Contact page</Link> to choose the right route. Commercial projects should go directly to the <Link href="/pricing#business-request">Business music request</Link> so the project context reaches the right place.</>,
      },
    ],
  },
];

export default function HelpCenterPage() {
  return (
    <PublicShell>
      <div className="help-page">
        <section className="support-hero" aria-labelledby="help-title">
          <div className="support-hero-inner" data-reveal="group">
            <p className="support-kicker">Symbiome support</p>
            <h1 id="help-title">Clear answers,<br />before you publish.</h1>
            <p className="support-lead">Find out how the catalogue, creator plans and business licensing routes work, including what is available in the current public preview.</p>
            <div className="support-actions">
              <Link className="support-button cta-swipe" href="/catalog">Browse music <span aria-hidden="true">→</span></Link>
              <Link className="support-button support-button-secondary cta-swipe" href="/pricing">View pricing <span aria-hidden="true">→</span></Link>
            </div>
          </div>
        </section>

        <nav className="help-category-nav" aria-label="Help Center categories">
          {categories.map((category) => (
            <a href={`#${category.id}`} key={category.id}>
              {category.label}
              <span>{category.number}</span>
            </a>
          ))}
        </nav>

        <div className="help-categories">
          {categories.map((category) => (
            <section className="help-category" id={category.id} aria-labelledby={`${category.id}-title`} key={category.id}>
              <div className="help-category-heading" data-reveal="left">
                <p>{category.number} / {category.label}</p>
                <h2 id={`${category.id}-title`}>{category.title}</h2>
                <span>{category.introduction}</span>
              </div>
              <div className="help-faq-list" data-reveal="group">
                {category.questions.map((faq, index) => (
                  <details open={index === 0} key={faq.question}>
                    <summary>{faq.question}<span aria-hidden="true">+</span></summary>
                    <p>{faq.answer}</p>
                  </details>
                ))}
              </div>
            </section>
          ))}
        </div>

        <section className="help-contact" aria-labelledby="help-contact-title" data-reveal="group">
          <h2 id="help-contact-title">Still not sure which route fits your project?</h2>
          <Link className="support-button cta-swipe" href="/contact">Contact us <span aria-hidden="true">→</span></Link>
        </section>
      </div>
    </PublicShell>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { PricingCards } from "../components/PricingCards";
import { PublicShell } from "../components/PublicShell";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Creator subscriptions and business music licensing from Easy License.",
};

const comparison = [
  ["Connected channels", "1 per platform", "Up to 3 per platform"],
  ["Your own monetised content", "Included", "Included"],
  ["YouTube, livestreams, podcasts and social", "Eligible uses", "Included"],
  ["Creator team access", "Not included", "Included"],
  ["Eligible catalogue downloads", "Included", "Included"],
  ["Content ID support", "Standard", "Priority"],
];

const pricingFaq = [
  {
    question: "What does the Creator plan cover?",
    answer: "One connected channel or profile per supported platform for your own eligible monetised videos, livestreams, podcasts and social content.",
  },
  {
    question: "When should I choose Pro?",
    answer: "Choose Pro when you manage up to three channels or profiles per platform, publish across several platforms, or need a shared workspace for a creator team.",
  },
  {
    question: "Can I pay monthly?",
    answer: "Yes. You can switch between monthly and yearly billing above. Yearly billing shows the equivalent monthly price and is charged once per year.",
  },
  {
    question: "How is business licensing priced?",
    answer: "Commercial Sync and Custom Commission are quoted according to the project, including media, territory, term and exclusivity. Send us a brief and the team will confirm the relevant scope and price.",
  },
  {
    question: "Is Music for Retail available now?",
    answer: "Not yet. Music for Retail is coming soon for cafés, shops, restaurants, hotels, studios and spas. You can join the early-access list from the Retail page.",
  },
  {
    question: "Is the catalogue made with generative AI?",
    answer: "No. Easy License only accepts music written and produced by artists. Generative AI music is not accepted into the catalogue.",
  },
];

export default function PricingPage() {
  return (
    <PublicShell>
      <section className="page-hero section-shell pricing-hero">
        <div className="page-hero-copy centered">
          <span className="eyebrow"><span>EL / PRICING</span> Creators and businesses</span>
          <h1>Pricing for creators<br /><em>and business projects.</em></h1>
          <p>Creators can choose a monthly or yearly subscription. Business licences are scoped and quoted according to the project, once the required rights are clear.</p>
        </div>
      </section>

      <section className="section-shell pricing-page-cards" aria-labelledby="creator-pricing-title">
        <div className="section-heading centered small-heading">
          <span className="section-kicker">CREATOR SUBSCRIPTIONS</span>
          <h2 id="creator-pricing-title">Choose a plan based on the channels you manage.</h2>
          <p>Both plans include eligible catalogue downloads and licensing for your own content. Your price does not increase with your follower count.</p>
        </div>
        <PricingCards expanded />
      </section>

      <section className="section section-shell comparison-section" aria-labelledby="comparison-title">
        <div className="section-heading centered small-heading">
          <span className="section-kicker">CREATOR PLAN COMPARISON</span>
          <h2 id="comparison-title">Compare Creator and Pro.</h2>
          <p>The main differences are the number of connected channels, team access and the level of Content ID support.</p>
        </div>
        <div className="comparison-table">
          <div className="comparison-head"><span>Plan coverage</span><strong>Creator</strong><strong>Pro</strong></div>
          {comparison.map((row) => (
            <div className="comparison-row" key={row[0]}>
              <span>{row[0]}</span>
              <span data-label="Creator">{row[1]}</span>
              <span data-label="Pro">{row[2]}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="business-options" aria-labelledby="business-pricing-title">
        <div className="offer-section-head" data-reveal="group">
          <p className="offer-kicker"><span>BUSINESS</span> Project-based licensing</p>
          <h2 id="business-pricing-title">Business pricing depends on the rights you need.</h2>
          <p>Choose an existing track, commission original music, or join early access for Music for Retail. Commercial projects receive a clear quote once the media, territory, term and exclusivity are defined.</p>
        </div>
        <div className="business-option-grid" data-reveal="group">
          <Link className="business-option business-option-sync" href="/sync">
            <span>COMMERCIAL SYNC</span>
            <div>
              <h3>License an existing track.</h3>
              <p>For advertising, films, series, games, trailers, branded content and events.</p>
              <strong>Explore Commercial Sync ↗</strong>
            </div>
          </Link>
          <Link className="business-option business-option-custom" href="/sync#brief">
            <span>CUSTOM COMMISSION</span>
            <div>
              <h3>Commission original music.</h3>
              <p>Work with composers and producers on music created for your brief and delivery requirements.</p>
              <strong>Start a project brief ↗</strong>
            </div>
          </Link>
          <Link className="business-option business-option-retail" href="/retail">
            <span>MUSIC FOR RETAIL · COMING SOON</span>
            <div>
              <h3>Music for physical spaces.</h3>
              <p>Human-made music for cafés, shops, restaurants, hotels, studios and spas.</p>
              <strong>Join early access ↗</strong>
            </div>
          </Link>
        </div>
      </section>

      <section className="section section-shell pricing-faq" id="faq" aria-labelledby="pricing-faq-title">
        <div className="split-heading">
          <div>
            <span className="section-kicker">PRICING FAQ</span>
            <h2 id="pricing-faq-title">Questions about plans and project licences.</h2>
          </div>
          <p>Creator subscriptions have published prices. Business licences are quoted after the required rights and deliverables are confirmed.</p>
        </div>
        <div className="faq-grid">
          {pricingFaq.map((item, index) => (
            <details open={index === 0} key={item.question}>
              <summary>{item.question}<span>+</span></summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="pricing-project-cta section-shell">
        <span>Commercial Sync or Custom Commission</span>
        <h2>Tell us what you are making and where it will be used.</h2>
        <Link className="button button-light" href="/sync#brief">Start a business brief</Link>
      </section>
    </PublicShell>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { creatorPlatforms, PlatformLogo } from "../components/PlatformLogo";
import { PricingCards } from "../components/PricingCards";
import { PublicShell } from "../components/PublicShell";
import "../pricing-v39.css";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Creator subscriptions and business music licensing from Symbiose.",
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
    answer: "No. Symbiose only accepts music written and produced by artists. Generative AI music is not accepted into the catalogue.",
  },
];

export default function PricingPage() {
  return (
    <PublicShell>
      <div className="pricing-v39">
      <section className="pricing-v39-hero">
        <div className="page-hero-copy centered">
          <span className="pricing-v39-kicker">SYMBIOSE PRICING</span>
          <h1>Simple plans for<br />the way you publish.</h1>
          <p>Creator subscriptions are clear from the start. Business projects are quoted around the rights they actually need.</p>
        </div>
      </section>

      <section className="pricing-v39-plans" aria-labelledby="creator-pricing-title">
        <div className="pricing-v39-heading">
          <div><span className="pricing-v39-kicker">FOR CREATORS</span><h2 id="creator-pricing-title">Choose your<br />publishing setup.</h2></div>
          <p>Both plans include eligible catalogue downloads for your own content. The price stays the same, whatever the size of your audience.</p>
        </div>
        <PricingCards expanded />
      </section>

      <section className="pricing-v39-platforms" aria-labelledby="platforms-title">
        <div><span className="pricing-v39-kicker">COVERED PLATFORMS</span><h2 id="platforms-title">Where you can publish.</h2><p>Connect the channels and profiles covered by your plan. Creator licensing is built for your own content, not paid advertising or client campaigns.</p></div>
        <div className="pricing-v39-platform-grid">
          {creatorPlatforms.map((name) => <span key={name}><PlatformLogo platform={name} />{name}</span>)}
        </div>
      </section>

      <section className="pricing-v39-comparison" aria-labelledby="comparison-title">
        <div className="pricing-v39-heading">
          <div><span className="pricing-v39-kicker">PLAN COMPARISON</span><h2 id="comparison-title">Creator or Pro?</h2></div>
          <p>The difference is the number of connected channels, the workspace and the support level. Nothing hidden in the fine print.</p>
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

      <section className="pricing-v39-business" aria-labelledby="business-pricing-title">
        <div className="pricing-v39-heading">
          <div><span className="pricing-v39-kicker">FOR BUSINESSES</span><h2 id="business-pricing-title">Rights built around<br />the project.</h2></div>
          <p>From a single existing track to a custom commission, we scope the licence around the media, territory, term and exclusivity you actually require.</p>
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

      <section className="pricing-v39-faq" id="faq" aria-labelledby="pricing-faq-title">
        <div className="pricing-v39-heading">
          <div>
            <span className="pricing-v39-kicker">PRICING FAQ</span>
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

      <section className="pricing-v39-cta">
        <span>Commercial Sync or Custom Commission</span>
        <h2>Tell us what you are making and where it will be used.</h2>
        <Link className="button button-light" href="/sync#brief">Start a business brief</Link>
      </section>
      </div>
    </PublicShell>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { LeadForm } from "../components/LeadForm";
import { PublicShell } from "../components/PublicShell";

export const metadata: Metadata = {
  title: "Easy License for Business",
  description: "Human-made music licensing and original composition for commercial projects, with music for physical spaces coming soon.",
};

export default function BusinessPage() {
  return (
    <PublicShell>
      <div className="offer-landing business-landing">
        <section className="offer-hero offer-hero-business">
          <div className="offer-hero-copy" data-reveal="left">
            <p className="offer-kicker"><span>EL / BUSINESS</span> Powered by Lofi Girl</p>
            <h1 data-reveal="hero-title">Music with the rights<br /><em>your project actually needs.</em></h1>
            <p>Every Business licence is quoted around the actual project. Tell us what you are making and we will help choose the right route: clear an existing track or commission something original, with the rights shaped around the media, territories, term and exclusivity.</p>
            <div className="offer-actions">
              <a className="offer-button offer-button-light" href="#business-brief">Request a custom quote <span>↓</span></a>
              <a className="offer-inline-link offer-inline-light" href="#business-options">Review business services <span>↓</span></a>
            </div>
          </div>
          <div className="offer-hero-proof" data-reveal="group">
            <div><strong>10,000+</strong><span>Human-made tracks</span></div>
            <div><strong>0</strong><span>AI-generated tracks</span></div>
            <div><strong>Custom</strong><span>Quote for every brief</span></div>
          </div>
        </section>

        <section className="offer-curation offer-curation-reverse business-curation" aria-labelledby="business-curation-title">
          <figure data-reveal="scale"><img src="/images/unsplash/business-studio.webp" alt="Sound engineer producing music in a recording studio" width={1400} height={912} loading="eager" fetchPriority="high" decoding="async" /></figure>
          <div className="offer-curation-copy" data-reveal="left">
            <p className="offer-kicker"><span>01</span> Start from the brief</p>
            <h2 id="business-curation-title">Music that can carry<br />a brand or a story.</h2>
            <p>Commercial work needs more than a good track. We look at the mood, pace, instrument palette, media plan and practical rights together, then help prepare a shortlist that makes sense for the project rather than a generic playlist.</p>
            <div className="offer-principles">
              <article><span>01</span><h3>Creative fit</h3><p>We match the musical character to the story, audience and pace of the work.</p></article>
              <article><span>02</span><h3>Rights fit</h3><p>Media, markets, duration and exclusivity are defined around the actual use.</p></article>
              <article><span>03</span><h3>Artist-led options</h3><p>Existing tracks and original commissions both begin with people making the music.</p></article>
            </div>
          </div>
        </section>

        <section className="business-options" id="business-options" aria-labelledby="business-options-title">
          <div className="offer-section-head" data-reveal="group">
            <p className="offer-kicker"><span>02</span> Easy License for Business</p>
            <h2 id="business-options-title">Choose the service that matches your project.</h2>
            <p>Commercial Sync licenses an existing track for a defined use. Custom Commission creates original music for the brief. Music for Retail will cover licensed background music in physical spaces when the service launches.</p>
          </div>
          <div className="business-option-grid" data-reveal="group">
            <Link className="business-option business-option-sync" href="/sync">
              <span>01 / COMMERCIAL SYNC</span><div><h3>License existing music.</h3><p>For advertising, film, series, games, trailers, branded content and events, with rights scoped to the project.</p><strong>Explore Commercial Sync ↗</strong></div>
            </Link>
            <Link className="business-option business-option-custom" href="#business-brief">
              <span>02 / CUSTOM COMMISSION</span><div><h3>Commission music for the project.</h3><p>Work with human composers and producers from the first creative reference through composition, revisions and final delivery.</p><strong>Request a custom quote ↓</strong></div>
            </Link>
            <Link className="business-option business-option-retail" href="/retail">
              <span>03 / MUSIC FOR RETAIL · COMING SOON</span><div><h3>Curated music for physical spaces.</h3><p>An easy, affordable way to soundtrack cafés, restaurants, hotels, boutiques, gyms, studios and spas.</p><strong>Join early access ↗</strong></div>
            </Link>
          </div>
        </section>

        <section className="offer-flow business-flow" aria-labelledby="business-flow-title">
          <div className="offer-section-head" data-reveal="group">
            <p className="offer-kicker"><span>03</span> From brief to licence</p>
            <h2 id="business-flow-title">A clear process for<br />commercial music use.</h2>
            <p>For Commercial Sync and Custom Commission, send the project details first. Our team will confirm the appropriate route, required rights and next steps before you commit.</p>
          </div>
          <div className="offer-flow-grid offer-flow-grid-four" data-reveal="group">
            <article><span>01</span><h3>Share the project context</h3><p>Tell us what you are making, where it will run, the launch date and your budget.</p></article>
            <article><span>02</span><h3>Review a shortlist or proposal</h3><p>We provide selected catalogue options or outline an original composition route.</p></article>
            <article><span>03</span><h3>Confirm the rights and quote</h3><p>We define the media, territory, term, exclusivity and price before approval.</p></article>
            <article><span>04</span><h3>Complete the licence and delivery</h3><p>Once approved, we issue the agreement and deliver the licensed music assets.</p></article>
          </div>
        </section>

        <section className="business-retail" aria-labelledby="business-retail-title">
          <div className="business-retail-copy" data-reveal="left">
            <p className="offer-kicker"><span>04</span> Music for Retail · Coming soon</p>
            <h2 id="business-retail-title">Licensed background music<br />for physical spaces.</h2>
            <p>The planned Retail service will provide human-made background music for retail stores, offices, restaurants, hotels, gyms and spas. Businesses will be able to choose professionally curated programming through a simple, affordable subscription designed for in-venue use.</p>
            <Link className="offer-inline-link" href="/retail">Join the first pilot <span>→</span></Link>
          </div>
          <div className="business-retail-images">
            <figure><img src="/images/unsplash/retail/store.webp" alt="Clothing store interior" width={960} height={720} loading="eager" fetchPriority="high" decoding="async" /><figcaption>Retail stores</figcaption></figure>
            <figure><img src="/images/unsplash/retail/office.webp" alt="Modern office interior" width={960} height={720} loading="eager" fetchPriority="high" decoding="async" /><figcaption>Offices</figcaption></figure>
            <figure><img src="/images/unsplash/retail/restaurant.webp" alt="Contemporary restaurant interior" width={960} height={720} loading="eager" fetchPriority="high" decoding="async" /><figcaption>Restaurants</figcaption></figure>
            <figure><img src="/images/unsplash/retail/hotel.webp" alt="Hotel lobby interior" width={960} height={720} loading="eager" fetchPriority="high" decoding="async" /><figcaption>Hotels</figcaption></figure>
            <figure><img src="/images/unsplash/retail/gym.webp" alt="Modern gym interior" width={960} height={720} loading="eager" fetchPriority="high" decoding="async" /><figcaption>Gyms</figcaption></figure>
            <figure><img src="/images/unsplash/retail/spa.webp" alt="Spa treatment in progress" width={960} height={720} loading="eager" fetchPriority="high" decoding="async" /><figcaption>Spas &amp; wellness</figcaption></figure>
          </div>
        </section>

        <section className="offer-human offer-human-business" aria-labelledby="business-human-title">
          <figure data-reveal="scale"><img src="/artists/meadow.jpg" alt="Portrait of Easy License artist M e a d o w" /></figure>
          <div data-reveal="right">
            <p className="offer-kicker"><span>05</span> Artists and music team</p>
            <h2 id="business-human-title">More than 1,000 artists<br />contribute to the catalogue.</h2>
            <p>Every track is created by a real artist, and no generative AI is used in the music catalogue. Our music team selects work for composition, production quality and suitability for commercial use. Artists are credited and paid directly and fairly when their music is licensed through Easy License.</p>
          </div>
        </section>

        <section className="business-quote" id="business-brief" aria-labelledby="business-brief-title">
          <div className="business-quote-copy" data-reveal="left">
            <p className="offer-kicker"><span>06</span> Made-to-measure quotes</p>
            <h2 id="business-brief-title">Every business project gets a custom quote.</h2>
            <p>Share the project, media, territories, timing and indicative budget. Our team will confirm the right music route, define the required rights and prepare a quote around the real use.</p>
            <div className="business-quote-factors" aria-label="The four factors used to prepare a quote">
              <span>Media</span><span>Territories</span><span>Term</span><span>Exclusivity</span>
            </div>
          </div>
          <div className="form-panel business-quote-form" data-reveal="right">
            <div className="form-panel-head"><span>CUSTOM QUOTE REQUEST</span><small>Start with the brief — we will help with the licence</small></div>
            <LeadForm type="sync" />
          </div>
        </section>
      </div>
    </PublicShell>
  );
}

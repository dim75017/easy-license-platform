import type { Metadata } from "next";
import Link from "next/link";
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
            <h1 data-reveal="hero-title">Commercial music licensing<br /><em>and original composition.</em></h1>
            <p>License an existing track for advertising, branded content, film, series, games, trailers and events, or commission original music from our artist network. Our team can prepare a curated shortlist and define the media, territory, term and exclusivity required for the project. Music for physical spaces is coming soon.</p>
            <div className="offer-actions">
              <Link className="offer-button offer-button-light" href="/sync#brief">Send a business brief <span>↗</span></Link>
              <a className="offer-inline-link offer-inline-light" href="#business-options">Review business services <span>↓</span></a>
            </div>
          </div>
          <div className="offer-hero-proof" data-reveal="group">
            <div><strong>10,000+</strong><span>Human-made tracks</span></div>
            <div><strong>0</strong><span>AI-generated tracks</span></div>
            <div><strong>Curated</strong><span>By music professionals</span></div>
          </div>
        </section>

        <section className="offer-curation offer-curation-reverse" aria-labelledby="business-curation-title">
          <figure data-reveal="scale"><img src="/images/stock/studio-artist.jpg" alt="Music producer working at a recording console" /></figure>
          <div className="offer-curation-copy" data-reveal="left">
            <p className="offer-kicker"><span>01</span> How we select music</p>
            <h2 id="business-curation-title">A catalogue reviewed by<br />music professionals.</h2>
            <p>Our music team evaluates composition, performance, recording and production quality before a track enters the catalogue. When you send a brief, we review the mood, pace, instrumentation and intended media to prepare a shortlist that fits the project.</p>
            <div className="offer-principles">
              <article><span>01</span><h3>Music and production review</h3><p>We assess the composition, performance, recording, mix and overall production quality.</p></article>
              <article><span>02</span><h3>Human-made catalogue</h3><p>Every eligible track is created by an artist; AI-generated music is not accepted.</p></article>
              <article><span>03</span><h3>Shortlists built for the brief</h3><p>Our team narrows the catalogue using the project context rather than broad, generic search terms.</p></article>
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
            <Link className="business-option business-option-custom" href="/sync#brief">
              <span>02 / CUSTOM COMMISSION</span><div><h3>Commission music for the project.</h3><p>Work with human composers and producers from the first creative reference through composition, revisions and final delivery.</p><strong>Explore Custom Commission ↗</strong></div>
            </Link>
            <Link className="business-option business-option-retail" href="/retail">
              <span>03 / MUSIC FOR RETAIL · COMING SOON</span><div><h3>Curated music for physical spaces.</h3><p>An easy, affordable way to soundtrack cafés, shops, restaurants, hotels, studios and spas.</p><strong>Join early access ↗</strong></div>
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
            <p>The planned Retail service will provide human-made background music for cafés, stores, restaurants, hotels and spas. Businesses will be able to choose professionally curated programming through a simple, affordable subscription designed for in-venue use.</p>
            <Link className="offer-inline-link" href="/retail">Join the first pilot <span>→</span></Link>
          </div>
          <div className="business-retail-images" data-reveal="group">
            <figure><img src="/images/unsplash/retail/cafe.jpg" alt="Warm café interior" /><figcaption>Cafés</figcaption></figure>
            <figure><img src="/images/unsplash/retail/hotel.jpg" alt="Warm modern hotel interior" /><figcaption>Hotels</figcaption></figure>
            <figure><img src="/images/unsplash/retail/spa.jpg" alt="Quiet spa interior" /><figcaption>Spas</figcaption></figure>
          </div>
        </section>

        <section className="offer-human offer-human-business" aria-labelledby="business-human-title">
          <figure data-reveal="scale"><img src="/artists/dario-lessing.jpg" alt="Portrait of Easy License artist Dario Lessing" /></figure>
          <div data-reveal="right">
            <p className="offer-kicker"><span>05</span> Artists and music team</p>
            <h2 id="business-human-title">More than 1,000 artists<br />contribute to the catalogue.</h2>
            <p>Every track is created by a real artist, and no generative AI is used in the music catalogue. Our music team selects work for composition, production quality and suitability for commercial use. Artists are credited and paid directly and fairly when their music is licensed through Easy License.</p>
          </div>
        </section>

        <section className="offer-final-cta" data-reveal="group">
          <p>EASY LICENSE FOR BUSINESS</p><h2>Tell us how the music will be used.</h2>
          <div className="offer-actions"><Link className="offer-button offer-button-light" href="/sync#brief">Send a business brief <span>↗</span></Link><Link className="offer-inline-link offer-inline-light" href="/catalog">Browse the music <span>→</span></Link></div>
        </section>
      </div>
    </PublicShell>
  );
}

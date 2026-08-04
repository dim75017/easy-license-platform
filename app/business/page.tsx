import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell } from "../components/PublicShell";

export const metadata: Metadata = {
  title: "Easy License for Business",
  description: "Professionally curated human-made music for commercial sync, custom commissions and physical spaces.",
};

export default function BusinessPage() {
  return (
    <PublicShell>
      <div className="offer-landing business-landing">
        <section className="offer-hero offer-hero-business">
          <div className="offer-hero-copy" data-reveal="left">
            <p className="offer-kicker"><span>EL / BUSINESS</span> Powered by Lofi Girl</p>
            <h1 data-reveal="hero-title">Human-made music,<br /><em>curated for work that matters.</em></h1>
            <p>License an existing track, commission something original, or bring a considered soundtrack to your physical spaces. One expert team, a premium catalogue and a clear path from brief to licence.</p>
            <div className="offer-actions">
              <Link className="offer-button offer-button-light" href="/sync#brief">Start a business brief <span>↗</span></Link>
              <a className="offer-inline-link offer-inline-light" href="#business-options">Explore the three options <span>↓</span></a>
            </div>
          </div>
          <div className="offer-hero-proof" data-reveal="group">
            <div><strong>10,000+</strong><span>Human-made tracks</span></div>
            <div><strong>0</strong><span>AI-generated tracks</span></div>
            <div><strong>Curated</strong><span>By music professionals</span></div>
          </div>
        </section>

        <section className="offer-curation offer-curation-reverse" aria-labelledby="business-curation-title">
          <figure data-reveal="scale"><img src="/images/unsplash/studio-artist.jpg" alt="Music professional producing a track in a recording studio" /></figure>
          <div className="offer-curation-copy" data-reveal="left">
            <p className="offer-kicker"><span>01</span> A better catalogue</p>
            <h2 id="business-curation-title">Less filler.<br />Better choices.</h2>
            <p>Our catalogue is selected by music professionals for quality, consistency and real-world usefulness. Bring us a mood or a creative brief and we can turn it into a focused shortlist.</p>
            <div className="offer-principles">
              <article><span>01</span><h3>Professionally curated</h3><p>Every release is reviewed for craft, cohesion and production quality.</p></article>
              <article><span>02</span><h3>Human-made only</h3><p>No AI-generated music. Just real artists and original productions.</p></article>
              <article><span>03</span><h3>Built around the brief</h3><p>Explore independently or let our music team narrow the catalogue for you.</p></article>
            </div>
          </div>
        </section>

        <section className="business-options" id="business-options" aria-labelledby="business-options-title">
          <div className="offer-section-head" data-reveal="group">
            <p className="offer-kicker"><span>02</span> Easy License for Business</p>
            <h2 id="business-options-title">Three ways to bring music into your business.</h2>
            <p>Choose an existing track, create something original, or prepare the soundtrack for a physical space.</p>
          </div>
          <div className="business-option-grid" data-reveal="group">
            <Link className="business-option business-option-sync" href="/sync">
              <span>01 / COMMERCIAL SYNC</span><div><h3>License existing music.</h3><p>For advertising, film, series, games, trailers, branded content and events, with rights scoped to the project.</p><strong>Explore Commercial Sync ↗</strong></div>
            </Link>
            <Link className="business-option business-option-custom" href="/sync#brief">
              <span>02 / CUSTOM COMMISSION</span><div><h3>Commission original music.</h3><p>Work with human composers and producers from the first creative reference to final delivery.</p><strong>Explore Custom Commission ↗</strong></div>
            </Link>
            <Link className="business-option business-option-retail" href="/retail">
              <span>03 / MUSIC FOR RETAIL · COMING SOON</span><div><h3>Curated music for physical spaces.</h3><p>An easy, affordable way to soundtrack cafés, shops, restaurants, hotels, studios and spas.</p><strong>Join early access ↗</strong></div>
            </Link>
          </div>
        </section>

        <section className="offer-flow business-flow" aria-labelledby="business-flow-title">
          <div className="offer-section-head" data-reveal="group">
            <p className="offer-kicker"><span>03</span> A clear music path</p>
            <h2 id="business-flow-title">Bring the brief.<br />We&apos;ll help choose the route.</h2>
            <p>You do not need to understand every licence before contacting us.</p>
          </div>
          <div className="offer-flow-grid offer-flow-grid-four" data-reveal="group">
            <article><span>01</span><h3>Share the context</h3><p>Project, mood, media, markets, timing and budget.</p></article>
            <article><span>02</span><h3>Curate or create</h3><p>A focused catalogue shortlist or an original composition route.</p></article>
            <article><span>03</span><h3>Define the rights</h3><p>Media, territory, term, exclusivity and a clear quote.</p></article>
            <article><span>04</span><h3>License and deliver</h3><p>Approved scope, agreement and final licensed assets.</p></article>
          </div>
        </section>

        <section className="business-retail" aria-labelledby="business-retail-title">
          <div className="business-retail-copy" data-reveal="left">
            <p className="offer-kicker"><span>04</span> Music for Retail · Coming soon</p>
            <h2 id="business-retail-title">A considered soundtrack for every room.</h2>
            <p>Human-made music for cafés, stores, hotels and spas, curated for the atmosphere and designed to stay simple and affordable.</p>
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
            <p className="offer-kicker"><span>05</span> Human at both ends</p>
            <h2 id="business-human-title">Made by artists.<br />Selected by professionals.</h2>
            <p>Our catalogue is shaped by people who understand composition, production and how music supports an image, a brand or a physical space. Artists are credited and paid directly when their work is licensed.</p>
          </div>
        </section>

        <section className="offer-final-cta" data-reveal="group">
          <p>EASY LICENSE FOR BUSINESS</p><h2>Bring us the brief. We&apos;ll make the music path clear.</h2>
          <div className="offer-actions"><Link className="offer-button offer-button-light" href="/sync#brief">Start a business brief <span>↗</span></Link><Link className="offer-inline-link offer-inline-light" href="/catalog">Explore the catalogue <span>→</span></Link></div>
        </section>
      </div>
    </PublicShell>
  );
}

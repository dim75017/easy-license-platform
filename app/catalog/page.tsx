import type { Metadata } from "next";
import Link from "next/link";
import { CatalogueExplorer } from "../components/CatalogueExplorer";
import { PublicShell } from "../components/PublicShell";
import { tracks } from "../data/catalog";

export const metadata: Metadata = {
  title: "Music library",
  description: "Browse professionally curated, human-made music for videos, streams, podcasts and commercial productions.",
};

export default function CataloguePage() {
  return (
    <PublicShell>
      <div className="music-v26-page">
        <section className="music-v26-hero">
          <div className="music-v26-hero-copy" data-reveal="left">
            <p className="music-v26-kicker"><span>Easy License</span> Music library</p>
            <h1>Music for videos, streams and stories of every kind.</h1>
            <p>Explore instrumental and background music selected by music professionals. Search by project, mood or genre, listen to the original recording and choose the licence that matches how the music will be used.</p>
            <div className="music-v26-hero-actions">
              <a className="music-v26-button music-v26-button-light" href="#music-library">Browse the library <span>↓</span></a>
              <Link className="music-v26-text-link music-v26-text-link-light" href="/pricing">See creator pricing <span>→</span></Link>
            </div>
          </div>
          <div className="music-v26-cover-stack" data-reveal="group" aria-label="A selection of music in the Easy License catalogue">
            {tracks.map((track) => (
              <figure key={track.id}>
                <img src={track.cover} alt={`Cover art for ${track.title} by ${track.artist}`} />
                <figcaption><strong>{track.title}</strong><span>{track.artist}</span></figcaption>
              </figure>
            ))}
          </div>
          <div className="music-v26-hero-facts" data-reveal="group">
            <div><strong>10,000+</strong><span>Human-made tracks</span></div>
            <div><strong>0</strong><span>AI-generated tracks</span></div>
            <div><strong>1,000+</strong><span>Artists worldwide</span></div>
          </div>
        </section>

        <section className="music-v26-library" id="music-library" aria-labelledby="music-library-title">
          <div className="music-v26-section-head" data-reveal="group">
            <p className="music-v26-kicker"><span>01</span> Explore the catalogue</p>
            <h2 id="music-library-title">Start with the project. Then narrow the music.</h2>
            <p>The editor&apos;s selection below is a first way into the wider catalogue. Search by track, artist, mood or project type, then confirm the intended use before licensing.</p>
          </div>
          <div data-reveal="scale"><CatalogueExplorer /></div>
        </section>

        <section className="music-v26-curation" aria-labelledby="music-curation-title">
          <div className="music-v26-curation-intro" data-reveal="left">
            <p className="music-v26-kicker"><span>02</span> Professional curation</p>
            <h2 id="music-curation-title">Why the catalogue feels consistent.</h2>
            <p>Easy License is not an open upload platform. Music is reviewed and organised by people who understand composition, production and the practical needs of editors, creators and brands.</p>
          </div>
          <div className="music-v26-curation-grid" data-reveal="group">
            <article><span>01</span><h3>Selected for quality</h3><p>Every addition is reviewed for musical craft, production quality and usefulness in real projects.</p></article>
            <article><span>02</span><h3>Made by real artists</h3><p>The catalogue contains human-made music only. Artists are credited and paid directly when their work is licensed.</p></article>
            <article><span>03</span><h3>Organised around use</h3><p>Collections, moods and use cases help you reach a focused shortlist without searching through irrelevant uploads.</p></article>
          </div>
        </section>

        <section className="music-v26-paths" aria-labelledby="music-paths-title">
          <div className="music-v26-section-head music-v26-section-head-light" data-reveal="group">
            <p className="music-v26-kicker"><span>03</span> Choose the right licence</p>
            <h2 id="music-paths-title">The music is shared. The licence depends on the use.</h2>
            <p>Creator subscriptions cover eligible publishing on your own channels. Campaigns, films, games, client work and other commercial projects are handled through Easy License for Businesses.</p>
          </div>
          <div className="music-v26-path-grid" data-reveal="group">
            <Link href="/creators"><span>FOR CREATORS</span><h3>YouTube, livestreams, podcasts and social content</h3><p>Explore Creator and Pro plans for eligible publishing on your own channels.</p><strong>See creator licences ↗</strong></Link>
            <Link href="/business"><span>FOR BUSINESSES</span><h3>Campaigns, productions, products and physical spaces</h3><p>License an existing track, commission original music or join the Retail early-access list.</p><strong>See business options ↗</strong></Link>
          </div>
        </section>
      </div>
    </PublicShell>
  );
}

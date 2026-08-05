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
            <h1>A working music library<br />for people making things.</h1>
            <p>Start with the project in front of you, then search by use, mood, artist or genre. Listen to the original recording, build a shortlist and only then choose the licence that matches how the music will appear.</p>
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
            <p className="music-v26-kicker"><span>02</span> A library with an editorial point of view</p>
            <h2 id="music-curation-title">Less searching.<br />More good first options.</h2>
            <p>Easy License is designed as a working library, not an endless upload feed. The structure helps editors, creators and teams get to a small number of relevant tracks before the search becomes tiring.</p>
          </div>
          <div className="music-v26-curation-grid" data-reveal="group">
            <article><span>01</span><h3>Start from the work</h3><p>Project collections provide a useful first route when you know what you are making but not the genre you need.</p></article>
            <article><span>02</span><h3>Follow the feeling</h3><p>Energy, mood and instrumentation give a second route when the picture is clear but the format is open.</p></article>
            <article><span>03</span><h3>Know who made it</h3><p>Every track is attached to a real artist, with the information needed to make a considered choice.</p></article>
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

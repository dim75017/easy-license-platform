import type { Metadata } from "next";
import Link from "next/link";
import { CatalogueExplorer } from "../components/CatalogueExplorer";
import { PublicShell } from "../components/PublicShell";
import { genres, useCategories } from "../data/catalog";

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
            <h1>Music for the<br />work in front of you.</h1>
            <p>Browse a focused, human-made catalogue by project, feeling or genre. Listen to the original recording, make a shortlist, then choose the licence that fits where the music will appear.</p>
            <div className="music-v26-hero-actions">
              <a className="music-v26-button music-v26-button-light" href="#music-library">Browse the library <span>↓</span></a>
              <Link className="music-v26-text-link music-v26-text-link-light" href="/pricing">See creator pricing <span>→</span></Link>
            </div>
          </div>
          <div className="music-v26-hero-routes" data-reveal="group" aria-label="Ways to explore the Easy License catalogue">
            <span>BY PROJECT</span><span>BY FEELING</span><span>BY GENRE</span>
          </div>
        </section>

        <section className="music-v26-discovery" aria-labelledby="music-projects-title">
          <div className="music-v26-section-head" data-reveal="group">
            <p className="music-v26-kicker"><span>01</span> Browse by project</p>
            <h2 id="music-projects-title">Start with what you&apos;re making.</h2>
            <p>Pick a familiar format and begin with a shorter, more useful selection. From there, the library lets you refine by artist, mood or genre.</p>
          </div>
          <div className="music-v26-project-grid" data-reveal="group">
            {useCategories.map((category) => (
              <Link className="music-v26-project-card" href={`/catalog?use=${category.slug}#music-library`} key={category.slug}>
                <img src={category.image} alt="" />
                <span><strong>{category.label}</strong><small>{category.description}</small><em>Explore selection →</em></span>
              </Link>
            ))}
          </div>
        </section>

        <section className="music-v26-sound-map" aria-labelledby="music-sound-map-title">
          <div data-reveal="left">
            <p className="music-v26-kicker"><span>02</span> Browse by sound</p>
            <h2 id="music-sound-map-title">A different route into the same catalogue.</h2>
            <p>Sometimes the format is clear. Sometimes it is the feeling that leads. Use either to arrive at the right music more quickly.</p>
          </div>
          <div className="music-v26-sound-map-groups" data-reveal="group">
            <div><span>GENRES</span>{genres.filter((item) => item !== "All genres").map((genre) => <Link href={`/catalog?genre=${encodeURIComponent(genre)}#music-library`} key={genre}>{genre}<b>→</b></Link>)}</div>
            <div><span>MOODS</span>{["Warm", "Calm", "Bright", "Reflective", "Dreamy", "Easygoing"].map((mood) => <Link href={`/catalog?q=${encodeURIComponent(mood)}#music-library`} key={mood}>{mood}<b>→</b></Link>)}</div>
          </div>
        </section>

        <section className="music-v26-library" id="music-library" aria-labelledby="music-library-title">
          <div className="music-v26-section-head" data-reveal="group">
            <p className="music-v26-kicker"><span>03</span> Music library</p>
            <h2 id="music-library-title">Search, listen and keep moving.</h2>
            <p>Search a track, artist, mood or use. The collection below is a small, working preview of the wider Easy License catalogue.</p>
          </div>
          <div data-reveal="scale"><CatalogueExplorer showUseCases={false} /></div>
        </section>

        <section className="music-v26-curation" aria-labelledby="music-curation-title">
          <div className="music-v26-curation-intro" data-reveal="left">
            <p className="music-v26-kicker"><span>04</span> Made for considered choices</p>
            <h2 id="music-curation-title">A library that stays<br />easy to navigate.</h2>
            <p>The catalogue is deliberately organised to feel useful, not overwhelming. Every route starts with a human-made track and an artist behind it.</p>
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

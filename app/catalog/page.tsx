import type { Metadata } from "next";
import Link from "next/link";
import { CatalogueExplorer } from "../components/CatalogueExplorer";
import { PublicShell } from "../components/PublicShell";
import { genres, playlists } from "../data/catalog";

export const metadata: Metadata = {
  title: "Music library",
  description: "Browse professionally curated, human-made music for videos, streams, podcasts and commercial productions.",
};

export default function CataloguePage() {
  return (
    <PublicShell>
      <div className="music-v26-page">
        <section className="music-library-hero">
          <div data-reveal="left">
            <p className="music-v26-kicker"><span>Easy License</span> Music</p>
            <h1>A real music<br />library for creators.</h1>
            <p>Listen, save your direction, then license the music that fits your video, stream, podcast or project. Every track is made by a real artist.</p>
            <a className="music-v26-button music-v26-button-light" href="#music-library">Open the library <span>↓</span></a>
          </div>
          <div className="music-library-now-playing" data-reveal="right" aria-label="Catalogue preview">
            <span className="music-library-eq" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></span>
            <div><small>NOW EXPLORING</small><strong>Instrumental music<br />with a human touch.</strong><p>10,000+ tracks · 0 AI · 1,000+ artists</p></div>
          </div>
        </section>

        <section className="music-playlists" aria-labelledby="music-playlists-title">
          <div className="music-library-section-head" data-reveal="group">
            <div><p className="music-v26-kicker"><span>01</span> Playlists</p><h2 id="music-playlists-title">Start with a playlist.</h2></div>
            <p>Collections built around a feeling or a use case. Choose one to open matching tracks in the library.</p>
          </div>
          <div className="music-playlist-grid" data-reveal="group">
            {playlists.map((playlist, index) => (
              <Link className={`music-playlist-card is-${playlist.accent}`} href={`/catalog?use=${playlist.use}#music-library`} key={playlist.title}>
                <span className="music-playlist-number">{String(index + 1).padStart(2, "0")}</span>
                <span className="music-playlist-art" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /></span>
                <span><small>{playlist.tracks}</small><strong>{playlist.title}</strong><em>{playlist.subtitle}</em></span>
                <b>Play playlist →</b>
              </Link>
            ))}
          </div>
        </section>

        <section className="music-genre-shelf" aria-labelledby="music-genres-title">
          <p className="music-v26-kicker"><span>02</span> Genres</p>
          <h2 id="music-genres-title">Browse by genre.</h2>
          <div>{genres.filter((item) => item !== "All genres").map((genre) => <Link href={`/catalog?genre=${encodeURIComponent(genre)}#music-library`} key={genre}>{genre}<span>Open playlist</span></Link>)}</div>
        </section>

        <section className="music-v26-library" id="music-library" aria-labelledby="music-library-title">
          <div className="music-v26-section-head" data-reveal="group">
            <p className="music-v26-kicker"><span>03</span> Music library</p>
            <h2 id="music-library-title">All music.</h2>
            <p>Search by track, artist, mood or genre. Play a preview and use the catalogue as the starting point for your next piece of content.</p>
          </div>
          <div data-reveal="scale"><CatalogueExplorer showUseCases={false} /></div>
        </section>
      </div>
    </PublicShell>
  );
}

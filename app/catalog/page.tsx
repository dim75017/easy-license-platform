import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type CSSProperties } from "react";
import { CatalogueFacts } from "../components/CatalogueFacts";
import { CreatorTrackShowcase } from "../components/CreatorTrackShowcase";
import { FilteredCreatorTrackShowcase } from "../components/FilteredCreatorTrackShowcase";
import { PublicShell } from "../components/PublicShell";
import { getPlaylistAccent, lofiGirlPlaylists } from "../data/catalog";
import { catalogueMoodFilters } from "../lib/catalog-moods";

export const metadata: Metadata = {
  title: "Music library",
  description: "Browse professionally curated, human-made music for videos, streams, podcasts and commercial productions.",
};

export default function CataloguePage() {
  const featuredMoods = catalogueMoodFilters.slice(0, 10);

  return (
    <PublicShell>
      <div className="music-v26-page">
        <section className="music-library-hero">
          <div data-reveal="left">
            <h1>A real music<br />library for creators.</h1>
            <p>Listen, save your direction, then license the music that fits your video, stream, podcast or project. Every track is made by a real artist.</p>
            <Link className="music-v26-button music-v26-button-light cta-swipe" href="/app">Open the library</Link>
          </div>
        </section>

        <CatalogueFacts />

        <section className="music-playlists" aria-labelledby="music-playlists-title">
          <div className="music-library-section-head" data-reveal="group">
            <div><p className="music-v26-kicker"><span>01</span> Playlists</p><h2 id="music-playlists-title">Start with a playlist.</h2></div>
            <p>Explore the catalogue&apos;s main directions, from lofi and ambient to jazz, classical, bossa and seasonal music.</p>
          </div>
          <div className="music-playlist-grid" data-reveal="group">
            {lofiGirlPlaylists.map((playlist, index) => {
              const accent = getPlaylistAccent(playlist);
              return <Link
                aria-label={`Open ${playlist.title} in the Symbiome library`}
                className="music-playlist-card"
                href={`/app?view=playlists&playlist=${encodeURIComponent(playlist.id)}`}
                key={playlist.id}
                style={{ "--playlist-accent": accent.color, "--playlist-accent-ink": accent.ink } as CSSProperties}
              >
                <span className="music-playlist-number">{String(index + 1).padStart(2, "0")}</span>
                <img
                  src={playlist.image}
                  alt=""
                  width={1600}
                  height={1200}
                  loading="lazy"
                  decoding="async"
                  style={{ objectPosition: playlist.imagePosition ?? "center" }}
                />
                <span className="music-playlist-copy"><small>{playlist.genre} · {playlist.moods.slice(0, 2).join(" · ")}</small><strong>{playlist.title}</strong><em>{playlist.description}</em></span>
              </Link>;
            })}
          </div>
          <Link className="music-playlists-all cta-swipe" href="/app?view=playlists">Explore all playlists</Link>
        </section>

        <section className="catalogue-moods" aria-labelledby="music-moods-title">
          <div className="catalogue-moods-head" data-reveal="group">
            <div>
              <p className="music-v26-kicker"><span>02</span> Moods</p>
              <h2 id="music-moods-title">Browse by mood.</h2>
            </div>
            <p>Start with the feeling you want, then narrow the library by track, artist or style.</p>
          </div>
          <ul className="catalogue-moods-grid" data-reveal="group">
            {featuredMoods.map((mood, index) => (
              <li key={mood}>
                <Link className="catalogue-mood-card" href={`/app?view=music&mood=${encodeURIComponent(mood)}`}>
                  <span className="catalogue-mood-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                  <strong>{mood}</strong>
                  <span className="catalogue-mood-action">Browse tracks</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="music-v26-library music-library-editorial music-library-showcase" id="music-library" aria-labelledby="music-library-title">
          <div className="music-v26-section-head music-library-editorial-heading" data-reveal="group">
            <p className="music-v26-kicker"><span>03</span> Browse the music</p>
            <h2 id="music-library-title">Search by mood,<br />style or use.</h2>
            <p>Search for a specific track by mood, style or intended use. Or begin with eight editor-selected tracks drawn from our main playlists for streams, edits and different kinds of content.</p>
          </div>
          <div data-reveal="scale">
            <Suspense fallback={<CreatorTrackShowcase />}>
              <FilteredCreatorTrackShowcase />
            </Suspense>
          </div>
        </section>
      </div>
    </PublicShell>
  );
}

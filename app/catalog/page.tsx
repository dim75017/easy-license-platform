import type { Metadata } from "next";
import Link from "next/link";
import { CatalogueExplorer } from "../components/CatalogueExplorer";
import { PublicShell } from "../components/PublicShell";
import { lofiGirlPlaylists, moods } from "../data/catalog";

export const metadata: Metadata = {
  title: "Music library",
  description: "Browse professionally curated, human-made music for videos, streams, podcasts and commercial productions.",
};

export default function CataloguePage() {
  const featuredMoods = moods.filter((item) => item !== "All moods").slice(0, 10);

  return (
    <PublicShell>
      <div className="music-v26-page">
        <section className="music-library-hero">
          <div data-reveal="left">
            <h1>A real music<br />library for creators.</h1>
            <p>Listen, save your direction, then license the music that fits your video, stream, podcast or project. Every track is made by a real artist.</p>
            <a className="music-v26-button music-v26-button-light" href="#music-library">Open the library <span>↓</span></a>
          </div>
        </section>

        <section className="music-playlists" aria-labelledby="music-playlists-title">
          <div className="music-library-section-head" data-reveal="group">
            <div><p className="music-v26-kicker"><span>01</span> Playlists</p><h2 id="music-playlists-title">Start with a playlist.</h2></div>
            <p>Start with the public playlists that define the catalogue&apos;s main directions, from quiet piano and lofi to synthwave, jazz, house and ambient.</p>
          </div>
          <div className="music-playlist-grid" data-reveal="group">
            {lofiGirlPlaylists.map((playlist, index) => (
              <a className="music-playlist-card" href={`https://open.spotify.com/playlist/${playlist.spotifyId}`} key={playlist.id}>
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
                <b>Open on Spotify ↗</b>
              </a>
            ))}
          </div>
          <a className="music-playlists-all" href="https://open.spotify.com/user/chilledcow?si=be0806a4d0fd44ca">Explore all playlists <span>↗</span></a>
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
                <Link className="catalogue-mood-card" href={`/catalog?q=${encodeURIComponent(mood)}#music-library`}>
                  <span className="catalogue-mood-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                  <strong>{mood}</strong>
                  <span className="catalogue-mood-action">Browse tracks <i aria-hidden="true">↗</i></span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="music-v26-library music-library-editorial" id="music-library" aria-labelledby="music-library-title">
          <div className="music-v26-section-head music-library-editorial-heading" data-reveal="group">
            <p className="music-v26-kicker"><span>03</span> Music library</p>
            <h2 id="music-library-title">Search the library<br />by mood, style or use.</h2>
            <p>Search by track, artist, mood or genre. Play a preview, compare directions and narrow the library without leaving the page.</p>
          </div>
          <div data-reveal="scale"><CatalogueExplorer showUseCases={false} editorial /></div>
        </section>
      </div>
    </PublicShell>
  );
}

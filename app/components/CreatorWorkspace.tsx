"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Brand } from "./Brand";
import { LofiGirlWordmark } from "./LofiGirlWordmark";
import { genres, lofiGirlPlaylists, moods, tracks, type LofiGirlPlaylist, type MusicUseSlug, type Track } from "../data/catalog";
import "../workspace-music.css";

type LibraryView = "music" | "playlists" | "downloads" | "channels" | "licences";

const roles = ["Creator", "Streamer", "Filmmaker", "Brand / agency"];
const destinations = ["YouTube", "Twitch", "TikTok", "Instagram", "Kick", "Podcasts", "Websites"];
const listeningDirections: Array<{ label: string; note: string; use: MusicUseSlug }> = [
  { label: "Calm focus", note: "Lofi · Piano", use: "study-focus" },
  { label: "Neon energy", note: "Synthwave · Gaming", use: "gaming-streaming" },
  { label: "Dream state", note: "Ambient · Cinematic", use: "cinematic" },
  { label: "Late-night warmth", note: "Jazz Lofi · Café", use: "food-hospitality" },
  { label: "Sunny motion", note: "Chill House · Travel", use: "travel" },
  { label: "Deep rest", note: "Sleep · Wellness", use: "wellness" },
];

const navItems: Array<{ id: LibraryView; label: string; icon: string; badge?: string }> = [
  { id: "music", label: "Music", icon: "♫" },
  { id: "playlists", label: "Playlists", icon: "▤", badge: String(lofiGirlPlaylists.length) },
  { id: "downloads", label: "Downloads", icon: "↓", badge: "4" },
  { id: "channels", label: "Channels", icon: "◉" },
  { id: "licences", label: "Licences", icon: "◇" },
];

function Wave({ seed, dense = false }: { seed: string; dense?: boolean }) {
  const heights = [34, 68, 43, 82, 56, 92, 47, 73, 39, 88, 51, 64, 31, 77, 46, 95, 58, 70, 37, 84, 49, 62, 42, 78];
  const offset = seed.charCodeAt(seed.length - 1) % heights.length;
  const count = dense ? heights.length : 12;
  return (
    <span className="music-wave" aria-hidden="true">
      {heights.slice(0, count).map((_, index) => <i key={index} style={{ height: `${heights[(index + offset) % heights.length]}%` }} />)}
    </span>
  );
}

function PlaylistCard({ playlist, onOpen }: { playlist: LofiGirlPlaylist; onOpen: (playlist: LofiGirlPlaylist) => void }) {
  const style = {
    "--playlist-border": playlist.borderColor,
    "--playlist-position": playlist.imagePosition ?? "center",
  } as CSSProperties;

  return (
    <button className="workspace-playlist" style={style} type="button" onClick={() => onOpen(playlist)} title={playlist.title}>
      <img
        className="workspace-playlist-photo"
        src={playlist.image}
        alt=""
        width={1600}
        height={1200}
        loading="lazy"
        decoding="async"
      />
      <span className="workspace-playlist-shade" aria-hidden="true" />
      <span className="workspace-playlist-copy">
        <small>{playlist.genre} · {playlist.moods[0]}</small>
        <strong>{playlist.title}</strong>
        <em>{playlist.description}</em>
        <b className="workspace-lofi-credit"><LofiGirlWordmark /> <span>public playlist</span></b>
      </span>
      <i aria-hidden="true">→</i>
    </button>
  );
}

function ProductNavigation() {
  return (
    <div className="music-product-nav" aria-label="Symbiome products">
      <button className="is-active" type="button"><span>♫</span><strong>Music</strong></button>
      <button type="button" aria-disabled="true"><span>⌁</span><strong>Sound effects</strong><small>Coming soon</small></button>
      <button type="button" aria-disabled="true"><span>◌</span><strong>Voices</strong><small>Coming soon</small></button>
    </div>
  );
}

export function CreatorWorkspace() {
  const [view, setView] = useState<LibraryView>("music");
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState("All genres");
  const [mood, setMood] = useState("All moods");
  const [activeUse, setActiveUse] = useState<MusicUseSlug | null>(null);
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  const [selectedTrackId, setSelectedTrackId] = useState(tracks[0]?.id ?? "");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [liked, setLiked] = useState<Set<string>>(() => new Set());
  const [setupOpen, setSetupOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState("Creator");
  const [selectedDestinations, setSelectedDestinations] = useState<Set<string>>(() => new Set(["YouTube"]));

  useEffect(() => {
    try {
      if (!window.localStorage.getItem("easy-license-library-tuned")) setSetupOpen(true);
    } catch {
      setSetupOpen(true);
    }
  }, []);

  const visibleTracks = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return tracks.filter((track) => {
      const haystack = `${track.title} ${track.artist} ${track.genre} ${track.moods.join(" ")} ${track.suggestedUses.join(" ")}`.toLowerCase();
      return (!needle || haystack.includes(needle))
        && (genre === "All genres" || track.genre === genre)
        && (mood === "All moods" || track.moods.includes(mood))
        && (!activeUse || track.suggestedUses.includes(activeUse));
    });
  }, [activeUse, genre, mood, query]);

  const selectedTrack = tracks.find((track) => track.id === selectedTrackId) ?? tracks[0];
  const activePlaylist = lofiGirlPlaylists.find((playlist) => playlist.id === activePlaylistId);

  function openPlaylist(playlist: LofiGirlPlaylist) {
    setActivePlaylistId(playlist.id);
    setActiveUse(playlist.use);
    setGenre("All genres");
    setMood("All moods");
    setView("music");
    window.setTimeout(() => document.querySelector(".music-track-browser")?.scrollIntoView({ behavior: "smooth", block: "start" }), 40);
  }

  function openDirection(use: MusicUseSlug) {
    setActivePlaylistId(null);
    setActiveUse(use);
    setGenre("All genres");
    setMood("All moods");
    window.setTimeout(() => document.querySelector(".music-track-browser")?.scrollIntoView({ behavior: "smooth", block: "start" }), 40);
  }

  function openTrack(track: Track) {
    setSelectedTrackId(track.id);
    setPreviewOpen(true);
  }

  function toggleLiked(trackId: string) {
    setLiked((current) => {
      const next = new Set(current);
      if (next.has(trackId)) next.delete(trackId);
      else next.add(trackId);
      return next;
    });
  }

  function closeSetup() {
    try { window.localStorage.setItem("easy-license-library-tuned", "1"); } catch { /* local storage can be unavailable in previews */ }
    setSetupOpen(false);
  }

  function toggleDestination(destination: string) {
    setSelectedDestinations((current) => {
      const next = new Set(current);
      if (next.has(destination)) next.delete(destination);
      else next.add(destination);
      return next;
    });
  }

  return (
    <div className="creator-music-app">
      <aside className="music-app-sidebar">
        <div className="music-app-brand"><Brand compact /><span>Creator</span></div>
        <ProductNavigation />

        <nav className="music-app-nav" aria-label="Creator library navigation">
          <span>YOUR LIBRARY</span>
          {navItems.slice(1).map((item) => (
            <button className={view === item.id ? "is-active" : ""} type="button" onClick={() => setView(item.id)} key={item.id}>
              <i aria-hidden="true">{item.icon}</i><strong>{item.label}</strong>{item.badge && <small>{item.badge}</small>}
            </button>
          ))}
        </nav>

        <div className="music-app-sidebar-bottom">
          <button className="tune-library-button" type="button" onClick={() => setSetupOpen(true)}><span>✦</span><strong>Tune my library</strong><small>Improve recommendations</small></button>
          <div className="music-app-account"><span>DM</span><div><strong>Demo creator</strong><small>Creator plan</small></div><i>•••</i></div>
          <Link href="/">← Back to website</Link>
        </div>
      </aside>

      <main className="music-app-main">
        <header className="music-app-topbar">
          <div><span>Symbiome</span><h1>{view === "music" ? "Music library" : navItems.find((item) => item.id === view)?.label}</h1></div>
          <label className="music-global-search">
            <span aria-hidden="true">⌕</span>
            <input value={query} onChange={(event) => { setQuery(event.target.value); setActiveUse(null); setActivePlaylistId(null); setView("music"); }} placeholder="Search tracks, artists, moods or genres" />
            <kbd>⌘ K</kbd>
          </label>
          <button className="music-topbar-action" type="button" onClick={() => setView("downloads")}>Downloads <span>4</span></button>
        </header>

        {view === "music" && (
          <div className="music-library-view">
            <section className="music-discovery-intro">
              <div><p>HUMAN-MADE MUSIC</p><h2>Find the right atmosphere,<br />then keep creating.</h2><span>Instrumental music from real artists, ready for videos, streams, podcasts and more.</span></div>
              <div className="music-catalogue-proof"><strong>10,000+</strong><span>tracks in the full catalogue</span><i>0 AI-generated</i></div>
            </section>

            <section className="music-shelf" aria-labelledby="project-playlists-title">
              <div className="music-shelf-head"><div><span className="workspace-lofi-kicker">PUBLIC PLAYLISTS FROM <LofiGirlWordmark /></span><h3 id="project-playlists-title">Explore by genre and mood.</h3><p>From lofi and ambient to classical, bossa and seasonal listening — twelve distinct directions for the work in front of you.</p></div><button type="button" onClick={() => setView("playlists")}>View all playlists →</button></div>
              <div className="music-playlist-shelf">
                {lofiGirlPlaylists.slice(0, 8).map((playlist) => <PlaylistCard playlist={playlist} onOpen={openPlaylist} key={playlist.id} />)}
              </div>
            </section>

            <section className="music-mood-shelf" aria-labelledby="mood-title">
              <div className="music-shelf-head"><div><span>MOVE BY MOOD</span><h3 id="mood-title">Choose the feeling first.</h3></div></div>
              <div>{listeningDirections.map((item) => <button className={activeUse === item.use && !activePlaylistId ? "is-active" : ""} type="button" onClick={() => openDirection(item.use)} key={item.label}><span><strong>{item.label}</strong><small>{item.note}</small></span><i>→</i></button>)}</div>
            </section>

            <section className="music-track-browser" aria-labelledby="tracks-title">
              <div className="music-track-browser-head">
                <div><span>SYMBIOME CATALOGUE PREVIEW</span><h3 id="tracks-title">{activePlaylist?.title ?? (activeUse ? listeningDirections.find((item) => item.use === activeUse)?.label : "All music")}</h3><p>{visibleTracks.length} matching licensable tracks in this preview</p></div>
                <div className="music-filter-row">
                  <label><span>Genre</span><select value={genre} onChange={(event) => setGenre(event.target.value)}>{genres.map((item) => <option key={item}>{item}</option>)}</select></label>
                  <label><span>Mood</span><select value={mood} onChange={(event) => setMood(event.target.value)}>{moods.map((item) => <option key={item}>{item}</option>)}</select></label>
                  {(genre !== "All genres" || mood !== "All moods" || activeUse || query) && <button type="button" onClick={() => { setGenre("All genres"); setMood("All moods"); setActiveUse(null); setActivePlaylistId(null); setQuery(""); }}>Clear filters</button>}
                </div>
              </div>

              <div className="music-track-table" aria-live="polite">
                <div className="music-track-table-head"><span>Track</span><span>Waveform</span><span>Genre / mood</span><span>Audience</span><span>Actions</span></div>
                {visibleTracks.map((track, index) => (
                  <article className={selectedTrackId === track.id ? "music-track-row is-selected" : "music-track-row"} key={track.id}>
                    <div className="music-track-identity"><button type="button" onClick={() => openTrack(track)} aria-label={`Preview ${track.title}`}>{selectedTrackId === track.id && previewOpen ? "■" : "▶"}</button><img src={track.cover} alt="" /><span><strong>{track.title}</strong><small>{track.artist}</small></span></div>
                    <Wave seed={track.id} dense />
                    <div className="music-track-tags"><span>{track.genre}</span><small>{track.moods.slice(0, 2).join(" · ")}</small></div>
                    <span className="music-track-streams">{track.streams}</span>
                    <div className="music-track-actions"><button className={liked.has(track.id) ? "is-liked" : ""} type="button" onClick={() => toggleLiked(track.id)} aria-label={`Like ${track.title}`}>{liked.has(track.id) ? "♥" : "♡"}</button><button type="button" aria-label={`Add ${track.title} to playlist`}>＋</button><button type="button" aria-label={`Download ${track.title}`}>↓</button></div>
                    <span className="music-track-index">{String(index + 1).padStart(2, "0")}</span>
                  </article>
                ))}
                {visibleTracks.length === 0 && <div className="music-no-results"><strong>No matching tracks yet.</strong><p>Try another mood or clear the filters to return to the full preview.</p><button type="button" onClick={() => { setGenre("All genres"); setMood("All moods"); setActiveUse(null); setActivePlaylistId(null); setQuery(""); }}>Reset library</button></div>}
              </div>
            </section>
          </div>
        )}

        {view === "playlists" && <PlaylistLibrary onOpen={openPlaylist} />}
        {view === "downloads" && <DownloadsLibrary onOpen={openTrack} />}
        {view === "channels" && <ChannelsView />}
        {view === "licences" && <LicencesView />}
      </main>

      {selectedTrack && (
        <footer className={previewOpen ? "workspace-audio-player is-open" : "workspace-audio-player"}>
          <div className="workspace-player-track"><img src={selectedTrack.cover} alt="" /><span><strong>{selectedTrack.title}</strong><small>{selectedTrack.artist} · {selectedTrack.genre}</small></span></div>
          <button className="workspace-player-toggle" type="button" onClick={() => setPreviewOpen((open) => !open)} aria-label={previewOpen ? "Close preview" : "Open preview"}>{previewOpen ? "×" : "▶"}</button>
          <Wave seed={selectedTrack.id} dense />
          <span className="workspace-player-time">PREVIEW</span>
          <div className="workspace-player-actions"><button className={liked.has(selectedTrack.id) ? "is-liked" : ""} type="button" onClick={() => toggleLiked(selectedTrack.id)}>♡</button><button type="button">＋ Playlist</button><button type="button">↓ Download</button></div>
          {previewOpen && <iframe src={`https://open.spotify.com/embed/track/${selectedTrack.spotifyId}?utm_source=generator&theme=0`} title={`Spotify preview for ${selectedTrack.title} by ${selectedTrack.artist}`} width="100%" height="80" loading="lazy" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" />}
        </footer>
      )}

      {setupOpen && (
        <div className="music-setup-backdrop" role="dialog" aria-modal="true" aria-labelledby="music-setup-title">
          <div className="music-setup-panel">
            <div className="music-setup-intro"><span>FIRST LISTEN</span><h2 id="music-setup-title">Tune the library<br />to your work.</h2><p>Two quick choices help Symbiome put more useful playlists first. You can change this later.</p><button type="button" onClick={closeSetup}>Skip for now</button></div>
            <div className="music-setup-form">
              <section><span>01 · YOUR MAIN ROLE</span><h3>What are you creating as?</h3><div className="music-role-grid">{roles.map((role) => <button className={selectedRole === role ? "is-selected" : ""} type="button" onClick={() => setSelectedRole(role)} key={role}>{role}<i>{selectedRole === role ? "✓" : ""}</i></button>)}</div></section>
              <section><span>02 · WHERE YOU PUBLISH</span><h3>Choose every destination that matters.</h3><div className="music-destination-grid">{destinations.map((destination) => <button className={selectedDestinations.has(destination) ? "is-selected" : ""} type="button" onClick={() => toggleDestination(destination)} key={destination}>{destination}<i>{selectedDestinations.has(destination) ? "✓" : "+"}</i></button>)}</div></section>
              <button className="music-setup-submit" type="button" onClick={closeSetup}>Open my music library <span>→</span></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PlaylistLibrary({ onOpen }: { onOpen: (playlist: LofiGirlPlaylist) => void }) {
  return <div className="music-secondary-view"><header><span className="workspace-lofi-kicker"><LofiGirlWordmark /> LISTENING WORLDS</span><h2>Playlists</h2><p>Twelve distinct directions drawn from the public <LofiGirlWordmark className="lofi-girl-wordmark-inline" /> profile, translated into a Symbiome starting point.</p></header><div className="music-secondary-playlists">{lofiGirlPlaylists.map((playlist) => <PlaylistCard playlist={playlist} onOpen={onOpen} key={playlist.id} />)}</div></div>;
}

function DownloadsLibrary({ onOpen }: { onOpen: (track: Track) => void }) {
  return <div className="music-secondary-view"><header><span>YOUR LIBRARY</span><h2>Downloads</h2><p>Your recent music downloads and their licence records.</p></header><div className="music-download-list">{tracks.map((track, index) => <article key={track.id}><button type="button" onClick={() => onOpen(track)}>▶</button><img src={track.cover} alt="" /><span><strong>{track.title}</strong><small>{track.artist}</small></span><span>{track.genre}</span><span>{["Today", "Yesterday", "31 Jul", "29 Jul"][index]}</span><strong>WAV + MP3</strong><button type="button">↓</button></article>)}</div></div>;
}

function ChannelsView() {
  return <div className="music-secondary-view"><header><span>ACCOUNT</span><h2>Channels</h2><p>Creator plans cover the channels and profiles connected to your account.</p></header><section className="music-account-card"><span className="music-account-platform">▶</span><div><strong>Demo Creator Channel</strong><small>YouTube · Connected to Creator plan</small></div><span className="music-account-status">● Connected</span><button type="button">Manage</button></section></div>;
}

function LicencesView() {
  return <div className="music-secondary-view"><header><span>ACCOUNT</span><h2>Licences</h2><p>Keep each track, channel and proof of licence in one place.</p></header><section className="music-account-card"><span className="music-account-platform">◇</span><div><strong>Symbiome · Creator</strong><small>SY-DEMO-2026-0001 · Active since 03 Aug 2026</small></div><span className="music-account-status">● Active</span><button type="button">View licence</button></section></div>;
}

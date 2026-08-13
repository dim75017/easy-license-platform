"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Brand } from "./Brand";
import { LofiGirlWordmark } from "./LofiGirlWordmark";
import { useTrackPreview } from "../hooks/useTrackPreview";
import {
  genres,
  lofiGirlPlaylists,
  moods,
  musicSearchTaxonomy,
  getPlaylistAccent,
  type LofiGirlPlaylist,
  type MusicUseSlug,
  type WorkspaceTrack,
  workspaceTracks,
} from "../data/catalog";
import "../workspace-music.css";

type LibraryView = "discover" | "music" | "playlists" | "liked" | "downloads" | "channels" | "licences";
type FacetKind = "genre" | "mood" | "theme" | "artist";

const roles = ["Creator", "Streamer", "Filmmaker", "Brand / agency"];
const destinations = ["YouTube", "Twitch", "TikTok", "Instagram", "Kick", "Podcasts", "Websites"];

const navGroups: ReadonlyArray<{
  label: string;
  items: ReadonlyArray<{ id: LibraryView; label: string; icon: string; mobileSecondary?: boolean }>;
}> = [
  {
    label: "DISCOVER MUSIC",
    items: [
      { id: "discover", label: "Discover", icon: "◎" },
      { id: "music", label: "Music", icon: "♫" },
      { id: "playlists", label: "Playlists", icon: "▦" },
    ],
  },
  {
    label: "YOUR LIBRARY",
    items: [
      { id: "liked", label: "Liked tracks", icon: "♡" },
      { id: "downloads", label: "Downloads", icon: "↓" },
      { id: "licences", label: "Licences", icon: "◇", mobileSecondary: true },
      { id: "channels", label: "Channels", icon: "◉", mobileSecondary: true },
    ],
  },
];

const viewLabels = Object.fromEntries(navGroups.flatMap((group) => group.items.map((item) => [item.id, item.label]))) as Record<LibraryView, string>;

function Wave({ seed, dense = false, progress = 0 }: { seed: string; dense?: boolean; progress?: number }) {
  const heights = [34, 68, 43, 82, 56, 92, 47, 73, 39, 88, 51, 64, 31, 77, 46, 95, 58, 70, 37, 84, 49, 62, 42, 78];
  const offset = seed.charCodeAt(seed.length - 1) % heights.length;
  const count = dense ? 96 : 24;
  const playedBars = Math.round(Math.max(0, Math.min(1, progress)) * count);

  return (
    <span className="music-wave" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <i
          className={index < playedBars ? "is-played" : undefined}
          key={index}
          style={{ height: `${heights[(index + offset) % heights.length]}%` }}
        />
      ))}
    </span>
  );
}

function PlaybackGlyph({ playing }: { playing: boolean }) {
  return <span className="music-player-icon" data-state={playing ? "pause" : "play"} aria-hidden="true" />;
}

function formatPlaybackTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "--:--";
  const wholeSeconds = Math.floor(seconds);
  const minutes = Math.floor(wholeSeconds / 60);
  return `${minutes}:${String(wholeSeconds % 60).padStart(2, "0")}`;
}

function PlaylistCard({ playlist, onOpen }: { playlist: LofiGirlPlaylist; onOpen: (playlist: LofiGirlPlaylist) => void }) {
  const accent = getPlaylistAccent(playlist);
  const style = {
    "--playlist-accent": accent.color,
    "--playlist-accent-ink": accent.ink,
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
    </button>
  );
}

function DiscoveryFacet({
  eyebrow,
  title,
  items,
  onSelect,
}: {
  eyebrow: string;
  title: string;
  items: readonly string[];
  onSelect: (item: string) => void;
}) {
  return (
    <section className="music-discovery-facet" aria-labelledby={`facet-${title.toLowerCase()}`}>
      <div className="music-discovery-facet-head">
        <span>{eyebrow}</span>
        <h3 id={`facet-${title.toLowerCase()}`}>{title}</h3>
      </div>
      <div className="music-facet-options">
        {items.map((item) => (
          <button className="music-facet-option" type="button" onClick={() => onSelect(item)} key={item}>{item}</button>
        ))}
      </div>
    </section>
  );
}

export function CreatorWorkspace() {
  const [view, setView] = useState<LibraryView>("discover");
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState("All genres");
  const [mood, setMood] = useState("All moods");
  const [activeUse, setActiveUse] = useState<MusicUseSlug | null>(null);
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  const [liked, setLiked] = useState<Set<string>>(() => new Set());
  const [likedReady, setLikedReady] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState("Creator");
  const [selectedDestinations, setSelectedDestinations] = useState<Set<string>>(() => new Set(["YouTube"]));
  const preview = useTrackPreview();

  useEffect(() => {
    try {
      if (!window.localStorage.getItem("easy-license-library-tuned")) setSetupOpen(true);
      const storedLiked = JSON.parse(window.localStorage.getItem("symbiome-liked-tracks") ?? "[]") as unknown;
      if (Array.isArray(storedLiked)) setLiked(new Set(storedLiked.filter((id): id is string => typeof id === "string")));
    } catch {
      setSetupOpen(true);
    } finally {
      setLikedReady(true);
    }
  }, []);

  useEffect(() => {
    if (!likedReady) return;
    try { window.localStorage.setItem("symbiome-liked-tracks", JSON.stringify([...liked])); } catch { /* Storage can be unavailable in previews. */ }
  }, [liked, likedReady]);

  const visibleTracks = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return workspaceTracks.filter((track) => {
      const themeLabels = track.themes.map((slug) => musicSearchTaxonomy.themes.find((theme) => theme.slug === slug)?.label ?? slug);
      const haystack = `${track.title} ${track.artist} ${track.genre} ${track.moods.join(" ")} ${themeLabels.join(" ")}`.toLowerCase();
      return (!needle || haystack.includes(needle))
        && (genre === "All genres" || track.genre === genre)
        && (mood === "All moods" || track.moods.includes(mood))
        && (!activeUse || track.themes.includes(activeUse));
    });
  }, [activeUse, genre, mood, query]);

  const likedTracks = useMemo(() => workspaceTracks.filter((track) => liked.has(track.id)), [liked]);
  const selectedTrack = workspaceTracks.find((track) => track.id === preview.activeTrackId);
  const activePlaylist = lofiGirlPlaylists.find((playlist) => playlist.id === activePlaylistId);
  const activeTheme = musicSearchTaxonomy.themes.find((theme) => theme.slug === activeUse);

  function resetFilters() {
    setGenre("All genres");
    setMood("All moods");
    setActiveUse(null);
    setActivePlaylistId(null);
    setQuery("");
  }

  function showMusic() {
    setView("music");
  }

  function openPlaylist(playlist: LofiGirlPlaylist) {
    setActivePlaylistId(playlist.id);
    setActiveUse(playlist.use);
    setGenre("All genres");
    setMood("All moods");
    showMusic();
  }

  function openFacet(kind: FacetKind, value: string) {
    setGenre("All genres");
    setMood("All moods");
    setActiveUse(null);
    setActivePlaylistId(null);
    setQuery("");
    if (kind === "genre") setGenre(value);
    if (kind === "mood") setMood(value);
    if (kind === "artist") setQuery(value);
    if (kind === "theme") {
      const theme = musicSearchTaxonomy.themes.find((item) => item.label === value);
      if (theme) setActiveUse(theme.slug);
    }
    showMusic();
  }

  function togglePreview(track: WorkspaceTrack) {
    void preview.toggle({ id: track.id, previewUrl: track.previewUrl });
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
    try { window.localStorage.setItem("easy-license-library-tuned", "1"); } catch { /* Storage can be unavailable in previews. */ }
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

  function renderTrackTable(source: readonly WorkspaceTrack[], label: string): ReactNode {
    return (
      <div className="music-track-table" role="list" aria-label={label}>
        <div className="music-track-table-head" aria-hidden="true">
          <span>Track</span><span>Player</span><span>Genre / mood</span><span>Actions</span>
        </div>
        {source.map((track) => {
          const isActive = preview.activeTrackId === track.id;
          const isPlaying = isActive && preview.isPlaying;
          const hasError = preview.errorTrackId === track.id;
          return (
            <article className={`music-track-row${isActive ? " is-selected" : ""}${hasError ? " has-preview-error" : ""}`} role="listitem" key={track.id}>
              <div className="music-track-identity">
                <img src={track.cover} alt="" width={64} height={64} loading="lazy" decoding="async" />
                <span><strong>{track.title}</strong><small>{track.artist}</small></span>
              </div>
              <div className="music-track-inline-player" role="group" aria-label={`Preview player for ${track.title}`}>
                <div className="music-player-transport">
                  <button className="music-player-play" type="button" onClick={() => togglePreview(track)} aria-label={`${isPlaying ? "Pause" : "Play"} preview of ${track.title} by ${track.artist}`} aria-pressed={isPlaying}><PlaybackGlyph playing={isPlaying} /></button>
                </div>
                <time className="music-player-time" dateTime={`PT${Math.floor(isActive ? preview.currentTime : 0)}S`}>{formatPlaybackTime(isActive ? preview.currentTime : 0)}</time>
                <span className="music-player-wave">
                  <Wave seed={track.id} dense progress={isActive ? preview.progress : 0} />
                  <input className="music-player-seek" type="range" min="0" max={isActive && preview.canSeek ? preview.duration : 1} step="0.1" value={isActive ? preview.currentTime : 0} onChange={(event) => preview.seekTo(Number(event.currentTarget.value))} disabled={!isActive || !preview.canSeek} aria-label={`Seek in preview of ${track.title}`} aria-valuetext={`${formatPlaybackTime(isActive ? preview.currentTime : 0)} of ${isActive && preview.canSeek ? formatPlaybackTime(preview.duration) : "not loaded"}`} />
                </span>
                <time className="music-player-time" dateTime={isActive && preview.canSeek ? `PT${Math.floor(preview.duration)}S` : track.durationIso ?? undefined}>{isActive && preview.canSeek ? formatPlaybackTime(preview.duration) : track.duration ?? "--:--"}</time>
              </div>
              <div className="music-track-tags"><span>{track.genre}</span><small>{track.moods.slice(0, 2).join(" · ")}</small></div>
              <div className="music-track-actions">
                <button className={liked.has(track.id) ? "is-liked" : ""} type="button" onClick={() => toggleLiked(track.id)} aria-label={`${liked.has(track.id) ? "Unlike" : "Like"} ${track.title}`} aria-pressed={liked.has(track.id)}>{liked.has(track.id) ? "♥" : "♡"}</button>
                <button type="button" aria-label={`Add ${track.title} to a playlist`}>＋</button>
                <button type="button" aria-label={`Download ${track.title}`}>↓</button>
                <button type="button" aria-label={`More options for ${track.title}`}>•••</button>
              </div>
              {hasError && <p className="music-track-preview-error" role="status">Preview unavailable. <a href={track.spotifyUrl} target="_blank" rel="noreferrer">Listen on Spotify</a></p>}
            </article>
          );
        })}
        {source.length === 0 && (
          <div className="music-no-results">
            <strong>No matching tracks yet.</strong>
            <p>Try another category or return to the full music preview.</p>
            <button type="button" onClick={() => { resetFilters(); setView("music"); }}>Show all music</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="creator-music-app">
      <aside className="music-app-sidebar">
        <div className="music-app-brand"><Brand compact /><span>Creator</span></div>

        <nav className="music-app-nav" aria-label="Creator music navigation">
          {navGroups.map((group) => (
            <div className="music-app-nav-section" key={group.label}>
              <span className="music-app-nav-label">{group.label}</span>
              {group.items.map((item) => {
                const badge = item.id === "playlists" ? String(lofiGirlPlaylists.length) : item.id === "liked" && liked.size ? String(liked.size) : undefined;
                return (
                  <button
                    className={view === item.id ? "is-active" : ""}
                    {...(item.mobileSecondary ? { "data-mobile-secondary": "true" } : {})}
                    type="button"
                    onClick={() => setView(item.id)}
                    aria-current={view === item.id ? "page" : undefined}
                    key={item.id}
                  >
                    <i aria-hidden="true">{item.icon}</i><strong>{item.label}</strong>{badge && <small>{badge}</small>}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="music-app-sidebar-bottom">
          <button className="tune-library-button" type="button" onClick={() => setSetupOpen(true)}><span>✦</span><strong>Tune my library</strong><small>Improve recommendations</small></button>
          <div className="music-app-account"><span>DM</span><div><strong>Demo creator</strong><small>Creator plan</small></div><i>•••</i></div>
          <Link href="/">Back to website</Link>
        </div>
      </aside>

      <main className="music-app-main">
        <header className="music-app-topbar">
          <div><span>Symbiome</span><h1>{viewLabels[view]}</h1></div>
          <label className="music-global-search">
            <span aria-hidden="true">⌕</span>
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveUse(null);
                setActivePlaylistId(null);
                setView("music");
              }}
              placeholder="Search by track, artist, genre, mood or theme"
            />
          </label>
          <button className="music-topbar-action" type="button" onClick={() => setView("downloads")}>Downloads</button>
        </header>

        {view === "discover" && (
          <div className="music-library-view">
            <section className="music-discovery-intro">
              <div><p>HUMAN-MADE MUSIC</p><h2>Start with a direction.<br />Find the right track.</h2><span>Browse the catalogue through real genres, moods, themes and artists.</span></div>
              <div className="music-catalogue-proof"><strong>10,000+</strong><span>tracks in the full catalogue</span><i>0 AI-generated</i></div>
            </section>

            <div className="music-discovery-grid">
              <DiscoveryFacet eyebrow="01" title="Genres" items={musicSearchTaxonomy.genres} onSelect={(item) => openFacet("genre", item)} />
              <DiscoveryFacet eyebrow="02" title="Moods" items={musicSearchTaxonomy.moods} onSelect={(item) => openFacet("mood", item)} />
              <DiscoveryFacet eyebrow="03" title="Themes" items={musicSearchTaxonomy.themes.map((theme) => theme.label)} onSelect={(item) => openFacet("theme", item)} />
              <DiscoveryFacet eyebrow="04" title="Artists" items={musicSearchTaxonomy.artists} onSelect={(item) => openFacet("artist", item)} />
            </div>

            <section className="music-shelf" aria-labelledby="project-playlists-title">
              <div className="music-shelf-head"><div><span className="workspace-lofi-kicker">PUBLIC PLAYLISTS FROM <LofiGirlWordmark /></span><h3 id="project-playlists-title">Start with a playlist.</h3><p>Twelve listening directions using the original playlist photography and a genre colour code.</p></div><button type="button" onClick={() => setView("playlists")}>View all playlists</button></div>
              <div className="music-playlist-shelf">
                {lofiGirlPlaylists.slice(0, 8).map((playlist) => <PlaylistCard playlist={playlist} onOpen={openPlaylist} key={playlist.id} />)}
              </div>
            </section>
          </div>
        )}

        {view === "music" && (
          <section className="music-track-browser" aria-labelledby="tracks-title">
            <div className="music-track-browser-head">
              <div>
                <span>MUSIC SEARCH</span>
                <h2 id="tracks-title">{activePlaylist?.title ?? activeTheme?.label ?? (query ? `Results for “${query}”` : "All music")}</h2>
                <p className="music-track-results-status" role="status">{visibleTracks.length} matching preview {visibleTracks.length === 1 ? "track" : "tracks"}</p>
              </div>
              <div className="music-filter-row">
                <label><span>Genre</span><select value={genre} onChange={(event) => setGenre(event.target.value)}>{genres.map((item) => <option key={item}>{item}</option>)}</select></label>
                <label><span>Mood</span><select value={mood} onChange={(event) => setMood(event.target.value)}>{moods.map((item) => <option key={item}>{item}</option>)}</select></label>
                <label><span>Theme</span><select value={activeUse ?? ""} onChange={(event) => setActiveUse((event.target.value || null) as MusicUseSlug | null)}><option value="">All themes</option>{musicSearchTaxonomy.themes.map((theme) => <option value={theme.slug} key={theme.slug}>{theme.label}</option>)}</select></label>
                {(genre !== "All genres" || mood !== "All moods" || activeUse || query) && <button type="button" onClick={resetFilters}>Clear filters</button>}
              </div>
            </div>
            {renderTrackTable(visibleTracks, "Matching music tracks")}
          </section>
        )}

        {view === "liked" && (
          <section className="music-track-browser music-liked-view" aria-labelledby="liked-tracks-title">
            <div className="music-track-browser-head"><div><span>YOUR LIBRARY</span><h2 id="liked-tracks-title">Liked tracks</h2><p className="music-track-results-status" role="status">{likedTracks.length} saved {likedTracks.length === 1 ? "track" : "tracks"}</p></div></div>
            {renderTrackTable(likedTracks, "Liked tracks")}
          </section>
        )}

        {view === "playlists" && <PlaylistLibrary onOpen={openPlaylist} />}
        {view === "downloads" && <DownloadsLibrary />}
        {view === "channels" && <ChannelsView />}
        {view === "licences" && <LicencesView />}
      </main>

      <audio
        ref={preview.audioRef}
        preload="none"
        playsInline
        onPlay={preview.onPlay}
        onPause={preview.onPause}
        onTimeUpdate={preview.onTimeUpdate}
        onLoadedMetadata={preview.onLoadedMetadata}
        onDurationChange={preview.onLoadedMetadata}
        onEnded={preview.onEnded}
        onError={preview.onError}
      />

      {selectedTrack && (
        <section className="workspace-audio-player is-open" aria-label="Track preview player">
          <div className="workspace-player-main">
            <img src={selectedTrack.cover} alt="" width={52} height={52} />
            <span><strong>{selectedTrack.title}</strong><small>{selectedTrack.artist}</small></span>
          </div>
          <div className="music-player-transport" aria-label="Playback controls">
            <button className="music-player-play" type="button" onClick={() => togglePreview(selectedTrack)} aria-label={`${preview.isPlaying ? "Pause" : "Play"} preview of ${selectedTrack.title}`} aria-pressed={preview.isPlaying}><PlaybackGlyph playing={preview.isPlaying} /></button>
          </div>
          <div className="workspace-player-timeline">
            <time className="music-player-time" dateTime={`PT${Math.floor(preview.currentTime)}S`}>{formatPlaybackTime(preview.currentTime)}</time>
            <span className="music-player-wave">
              <Wave seed={selectedTrack.id} dense progress={preview.progress} />
              <input className="music-player-seek" type="range" min="0" max={preview.canSeek ? preview.duration : 1} step="0.1" value={preview.currentTime} onChange={(event) => preview.seekTo(Number(event.currentTarget.value))} disabled={!preview.canSeek} aria-label={`Seek in preview of ${selectedTrack.title}`} aria-valuetext={`${formatPlaybackTime(preview.currentTime)} of ${preview.canSeek ? formatPlaybackTime(preview.duration) : "not loaded"}`} />
            </span>
            <time className="music-player-time" dateTime={preview.canSeek ? `PT${Math.floor(preview.duration)}S` : undefined}>{preview.canSeek ? formatPlaybackTime(preview.duration) : "--:--"}</time>
          </div>
          <div className="workspace-player-actions">
            <button className={liked.has(selectedTrack.id) ? "is-liked" : ""} type="button" onClick={() => toggleLiked(selectedTrack.id)} aria-label={`${liked.has(selectedTrack.id) ? "Unlike" : "Like"} ${selectedTrack.title}`} aria-pressed={liked.has(selectedTrack.id)}>{liked.has(selectedTrack.id) ? "♥" : "♡"}</button>
            <button type="button" aria-label={`Add ${selectedTrack.title} to a playlist`}>＋</button>
            <button type="button" aria-label={`Download ${selectedTrack.title}`}>↓</button>
          </div>
          {preview.errorTrackId === selectedTrack.id && <p className="workspace-player-error" role="status">Preview unavailable. <a href={selectedTrack.spotifyUrl} target="_blank" rel="noreferrer">Listen on Spotify</a></p>}
        </section>
      )}

      {setupOpen && (
        <div className="music-setup-backdrop" role="dialog" aria-modal="true" aria-labelledby="music-setup-title">
          <div className="music-setup-panel">
            <div className="music-setup-intro"><span>FIRST LISTEN</span><h2 id="music-setup-title">Tune the library<br />to your work.</h2><p>Two quick choices help Symbiome put more useful playlists first. You can change this later.</p><button type="button" onClick={closeSetup}>Skip for now</button></div>
            <div className="music-setup-form">
              <section><span>01 · YOUR MAIN ROLE</span><h3>What are you creating as?</h3><div className="music-role-grid">{roles.map((role) => <button className={selectedRole === role ? "is-selected" : ""} type="button" onClick={() => setSelectedRole(role)} key={role}>{role}<i>{selectedRole === role ? "✓" : ""}</i></button>)}</div></section>
              <section><span>02 · WHERE YOU PUBLISH</span><h3>Choose every destination that matters.</h3><div className="music-destination-grid">{destinations.map((destination) => <button className={selectedDestinations.has(destination) ? "is-selected" : ""} type="button" onClick={() => toggleDestination(destination)} key={destination}>{destination}<i>{selectedDestinations.has(destination) ? "✓" : "+"}</i></button>)}</div></section>
              <button className="music-setup-submit" type="button" onClick={closeSetup}>Open my music library</button>
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

function DownloadsLibrary() {
  return <div className="music-secondary-view"><header><span>YOUR LIBRARY</span><h2>Downloads</h2><p>Downloaded masters and licence records will appear here.</p></header><div className="music-empty-library"><strong>No downloads yet.</strong><p>Download a track from Music and it will stay connected to its licence record.</p></div></div>;
}

function ChannelsView() {
  return <div className="music-secondary-view"><header><span>ACCOUNT</span><h2>Channels</h2><p>Creator plans cover the channels and profiles connected to your account.</p></header><section className="music-account-card"><span className="music-account-platform">▶</span><div><strong>Demo Creator Channel</strong><small>YouTube · Connected to Creator plan</small></div><span className="music-account-status">● Connected</span><button type="button">Manage</button></section></div>;
}

function LicencesView() {
  return <div className="music-secondary-view"><header><span>ACCOUNT</span><h2>Licences</h2><p>Keep each track, channel and proof of licence in one place.</p></header><section className="music-account-card"><span className="music-account-platform">◇</span><div><strong>Symbiome · Creator</strong><small>SY-DEMO-2026-0001 · Active since 03 Aug 2026</small></div><span className="music-account-status">● Active</span><button type="button">View licence</button></section></div>;
}

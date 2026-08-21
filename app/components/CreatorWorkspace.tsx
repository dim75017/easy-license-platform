"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { Brand } from "./Brand";
import { LofiGirlWordmark } from "./LofiGirlWordmark";
import { useTrackPreview } from "../hooks/useTrackPreview";
import { catalogApiOrigin, parseCatalogPage, type CatalogPagination } from "../lib/catalog-client";
import {
  lofiGirlPlaylists,
  musicSearchTaxonomy,
  getPlaylistAccent,
  type LofiGirlPlaylist,
  type MusicUseSlug,
  type WorkspaceTrack,
} from "../data/catalog";
import { trackMatchesMood } from "../lib/catalog-moods";
import { isCatalogPlaylistId, type CatalogPlaylistId } from "../lib/catalog-playlists";
import { WorkspaceProfileSwitcher } from "./WorkspaceProfileSwitcher";
import "../workspace-music.css";

type LibraryView = "discover" | "music" | "playlists" | "liked" | "downloads" | "channels" | "licences";
type FacetKind = "genre" | "mood" | "theme" | "artist";
type TrackMenuMode = "actions" | "playlists";
type CatalogLoadState = "loading" | "live" | "fallback";

const libraryViewIds: readonly LibraryView[] = ["discover", "music", "playlists", "liked", "downloads", "channels", "licences"];

function isLibraryView(value: string | null): value is LibraryView {
  return value !== null && libraryViewIds.includes(value as LibraryView);
}

function readLibraryViewFromLocation(): LibraryView {
  const params = new URLSearchParams(window.location.search);
  if (params.get("track")?.trim()) return "music";
  const requestedPlaylist = params.get("playlist")?.trim() ?? "";
  if (requestedPlaylist && isCatalogPlaylistId(requestedPlaylist)) return "playlists";

  const requestedView = params.get("view");
  if (isLibraryView(requestedView)) return requestedView;

  return "discover";
}

function readLibrarySelectionFromLocation(): { mood: string | null; playlist: CatalogPlaylistId | null } {
  const params = new URLSearchParams(window.location.search);
  const requestedPlaylist = params.get("playlist")?.trim() ?? "";
  if (requestedPlaylist && isCatalogPlaylistId(requestedPlaylist)) {
    return { mood: null, playlist: requestedPlaylist };
  }

  const requestedMood = params.get("mood")?.trim() ?? "";
  const mood = musicSearchTaxonomy.moods.find((item) => item.toLocaleLowerCase() === requestedMood.toLocaleLowerCase()) ?? null;
  return { mood, playlist: null };
}

function writeLibraryViewToLocation(view: LibraryView, mode: "push" | "replace") {
  const url = new URL(window.location.href);
  url.searchParams.set("view", view);
  if (view !== "music") {
    url.searchParams.delete("track");
    url.searchParams.delete("mood");
  }
  if (view !== "playlists") url.searchParams.delete("playlist");

  const destination = `${url.pathname}${url.search}${url.hash}`;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (destination === current) return;

  if (mode === "push") window.history.pushState(window.history.state, "", destination);
  else window.history.replaceState(window.history.state, "", destination);
}

function writeLibrarySelectionToLocation(
  selection: { mood?: string | null },
  mode: "push" | "replace" = "replace",
) {
  const url = new URL(window.location.href);
  url.searchParams.set("view", "music");
  url.searchParams.delete("track");
  url.searchParams.delete("mood");
  url.searchParams.delete("playlist");
  if (selection.mood) url.searchParams.set("mood", selection.mood);

  const destination = `${url.pathname}${url.search}${url.hash}`;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (destination === current) return;

  if (mode === "push") window.history.pushState(window.history.state, "", destination);
  else window.history.replaceState(window.history.state, "", destination);
}

function writePlaylistSelectionToLocation(
  playlist: CatalogPlaylistId | null,
  mode: "push" | "replace" = "replace",
) {
  const url = new URL(window.location.href);
  url.searchParams.set("view", "playlists");
  url.searchParams.delete("track");
  url.searchParams.delete("mood");
  url.searchParams.delete("playlist");
  if (playlist) url.searchParams.set("playlist", playlist);

  const destination = `${url.pathname}${url.search}${url.hash}`;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (destination === current) return;

  if (mode === "push") window.history.pushState(window.history.state, "", destination);
  else window.history.replaceState(window.history.state, "", destination);
}

type PersonalPlaylist = {
  id: string;
  name: string;
  trackIds: string[];
};

type TrackMenuState = {
  trackId: string;
  x: number;
  y: number;
  mode: TrackMenuMode;
};

const defaultPersonalPlaylist: PersonalPlaylist = { id: "my-playlist", name: "My playlist", trackIds: [] };
const trackControlSelector = "button, a, input, select, textarea, [role='menu'], [role='dialog']";
const catalogFetchCredentials: RequestCredentials = catalogApiOrigin ? "omit" : "same-origin";
const CATALOG_PAGE_SIZE = 40;
const RECENT_RELEASE_LIMIT = 8;

type CatalogFilters = {
  query: string;
  genre: string;
  mood: string;
  theme: MusicUseSlug | null;
  playlist: CatalogPlaylistId | null;
};

function catalogFilterSignature(filters: CatalogFilters): string {
  return JSON.stringify({
    q: filters.query.trim(),
    genre: filters.genre,
    mood: filters.mood,
    theme: filters.theme,
    playlist: filters.playlist,
  });
}

function catalogRequestUrl({
  page,
  pageSize = CATALOG_PAGE_SIZE,
  filters,
  onePerRelease = false,
  trackId = null,
}: {
  page: number;
  pageSize?: number;
  filters?: CatalogFilters;
  onePerRelease?: boolean;
  trackId?: number | null;
}): string {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (filters?.query.trim()) params.set("q", filters.query.trim());
  if (filters && filters.genre !== "All genres") params.set("genre", filters.genre);
  if (filters && filters.mood !== "All moods") params.set("mood", filters.mood);
  if (filters?.theme) params.set("theme", filters.theme);
  if (filters?.playlist) params.set("playlist", filters.playlist);
  if (onePerRelease) params.set("onePerRelease", "true");
  if (trackId !== null) params.set("trackId", String(trackId));
  return `${catalogApiOrigin}/api/catalog/tracks?${params.toString()}`;
}

function mergeTrackPages(
  current: readonly WorkspaceTrack[],
  incoming: readonly WorkspaceTrack[],
): WorkspaceTrack[] {
  const merged = new Map(current.map((track) => [track.id, track]));
  for (const track of incoming) merged.set(track.id, track);
  return [...merged.values()];
}

function catalogNumericTrackId(trackId: string): number | null {
  const match = /^CATALOG-(\d+)$/u.exec(trackId);
  if (!match) return null;
  const numericId = Number(match[1]);
  return Number.isSafeInteger(numericId) && numericId > 0 ? numericId : null;
}

function isStoredTrackId(value: unknown): value is string {
  return typeof value === "string"
    && value.length > 0
    && value.length <= 160
    && !/[\u0000-\u001f\u007f]/u.test(value);
}

function releaseMeta(track: WorkspaceTrack): string {
  const release = track.release;
  if (!release) return `${track.genre}${track.moods[0] ? ` · ${track.moods[0]}` : ""}`;
  const parts = [release.type.charAt(0).toUpperCase() + release.type.slice(1)];
  if (release.releaseDate) parts.push(release.releaseDate);
  if (release.trackCount) parts.push(`${release.trackCount} ${release.trackCount === 1 ? "track" : "tracks"}`);
  return parts.join(" · ");
}

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
    ],
  },
];

const viewLabels: Record<LibraryView, string> = {
  discover: "Discover",
  music: "Music",
  playlists: "Playlists",
  liked: "Liked tracks",
  downloads: "Downloads",
  channels: "Channels",
  licences: "Licences",
};

const Wave = memo(function Wave({ seed, dense = false, progress = 0 }: { seed: string; dense?: boolean; progress?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const clampedProgress = Math.max(0, Math.min(1, progress));
  const progressRef = useRef(clampedProgress);
  progressRef.current = clampedProgress;

  const drawWave = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (width <= 0 || height <= 0) return;

    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const targetWidth = Math.max(1, Math.round(width * pixelRatio));
    const targetHeight = Math.max(1, Math.round(height * pixelRatio));
    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    }

    const context = canvas.getContext("2d");
    if (!context) return;

    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, width, height);

    const styles = getComputedStyle(canvas);
    const baseColor = styles.color;
    const playedColor = styles.getPropertyValue("--wm-clay").trim() || "#e06343";
    const seedValue = Array.from(seed).reduce((hash, character) => ((hash * 31) + character.charCodeAt(0)) >>> 0, 7);
    const pitch = dense ? 5 : 7.5;
    const barWidth = 2.25;
    const snappedBarWidth = Math.max(1, Math.round(barWidth * pixelRatio)) / pixelRatio;
    const count = Math.max(1, Math.floor(width / pitch));
    const playedBars = Math.round(progressRef.current * count);

    for (let index = 0; index < count; index += 1) {
      const position = count > 1 ? index / (count - 1) : 0;
      const fastDetail = Math.abs(Math.sin((index + seedValue) * .613));
      const midDetail = Math.abs(Math.sin((index + seedValue) * .173 + 1.4));
      const slowEnvelope = .66 + Math.abs(Math.sin((index + seedValue) * .041 + .8)) * .34;
      const tailFloor = width < 180 ? .22 : .12;
      const tail = position > .86 ? Math.max(tailFloor, (1 - position) / .14) : 1;
      const amplitude = Math.max(.22, Math.min(1, (.3 + fastDetail * .42 + midDetail * .31) * slowEnvelope * tail));
      const barHeight = Math.max(2, Math.round(height * amplitude * pixelRatio) / pixelRatio);
      const x = Math.round(index * pitch * pixelRatio) / pixelRatio;
      const y = Math.round(((height - barHeight) / 2) * pixelRatio) / pixelRatio;

      context.globalAlpha = index < playedBars ? 1 : .18;
      context.fillStyle = index < playedBars ? playedColor : baseColor;
      context.fillRect(x, y, snappedBarWidth, barHeight);
    }

    context.globalAlpha = 1;
  }, [dense, seed]);

  useEffect(() => {
    drawWave();
  }, [clampedProgress, drawWave]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", drawWave);
      return () => window.removeEventListener("resize", drawWave);
    }
    const observer = new ResizeObserver(drawWave);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [drawWave]);

  return <canvas className="music-wave" ref={canvasRef} aria-hidden="true" data-density={dense ? "dense" : "compact"} />;
});

function PlaybackGlyph({ playing }: { playing: boolean }) {
  return <span className="music-player-icon" data-state={playing ? "pause" : "play"} aria-hidden="true" />;
}

function VolumeGlyph({ muted }: { muted: boolean }) {
  return <span className="music-volume-icon" data-muted={muted ? "true" : "false"} aria-hidden="true" />;
}

function TrackActionIcon({ kind, active = false }: { kind: "like" | "playlist" | "download" | "share"; active?: boolean }) {
  return (
    <span className={`music-action-icon music-action-${kind}`} data-active={active ? "true" : "false"} aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" focusable="false">
        {kind === "like" && <path fill={active ? "currentColor" : "none"} d="M20.8 4.7a5.5 5.5 0 0 0-7.8 0L12 5.8l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.4 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />}
        {kind === "playlist" && <><path d="M4 6h10M4 12h8M4 18h6" /><path d="M18 12v8M14 16h8" /></>}
        {kind === "download" && <><path d="M12 3v12M8 11l4 4 4-4" /><path d="M5 18v2h14v-2" /></>}
        {kind === "share" && <><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4" /></>}
      </svg>
    </span>
  );
}

function TrackActionPopover({
  state,
  track,
  liked,
  personalPlaylists,
  onClose,
  onToggleLike,
  onShowPlaylists,
  onAddToPlaylist,
  onCreatePlaylist,
  onDownload,
  onShare,
  canDownload,
}: {
  state: TrackMenuState;
  track: WorkspaceTrack;
  liked: boolean;
  personalPlaylists: readonly PersonalPlaylist[];
  onClose: (restoreFocus?: boolean) => void;
  onToggleLike: () => void;
  onShowPlaylists: () => void;
  onAddToPlaylist: (playlistId: string) => void;
  onCreatePlaylist: (name: string) => void;
  onDownload: () => void;
  onShare: () => void;
  canDownload: boolean;
}) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: state.x, y: state.y });
  const [newPlaylistName, setNewPlaylistName] = useState("");

  useEffect(() => {
    const popover = popoverRef.current;
    if (!popover) return;
    const rect = popover.getBoundingClientRect();
    const gutter = 12;
    const nextX = Math.max(gutter, Math.min(state.x, window.innerWidth - rect.width - gutter));
    const preferredY = state.y + rect.height > window.innerHeight - gutter ? state.y - rect.height : state.y;
    const nextY = Math.max(gutter, Math.min(preferredY, window.innerHeight - rect.height - gutter));
    setPosition({ x: nextX, y: nextY });
    popover.querySelector<HTMLButtonElement>("button:not([disabled])")?.focus();
  }, [state.mode, state.x, state.y]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!popoverRef.current?.contains(event.target as Node)) onClose(false);
    };
    const handleViewportChange = (event: Event) => {
      if (event.target instanceof Node && popoverRef.current?.contains(event.target)) return;
      onClose(false);
    };
    document.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [onClose]);

  function handleMenuKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const buttons = [...(popoverRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ?? [])];
    const currentIndex = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === "Escape") {
      event.preventDefault();
      onClose(true);
      return;
    }
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key) || buttons.length === 0) return;
    event.preventDefault();
    if (event.key === "Home") buttons[0]?.focus();
    else if (event.key === "End") buttons.at(-1)?.focus();
    else {
      const direction = event.key === "ArrowDown" ? 1 : -1;
      buttons[(currentIndex + direction + buttons.length) % buttons.length]?.focus();
    }
  }

  return (
    <div
      id="music-track-context-menu"
      className="music-track-context-menu"
      role={state.mode === "actions" ? "menu" : "dialog"}
      aria-label={state.mode === "actions" ? `Actions for ${track.title}` : `Add ${track.title} to a playlist`}
      style={{ left: position.x, top: position.y }}
      ref={popoverRef}
      onKeyDown={handleMenuKeyDown}
    >
      <header><strong>{state.mode === "actions" ? track.title : "Add to playlist"}</strong><small>{state.mode === "actions" ? track.artist : track.title}</small></header>
      {state.mode === "actions" ? (
        <div className="music-track-context-options">
          <button role="menuitemcheckbox" aria-checked={liked} type="button" onClick={() => { onToggleLike(); onClose(true); }}><TrackActionIcon kind="like" active={liked} /><span>{liked ? "Remove from liked tracks" : "Like track"}</span></button>
          <button role="menuitem" type="button" onClick={onShowPlaylists}><TrackActionIcon kind="playlist" /><span>Add to playlist</span></button>
          <button role="menuitem" type="button" disabled={!canDownload} title={canDownload ? undefined : "Listening copy unavailable"} onClick={() => { onDownload(); onClose(true); }}><TrackActionIcon kind="download" /><span>{canDownload ? "Download listening copy" : "Download unavailable"}</span></button>
          <button role="menuitem" type="button" onClick={() => { onShare(); onClose(true); }}><TrackActionIcon kind="share" /><span>Copy track link</span></button>
        </div>
      ) : (
        <>
          <div className="music-track-context-options music-track-playlist-options">
            {personalPlaylists.map((playlist) => {
              const containsTrack = playlist.trackIds.includes(track.id);
              return <button aria-pressed={containsTrack} type="button" onClick={() => { onAddToPlaylist(playlist.id); onClose(true); }} key={playlist.id}><TrackActionIcon kind="playlist" active={containsTrack} /><span><strong>{playlist.name}</strong><small>{containsTrack ? "Remove from playlist" : `${playlist.trackIds.length} ${playlist.trackIds.length === 1 ? "track" : "tracks"}`}</small></span></button>;
            })}
          </div>
          <form className="music-track-new-playlist" onSubmit={(event) => { event.preventDefault(); const name = newPlaylistName.trim(); if (name) { onCreatePlaylist(name); onClose(true); } }}>
            <label><span>New playlist</span><input value={newPlaylistName} onChange={(event) => setNewPlaylistName(event.target.value)} placeholder="Playlist name" maxLength={48} /></label>
            <button type="submit" disabled={!newPlaylistName.trim()}>Create & add</button>
          </form>
        </>
      )}
    </div>
  );
}

function formatPlaybackTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "--:--";
  const wholeSeconds = Math.floor(seconds);
  const minutes = Math.floor(wholeSeconds / 60);
  return `${minutes}:${String(wholeSeconds % 60).padStart(2, "0")}`;
}

function isTrackControl(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest(trackControlSelector));
}

function createTrackShareUrl(trackId: string) {
  const appPath = window.location.pathname.replace(/\/app\/?$/u, "/app") || "/app";
  const url = new URL(appPath, window.location.origin);
  url.searchParams.set("track", trackId);
  return url.toString();
}

function copyTextFallback(value: string) {
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.readOnly = true;
  textarea.setAttribute("aria-hidden", "true");
  textarea.style.position = "fixed";
  textarea.style.inset = "-9999px auto auto -9999px";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, value.length);
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
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
  const [activePlaylistId, setActivePlaylistId] = useState<CatalogPlaylistId | null>(null);
  const [liked, setLiked] = useState<Set<string>>(() => new Set());
  const [likedReady, setLikedReady] = useState(false);
  const [personalPlaylists, setPersonalPlaylists] = useState<PersonalPlaylist[]>(() => [defaultPersonalPlaylist]);
  const [downloadedTrackIds, setDownloadedTrackIds] = useState<Set<string>>(() => new Set());
  const [libraryActionsReady, setLibraryActionsReady] = useState(false);
  const [trackMenu, setTrackMenu] = useState<TrackMenuState | null>(null);
  const [actionStatus, setActionStatus] = useState("");
  const [catalogTracks, setCatalogTracks] = useState<readonly WorkspaceTrack[] | null>(null);
  const [catalogKnownTracks, setCatalogKnownTracks] = useState<readonly WorkspaceTrack[]>([]);
  const [catalogPagination, setCatalogPagination] = useState<CatalogPagination | null>(null);
  const [catalogResolvedSignature, setCatalogResolvedSignature] = useState<string | null>(null);
  const [recentCatalogTracks, setRecentCatalogTracks] = useState<readonly WorkspaceTrack[] | null>(null);
  const [recentCatalogTotal, setRecentCatalogTotal] = useState(0);
  const [recentCatalogRequestFailed, setRecentCatalogRequestFailed] = useState(false);
  const [catalogLoadState, setCatalogLoadState] = useState<CatalogLoadState>("loading");
  const [catalogBusy, setCatalogBusy] = useState(true);
  const [catalogLoadingMore, setCatalogLoadingMore] = useState(false);
  const [catalogLoadMoreFailed, setCatalogLoadMoreFailed] = useState(false);
  const [catalogInfiniteScrollSupported, setCatalogInfiniteScrollSupported] = useState<boolean | null>(null);
  const [catalogRequestFailed, setCatalogRequestFailed] = useState(false);
  const [catalogRetryNonce, setCatalogRetryNonce] = useState(0);
  const [highlightedTrackId, setHighlightedTrackId] = useState<string | null>(null);
  const trackMenuOpenerRef = useRef<HTMLElement | null>(null);
  const sharedTrackHandledRef = useRef<string | null>(null);
  const activeViewRef = useRef<LibraryView>("discover");
  const loadMoreControllerRef = useRef<AbortController | null>(null);
  const catalogLoadMoreSentinelRef = useRef<HTMLDivElement | null>(null);
  const catalogHasLoadedRef = useRef(false);
  const catalogRequestGenerationRef = useRef(0);
  const catalogResolvedSignatureRef = useRef<string | null>(null);
  const preview = useTrackPreview();
  const catalogFilters = useMemo<CatalogFilters>(
    () => ({ query, genre, mood, theme: activeUse, playlist: activePlaylistId }),
    [activePlaylistId, activeUse, genre, mood, query],
  );
  const catalogQuerySignature = useMemo(() => catalogFilterSignature(catalogFilters), [catalogFilters]);
  const catalogQuerySignatureRef = useRef(catalogQuerySignature);
  catalogQuerySignatureRef.current = catalogQuerySignature;
  const catalogViewIsCurrent = catalogResolvedSignature === catalogQuerySignature;
  const libraryTracks = catalogTracks ?? [];
  const knownTracks = catalogLoadState === "live" ? catalogKnownTracks : [];
  const knownTracksRef = useRef(knownTracks);
  knownTracksRef.current = knownTracks;
  const recentTracks = recentCatalogTracks ?? [];
  const activePlaylist = useMemo(
    () => lofiGirlPlaylists.find((playlist) => playlist.id === activePlaylistId) ?? null,
    [activePlaylistId],
  );
  const availableGenres = useMemo(
    () => ["All genres", ...new Set([...musicSearchTaxonomy.genres, ...knownTracks.map((track) => track.genre)])],
    [knownTracks],
  );
  const availableMoods = useMemo(
    () => ["All moods", ...new Set([...musicSearchTaxonomy.moods, ...knownTracks.flatMap((track) => track.moods)])],
    [knownTracks],
  );

  useEffect(() => {
    const syncViewFromLocation = () => {
      const nextView = readLibraryViewFromLocation();
      const selection = readLibrarySelectionFromLocation();
      activeViewRef.current = nextView;
      setView(nextView);
      setActivePlaylistId(selection.playlist);
      setMood(selection.mood ?? "All moods");
      if (selection.playlist || selection.mood) {
        setGenre("All genres");
        setActiveUse(null);
        setQuery("");
      }
      writeLibraryViewToLocation(nextView, "replace");
    };

    syncViewFromLocation();
    const handlePopState = () => syncViewFromLocation();
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => () => loadMoreControllerRef.current?.abort(), []);

  useEffect(() => {
    setCatalogInfiniteScrollSupported("IntersectionObserver" in window);
  }, []);

  useEffect(() => {
    const requestGeneration = ++catalogRequestGenerationRef.current;
    const requestSignature = catalogQuerySignature;
    const preservesCurrentPage = catalogResolvedSignatureRef.current === requestSignature;
    const controller = new AbortController();
    loadMoreControllerRef.current?.abort();
    loadMoreControllerRef.current = null;
    setCatalogBusy(true);
    setCatalogLoadingMore(false);
    setCatalogLoadMoreFailed(false);
    setCatalogRequestFailed(false);
    if (!preservesCurrentPage) {
      catalogResolvedSignatureRef.current = null;
      setCatalogResolvedSignature(null);
      setCatalogTracks([]);
      setCatalogPagination(null);
    }
    if (!catalogHasLoadedRef.current) setCatalogLoadState("loading");

    const delay = query.trim() ? 250 : 0;
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(catalogRequestUrl({ page: 1, filters: catalogFilters }), {
          cache: "no-store",
          credentials: catalogFetchCredentials,
          headers: { accept: "application/json" },
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Catalogue request failed");

        const page = parseCatalogPage(await response.json());
        if (!page || page.view !== "tracks") throw new Error("Catalogue response was invalid");
        if (catalogRequestGenerationRef.current !== requestGeneration || catalogQuerySignatureRef.current !== requestSignature) return;

        setCatalogTracks(page.tracks);
        setCatalogKnownTracks((current) => mergeTrackPages(current, page.tracks));
        setCatalogPagination(page.pagination);
        catalogResolvedSignatureRef.current = requestSignature;
        setCatalogResolvedSignature(requestSignature);
        setCatalogLoadState("live");
        setCatalogRequestFailed(false);
        catalogHasLoadedRef.current = true;
      } catch (error) {
        if (
          (error instanceof DOMException && error.name === "AbortError")
          || catalogRequestGenerationRef.current !== requestGeneration
          || catalogQuerySignatureRef.current !== requestSignature
        ) return;
        setCatalogRequestFailed(true);
        if (!catalogHasLoadedRef.current) {
          setCatalogTracks([]);
          setCatalogPagination(null);
          setCatalogLoadState("fallback");
        } else {
          setCatalogLoadState("live");
          setActionStatus(
            preservesCurrentPage
              ? "The catalogue update failed. The last loaded results are still shown."
              : "The matching catalogue view could not be loaded. Retry when you are ready.",
          );
        }
      } finally {
        if (!controller.signal.aborted && catalogRequestGenerationRef.current === requestGeneration) setCatalogBusy(false);
      }
    }, delay);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [catalogFilters, catalogQuerySignature, catalogRetryNonce, query]);

  useEffect(() => {
    const controller = new AbortController();
    setRecentCatalogRequestFailed(false);

    async function loadRecentReleases() {
      try {
        const response = await fetch(catalogRequestUrl({
          page: 1,
          pageSize: RECENT_RELEASE_LIMIT,
          onePerRelease: true,
        }), {
          cache: "no-store",
          credentials: catalogFetchCredentials,
          headers: { accept: "application/json" },
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Recent catalogue request failed");
        const page = parseCatalogPage(await response.json());
        if (!page || page.view !== "releases") throw new Error("Recent catalogue response was invalid");
        setRecentCatalogTracks(page.tracks);
        setRecentCatalogTotal(page.pagination.total);
        setRecentCatalogRequestFailed(false);
        setCatalogKnownTracks((current) => mergeTrackPages(current, page.tracks));
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setRecentCatalogTracks(null);
          setRecentCatalogRequestFailed(true);
        }
      }
    }

    void loadRecentReleases();
    return () => controller.abort();
  }, [catalogRetryNonce]);

  useEffect(() => {
    if (catalogLoadState === "loading") return;
    const trackId = new URLSearchParams(window.location.search).get("track")?.trim() ?? "";
    if (!trackId || sharedTrackHandledRef.current === trackId) return;

    const controller = new AbortController();
    const openSharedTrack = (track: WorkspaceTrack) => {
      setGenre("All genres");
      setMood("All moods");
      setActiveUse(null);
      setActivePlaylistId(null);
      setQuery("");
      setCatalogTracks((current) => current === null ? current : [track, ...current.filter((item) => item.id !== track.id)]);
      setHighlightedTrackId(track.id);
      activeViewRef.current = "music";
      setView("music");
      setActionStatus(`${track.title} opened from a shared link. Press play to listen.`);
    };

    const availableTrack = knownTracksRef.current.find((track) => track.id === trackId);
    if (availableTrack) {
      sharedTrackHandledRef.current = trackId;
      openSharedTrack(availableTrack);
      return () => controller.abort();
    }

    const numericTrackId = catalogNumericTrackId(trackId);
    if (numericTrackId === null) {
      sharedTrackHandledRef.current = trackId;
      setActionStatus("This shared track is not available in the active catalogue.");
      return () => controller.abort();
    }
    if (catalogLoadState !== "live") {
      setActionStatus("The live catalogue is temporarily unavailable. Retry to open this shared track.");
      return () => controller.abort();
    }

    async function resolveSharedTrack() {
      try {
        const response = await fetch(catalogRequestUrl({ page: 1, pageSize: 1, trackId: numericTrackId }), {
          cache: "no-store",
          credentials: catalogFetchCredentials,
          headers: { accept: "application/json" },
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Shared track request failed");
        const page = parseCatalogPage(await response.json());
        const sharedTrack = page?.tracks[0];
        if (!sharedTrack) {
          sharedTrackHandledRef.current = trackId;
          setActionStatus("This shared track is not available in the active catalogue.");
          return;
        }
        sharedTrackHandledRef.current = trackId;
        setCatalogKnownTracks((current) => mergeTrackPages(current, [sharedTrack]));
        openSharedTrack(sharedTrack);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setCatalogRequestFailed(true);
        setActionStatus("This shared track could not be loaded. Retry the live catalogue to try again.");
      }
    }

    void resolveSharedTrack();
    return () => controller.abort();
  }, [catalogLoadState, catalogRetryNonce]);

  useEffect(() => {
    if (!highlightedTrackId || view !== "music") return;
    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        const row = [...document.querySelectorAll<HTMLElement>("[data-track-id]")]
          .find((element) => element.dataset.trackId === highlightedTrackId);
        if (!row) return;
        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        row.scrollIntoView({ block: "center", behavior: reducedMotion ? "auto" : "smooth" });
        row.focus({ preventScroll: true });
      });
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
    };
  }, [highlightedTrackId, view]);

  useEffect(() => {
    if (!activePlaylistId || view !== "playlists") return;
    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        const hero = document.getElementById("music-playlist-detail-hero");
        if (!hero) return;
        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        hero.focus({ preventScroll: true });
        hero.scrollIntoView({ block: "start", behavior: reducedMotion ? "auto" : "smooth" });
      });
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
    };
  }, [activePlaylistId, view]);

  useEffect(() => {
    try {
      const storedLiked = JSON.parse(window.localStorage.getItem("symbiome-liked-tracks") ?? "[]") as unknown;
      if (Array.isArray(storedLiked)) setLiked(new Set(storedLiked.filter(isStoredTrackId)));
    } catch { /* Ignore only the malformed liked-tracks key. */ }
    try {
      const storedPlaylists = JSON.parse(window.localStorage.getItem("symbiome-personal-playlists-v1") ?? "[]") as unknown;
      if (Array.isArray(storedPlaylists)) {
        const validPlaylists = storedPlaylists.flatMap((item): PersonalPlaylist[] => {
          if (!item || typeof item !== "object") return [];
          const record = item as Record<string, unknown>;
          if (!isStoredTrackId(record.id) || typeof record.name !== "string" || !record.name.trim() || !Array.isArray(record.trackIds)) return [];
          return [{ id: record.id, name: record.name.trim().slice(0, 48), trackIds: [...new Set(record.trackIds.filter(isStoredTrackId))] }];
        });
        if (validPlaylists.length) setPersonalPlaylists(validPlaylists);
      }
    } catch { /* Ignore only the malformed personal-playlists key. */ }
    try {
      const storedDownloads = JSON.parse(window.localStorage.getItem("symbiome-preview-downloads-v1") ?? "[]") as unknown;
      if (Array.isArray(storedDownloads)) setDownloadedTrackIds(new Set(storedDownloads.filter(isStoredTrackId)));
    } catch { /* Ignore only the malformed downloads key. */ }
    setLikedReady(true);
    setLibraryActionsReady(true);
  }, []);

  useEffect(() => {
    if (!likedReady) return;
    try { window.localStorage.setItem("symbiome-liked-tracks", JSON.stringify([...liked])); } catch { /* Storage can be unavailable in previews. */ }
  }, [liked, likedReady]);

  useEffect(() => {
    if (!libraryActionsReady) return;
    try {
      window.localStorage.setItem("symbiome-personal-playlists-v1", JSON.stringify(personalPlaylists));
      window.localStorage.setItem("symbiome-preview-downloads-v1", JSON.stringify([...downloadedTrackIds]));
    } catch { /* Storage can be unavailable in previews. */ }
  }, [downloadedTrackIds, libraryActionsReady, personalPlaylists]);

  const closeTrackMenu = useCallback((restoreFocus = false) => {
    setTrackMenu(null);
    if (restoreFocus && trackMenuOpenerRef.current) requestAnimationFrame(() => trackMenuOpenerRef.current?.focus());
  }, []);

  useEffect(() => {
    closeTrackMenu(false);
  }, [activePlaylistId, activeUse, closeTrackMenu, genre, mood, query, view]);

  useEffect(() => {
    if (!actionStatus) return;
    const timeout = window.setTimeout(() => setActionStatus(""), 5000);
    return () => window.clearTimeout(timeout);
  }, [actionStatus]);

  const visibleTracks = useMemo(() => {
    if (catalogLoadState === "live") {
      return catalogViewIsCurrent && catalogTracks !== null ? catalogTracks : [];
    }
    const needle = query.trim().toLowerCase();
    return libraryTracks.filter((track) => {
      const themeLabels = track.themes.map((slug) => musicSearchTaxonomy.themes.find((theme) => theme.slug === slug)?.label ?? slug);
      const haystack = `${track.title} ${track.artist} ${track.genre} ${track.moods.join(" ")} ${themeLabels.join(" ")}`.toLowerCase();
      return (!needle || haystack.includes(needle))
        && (genre === "All genres" || track.genre === genre)
        && (mood === "All moods" || trackMatchesMood(track.moods, mood))
        && (!activeUse || track.themes.includes(activeUse));
    });
  }, [activeUse, catalogLoadState, catalogTracks, catalogViewIsCurrent, genre, libraryTracks, mood, query]);

  const likedTracks = useMemo(() => knownTracks.filter((track) => liked.has(track.id)), [knownTracks, liked]);
  const downloadedTracks = useMemo(() => knownTracks.filter((track) => downloadedTrackIds.has(track.id)), [downloadedTrackIds, knownTracks]);
  const selectedTrack = knownTracks.find((track) => track.id === preview.activeTrackId);
  const menuTrack = trackMenu ? knownTracks.find((track) => track.id === trackMenu.trackId) : undefined;
  useEffect(() => {
    if (preview.activeTrackId && !knownTracks.some((track) => track.id === preview.activeTrackId)) preview.stop();
  }, [knownTracks, preview.activeTrackId, preview.stop]);

  const loadMoreCatalog = useCallback(async () => {
    const nextPage = catalogPagination?.nextPage;
    if (
      catalogLoadState !== "live"
      || !catalogViewIsCurrent
      || catalogBusy
      || catalogRequestFailed
      || typeof nextPage !== "number"
      || catalogLoadingMore
      || loadMoreControllerRef.current !== null
    ) return;

    const requestGeneration = catalogRequestGenerationRef.current;
    const requestSignature = catalogQuerySignature;
    const controller = new AbortController();
    loadMoreControllerRef.current = controller;
    setCatalogLoadMoreFailed(false);
    setCatalogLoadingMore(true);
    try {
      const response = await fetch(catalogRequestUrl({ page: nextPage, filters: catalogFilters }), {
        cache: "no-store",
        credentials: catalogFetchCredentials,
        headers: { accept: "application/json" },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("Catalogue page request failed");
      const page = parseCatalogPage(await response.json());
      if (!page || page.view !== "tracks" || page.pagination.page !== nextPage) throw new Error("Catalogue page response was invalid");
      if (
        catalogRequestGenerationRef.current !== requestGeneration
        || catalogQuerySignatureRef.current !== requestSignature
        || catalogResolvedSignatureRef.current !== requestSignature
      ) return;

      setCatalogTracks((current) => mergeTrackPages(current ?? [], page.tracks));
      setCatalogKnownTracks((current) => mergeTrackPages(current, page.tracks));
      setCatalogPagination(page.pagination);
      setCatalogLoadMoreFailed(false);
    } catch (error) {
      if (
        (error instanceof DOMException && error.name === "AbortError")
        || catalogRequestGenerationRef.current !== requestGeneration
        || catalogQuerySignatureRef.current !== requestSignature
        || catalogResolvedSignatureRef.current !== requestSignature
      ) return;
      setCatalogLoadMoreFailed(true);
      setActionStatus("The next catalogue page could not be loaded right now.");
    } finally {
      if (loadMoreControllerRef.current === controller) {
        loadMoreControllerRef.current = null;
        setCatalogLoadingMore(false);
      }
    }
  }, [
    catalogBusy,
    catalogFilters,
    catalogLoadingMore,
    catalogLoadState,
    catalogPagination?.nextPage,
    catalogQuerySignature,
    catalogRequestFailed,
    catalogViewIsCurrent,
  ]);

  useEffect(() => {
    const catalogueIsVisible = view === "music" || (view === "playlists" && activePlaylistId !== null);
    if (
      !catalogueIsVisible
      || catalogInfiniteScrollSupported !== true
      || catalogLoadState !== "live"
      || !catalogViewIsCurrent
      || catalogBusy
      || catalogRequestFailed
      || catalogLoadMoreFailed
      || catalogLoadingMore
      || !catalogPagination?.hasNextPage
    ) return;

    const sentinel = catalogLoadMoreSentinelRef.current;
    if (!sentinel) return;

    try {
      const observer = new IntersectionObserver(([entry]) => {
        if (entry?.isIntersecting) void loadMoreCatalog();
      }, { rootMargin: "720px 0px", threshold: 0 });
      observer.observe(sentinel);
      return () => observer.disconnect();
    } catch {
      setCatalogInfiniteScrollSupported(false);
    }
  }, [
    activePlaylistId,
    catalogBusy,
    catalogInfiniteScrollSupported,
    catalogLoadMoreFailed,
    catalogLoadingMore,
    catalogLoadState,
    catalogPagination?.hasNextPage,
    catalogRequestFailed,
    catalogViewIsCurrent,
    loadMoreCatalog,
    view,
  ]);

  function resetFilters() {
    setGenre("All genres");
    setMood("All moods");
    setActiveUse(null);
    setActivePlaylistId(null);
    setQuery("");
    if (activeViewRef.current === "music") writeLibrarySelectionToLocation({});
  }

  function navigateToView(nextView: LibraryView) {
    const historyMode = activeViewRef.current === nextView ? "replace" : "push";
    activeViewRef.current = nextView;
    if (nextView !== "playlists" && activePlaylistId !== null) setActivePlaylistId(null);
    setView(nextView);
    writeLibraryViewToLocation(nextView, historyMode);
  }

  function showMusic() {
    navigateToView("music");
  }

  function openPlaylist(playlist: LofiGirlPlaylist) {
    if (!isCatalogPlaylistId(playlist.id)) return;
    activeViewRef.current = "playlists";
    setView("playlists");
    setActivePlaylistId(playlist.id);
    setActiveUse(null);
    setGenre("All genres");
    setMood("All moods");
    setQuery("");
    writePlaylistSelectionToLocation(playlist.id, "push");
  }

  function closePlaylist() {
    setActivePlaylistId(null);
    writePlaylistSelectionToLocation(null, "push");
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
    writeLibrarySelectionToLocation({ mood: kind === "mood" ? value : null });
  }

  function togglePreview(track: WorkspaceTrack) {
    setHighlightedTrackId(track.id);
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

  function openTrackMenu(track: WorkspaceTrack, x: number, y: number, mode: TrackMenuMode, opener: HTMLElement | null = null) {
    trackMenuOpenerRef.current = opener;
    setTrackMenu({ trackId: track.id, x, y, mode });
  }

  function openPlaylistChooser(track: WorkspaceTrack, opener: HTMLButtonElement) {
    const rect = opener.getBoundingClientRect();
    openTrackMenu(track, rect.right - 240, rect.bottom + 8, "playlists", opener);
  }

  function addTrackToPlaylist(track: WorkspaceTrack, playlistId: string) {
    const target = personalPlaylists.find((playlist) => playlist.id === playlistId);
    const removing = target?.trackIds.includes(track.id) ?? false;
    setPersonalPlaylists((current) => current.map((playlist) => playlist.id !== playlistId ? playlist : { ...playlist, trackIds: removing ? playlist.trackIds.filter((id) => id !== track.id) : [...playlist.trackIds, track.id] }));
    setActionStatus(removing ? `${track.title} removed from ${target?.name ?? "playlist"}.` : `${track.title} added to ${target?.name ?? "playlist"}.`);
  }

  function createPlaylistWithTrack(track: WorkspaceTrack, name: string) {
    const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `playlist-${Date.now()}`;
    setPersonalPlaylists((current) => [...current, { id, name, trackIds: [track.id] }]);
    setActionStatus(`${name} created with ${track.title}.`);
  }

  async function downloadTrackPreview(track: WorkspaceTrack) {
    const downloadUrl = track.previewDownloadUrl === undefined ? track.previewUrl : track.previewDownloadUrl;
    if (!downloadUrl) {
      setActionStatus(`A licensed download is not available for ${track.title} yet.`);
      return;
    }
    setActionStatus(`Preparing ${track.title}.`);
    try {
      const response = await fetch(downloadUrl);
      if (!response.ok) throw new Error("Preview download failed");
      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.startsWith("audio/") && contentType !== "application/octet-stream") throw new Error("Unexpected preview format");
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `${track.artist} - ${track.title}.mp3`.replace(/[\\/:*?"<>|]/g, "-");
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      setDownloadedTrackIds((current) => new Set(current).add(track.id));
      setActionStatus(`${track.title} downloaded. The WAV master remains reserved for licensed downloads.`);
    } catch {
      setActionStatus(`${track.title} could not be downloaded right now.`);
    }
  }

  async function shareTrack(track: WorkspaceTrack) {
    const shareUrl = createTrackShareUrl(track.id);
    let copied = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        copied = true;
      }
    } catch { /* Fall through to the DOM copy path below. */ }

    if (!copied) copied = copyTextFallback(shareUrl);
    if (copied) {
      setActionStatus(`Link to ${track.title} copied.`);
      return;
    }

    window.prompt("Copy this track link", shareUrl);
    setActionStatus(`The link to ${track.title} is ready to copy.`);
  }

  function renderTrackTable(source: readonly WorkspaceTrack[], label: string): ReactNode {
    return (
      <div className="music-track-table" role="list" aria-label={label}>
        <div className="music-track-table-head" aria-hidden="true">
          <span>Track</span><span>Player</span><span>Genre</span><span>Mood</span><span>Actions</span>
        </div>
        {source.map((track) => {
          const isActive = preview.activeTrackId === track.id;
          const isPlaying = isActive && preview.isPlaying;
          const hasError = preview.errorTrackId === track.id;
          const isHighlighted = highlightedTrackId === track.id;
          return (
            <article
              className={`music-track-row${isActive || isHighlighted ? " is-selected" : ""}${isHighlighted ? " is-highlighted" : ""}${hasError ? " has-preview-error" : ""}`}
              role="listitem"
              tabIndex={0}
              data-track-id={track.id}
              aria-label={`${isPlaying ? "Pause" : "Play"} ${track.title} by ${track.artist}`}
              aria-current={isHighlighted ? "true" : undefined}
              onClick={(event) => {
                if (isTrackControl(event.target)) return;
                togglePreview(track);
              }}
              onKeyDown={(event) => {
                if (event.target !== event.currentTarget) return;
                if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
                  event.preventDefault();
                  const rect = event.currentTarget.getBoundingClientRect();
                  openTrackMenu(track, rect.left + Math.min(rect.width - 12, 280), rect.top + 48, "actions", event.currentTarget);
                  return;
                }
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                togglePreview(track);
              }}
              onContextMenu={(event) => {
                if (isTrackControl(event.target)) return;
                event.preventDefault();
                openTrackMenu(track, event.clientX, event.clientY, "actions", event.currentTarget);
              }}
              key={track.id}
            >
              <div className="music-track-identity">
                {track.cover ? <img src={track.cover} alt="" width={64} height={64} loading="lazy" decoding="async" /> : <span className="music-track-cover-placeholder" aria-hidden="true">♪</span>}
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
              <div className="music-track-taxonomy music-track-genre"><small className="music-track-taxonomy-label">Genre</small><span>{track.genre}</span></div>
              <div className="music-track-taxonomy music-track-mood"><small className="music-track-taxonomy-label">Mood</small><span>{track.moods.slice(0, 2).join(" · ")}</span></div>
              <div className="music-track-actions">
                <button className={liked.has(track.id) ? "is-liked" : ""} type="button" onClick={() => toggleLiked(track.id)} aria-label={`${liked.has(track.id) ? "Unlike" : "Like"} ${track.title}`} aria-pressed={liked.has(track.id)}><TrackActionIcon kind="like" active={liked.has(track.id)} /></button>
                <button type="button" onClick={(event) => openPlaylistChooser(track, event.currentTarget)} aria-label={`Add ${track.title} to a playlist`} aria-haspopup="menu" aria-controls="music-track-context-menu" aria-expanded={trackMenu?.trackId === track.id && trackMenu.mode === "playlists"}><TrackActionIcon kind="playlist" /></button>
                <button className={downloadedTrackIds.has(track.id) ? "is-downloaded" : ""} type="button" disabled={track.previewDownloadUrl === null} title={track.previewDownloadUrl === null ? "Licensed download unavailable" : undefined} onClick={() => void downloadTrackPreview(track)} aria-label={track.previewDownloadUrl === null ? `Licensed download unavailable for ${track.title}` : `Download preview of ${track.title}${downloadedTrackIds.has(track.id) ? " again" : ""}`}><TrackActionIcon kind="download" /></button>
                <button type="button" onClick={() => void shareTrack(track)} aria-label={`Copy link to ${track.title}`}><TrackActionIcon kind="share" /></button>
              </div>
              {hasError && <p className="music-track-preview-error" role="status">Playback unavailable.{track.spotifyUrl && <> <a href={track.spotifyUrl} target="_blank" rel="noreferrer">Listen on Spotify</a></>}</p>}
            </article>
          );
        })}
        {source.length === 0 && (
          <div className="music-no-results">
            <strong>No matching tracks yet.</strong>
            <p>Try another category or return to the full music preview.</p>
            <button type="button" onClick={() => { resetFilters(); navigateToView("music"); }}>Show all music</button>
          </div>
        )}
      </div>
    );
  }

  const playlistCatalogueStatus = activePlaylist && (catalogLoadState !== "live" || !catalogViewIsCurrent || catalogRequestFailed) ? (
    <p className="music-track-results-status music-playlist-detail-status" role="status" aria-live="polite">
      <span>
        {catalogLoadState === "loading"
          ? `Loading ${activePlaylist.title}...`
          : catalogLoadState === "live"
            ? !catalogViewIsCurrent
              ? catalogBusy
                ? `Loading tracks from ${activePlaylist.title}...`
                : catalogRequestFailed
                  ? "This playlist could not be loaded. Retry when you are ready."
                  : "Preparing this playlist..."
              : "Update failed, previous results kept."
            : "This playlist is temporarily unavailable. Retry to load it."}
      </span>
      {catalogRequestFailed && <button className="cta-swipe" type="button" onClick={() => setCatalogRetryNonce((value) => value + 1)}>Retry playlist</button>}
    </p>
  ) : null;

  const playlistCataloguePager = activePlaylist && catalogLoadState === "live" && catalogViewIsCurrent && catalogPagination?.hasNextPage ? (
    <div className="music-catalogue-load-more" ref={catalogLoadMoreSentinelRef}>
      {(catalogInfiniteScrollSupported === false || catalogLoadMoreFailed) && !catalogRequestFailed && (
        <button className="cta-swipe" type="button" onClick={() => void loadMoreCatalog()} disabled={catalogLoadingMore}>
          {catalogLoadingMore
            ? "Loading more..."
            : catalogLoadMoreFailed
              ? "Retry loading more tracks"
              : `Load ${Math.min(CATALOG_PAGE_SIZE, Math.max(1, catalogPagination.total - (catalogPagination.page * catalogPagination.pageSize)))} more tracks`}
        </button>
      )}
      {(catalogLoadingMore || catalogLoadMoreFailed) && (
        <span role="status" aria-live="polite">
          {catalogLoadingMore ? "Loading more tracks..." : "Automatic loading paused. Retry to continue."}
        </span>
      )}
    </div>
  ) : null;

  const usesWideCanvas = view === "discover" || view === "music" || view === "playlists" || view === "liked";

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
                    onClick={() => navigateToView(item.id)}
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

      </aside>

      <main className="music-app-main">
        <header className={`music-app-topbar${usesWideCanvas ? " is-wide" : ""}`}>
          <div><span>Symbiome</span><h1>{viewLabels[view]}</h1></div>
          <WorkspaceProfileSwitcher
            activeRole="creator"
            compact
            activeLibraryView={view === "channels" || view === "licences" ? view : undefined}
            onOpenLibraryView={navigateToView}
          />
        </header>

        {view === "discover" && (
          <div className="music-library-view music-workspace-view">
            <section className="music-discovery-intro">
              <div><p>HUMAN-MADE MUSIC</p><h2>Start with a direction.<br />Find the right track.</h2><span>Browse the catalogue through real genres, moods, themes and artists.</span></div>
              <div className="music-catalogue-proof"><strong>10,000+</strong><span>tracks in the full catalogue</span><i>0 AI-generated</i></div>
            </section>

            <section className="music-recent-releases" aria-labelledby="recent-releases-title">
              <div className="music-recent-head">
                <div>
                  <span>NEW IN THE CATALOGUE</span>
                  <h3 id="recent-releases-title">Recent releases</h3>
                  <p role="status" aria-live="polite">
                    {recentCatalogTracks !== null
                      ? `${recentTracks.length} latest ${recentTracks.length === 1 ? "release" : "releases"} from ${recentCatalogTotal} published ${recentCatalogTotal === 1 ? "release" : "releases"}.`
                      : recentCatalogRequestFailed
                        ? "The live catalogue is temporarily unavailable. Retry to load it."
                        : "Loading the latest releases from the live catalogue."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => recentCatalogRequestFailed
                    ? setCatalogRetryNonce((value) => value + 1)
                    : navigateToView("music")}
                >
                  {recentCatalogRequestFailed ? "Retry live catalogue" : "Browse all music"}
                </button>
              </div>
              <div className="music-recent-grid" role="list" aria-label="Recent catalogue releases">
                {recentTracks.map((track) => {
                  const isActive = preview.activeTrackId === track.id;
                  const isPlaying = isActive && preview.isPlaying;
                  return (
                    <article className={isActive ? "is-active" : ""} role="listitem" key={track.release?.id ?? track.id}>
                      <button className="music-recent-cover" type="button" onClick={() => togglePreview(track)} aria-label={`${isPlaying ? "Pause" : "Play"} ${track.title} from ${track.release?.title ?? track.title} by ${track.artist}`} aria-pressed={isPlaying}>
                        {track.cover ? <img src={track.cover} alt="" width={420} height={420} loading="lazy" decoding="async" /> : <span className="music-recent-cover-placeholder" aria-hidden="true">♪</span>}
                        <span className="music-recent-play"><PlaybackGlyph playing={isPlaying} /></span>
                      </button>
                      <div className="music-recent-copy"><strong>{track.release?.title ?? track.title}</strong><span>{track.artist}</span><small>{releaseMeta(track)}</small></div>
                      <button className="music-recent-share" type="button" onClick={() => void shareTrack(track)} aria-label={`Copy link to ${track.title}`}><TrackActionIcon kind="share" /></button>
                    </article>
                  );
                })}
              </div>
            </section>

            <div className="music-discovery-grid">
              <DiscoveryFacet eyebrow="01" title="Genres" items={musicSearchTaxonomy.genres} onSelect={(item) => openFacet("genre", item)} />
              <DiscoveryFacet eyebrow="02" title="Moods" items={musicSearchTaxonomy.moods} onSelect={(item) => openFacet("mood", item)} />
              <DiscoveryFacet eyebrow="03" title="Themes" items={musicSearchTaxonomy.themes.map((theme) => theme.label)} onSelect={(item) => openFacet("theme", item)} />
              <DiscoveryFacet eyebrow="04" title="Artists" items={musicSearchTaxonomy.artists} onSelect={(item) => openFacet("artist", item)} />
            </div>

            <section className="music-shelf" aria-labelledby="project-playlists-title">
              <div className="music-shelf-head"><div><span className="workspace-lofi-kicker">PUBLIC PLAYLISTS FROM <LofiGirlWordmark /></span><h3 id="project-playlists-title">Start with a playlist.</h3><p>Twelve listening directions using the original playlist photography and a genre colour code.</p></div><button type="button" onClick={() => navigateToView("playlists")}>View all playlists</button></div>
              <div className="music-playlist-shelf">
                {lofiGirlPlaylists.slice(0, 8).map((playlist) => <PlaylistCard playlist={playlist} onOpen={openPlaylist} key={playlist.id} />)}
              </div>
            </section>
          </div>
        )}

        {view === "music" && (
          <section className="music-track-browser music-workspace-view" aria-label="Music catalogue">
            <div className="music-track-browser-head music-track-browser-controls">
              <label className="music-global-search music-library-search">
                <span aria-hidden="true">⌕</span>
                <input
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setActiveUse(null);
                    setActivePlaylistId(null);
                    writeLibrarySelectionToLocation({});
                  }}
                  aria-label="Search the music library"
                  placeholder="Search by track, artist, genre, mood or theme"
                />
              </label>
              <div className="music-filter-row">
                {activePlaylist && <span className="music-active-playlist-filter">Playlist · {activePlaylist.title}</span>}
                <label><span>Genre</span><select value={genre} onChange={(event) => { setGenre(event.target.value); setActivePlaylistId(null); writeLibrarySelectionToLocation({}); }}>{availableGenres.map((item) => <option key={item}>{item}</option>)}</select></label>
                <label><span>Mood</span><select value={mood} onChange={(event) => { const value = event.target.value; setMood(value); setActivePlaylistId(null); writeLibrarySelectionToLocation({ mood: value === "All moods" ? null : value }); }}>{availableMoods.map((item) => <option key={item}>{item}</option>)}</select></label>
                <label><span>Theme</span><select value={activeUse ?? ""} onChange={(event) => { setActiveUse((event.target.value || null) as MusicUseSlug | null); setActivePlaylistId(null); writeLibrarySelectionToLocation({}); }}><option value="">All themes</option>{musicSearchTaxonomy.themes.map((theme) => <option value={theme.slug} key={theme.slug}>{theme.label}</option>)}</select></label>
                {(genre !== "All genres" || mood !== "All moods" || activeUse || activePlaylist || query) && <button type="button" onClick={resetFilters}>Clear filters</button>}
                {catalogRequestFailed && <button type="button" onClick={() => setCatalogRetryNonce((value) => value + 1)}>Retry live catalogue</button>}
              </div>
            </div>
            {(catalogLoadState !== "live" || !catalogViewIsCurrent || catalogRequestFailed) && (
              <p className="music-track-results-status" role="status" aria-live="polite">
                {catalogLoadState === "loading"
                  ? "Loading the live catalogue..."
                  : catalogLoadState === "live"
                    ? !catalogViewIsCurrent
                      ? catalogBusy
                        ? "Loading tracks for the current filters..."
                        : catalogRequestFailed
                          ? "The current catalogue filters could not be loaded. Retry when you are ready."
                          : "Preparing the current catalogue filters..."
                      : "Update failed, previous results kept."
                    : "The live catalogue is temporarily unavailable. Retry to load it."}
              </p>
            )}
            {renderTrackTable(visibleTracks, "Matching music tracks")}
            {catalogLoadState === "live" && catalogViewIsCurrent && catalogPagination?.hasNextPage && (
              <div className="music-catalogue-load-more" ref={catalogLoadMoreSentinelRef}>
                {(catalogInfiniteScrollSupported === false || catalogLoadMoreFailed) && !catalogRequestFailed && (
                  <button className="cta-swipe" type="button" onClick={() => void loadMoreCatalog()} disabled={catalogLoadingMore}>
                    {catalogLoadingMore
                      ? "Loading more..."
                      : catalogLoadMoreFailed
                        ? "Retry loading more tracks"
                        : `Load ${Math.min(CATALOG_PAGE_SIZE, Math.max(1, catalogPagination.total - (catalogPagination.page * catalogPagination.pageSize)))} more tracks`}
                  </button>
                )}
                {(catalogLoadingMore || catalogLoadMoreFailed) && (
                  <span role="status" aria-live="polite">
                    {catalogLoadingMore ? "Loading more tracks..." : "Automatic loading paused. Retry to continue."}
                  </span>
                )}
              </div>
            )}
          </section>
        )}

        {view === "liked" && (
          <section className="music-track-browser music-liked-view music-workspace-view" aria-labelledby="liked-tracks-title">
            <div className="music-track-browser-head"><div><span>YOUR LIBRARY</span><h2 id="liked-tracks-title">Liked tracks</h2><p className="music-track-results-status" role="status">{likedTracks.length} loaded of {liked.size} saved {liked.size === 1 ? "track" : "tracks"}</p></div></div>
            {renderTrackTable(likedTracks, "Liked tracks")}
          </section>
        )}

        {view === "playlists" && (
          <PlaylistLibrary
            activePlaylist={activePlaylist}
            cataloguePager={playlistCataloguePager}
            catalogueStatus={playlistCatalogueStatus}
            onBack={closePlaylist}
            onOpen={openPlaylist}
            personalPlaylists={personalPlaylists}
            trackCount={activePlaylist && catalogViewIsCurrent ? catalogPagination?.total ?? visibleTracks.length : null}
            trackList={activePlaylist && catalogViewIsCurrent ? renderTrackTable(visibleTracks, `${activePlaylist.title} tracks`) : null}
          />
        )}
        {view === "downloads" && <DownloadsLibrary tracks={downloadedTracks} savedCount={downloadedTrackIds.size} />}
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
            {selectedTrack.cover ? <img src={selectedTrack.cover} alt="" width={52} height={52} /> : <span className="music-track-cover-placeholder" aria-hidden="true">♪</span>}
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
            <div className="workspace-player-volume" role="group" aria-label="Volume">
              <button className="music-player-volume-toggle" type="button" onClick={preview.toggleMute} aria-label={preview.isMuted ? "Unmute preview" : "Mute preview"} aria-pressed={preview.isMuted}><VolumeGlyph muted={preview.isMuted} /></button>
              <input className="music-player-volume-range" type="range" min="0" max="1" step="0.01" value={preview.isMuted ? 0 : preview.volume} onChange={(event) => preview.setVolume(Number(event.currentTarget.value))} aria-label="Preview volume" aria-valuetext={`${Math.round((preview.isMuted ? 0 : preview.volume) * 100)} percent`} />
            </div>
          </div>
          <div className="workspace-player-actions">
            <button className={liked.has(selectedTrack.id) ? "is-liked" : ""} type="button" onClick={() => toggleLiked(selectedTrack.id)} aria-label={`${liked.has(selectedTrack.id) ? "Unlike" : "Like"} ${selectedTrack.title}`} aria-pressed={liked.has(selectedTrack.id)}><TrackActionIcon kind="like" active={liked.has(selectedTrack.id)} /></button>
            <button type="button" onClick={(event) => openPlaylistChooser(selectedTrack, event.currentTarget)} aria-label={`Add ${selectedTrack.title} to a playlist`} aria-haspopup="menu" aria-controls="music-track-context-menu" aria-expanded={trackMenu?.trackId === selectedTrack.id && trackMenu.mode === "playlists"}><TrackActionIcon kind="playlist" /></button>
            <button className={downloadedTrackIds.has(selectedTrack.id) ? "is-downloaded" : ""} type="button" disabled={selectedTrack.previewDownloadUrl === null} title={selectedTrack.previewDownloadUrl === null ? "Licensed download unavailable" : undefined} onClick={() => void downloadTrackPreview(selectedTrack)} aria-label={selectedTrack.previewDownloadUrl === null ? `Licensed download unavailable for ${selectedTrack.title}` : `Download preview of ${selectedTrack.title}${downloadedTrackIds.has(selectedTrack.id) ? " again" : ""}`}><TrackActionIcon kind="download" /></button>
            <button type="button" onClick={() => void shareTrack(selectedTrack)} aria-label={`Copy link to ${selectedTrack.title}`}><TrackActionIcon kind="share" /></button>
          </div>
          {preview.errorTrackId === selectedTrack.id && <p className="workspace-player-error" role="status">Playback unavailable.{selectedTrack.spotifyUrl && <> <a href={selectedTrack.spotifyUrl} target="_blank" rel="noreferrer">Listen on Spotify</a></>}</p>}
        </section>
      )}

      {trackMenu && menuTrack && (
        <TrackActionPopover
          state={trackMenu}
          track={menuTrack}
          liked={liked.has(menuTrack.id)}
          personalPlaylists={personalPlaylists}
          onClose={closeTrackMenu}
          onToggleLike={() => toggleLiked(menuTrack.id)}
          onShowPlaylists={() => setTrackMenu((current) => current ? { ...current, mode: "playlists" } : current)}
          onAddToPlaylist={(playlistId) => addTrackToPlaylist(menuTrack, playlistId)}
          onCreatePlaylist={(name) => createPlaylistWithTrack(menuTrack, name)}
          onDownload={() => void downloadTrackPreview(menuTrack)}
          onShare={() => void shareTrack(menuTrack)}
          canDownload={menuTrack.previewDownloadUrl !== null}
        />
      )}

      <div className="music-action-status" role="status" aria-live="polite" aria-atomic="true">{actionStatus}</div>
    </div>
  );
}

function PlaylistLibrary({
  activePlaylist,
  cataloguePager,
  catalogueStatus,
  onBack,
  onOpen,
  personalPlaylists,
  trackCount,
  trackList,
}: {
  activePlaylist: LofiGirlPlaylist | null;
  cataloguePager: ReactNode;
  catalogueStatus: ReactNode;
  onBack: () => void;
  onOpen: (playlist: LofiGirlPlaylist) => void;
  personalPlaylists: readonly PersonalPlaylist[];
  trackCount: number | null;
  trackList: ReactNode;
}) {
  const accent = activePlaylist ? getPlaylistAccent(activePlaylist) : null;
  const style = activePlaylist && accent ? {
    "--playlist-accent": accent.color,
    "--playlist-accent-ink": accent.ink,
    "--playlist-position": activePlaylist.imagePosition ?? "center",
  } as CSSProperties : undefined;

  return (
    <div className={`music-secondary-view music-playlists-view music-workspace-view${activePlaylist ? " is-playlist-detail" : ""}`}>
      {activePlaylist ? (
        <>
          <section id="music-playlist-detail-hero" className="music-playlist-detail-hero" style={style} aria-labelledby="music-playlist-detail-title" tabIndex={-1}>
            <img className="music-playlist-detail-photo" src={activePlaylist.image} alt="" width={1600} height={1200} loading="eager" fetchPriority="high" decoding="async" />
            <span className="music-playlist-detail-shade" aria-hidden="true" />
            <button className="music-playlist-detail-back" type="button" onClick={onBack}><span aria-hidden="true">←</span> All playlists</button>
            <div className="music-playlist-detail-copy">
              <span className="music-playlist-detail-kicker">SYMBIOME PLAYLIST · {activePlaylist.genre}</span>
              <h2 id="music-playlist-detail-title">{activePlaylist.title}</h2>
              <p>{activePlaylist.description}</p>
              <div className="music-playlist-detail-meta" aria-label="Playlist details">
                {activePlaylist.moods.map((item) => <span key={item}>{item}</span>)}
                {trackCount !== null && <strong>{trackCount} {trackCount === 1 ? "track" : "tracks"}</strong>}
              </div>
            </div>
          </section>
          <section className="music-playlist-detail-tracks" aria-labelledby="music-playlist-tracks-title">
            <div className="music-playlist-detail-track-head"><span>IN THIS PLAYLIST</span><h3 id="music-playlist-tracks-title">Tracks</h3></div>
            {catalogueStatus}
            {trackList}
            {cataloguePager}
          </section>
        </>
      ) : (
        <>
          <section className="music-personal-playlists" aria-labelledby="personal-playlists-title">
            <div><span>YOUR PLAYLISTS</span><h3 id="personal-playlists-title">Saved directions</h3></div>
            <div>{personalPlaylists.map((playlist) => <article key={playlist.id}><TrackActionIcon kind="playlist" /><span><strong>{playlist.name}</strong><small>{playlist.trackIds.length} {playlist.trackIds.length === 1 ? "track" : "tracks"}</small></span></article>)}</div>
          </section>
          <div className="music-secondary-playlists">{lofiGirlPlaylists.map((playlist) => <PlaylistCard playlist={playlist} onOpen={onOpen} key={playlist.id} />)}</div>
        </>
      )}
    </div>
  );
}

function DownloadsLibrary({ tracks, savedCount }: { tracks: readonly WorkspaceTrack[]; savedCount: number }) {
  return <div className="music-secondary-view">{savedCount > tracks.length && <p className="music-track-results-status music-downloads-sync-status" role="status" aria-live="polite">{tracks.length} loaded of {savedCount} saved downloads. Other saved IDs remain intact while catalogue pages load.</p>}{tracks.length ? <div className="music-download-list">{tracks.map((track) => <article key={track.id}><TrackActionIcon kind="download" />{track.cover ? <img src={track.cover} alt="" width={45} height={45} /> : <span className="music-track-cover-placeholder" aria-hidden="true">♪</span>}<span><strong>{track.title}</strong><small>{track.artist}</small></span><span>{track.genre}</span><strong>Listening copy</strong></article>)}</div> : <div className="music-empty-library"><strong>{savedCount ? "Saved downloads are outside the loaded pages." : "No downloads yet."}</strong><p>{savedCount ? "Browse or search the catalogue to load their track details without losing the saved IDs." : "Download a track from Music and it will appear here."}</p></div>}</div>;
}

function ChannelsView() {
  return <div className="music-secondary-view"><header><span>ACCOUNT</span><h2>Channels</h2><p>Creator plans cover the channels and profiles connected to your account.</p></header><section className="music-account-card"><span className="music-account-platform">▶</span><div><strong>Demo Creator Channel</strong><small>YouTube · Connected to Creator plan</small></div><span className="music-account-status">● Connected</span><button type="button">Manage</button></section></div>;
}

function LicencesView() {
  return <div className="music-secondary-view"><header><span>ACCOUNT</span><h2>Licences</h2><p>Keep each track, channel and proof of licence in one place.</p></header><section className="music-account-card"><span className="music-account-platform">◇</span><div><strong>Symbiome · Creator</strong><small>SY-DEMO-2026-0001 · Active since 03 Aug 2026</small></div><span className="music-account-status">● Active</span><button type="button">View licence</button></section></div>;
}

"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { Brand } from "./Brand";
import { LofiGirlWordmark } from "./LofiGirlWordmark";
import { useTrackPreview } from "../hooks/useTrackPreview";
import { parseCatalogPage } from "../lib/catalog-client";
import {
  lofiGirlPlaylists,
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
type TrackMenuMode = "actions" | "playlists";
type CatalogLoadState = "loading" | "live" | "fallback";

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

function TrackActionIcon({ kind, active = false }: { kind: "like" | "playlist" | "download"; active?: boolean }) {
  if (kind === "like") return <span className="music-action-icon music-action-like" data-active={active ? "true" : "false"} aria-hidden="true" />;
  if (kind === "playlist") return <span className="music-action-icon music-action-playlist" aria-hidden="true"><i /><b /></span>;
  return <span className="music-action-icon music-action-download" aria-hidden="true"><i /><b /></span>;
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
          <button role="menuitem" type="button" disabled={!canDownload} title={canDownload ? undefined : "Licensed download unavailable"} onClick={() => { onDownload(); onClose(true); }}><TrackActionIcon kind="download" /><span>{canDownload ? "Download preview" : "Download unavailable"}</span></button>
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
  const [personalPlaylists, setPersonalPlaylists] = useState<PersonalPlaylist[]>(() => [defaultPersonalPlaylist]);
  const [downloadedTrackIds, setDownloadedTrackIds] = useState<Set<string>>(() => new Set());
  const [libraryActionsReady, setLibraryActionsReady] = useState(false);
  const [trackMenu, setTrackMenu] = useState<TrackMenuState | null>(null);
  const [actionStatus, setActionStatus] = useState("");
  const [catalogTracks, setCatalogTracks] = useState<readonly WorkspaceTrack[] | null>(null);
  const [catalogTotal, setCatalogTotal] = useState(0);
  const [catalogLoadState, setCatalogLoadState] = useState<CatalogLoadState>("loading");
  const trackMenuOpenerRef = useRef<HTMLButtonElement | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState("Creator");
  const [selectedDestinations, setSelectedDestinations] = useState<Set<string>>(() => new Set(["YouTube"]));
  const preview = useTrackPreview();
  const libraryTracks = catalogTracks?.length ? catalogTracks : workspaceTracks;
  const availableGenres = useMemo(() => ["All genres", ...new Set(libraryTracks.map((track) => track.genre))], [libraryTracks]);
  const availableMoods = useMemo(() => ["All moods", ...new Set(libraryTracks.flatMap((track) => track.moods))], [libraryTracks]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadCatalog() {
      try {
        const response = await fetch("/api/catalog/tracks?page=1&pageSize=30", {
          cache: "no-store",
          credentials: "same-origin",
          headers: { accept: "application/json" },
          signal: controller.signal,
        });
        if (!response.ok) {
          setCatalogLoadState("fallback");
          return;
        }

        const page = parseCatalogPage(await response.json());
        if (!page || page.tracks.length === 0) {
          setCatalogLoadState("fallback");
          return;
        }

        setCatalogTracks(page.tracks);
        setCatalogTotal(page.total);
        setCatalogLoadState("live");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setCatalogLoadState("fallback");
      }
    }

    void loadCatalog();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const knownTrackIds = new Set(libraryTracks.map((track) => track.id));
    try { if (!window.localStorage.getItem("easy-license-library-tuned")) setSetupOpen(true); } catch { setSetupOpen(true); }
    try {
      const storedLiked = JSON.parse(window.localStorage.getItem("symbiome-liked-tracks") ?? "[]") as unknown;
      if (Array.isArray(storedLiked)) setLiked(new Set(storedLiked.filter((id): id is string => typeof id === "string" && knownTrackIds.has(id))));
    } catch { /* Ignore only the malformed liked-tracks key. */ }
    try {
      const storedPlaylists = JSON.parse(window.localStorage.getItem("symbiome-personal-playlists-v1") ?? "[]") as unknown;
      if (Array.isArray(storedPlaylists)) {
        const validPlaylists = storedPlaylists.flatMap((item): PersonalPlaylist[] => {
          if (!item || typeof item !== "object") return [];
          const record = item as Record<string, unknown>;
          if (typeof record.id !== "string" || typeof record.name !== "string" || !Array.isArray(record.trackIds)) return [];
          return [{ id: record.id, name: record.name.slice(0, 48), trackIds: [...new Set(record.trackIds.filter((id): id is string => typeof id === "string" && knownTrackIds.has(id)))] }];
        });
        if (validPlaylists.length) setPersonalPlaylists(validPlaylists);
      }
    } catch { /* Ignore only the malformed personal-playlists key. */ }
    try {
      const storedDownloads = JSON.parse(window.localStorage.getItem("symbiome-preview-downloads-v1") ?? "[]") as unknown;
      if (Array.isArray(storedDownloads)) setDownloadedTrackIds(new Set(storedDownloads.filter((id): id is string => typeof id === "string" && knownTrackIds.has(id))));
    } catch { /* Ignore only the malformed downloads key. */ }
    setLikedReady(true);
    setLibraryActionsReady(true);
  }, [libraryTracks]);

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
  }, [activeUse, closeTrackMenu, genre, mood, query, view]);

  useEffect(() => {
    if (!actionStatus) return;
    const timeout = window.setTimeout(() => setActionStatus(""), 5000);
    return () => window.clearTimeout(timeout);
  }, [actionStatus]);

  const visibleTracks = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return libraryTracks.filter((track) => {
      const themeLabels = track.themes.map((slug) => musicSearchTaxonomy.themes.find((theme) => theme.slug === slug)?.label ?? slug);
      const haystack = `${track.title} ${track.artist} ${track.genre} ${track.moods.join(" ")} ${themeLabels.join(" ")}`.toLowerCase();
      return (!needle || haystack.includes(needle))
        && (genre === "All genres" || track.genre === genre)
        && (mood === "All moods" || track.moods.includes(mood))
        && (!activeUse || track.themes.includes(activeUse));
    });
  }, [activeUse, genre, libraryTracks, mood, query]);

  const likedTracks = useMemo(() => libraryTracks.filter((track) => liked.has(track.id)), [libraryTracks, liked]);
  const downloadedTracks = useMemo(() => libraryTracks.filter((track) => downloadedTrackIds.has(track.id)), [downloadedTrackIds, libraryTracks]);
  const selectedTrack = libraryTracks.find((track) => track.id === preview.activeTrackId);
  const menuTrack = trackMenu ? libraryTracks.find((track) => track.id === trackMenu.trackId) : undefined;
  const activePlaylist = lofiGirlPlaylists.find((playlist) => playlist.id === activePlaylistId);
  const activeTheme = musicSearchTaxonomy.themes.find((theme) => theme.slug === activeUse);

  useEffect(() => {
    if (preview.activeTrackId && !libraryTracks.some((track) => track.id === preview.activeTrackId)) preview.stop();
  }, [libraryTracks, preview.activeTrackId, preview.stop]);

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

  function openTrackMenu(track: WorkspaceTrack, x: number, y: number, mode: TrackMenuMode, opener: HTMLButtonElement | null = null) {
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
    setActionStatus(`Preparing the preview of ${track.title}.`);
    try {
      const response = await fetch(downloadUrl);
      if (!response.ok) throw new Error("Preview download failed");
      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.startsWith("audio/") && contentType !== "application/octet-stream") throw new Error("Unexpected preview format");
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `${track.artist} - ${track.title} (preview).mp3`.replace(/[\\/:*?"<>|]/g, "-");
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      setDownloadedTrackIds((current) => new Set(current).add(track.id));
      setActionStatus(`${track.title} preview downloaded. The licensed master becomes available after checkout.`);
    } catch {
      setActionStatus(`The preview of ${track.title} could not be downloaded. The licensed master is not connected yet.`);
    }
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
          <span>Track</span><span>Player</span><span>Genre</span><span>Mood</span><span>Actions</span>
        </div>
        {source.map((track) => {
          const isActive = preview.activeTrackId === track.id;
          const isPlaying = isActive && preview.isPlaying;
          const hasError = preview.errorTrackId === track.id;
          return (
            <article
              className={`music-track-row${isActive ? " is-selected" : ""}${hasError ? " has-preview-error" : ""}`}
              role="listitem"
              onContextMenu={(event) => {
                if ((event.target as HTMLElement).closest("button, a, input, select, textarea")) return;
                event.preventDefault();
                openTrackMenu(track, event.clientX, event.clientY, "actions");
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
              </div>
              {hasError && <p className="music-track-preview-error" role="status">Playback unavailable.{track.spotifyUrl && <> <a href={track.spotifyUrl} target="_blank" rel="noreferrer">Listen on Spotify</a></>}</p>}
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
        </div>
      </aside>

      <main className="music-app-main">
        <header className={`music-app-topbar${usesWideCanvas ? " is-wide" : ""}`}>
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
          <div className="music-library-view music-workspace-view">
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
          <section className="music-track-browser music-workspace-view" aria-labelledby="tracks-title">
            <div className="music-track-browser-head">
              <div>
                <span>MUSIC SEARCH</span>
                <h2 id="tracks-title">{activePlaylist?.title ?? activeTheme?.label ?? (query ? `Results for “${query}”` : "All music")}</h2>
                <p className="music-track-results-status" role="status" aria-live="polite">
                  {catalogLoadState === "loading"
                    ? "Loading your private catalogue..."
                    : catalogLoadState === "live"
                      ? `${visibleTracks.length} shown from ${catalogTotal} available ${catalogTotal === 1 ? "track" : "tracks"}`
                      : `${visibleTracks.length} matching preview ${visibleTracks.length === 1 ? "track" : "tracks"} · Demo catalogue`}
                </p>
              </div>
              <div className="music-filter-row">
                <label><span>Genre</span><select value={genre} onChange={(event) => setGenre(event.target.value)}>{availableGenres.map((item) => <option key={item}>{item}</option>)}</select></label>
                <label><span>Mood</span><select value={mood} onChange={(event) => setMood(event.target.value)}>{availableMoods.map((item) => <option key={item}>{item}</option>)}</select></label>
                <label><span>Theme</span><select value={activeUse ?? ""} onChange={(event) => setActiveUse((event.target.value || null) as MusicUseSlug | null)}><option value="">All themes</option>{musicSearchTaxonomy.themes.map((theme) => <option value={theme.slug} key={theme.slug}>{theme.label}</option>)}</select></label>
                {(genre !== "All genres" || mood !== "All moods" || activeUse || query) && <button type="button" onClick={resetFilters}>Clear filters</button>}
              </div>
            </div>
            {renderTrackTable(visibleTracks, "Matching music tracks")}
          </section>
        )}

        {view === "liked" && (
          <section className="music-track-browser music-liked-view music-workspace-view" aria-labelledby="liked-tracks-title">
            <div className="music-track-browser-head"><div><span>YOUR LIBRARY</span><h2 id="liked-tracks-title">Liked tracks</h2><p className="music-track-results-status" role="status">{likedTracks.length} saved {likedTracks.length === 1 ? "track" : "tracks"}</p></div></div>
            {renderTrackTable(likedTracks, "Liked tracks")}
          </section>
        )}

        {view === "playlists" && <PlaylistLibrary onOpen={openPlaylist} personalPlaylists={personalPlaylists} />}
        {view === "downloads" && <DownloadsLibrary tracks={downloadedTracks} />}
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
          canDownload={menuTrack.previewDownloadUrl !== null}
        />
      )}

      <div className="music-action-status" role="status" aria-live="polite" aria-atomic="true">{actionStatus}</div>

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

function PlaylistLibrary({ onOpen, personalPlaylists }: { onOpen: (playlist: LofiGirlPlaylist) => void; personalPlaylists: readonly PersonalPlaylist[] }) {
  return <div className="music-secondary-view music-playlists-view music-workspace-view"><header><span className="workspace-lofi-kicker"><LofiGirlWordmark /> LISTENING WORLDS</span><h2>Playlists</h2><p>Twelve distinct directions drawn from the public <LofiGirlWordmark className="lofi-girl-wordmark-inline" /> profile, translated into a Symbiome starting point.</p></header><section className="music-personal-playlists" aria-labelledby="personal-playlists-title"><div><span>YOUR PLAYLISTS</span><h3 id="personal-playlists-title">Saved directions</h3></div><div>{personalPlaylists.map((playlist) => <article key={playlist.id}><TrackActionIcon kind="playlist" /><span><strong>{playlist.name}</strong><small>{playlist.trackIds.length} {playlist.trackIds.length === 1 ? "track" : "tracks"}</small></span></article>)}</div></section><div className="music-secondary-playlists">{lofiGirlPlaylists.map((playlist) => <PlaylistCard playlist={playlist} onOpen={onOpen} key={playlist.id} />)}</div></div>;
}

function DownloadsLibrary({ tracks }: { tracks: readonly WorkspaceTrack[] }) {
  return <div className="music-secondary-view"><header><span>YOUR LIBRARY</span><h2>Downloads</h2><p>Preview downloads are listed here. Licensed masters will replace them when checkout and rights verification are connected.</p></header>{tracks.length ? <div className="music-download-list">{tracks.map((track) => <article key={track.id}><TrackActionIcon kind="download" />{track.cover ? <img src={track.cover} alt="" width={45} height={45} /> : <span className="music-track-cover-placeholder" aria-hidden="true">♪</span>}<span><strong>{track.title}</strong><small>{track.artist}</small></span><span>{track.genre}</span><strong>Preview</strong></article>)}</div> : <div className="music-empty-library"><strong>No downloads yet.</strong><p>Download a preview from Music and it will appear here.</p></div>}</div>;
}

function ChannelsView() {
  return <div className="music-secondary-view"><header><span>ACCOUNT</span><h2>Channels</h2><p>Creator plans cover the channels and profiles connected to your account.</p></header><section className="music-account-card"><span className="music-account-platform">▶</span><div><strong>Demo Creator Channel</strong><small>YouTube · Connected to Creator plan</small></div><span className="music-account-status">● Connected</span><button type="button">Manage</button></section></div>;
}

function LicencesView() {
  return <div className="music-secondary-view"><header><span>ACCOUNT</span><h2>Licences</h2><p>Keep each track, channel and proof of licence in one place.</p></header><section className="music-account-card"><span className="music-account-platform">◇</span><div><strong>Symbiome · Creator</strong><small>SY-DEMO-2026-0001 · Active since 03 Aug 2026</small></div><span className="music-account-status">● Active</span><button type="button">View licence</button></section></div>;
}

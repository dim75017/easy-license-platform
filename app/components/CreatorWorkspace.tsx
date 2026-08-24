"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { preload } from "react-dom";
import { Brand } from "./Brand";
import { LofiGirlWordmark } from "./LofiGirlWordmark";
import { SymbiomeMark } from "./SymbiomeMark";
import { useTrackPreview } from "../hooks/useTrackPreview";
import { catalogApiOrigin, parseCatalogPage, type CatalogPagination } from "../lib/catalog-client";
import {
  deletePersonalPlaylistImage,
  isPersonalPlaylistImageKey,
  loadPersonalPlaylistImage,
  personalPlaylistImageKey,
  preparePersonalPlaylistImage,
  savePersonalPlaylistImage,
} from "../lib/personal-playlist-images";
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
import { BusinessWorkspaceRequest } from "./BusinessWorkspaceRequest";
import { CatalogueMetric } from "./CatalogueMetric";
import "../workspace-music.css";

type WorkspaceRole = "guest" | "creator" | "business";
type LibraryView = "discover" | "music" | "playlists" | "liked" | "downloads" | "channels" | "licences" | "license-song" | "custom-song";
type FacetKind = "genre" | "mood" | "theme" | "artist";
type TrackMenuMode = "actions" | "playlists" | "share";
type TrackMenuPlacement = "auto" | "above";
type CatalogLoadState = "loading" | "live" | "fallback";
type WorkspaceNavigationIcon = "discover" | "music" | "playlists" | "liked" | "downloads" | "license" | "custom";

const creatorLibraryViewIds: readonly LibraryView[] = ["discover", "music", "playlists", "liked", "downloads", "channels", "licences"];
const businessLibraryViewIds: readonly LibraryView[] = ["music", "playlists", "liked", "license-song", "custom-song"];
const guestLibraryViewIds: readonly LibraryView[] = ["discover", "music", "playlists", "liked"];
const libraryViewIds: readonly LibraryView[] = [...creatorLibraryViewIds, "license-song", "custom-song"];

function isLibraryView(value: string | null): value is LibraryView {
  return value !== null && libraryViewIds.includes(value as LibraryView);
}

function readLibraryViewFromLocation(fallbackView: LibraryView = "discover", allowedViews: readonly LibraryView[] = libraryViewIds): LibraryView {
  const params = new URLSearchParams(window.location.search);
  const requestedView = params.get("view");
  if (
    (requestedView === "license-song" || requestedView === "custom-song")
    && allowedViews.includes(requestedView)
  ) return requestedView;
  if (params.get("track")?.trim()) return "music";
  const requestedPlaylist = params.get("playlist")?.trim() ?? "";
  if (requestedPlaylist && isCatalogPlaylistId(requestedPlaylist)) return "playlists";
  if (isStoredTrackId(params.get("myPlaylist")?.trim())) return "playlists";

  if (isLibraryView(requestedView) && allowedViews.includes(requestedView)) return requestedView;

  return fallbackView;
}

function readLibrarySelectionFromLocation(): { mood: string | null; playlist: CatalogPlaylistId | null; personalPlaylist: string | null } {
  const params = new URLSearchParams(window.location.search);
  const requestedPlaylist = params.get("playlist")?.trim() ?? "";
  if (requestedPlaylist && isCatalogPlaylistId(requestedPlaylist)) {
    return { mood: null, playlist: requestedPlaylist, personalPlaylist: null };
  }
  const requestedPersonalPlaylist = params.get("myPlaylist")?.trim() ?? "";
  if (isStoredTrackId(requestedPersonalPlaylist)) {
    return { mood: null, playlist: null, personalPlaylist: requestedPersonalPlaylist };
  }

  const requestedMood = params.get("mood")?.trim() ?? "";
  const mood = musicSearchTaxonomy.moods.find((item) => item.toLocaleLowerCase() === requestedMood.toLocaleLowerCase()) ?? null;
  return { mood, playlist: null, personalPlaylist: null };
}

function writeLibraryViewToLocation(
  view: LibraryView,
  mode: "push" | "replace",
  preserveTrack = view === "music" || view === "license-song",
) {
  const url = new URL(window.location.href);
  url.searchParams.set("view", view);
  if (!preserveTrack) {
    url.searchParams.delete("track");
  }
  if (view !== "music") {
    url.searchParams.delete("mood");
  }
  if (view !== "playlists") {
    url.searchParams.delete("playlist");
    url.searchParams.delete("myPlaylist");
  }

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
  url.searchParams.delete("myPlaylist");
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
  url.searchParams.delete("myPlaylist");
  if (playlist) url.searchParams.set("playlist", playlist);

  const destination = `${url.pathname}${url.search}${url.hash}`;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (destination === current) return;

  if (mode === "push") window.history.pushState(window.history.state, "", destination);
  else window.history.replaceState(window.history.state, "", destination);
}

function writePersonalPlaylistSelectionToLocation(
  playlist: string | null,
  mode: "push" | "replace" = "replace",
) {
  const url = new URL(window.location.href);
  url.searchParams.set("view", "playlists");
  url.searchParams.delete("track");
  url.searchParams.delete("mood");
  url.searchParams.delete("playlist");
  url.searchParams.delete("myPlaylist");
  if (playlist) url.searchParams.set("myPlaylist", playlist);

  const destination = `${url.pathname}${url.search}${url.hash}`;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (destination === current) return;

  if (mode === "push") window.history.pushState(window.history.state, "", destination);
  else window.history.replaceState(window.history.state, "", destination);
}

type PersonalPlaylist = {
  id: string;
  name: string;
  description: string;
  imageKey: string | null;
  trackIds: string[];
};

type PersonalPlaylistDraft = {
  name: string;
  description: string;
  image: Blob | null;
};

type TrackMenuState = {
  trackId: string;
  x: number;
  y: number;
  mode: TrackMenuMode;
  placement: TrackMenuPlacement;
  personalPlaylistId: string | null;
};

type PersonalPlaylistMenuState = {
  playlistId: string;
  x: number;
  y: number;
};

const defaultPersonalPlaylist: PersonalPlaylist = { id: "my-playlist", name: "My playlist", description: "", imageKey: null, trackIds: [] };
const trackControlSelector = "button, a, input, select, textarea, [role='menu'], [role='dialog']";
const trackPopoverFocusableSelector = "button:not([disabled]), a[href], input:not([disabled])";
const catalogFetchCredentials: RequestCredentials = catalogApiOrigin ? "omit" : "same-origin";
const CATALOG_PAGE_SIZE = 40;
const RECENT_RELEASE_LIMIT = 8;
const RECENT_RELEASE_BUFFER = 24;
const PERSONAL_PLAYLIST_DESCRIPTION_LIMIT = 280;
const VISIBLE_COVER_PRELOAD_LIMIT = 8;

const personalPlaylistImageUrlCache = new Map<string, string>();
const personalPlaylistImagePromiseCache = new Map<string, Promise<string | null>>();
const personalPlaylistImageRequestTokenCache = new Map<string, symbol>();
const personalPlaylistImageSelectionTokenCache = new Map<string, symbol>();
const personalPlaylistImageUpdateQueue = new Map<string, Promise<void>>();
const warmedPlaylistArtwork = new Set<string>();

function rememberPersonalPlaylistImage(imageKey: string, image: Blob) {
  try {
    const nextUrl = URL.createObjectURL(image);
    const previousUrl = personalPlaylistImageUrlCache.get(imageKey);
    personalPlaylistImageUrlCache.set(imageKey, nextUrl);
    personalPlaylistImagePromiseCache.delete(imageKey);
    personalPlaylistImageRequestTokenCache.delete(imageKey);
    if (previousUrl) URL.revokeObjectURL(previousUrl);
  } catch {
    // The persisted image remains available through IndexedDB on the next render.
  }
}

function cachedPersonalPlaylistImageUrl(imageKey: string): Promise<string | null> {
  const cached = personalPlaylistImageUrlCache.get(imageKey);
  if (cached) return Promise.resolve(cached);
  const pending = personalPlaylistImagePromiseCache.get(imageKey);
  if (pending) return pending;
  const requestToken = Symbol(imageKey);
  personalPlaylistImageRequestTokenCache.set(imageKey, requestToken);
  const request = loadPersonalPlaylistImage(imageKey)
    .then((image) => {
      if (personalPlaylistImageRequestTokenCache.get(imageKey) !== requestToken) {
        return personalPlaylistImageUrlCache.get(imageKey) ?? null;
      }
      if (!image) return null;
      const objectUrl = URL.createObjectURL(image);
      personalPlaylistImageUrlCache.set(imageKey, objectUrl);
      return objectUrl;
    })
    .catch(() => null)
    .finally(() => {
      if (personalPlaylistImageRequestTokenCache.get(imageKey) === requestToken) {
        personalPlaylistImageRequestTokenCache.delete(imageKey);
        personalPlaylistImagePromiseCache.delete(imageKey);
      }
    });
  personalPlaylistImagePromiseCache.set(imageKey, request);
  return request;
}

function forgetCachedPersonalPlaylistImage(imageKey: string) {
  const objectUrl = personalPlaylistImageUrlCache.get(imageKey);
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  personalPlaylistImageUrlCache.delete(imageKey);
  personalPlaylistImagePromiseCache.delete(imageKey);
  personalPlaylistImageRequestTokenCache.delete(imageKey);
}

function warmPlaylistArtwork(source: string) {
  if (warmedPlaylistArtwork.has(source)) return;
  warmedPlaylistArtwork.add(source);
  const image = new Image();
  image.decoding = "async";
  image.src = source;
}

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
  requireCover = false,
  trackId = null,
}: {
  page: number;
  pageSize?: number;
  filters?: CatalogFilters;
  onePerRelease?: boolean;
  requireCover?: boolean;
  trackId?: number | null;
}): string {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (filters?.query.trim()) params.set("q", filters.query.trim());
  if (filters && filters.genre !== "All genres") params.set("genre", filters.genre);
  if (filters && filters.mood !== "All moods") params.set("mood", filters.mood);
  if (filters?.theme) params.set("theme", filters.theme);
  if (filters?.playlist) params.set("playlist", filters.playlist);
  if (onePerRelease) params.set("onePerRelease", "true");
  if (requireCover) params.set("requireCover", "true");
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

type WorkspaceNavGroup = {
  label: string;
  items: ReadonlyArray<{ id: LibraryView; label: string; icon: WorkspaceNavigationIcon; mobileSecondary?: boolean }>;
};

const creatorNavGroups: ReadonlyArray<WorkspaceNavGroup> = [
  {
    label: "DISCOVER MUSIC",
    items: [
      { id: "discover", label: "Discover", icon: "discover" },
      { id: "music", label: "Music", icon: "music" },
      { id: "playlists", label: "Playlists", icon: "playlists" },
    ],
  },
  {
    label: "YOUR LIBRARY",
    items: [
      { id: "liked", label: "Liked tracks", icon: "liked" },
      { id: "downloads", label: "Downloads", icon: "downloads" },
    ],
  },
];

const guestNavGroups: ReadonlyArray<WorkspaceNavGroup> = [
  {
    label: "BROWSE MUSIC",
    items: [
      { id: "discover", label: "Discover", icon: "discover" },
      { id: "music", label: "Music", icon: "music" },
      { id: "playlists", label: "Playlists", icon: "playlists" },
      { id: "liked", label: "Liked tracks", icon: "liked" },
    ],
  },
];

const businessNavGroups: ReadonlyArray<WorkspaceNavGroup> = [
  {
    label: "BUSINESS LIBRARY",
    items: [
      { id: "music", label: "Music", icon: "music" },
      { id: "playlists", label: "Playlists", icon: "playlists" },
      { id: "liked", label: "Liked tracks", icon: "liked" },
    ],
  },
  {
    label: "START A PROJECT",
    items: [
      { id: "license-song", label: "License a song", icon: "license" },
      { id: "custom-song", label: "Custom song", icon: "custom" },
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
  "license-song": "License a song",
  "custom-song": "Request custom song",
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

function WorkspaceNavIcon({ kind }: { kind: WorkspaceNavigationIcon }) {
  return (
    <svg className="music-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" focusable="false">
      {kind === "discover" && <><path d="M12 3.5 14.1 9.9 20.5 12l-6.4 2.1L12 20.5l-2.1-6.4L3.5 12l6.4-2.1L12 3.5Z" /><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" /></>}
      {kind === "music" && <><path d="M9 17.5V6.8L18 5v10.5" /><path d="M9 9.5 18 7.8" /><circle cx="6.5" cy="17.5" r="2.5" /><circle cx="15.5" cy="15.5" r="2.5" /></>}
      {kind === "playlists" && <><rect x="4" y="4.5" width="14" height="12" rx="2.5" /><path d="m9.5 8.2 4.2 2.4-4.2 2.4V8.2Z" fill="currentColor" stroke="none" /><path d="M7 20h11.5a2 2 0 0 0 2-2V8" /></>}
      {kind === "liked" && <path d="M20.8 4.7a5.5 5.5 0 0 0-7.8 0L12 5.8l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.4 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />}
      {kind === "downloads" && <><path d="M12 4v10" /><path d="m8 10 4 4 4-4" /><path d="M5 17.5v1A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5v-1" /></>}
      {kind === "license" && <><path d="M6.5 4.5h8l3 3v12h-11z" /><path d="M14.5 4.5v3h3M9.5 12h5M9.5 15.5h3" /><path d="m4 11 2 2 3.5-4" /></>}
      {kind === "custom" && <><path d="M9 17.5V7l9-2v10.5" /><circle cx="6.5" cy="17.5" r="2.5" /><circle cx="15.5" cy="15.5" r="2.5" /><path d="m5 4 .7 1.8L7.5 6.5l-1.8.7L5 9l-.7-1.8-1.8-.7 1.8-.7L5 4Z" /></>}
    </svg>
  );
}

function writeBusinessLicenseSelectionToLocation(trackId: string | null, mode: "push" | "replace" = "push") {
  const url = new URL(window.location.href);
  url.searchParams.set("view", "license-song");
  url.searchParams.delete("mood");
  url.searchParams.delete("playlist");
  url.searchParams.delete("myPlaylist");
  if (trackId) url.searchParams.set("track", trackId);
  else url.searchParams.delete("track");

  const destination = `${url.pathname}${url.search}${url.hash}`;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (destination === current) return;
  if (mode === "push") window.history.pushState(window.history.state, "", destination);
  else window.history.replaceState(window.history.state, "", destination);
}

function scrollWorkspaceToTop() {
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
}

function TrackActionIcon({ kind, active = false }: { kind: "like" | "playlist" | "download" | "share" | "delete" | "license"; active?: boolean }) {
  return (
    <span className={`music-action-icon music-action-${kind}`} data-active={active ? "true" : "false"} aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" focusable="false">
        {kind === "like" && <path fill={active ? "currentColor" : "none"} d="M20.8 4.7a5.5 5.5 0 0 0-7.8 0L12 5.8l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.4 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />}
        {kind === "playlist" && <><path d="M4 6h10M4 12h8M4 18h6" /><path d="M18 12v8M14 16h8" /></>}
        {kind === "download" && <><path d="M12 3v12M8 11l4 4 4-4" /><path d="M5 18v2h14v-2" /></>}
        {kind === "share" && <><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4" /></>}
        {kind === "delete" && <><path d="M4 7h16" /><path d="m9 7 .8-2h4.4l.8 2" /><path d="m6.5 7 .8 13h9.4l.8-13" /><path d="M10 11v5M14 11v5" /></>}
        {kind === "license" && <><path d="M6.5 4.5h8l3 3v12h-11z" /><path d="M14.5 4.5v3h3M9.5 12h5M9.5 15.5h3" /><path d="m4 11 2 2 3.5-4" /></>}
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
  onShowShare,
  onAddToPlaylist,
  onOpenPlaylistCreator,
  onDownload,
  shareUrl,
  onCopyShareLink,
  onLicense,
  removeFromPlaylistName,
  onRemoveFromPlaylist,
  canDownload,
}: {
  state: TrackMenuState;
  track: WorkspaceTrack;
  liked: boolean;
  personalPlaylists: readonly PersonalPlaylist[];
  onClose: (restoreFocus?: boolean) => void;
  onToggleLike: () => void;
  onShowPlaylists: () => void;
  onShowShare: () => void;
  onAddToPlaylist: (playlistId: string) => void;
  onOpenPlaylistCreator: () => void;
  onDownload: () => void;
  shareUrl: string | null;
  onCopyShareLink: (shareUrl: string) => Promise<boolean>;
  onLicense?: () => void;
  removeFromPlaylistName: string | null;
  onRemoveFromPlaylist: () => void;
  canDownload: boolean;
}) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: state.x, y: state.y });
  const [copiedShareUrl, setCopiedShareUrl] = useState<string | null>(null);
  const maxHeight = state.placement === "above" ? Math.max(0, state.y - 12) : undefined;
  const shareTargets = shareUrl ? createTrackShareTargets(track, shareUrl) : [];

  useEffect(() => {
    const popover = popoverRef.current;
    if (!popover) return;
    const rect = popover.getBoundingClientRect();
    const gutter = 12;
    const nextX = Math.max(gutter, Math.min(state.x, window.innerWidth - rect.width - gutter));
    const preferredY = state.placement === "above"
      ? state.y - rect.height
      : state.y + rect.height > window.innerHeight - gutter ? state.y - rect.height : state.y;
    const nextY = Math.max(gutter, Math.min(preferredY, window.innerHeight - rect.height - gutter));
    setPosition({ x: nextX, y: nextY });
    popover.querySelector<HTMLElement>(trackPopoverFocusableSelector)?.focus();
  }, [state.mode, state.placement, state.x, state.y]);

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
    const controls = [...(popoverRef.current?.querySelectorAll<HTMLElement>(trackPopoverFocusableSelector) ?? [])];
    const currentIndex = controls.indexOf(document.activeElement as HTMLElement);
    if (event.key === "Escape") {
      event.preventDefault();
      onClose(true);
      return;
    }
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key) || controls.length === 0) return;
    event.preventDefault();
    if (event.key === "Home") controls[0]?.focus();
    else if (event.key === "End") controls.at(-1)?.focus();
    else {
      const direction = event.key === "ArrowDown" ? 1 : -1;
      controls[(currentIndex + direction + controls.length) % controls.length]?.focus();
    }
  }

  return (
    <div
      id="music-track-context-menu"
      className={`music-track-context-menu${state.mode === "share" ? " is-share" : ""}`}
      role={state.mode === "actions" ? "menu" : "dialog"}
      aria-label={state.mode === "actions" ? `Actions for ${track.title}` : state.mode === "playlists" ? `Add ${track.title} to a playlist` : `Share ${track.title}`}
      style={{ left: position.x, top: position.y, maxHeight }}
      ref={popoverRef}
      onKeyDown={handleMenuKeyDown}
    >
      <header><strong>{state.mode === "actions" ? track.title : state.mode === "playlists" ? "Add to playlist" : "Share track"}</strong><small>{state.mode === "actions" ? track.artist : state.mode === "playlists" ? track.title : `${track.title} · ${track.artist}`}</small></header>
      {state.mode === "actions" ? (
        <div className="music-track-context-options">
          {removeFromPlaylistName && <button className="is-destructive" role="menuitem" type="button" onClick={() => { onRemoveFromPlaylist(); onClose(true); }}><TrackActionIcon kind="delete" /><span>Remove from {removeFromPlaylistName}</span></button>}
          <button role="menuitemcheckbox" aria-checked={liked} type="button" onClick={() => { onToggleLike(); onClose(true); }}><TrackActionIcon kind="like" active={liked} /><span>{liked ? "Remove from liked tracks" : "Like track"}</span></button>
          <button role="menuitem" type="button" onClick={onShowPlaylists}><TrackActionIcon kind="playlist" /><span>Add to playlist</span></button>
          <button role="menuitem" type="button" disabled={!canDownload} title={canDownload ? undefined : "Listening copy unavailable"} onClick={() => { onDownload(); onClose(true); }}><TrackActionIcon kind="download" /><span>{canDownload ? "Download listening copy" : "Download unavailable"}</span></button>
          <button role="menuitem" type="button" onClick={onShowShare}><TrackActionIcon kind="share" /><span>Share track</span></button>
          {onLicense && <button role="menuitem" type="button" onClick={() => { onLicense(); onClose(false); }}><TrackActionIcon kind="license" /><span>License this song</span></button>}
        </div>
      ) : state.mode === "playlists" ? (
        <>
          <div className="music-track-context-options music-track-playlist-options">
            {personalPlaylists.map((playlist) => {
              const containsTrack = playlist.trackIds.includes(track.id);
              return <button aria-pressed={containsTrack} type="button" onClick={() => { onAddToPlaylist(playlist.id); onClose(true); }} key={playlist.id}><TrackActionIcon kind="playlist" active={containsTrack} /><span><strong>{playlist.name}</strong><small>{containsTrack ? "Remove from playlist" : `${playlist.trackIds.length} ${playlist.trackIds.length === 1 ? "track" : "tracks"}`}</small></span></button>;
            })}
          </div>
          <div className="music-track-new-playlist">
            <button type="button" onClick={onOpenPlaylistCreator}>Create a new playlist</button>
          </div>
        </>
      ) : (
        <div className="music-track-share">
          <div className="music-track-share-platforms" role="group" aria-label="Sharing platforms">
            {shareTargets.map((target) => (
              <a
                href={target.href}
                target={target.external ? "_blank" : undefined}
                rel={target.external ? "noopener noreferrer" : undefined}
                aria-label={`Share ${track.title} via ${target.label}`}
                onClick={() => onClose(true)}
                key={target.id}
              >
                <span className={`music-track-share-mark is-${target.id}`} aria-hidden="true">{target.mark}</span>
                <span>{target.label}</span>
              </a>
            ))}
          </div>
          <div className="music-track-share-link">
            <span>Track link</span>
            <div>
              <input readOnly value={shareUrl ?? ""} aria-label={`Share link for ${track.title}`} onFocus={(event) => event.currentTarget.select()} />
              <button
                className="music-track-share-copy"
                type="button"
                data-copied={copiedShareUrl === shareUrl ? "true" : "false"}
                aria-live="polite"
                onClick={async () => {
                  if (!shareUrl) return;
                  setCopiedShareUrl(await onCopyShareLink(shareUrl) ? shareUrl : null);
                }}
              >
                {copiedShareUrl === shareUrl ? "Copied" : "Copy link"}
              </button>
            </div>
          </div>
        </div>
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
  const pathname = window.location.pathname;
  const appPath = /\/app(?:\/(?:guest|business))?\/?$/u.test(pathname)
    ? pathname.replace(/\/app(?:\/(?:guest|business))?\/?$/u, "/app/guest")
    : "/app/guest";
  const url = new URL(appPath, window.location.origin);
  url.searchParams.set("view", "music");
  url.searchParams.set("track", trackId);
  return url.toString();
}

function createTrackShareTargets(track: WorkspaceTrack, shareUrl: string) {
  const message = `Listen to ${track.title} by ${track.artist} on Symbiome`;
  return [
    { id: "whatsapp", label: "WhatsApp", mark: "W", href: `https://wa.me/?text=${encodeURIComponent(`${message} ${shareUrl}`)}`, external: true },
    { id: "facebook", label: "Facebook", mark: "f", href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, external: true },
    { id: "x", label: "X", mark: "X", href: `https://x.com/intent/post?text=${encodeURIComponent(message)}&url=${encodeURIComponent(shareUrl)}`, external: true },
    { id: "linkedin", label: "LinkedIn", mark: "in", href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`, external: true },
    { id: "email", label: "Email", mark: "@", href: `mailto:?subject=${encodeURIComponent(message)}&body=${encodeURIComponent(`${message}\n\n${shareUrl}`)}`, external: false },
  ] as const;
}

function copyTextFallback(value: string) {
  const previousActiveElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
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
    previousActiveElement?.focus({ preventScroll: true });
  }
}

function TrackCover({
  src,
  width,
  height,
  priority = false,
  className,
  fallbackClassName = "music-track-cover-placeholder",
}: {
  src: string | null;
  width: number;
  height: number;
  priority?: boolean;
  className?: string;
  fallbackClassName?: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (src && failedSrc !== src && priority) {
    preload(src, { as: "image", fetchPriority: "high" });
  }
  if (!src || failedSrc === src) {
    return <span className={fallbackClassName} aria-hidden="true">♪</span>;
  }
  return (
    <img
      className={className}
      src={src}
      alt=""
      width={width}
      height={height}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
      onError={() => setFailedSrc(src)}
    />
  );
}

function PlaylistHeroArtwork({ playlist }: { playlist: LofiGirlPlaylist }) {
  const [decodedSource, setDecodedSource] = useState<string | null>(null);
  return (
    <>
      <img className="music-playlist-detail-photo is-thumbnail" src={playlist.thumbnail} alt="" width={640} height={480} loading="eager" fetchPriority="high" decoding="async" />
      <img className={`music-playlist-detail-photo is-full${decodedSource === playlist.image ? " is-loaded" : ""}`} src={playlist.image} alt="" width={1600} height={1200} loading="eager" fetchPriority="high" decoding="async" onLoad={() => setDecodedSource(playlist.image)} />
    </>
  );
}

function PlaylistCard({
  playlist,
  onOpen,
  priority = false,
}: {
  playlist: LofiGirlPlaylist;
  onOpen: (playlist: LofiGirlPlaylist) => void;
  priority?: boolean;
}) {
  const accent = getPlaylistAccent(playlist);
  const style = {
    "--playlist-accent": accent.color,
    "--playlist-accent-ink": accent.ink,
    "--playlist-position": playlist.imagePosition ?? "center",
  } as CSSProperties;

  return (
    <button
      className="workspace-playlist"
      style={style}
      type="button"
      onClick={() => {
        warmPlaylistArtwork(playlist.image);
        onOpen(playlist);
      }}
      onPointerEnter={() => warmPlaylistArtwork(playlist.image)}
      onFocus={() => warmPlaylistArtwork(playlist.image)}
      title={playlist.title}
    >
      <img
        className="workspace-playlist-photo"
        src={playlist.thumbnail}
        alt=""
        width={640}
        height={480}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
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

function usePersonalPlaylistImageUrl(imageKey: string | null): string | null {
  const [loadedImage, setLoadedImage] = useState<{ key: string; url: string } | null>(() => {
    const cached = imageKey ? personalPlaylistImageUrlCache.get(imageKey) : null;
    return imageKey && cached ? { key: imageKey, url: cached } : null;
  });

  useEffect(() => {
    let cancelled = false;
    if (!imageKey) return;

    void cachedPersonalPlaylistImageUrl(imageKey)
      .then((url) => {
        if (!url || cancelled) return;
        setLoadedImage({ key: imageKey, url });
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [imageKey]);

  const cachedImageUrl = imageKey ? personalPlaylistImageUrlCache.get(imageKey) ?? null : null;
  return cachedImageUrl ?? (loadedImage?.key === imageKey ? loadedImage.url : null);
}

function useBlobPreviewUrl(image: Blob | null): string | null {
  const [loadedImage, setLoadedImage] = useState<{ image: Blob; url: string } | null>(null);

  useEffect(() => {
    if (!image) return;
    let cancelled = false;
    const objectUrl = URL.createObjectURL(image);
    queueMicrotask(() => {
      if (!cancelled) setLoadedImage({ image, url: objectUrl });
    });
    return () => {
      cancelled = true;
      URL.revokeObjectURL(objectUrl);
    };
  }, [image]);

  return loadedImage?.image === image ? loadedImage.url : null;
}

function PersonalPlaylistArtwork({
  playlist,
  className,
  eager = false,
}: {
  playlist: PersonalPlaylist;
  className: string;
  eager?: boolean;
}) {
  const imageUrl = usePersonalPlaylistImageUrl(playlist.imageKey);
  if (imageUrl) return <img className={className} src={imageUrl} alt="" width={640} height={480} loading={eager ? "eager" : "lazy"} fetchPriority={eager ? "high" : "auto"} decoding="async" />;
  return <span className={`${className} music-personal-playlist-default-art`} aria-hidden="true"><SymbiomeMark /></span>;
}

function PersonalPlaylistImagePicker({
  playlist,
  onChange,
}: {
  playlist: PersonalPlaylist;
  onChange: (playlist: PersonalPlaylist, image: Blob, selectionToken: symbol) => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const actionLabel = playlist.imageKey ? "Change image" : "Add image";

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0] ?? null;
    setError("");
    if (!file) return;
    const selectionToken = Symbol(playlist.id);
    personalPlaylistImageSelectionTokenCache.set(playlist.id, selectionToken);
    setBusy(true);
    try {
      const preparedImage = await preparePersonalPlaylistImage(file);
      if (personalPlaylistImageSelectionTokenCache.get(playlist.id) !== selectionToken) return;
      await onChange(playlist, preparedImage, selectionToken);
    } catch (caught) {
      if (personalPlaylistImageSelectionTokenCache.get(playlist.id) === selectionToken) {
        setError(caught instanceof Error ? caught.message : "This image could not be saved.");
      }
    } finally {
      setBusy(false);
      input.value = "";
    }
  }

  return (
    <div className="music-playlist-detail-image-control">
      <input
        className="music-playlist-detail-image-input"
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => void handleChange(event)}
        disabled={busy}
      />
      <button
        className="music-playlist-detail-image-picker"
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        aria-label={`${actionLabel} for ${playlist.name}`}
      >
        <span>{busy ? "Updating…" : actionLabel}</span>
      </button>
      {error && <span className="music-playlist-detail-image-error" role="alert">{error}</span>}
    </div>
  );
}

function PersonalPlaylistCard({
  playlist,
  onOpen,
  onDelete,
  onOpenMenu,
  priority = false,
}: {
  playlist: PersonalPlaylist;
  onOpen: (playlist: PersonalPlaylist) => void;
  onDelete: (playlist: PersonalPlaylist) => void;
  onOpenMenu: (playlist: PersonalPlaylist, x: number, y: number, opener: HTMLElement) => void;
  priority?: boolean;
}) {
  const style = {
    "--playlist-accent": "#e06343",
    "--playlist-accent-ink": "#292832",
    "--playlist-position": "center",
  } as CSSProperties;
  const trackLabel = `${playlist.trackIds.length} ${playlist.trackIds.length === 1 ? "track" : "tracks"}`;

  return (
    <article
      className="music-personal-playlist-card-shell"
      onContextMenu={(event) => {
        event.preventDefault();
        onOpenMenu(playlist, event.clientX, event.clientY, event.currentTarget);
      }}
    >
      <button
        className="workspace-playlist music-personal-playlist-card"
        style={style}
        type="button"
        onClick={() => onOpen(playlist)}
        onKeyDown={(event) => {
          if (event.key !== "ContextMenu" && !(event.shiftKey && event.key === "F10")) return;
          event.preventDefault();
          const rect = event.currentTarget.getBoundingClientRect();
          onOpenMenu(playlist, rect.right - 220, rect.top + 52, event.currentTarget);
        }}
        title={playlist.name}
      >
        <PersonalPlaylistArtwork playlist={playlist} className="workspace-playlist-photo" eager={priority} />
        <span className="workspace-playlist-shade" aria-hidden="true" />
        <span className="workspace-playlist-copy">
          <small>My playlist · {trackLabel}</small>
          <strong>{playlist.name}</strong>
          {playlist.description && <em>{playlist.description}</em>}
          <b>Personal playlist</b>
        </span>
      </button>
      <button className="music-personal-playlist-delete" type="button" onClick={() => onDelete(playlist)} aria-label={`Delete playlist ${playlist.name}`} title="Delete playlist"><TrackActionIcon kind="delete" /></button>
    </article>
  );
}

function PersonalPlaylistContextMenu({
  state,
  playlist,
  onClose,
  onDelete,
}: {
  state: PersonalPlaylistMenuState;
  playlist: PersonalPlaylist;
  onClose: (restoreFocus?: boolean) => void;
  onDelete: (playlist: PersonalPlaylist) => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: state.x, y: state.y });

  useEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const rect = menu.getBoundingClientRect();
    const gutter = 12;
    setPosition({
      x: Math.max(gutter, Math.min(state.x, window.innerWidth - rect.width - gutter)),
      y: Math.max(gutter, Math.min(state.y, window.innerHeight - rect.height - gutter)),
    });
    menu.querySelector<HTMLButtonElement>("button")?.focus();
  }, [state.x, state.y]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) onClose(false);
    };
    const handleViewportChange = () => onClose(false);
    document.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [onClose]);

  return (
    <div
      id="music-personal-playlist-context-menu"
      className="music-personal-playlist-context-menu"
      role="menu"
      aria-label={`Actions for ${playlist.name}`}
      style={{ left: position.x, top: position.y }}
      ref={menuRef}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        onClose(true);
      }}
    >
      <button role="menuitem" type="button" onClick={() => onDelete(playlist)}><TrackActionIcon kind="delete" /><span>Delete playlist</span></button>
    </div>
  );
}

function PlaylistDeleteDialog({
  playlist,
  onClose,
  onConfirm,
}: {
  playlist: PersonalPlaylist;
  onClose: () => void;
  onConfirm: (playlist: PersonalPlaylist) => Promise<void>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const trackLabel = `${playlist.trackIds.length} ${playlist.trackIds.length === 1 ? "track" : "tracks"}`;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    const frame = window.requestAnimationFrame(() => cancelRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, []);

  async function confirmDeletion() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await onConfirm(playlist);
    } catch {
      setError("The playlist could not be deleted from this browser. Try again.");
      setBusy(false);
    }
  }

  return (
    <dialog
      className="music-playlist-delete-dialog"
      ref={dialogRef}
      aria-labelledby="music-playlist-delete-title"
      aria-describedby="music-playlist-delete-description"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <section aria-busy={busy}>
        <header><span>MY PLAYLIST</span><h2 id="music-playlist-delete-title">Delete “{playlist.name}”?</h2></header>
        <p id="music-playlist-delete-description">This removes the playlist, its custom image and {trackLabel} from this browser. The tracks remain available in the Symbiome catalogue.</p>
        {error && <p className="music-playlist-delete-error" role="alert">{error}</p>}
        <footer>
          <button ref={cancelRef} type="button" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="is-destructive" type="button" onClick={() => void confirmDeletion()} disabled={busy}>{busy ? "Deleting…" : "Delete playlist"}</button>
        </footer>
      </section>
    </dialog>
  );
}

function PlaylistComposerDialog({
  trackTitle,
  onClose,
  onCreate,
}: {
  trackTitle: string | null;
  onClose: () => void;
  onCreate: (draft: PersonalPlaylistDraft) => Promise<void>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<Blob | null>(null);
  const [imageName, setImageName] = useState("");
  const [imageError, setImageError] = useState("");
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const previewUrl = useBlobPreviewUrl(image);
  const imageActionLabel = image ? "Change image" : "Choose image";

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);

  async function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0] ?? null;
    setImageError("");
    if (!file) return;
    setIsProcessingImage(true);
    try {
      const preparedImage = await preparePersonalPlaylistImage(file);
      setImage(preparedImage);
      setImageName(file.name);
    } catch (error) {
      setImage(null);
      setImageName("");
      setImageError(error instanceof Error ? error.message : "This image could not be prepared.");
    } finally {
      setIsProcessingImage(false);
      input.value = "";
    }
  }

  return (
    <dialog
      className="music-playlist-composer"
      ref={dialogRef}
      aria-labelledby="music-playlist-composer-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!isSubmitting) onClose();
      }}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) onClose();
      }}
    >
      <form onSubmit={(event) => {
        event.preventDefault();
        const playlistName = name.trim();
        if (!playlistName || isProcessingImage || isSubmitting) return;
        setIsSubmitting(true);
        void onCreate({ name: playlistName, description: description.trim(), image })
          .catch(() => setImageError("The playlist could not be created."))
          .finally(() => setIsSubmitting(false));
      }}>
        <header>
          <span>YOUR LIBRARY</span>
          <h2 id="music-playlist-composer-title">Create a playlist</h2>
          <p>{trackTitle ? `${trackTitle} will be added when the playlist is created.` : "Start with a name, then add artwork or a short description if you want."}</p>
          <button type="button" onClick={onClose} disabled={isSubmitting} aria-label="Close playlist creator">×</button>
        </header>

        <div className="music-playlist-composer-body">
          <button
            className="music-playlist-composer-preview"
            type="button"
            onClick={() => imageInputRef.current?.click()}
            disabled={isProcessingImage || isSubmitting}
            aria-label={imageActionLabel}
          >
            {previewUrl
              ? <img src={previewUrl} alt="" />
              : <span className="music-personal-playlist-default-art" aria-hidden="true"><SymbiomeMark /></span>}
            <span className="music-playlist-composer-preview-action" aria-hidden="true">{imageActionLabel}</span>
            <small aria-hidden="true">{imageName || "Default Symbiome artwork"}</small>
          </button>

          <div className="music-playlist-composer-fields">
            <label>
              <span>Playlist name</span>
              <input type="text" autoFocus value={name} onChange={(event) => setName(event.currentTarget.value)} placeholder="Name your playlist" maxLength={48} required />
            </label>
            <label>
              <span>Description <small>Optional</small></span>
              <textarea value={description} onChange={(event) => setDescription(event.currentTarget.value)} placeholder="What is this playlist for?" maxLength={PERSONAL_PLAYLIST_DESCRIPTION_LIMIT} rows={4} />
            </label>
            <div className="music-playlist-composer-image">
              <span>Image <small>Optional · JPEG, PNG or WebP</small></span>
              <div>
                <label className="music-playlist-image-picker">
                  <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void handleImageChange(event)} disabled={isProcessingImage || isSubmitting} />
                  <span>{isProcessingImage ? "Preparing image…" : imageActionLabel}</span>
                </label>
                {image && <button type="button" onClick={() => { setImage(null); setImageName(""); setImageError(""); }} disabled={isSubmitting}>Use default</button>}
              </div>
              {imageError && <p role="alert">{imageError}</p>}
            </div>
          </div>
        </div>

        <footer>
          <button type="button" onClick={onClose} disabled={isSubmitting}>Cancel</button>
          <button className="cta-swipe" type="submit" disabled={!name.trim() || isProcessingImage || isSubmitting}>{isSubmitting ? "Creating…" : trackTitle ? "Create & add track" : "Create playlist"}</button>
        </footer>
      </form>
    </dialog>
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

function BusinessLibraryIntro({ onLicense, onCustom }: { onLicense: () => void; onCustom: () => void }) {
  return (
    <section className="business-library-intro" aria-labelledby="business-library-title">
      <div>
        <span>BUSINESS MUSIC LIBRARY</span>
        <h2 id="business-library-title">Find the sound.<br />Clear the rights.</h2>
        <p>Search the full Symbiome catalogue, then send the usage scope for a licence quote — or brief an original song made for your project.</p>
      </div>
      <div className="business-library-actions">
        <button className="business-workspace-cta" type="button" onClick={onLicense}>License a song</button>
        <button className="business-workspace-cta is-secondary" type="button" onClick={onCustom}>Request custom song</button>
      </div>
    </section>
  );
}

export function CreatorWorkspace({ workspaceRole = "creator" }: { workspaceRole?: WorkspaceRole }) {
  const defaultView: LibraryView = workspaceRole === "business" ? "music" : "discover";
  const allowedViews = workspaceRole === "business"
    ? businessLibraryViewIds
    : workspaceRole === "guest"
      ? guestLibraryViewIds
      : creatorLibraryViewIds;
  const activeNavGroups = workspaceRole === "business"
    ? businessNavGroups
    : workspaceRole === "guest"
      ? guestNavGroups
      : creatorNavGroups;
  const isBusinessWorkspace = workspaceRole === "business";
  const isGuestWorkspace = workspaceRole === "guest";
  const [view, setView] = useState<LibraryView>(defaultView);
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState("All genres");
  const [mood, setMood] = useState("All moods");
  const [activeUse, setActiveUse] = useState<MusicUseSlug | null>(null);
  const [activePlaylistId, setActivePlaylistId] = useState<CatalogPlaylistId | null>(null);
  const [activePersonalPlaylistId, setActivePersonalPlaylistId] = useState<string | null>(null);
  const [liked, setLiked] = useState<Set<string>>(() => new Set());
  const [likedReady, setLikedReady] = useState(false);
  const [personalPlaylists, setPersonalPlaylists] = useState<PersonalPlaylist[]>(() => [defaultPersonalPlaylist]);
  const personalPlaylistsRef = useRef(personalPlaylists);
  const replacePersonalPlaylists = useCallback((nextPlaylists: PersonalPlaylist[]) => {
    personalPlaylistsRef.current = nextPlaylists;
    setPersonalPlaylists(nextPlaylists);
  }, []);
  const updatePersonalPlaylists = useCallback((update: (current: PersonalPlaylist[]) => PersonalPlaylist[]) => {
    const nextPlaylists = update(personalPlaylistsRef.current);
    personalPlaylistsRef.current = nextPlaylists;
    setPersonalPlaylists(nextPlaylists);
  }, []);
  const [downloadedTrackIds, setDownloadedTrackIds] = useState<Set<string>>(() => new Set());
  const [libraryActionsReady, setLibraryActionsReady] = useState(false);
  const [trackMenu, setTrackMenu] = useState<TrackMenuState | null>(null);
  const [personalPlaylistMenu, setPersonalPlaylistMenu] = useState<PersonalPlaylistMenuState | null>(null);
  const [playlistPendingDeletion, setPlaylistPendingDeletion] = useState<PersonalPlaylist | null>(null);
  const [playlistComposerTrackId, setPlaylistComposerTrackId] = useState<string | null | undefined>(undefined);
  const [personalPlaylistLoadState, setPersonalPlaylistLoadState] = useState<"idle" | "loading" | "error">("idle");
  const [downloadsLoadState, setDownloadsLoadState] = useState<"idle" | "loading" | "error">("idle");
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
  const [businessLicenseTrackId, setBusinessLicenseTrackId] = useState<string | null>(null);
  const trackMenuOpenerRef = useRef<HTMLElement | null>(null);
  const personalPlaylistMenuOpenerRef = useRef<HTMLElement | null>(null);
  const sharedTrackHandledRef = useRef<string | null>(null);
  const activeViewRef = useRef<LibraryView>(defaultView);
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
  const recentTracks = useMemo(
    () => (recentCatalogTracks ?? [])
      .filter((track): track is WorkspaceTrack & { cover: string } => (
        typeof track.cover === "string"
      ))
      .slice(0, RECENT_RELEASE_LIMIT),
    [recentCatalogTracks],
  );
  const activePlaylist = useMemo(
    () => lofiGirlPlaylists.find((playlist) => playlist.id === activePlaylistId) ?? null,
    [activePlaylistId],
  );
  const activePersonalPlaylist = useMemo(
    () => personalPlaylists.find((playlist) => playlist.id === activePersonalPlaylistId) ?? null,
    [activePersonalPlaylistId, personalPlaylists],
  );
  const activePersonalPlaylistTracks = useMemo(() => {
    if (!activePersonalPlaylist) return [];
    const tracksById = new Map(catalogKnownTracks.map((track) => [track.id, track]));
    return activePersonalPlaylist.trackIds.flatMap((trackId) => {
      const track = tracksById.get(trackId);
      return track ? [track] : [];
    });
  }, [activePersonalPlaylist, catalogKnownTracks]);
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
      const nextView = readLibraryViewFromLocation(defaultView, allowedViews);
      const selection = readLibrarySelectionFromLocation();
      const requestedTrackId = new URLSearchParams(window.location.search).get("track")?.trim() ?? "";
      if (activeViewRef.current !== nextView) scrollWorkspaceToTop();
      activeViewRef.current = nextView;
      setView(nextView);
      setBusinessLicenseTrackId(
        nextView === "license-song" && isStoredTrackId(requestedTrackId) ? requestedTrackId : null,
      );
      setActivePlaylistId(selection.playlist);
      setActivePersonalPlaylistId(selection.personalPlaylist);
      setMood(selection.mood ?? "All moods");
      if (selection.playlist || selection.personalPlaylist || selection.mood) {
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
  }, [allowedViews, defaultView]);

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
          pageSize: RECENT_RELEASE_BUFFER,
          onePerRelease: true,
          requireCover: true,
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
    const requestedView = readLibraryViewFromLocation(defaultView, allowedViews);
    const opensBusinessLicense = isBusinessWorkspace && requestedView === "license-song";
    const openSharedTrack = (track: WorkspaceTrack) => {
      if (opensBusinessLicense) {
        setCatalogKnownTracks((current) => mergeTrackPages(current, [track]));
        setBusinessLicenseTrackId(track.id);
        activeViewRef.current = "license-song";
        setView("license-song");
        setActionStatus(`${track.title} selected for a licence request.`);
        return;
      }
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
        const currentParams = new URLSearchParams(window.location.search);
        const currentView = readLibraryViewFromLocation(defaultView, allowedViews);
        if (
          currentView !== requestedView
          || activeViewRef.current !== requestedView
          || currentParams.get("track")?.trim() !== trackId
        ) return;
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
  }, [allowedViews, catalogLoadState, catalogRetryNonce, defaultView, isBusinessWorkspace, view]);

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
    if ((!activePlaylistId && !activePersonalPlaylistId) || view !== "playlists") return;
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
  }, [activePersonalPlaylistId, activePlaylistId, view]);

  useEffect(() => {
    try {
      const storedLiked = JSON.parse(window.localStorage.getItem("symbiome-liked-tracks") ?? "[]") as unknown;
      if (Array.isArray(storedLiked)) setLiked(new Set(storedLiked.filter(isStoredTrackId)));
    } catch { /* Ignore only the malformed liked-tracks key. */ }
    try {
      const storedPlaylistsValue = window.localStorage.getItem("symbiome-personal-playlists-v1");
      const storedPlaylists = storedPlaylistsValue === null ? null : JSON.parse(storedPlaylistsValue) as unknown;
      if (Array.isArray(storedPlaylists)) {
        const validPlaylists = storedPlaylists.flatMap((item): PersonalPlaylist[] => {
          if (!item || typeof item !== "object") return [];
          const record = item as Record<string, unknown>;
          if (!isStoredTrackId(record.id) || typeof record.name !== "string" || !record.name.trim() || !Array.isArray(record.trackIds)) return [];
          const description = typeof record.description === "string"
            ? record.description.trim().slice(0, PERSONAL_PLAYLIST_DESCRIPTION_LIMIT)
            : "";
          const imageKey = isPersonalPlaylistImageKey(record.imageKey) ? record.imageKey : null;
          return [{ id: record.id, name: record.name.trim().slice(0, 48), description, imageKey, trackIds: [...new Set(record.trackIds.filter(isStoredTrackId))] }];
        });
        replacePersonalPlaylists(validPlaylists);
      }
    } catch { /* Ignore only the malformed personal-playlists key. */ }
    try {
      const storedDownloads = JSON.parse(window.localStorage.getItem("symbiome-preview-downloads-v1") ?? "[]") as unknown;
      if (Array.isArray(storedDownloads)) setDownloadedTrackIds(new Set(storedDownloads.filter(isStoredTrackId)));
    } catch { /* Ignore only the malformed downloads key. */ }
    setLikedReady(true);
    setLibraryActionsReady(true);
  }, [replacePersonalPlaylists]);

  useEffect(() => {
    if (!likedReady) return;
    try { window.localStorage.setItem("symbiome-liked-tracks", JSON.stringify([...liked])); } catch { /* Storage can be unavailable in previews. */ }
  }, [liked, likedReady]);

  useEffect(() => {
    if (!libraryActionsReady) return;
    try { window.localStorage.setItem("symbiome-personal-playlists-v1", JSON.stringify(personalPlaylists)); } catch { /* Storage can be unavailable in previews. */ }
  }, [libraryActionsReady, personalPlaylists]);

  useEffect(() => {
    if (!libraryActionsReady) return;
    try { window.localStorage.setItem("symbiome-preview-downloads-v1", JSON.stringify([...downloadedTrackIds])); } catch { /* Storage can be unavailable in previews. */ }
  }, [downloadedTrackIds, libraryActionsReady]);

  useEffect(() => {
    if (!libraryActionsReady || !activePersonalPlaylistId || activePersonalPlaylist) return;
    setActivePersonalPlaylistId(null);
    writePersonalPlaylistSelectionToLocation(null, "replace");
  }, [activePersonalPlaylist, activePersonalPlaylistId, libraryActionsReady]);

  useEffect(() => {
    let cancelled = false;
    const settleIdle = () => queueMicrotask(() => {
      if (!cancelled) setPersonalPlaylistLoadState("idle");
    });
    if (!activePersonalPlaylist || !libraryActionsReady) {
      settleIdle();
      return () => { cancelled = true; };
    }
    const knownIds = new Set(catalogKnownTracks.map((track) => track.id));
    const missingTrackIds = activePersonalPlaylist.trackIds
      .filter((trackId) => !knownIds.has(trackId))
      .map(catalogNumericTrackId)
      .filter((trackId): trackId is number => trackId !== null);
    if (!missingTrackIds.length) {
      settleIdle();
      return () => { cancelled = true; };
    }

    const controller = new AbortController();

    async function loadPersonalPlaylistTracks() {
      setPersonalPlaylistLoadState("loading");
      const loadedTracks: WorkspaceTrack[] = [];
      let failed = false;
      for (let index = 0; index < missingTrackIds.length; index += 6) {
        const chunk = missingTrackIds.slice(index, index + 6);
        const results = await Promise.allSettled(chunk.map(async (trackId) => {
          const response = await fetch(catalogRequestUrl({ page: 1, pageSize: 1, trackId }), {
            cache: "no-store",
            credentials: catalogFetchCredentials,
            headers: { accept: "application/json" },
            signal: controller.signal,
          });
          if (!response.ok) throw new Error("Personal playlist track request failed");
          const page = parseCatalogPage(await response.json());
          if (!page || page.view !== "tracks") throw new Error("Personal playlist track response was invalid");
          return page.tracks[0] ?? null;
        }));
        if (cancelled) return;
        for (const result of results) {
          if (result.status === "fulfilled" && result.value) loadedTracks.push(result.value);
          else if (result.status === "rejected" && !(result.reason instanceof DOMException && result.reason.name === "AbortError")) failed = true;
        }
      }
      if (cancelled) return;
      if (loadedTracks.length) setCatalogKnownTracks((current) => mergeTrackPages(current, loadedTracks));
      setPersonalPlaylistLoadState(failed ? "error" : "idle");
    }

    void loadPersonalPlaylistTracks().catch((error) => {
      if (cancelled || (error instanceof DOMException && error.name === "AbortError")) return;
      setPersonalPlaylistLoadState("error");
    });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [activePersonalPlaylist, catalogKnownTracks, catalogRetryNonce, libraryActionsReady]);

  useEffect(() => {
    let cancelled = false;
    const settleState = (state: "idle" | "error") => queueMicrotask(() => {
      if (!cancelled) setDownloadsLoadState(state);
    });
    if (view !== "downloads" || !libraryActionsReady || downloadedTrackIds.size === 0) {
      settleState("idle");
      return () => { cancelled = true; };
    }

    const knownIds = new Set(catalogKnownTracks.map((track) => track.id));
    const missingSavedIds = [...downloadedTrackIds].filter((trackId) => !knownIds.has(trackId));
    if (!missingSavedIds.length) {
      settleState("idle");
      return () => { cancelled = true; };
    }

    const missingTrackRequests = missingSavedIds.flatMap((savedId) => {
      const trackId = catalogNumericTrackId(savedId);
      return trackId === null ? [] : [{ savedId, trackId }];
    });
    if (!missingTrackRequests.length) {
      settleState("error");
      return () => { cancelled = true; };
    }

    const controller = new AbortController();

    async function loadDownloadedTracks() {
      setDownloadsLoadState("loading");
      const loadedTracks: WorkspaceTrack[] = [];
      let failed = missingTrackRequests.length !== missingSavedIds.length;
      for (let index = 0; index < missingTrackRequests.length; index += 6) {
        const chunk = missingTrackRequests.slice(index, index + 6);
        const results = await Promise.allSettled(chunk.map(async ({ savedId, trackId }) => {
          const response = await fetch(catalogRequestUrl({ page: 1, pageSize: 1, trackId }), {
            cache: "no-store",
            credentials: catalogFetchCredentials,
            headers: { accept: "application/json" },
            signal: controller.signal,
          });
          if (!response.ok) throw new Error("Downloaded track request failed");
          const page = parseCatalogPage(await response.json());
          if (!page || page.view !== "tracks") throw new Error("Downloaded track response was invalid");
          const track = page.tracks[0] ?? null;
          return track?.id === savedId ? track : null;
        }));
        if (cancelled) return;
        for (const result of results) {
          if (result.status === "fulfilled" && result.value) loadedTracks.push(result.value);
          else if (result.status === "fulfilled" || !(result.reason instanceof DOMException && result.reason.name === "AbortError")) failed = true;
        }
      }
      if (cancelled) return;
      if (loadedTracks.length) setCatalogKnownTracks((current) => mergeTrackPages(current, loadedTracks));
      setDownloadsLoadState(failed ? "error" : "idle");
    }

    void loadDownloadedTracks().catch((error) => {
      if (cancelled || (error instanceof DOMException && error.name === "AbortError")) return;
      setDownloadsLoadState("error");
    });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [catalogKnownTracks, catalogRetryNonce, downloadedTrackIds, libraryActionsReady, view]);

  const closeTrackMenu = useCallback((restoreFocus = false) => {
    setTrackMenu(null);
    if (restoreFocus && trackMenuOpenerRef.current) requestAnimationFrame(() => trackMenuOpenerRef.current?.focus());
  }, []);

  const closePersonalPlaylistMenu = useCallback((restoreFocus = false) => {
    setPersonalPlaylistMenu(null);
    if (restoreFocus && personalPlaylistMenuOpenerRef.current) requestAnimationFrame(() => personalPlaylistMenuOpenerRef.current?.focus());
  }, []);

  useEffect(() => {
    closeTrackMenu(false);
    closePersonalPlaylistMenu(false);
  }, [activePersonalPlaylistId, activePlaylistId, activeUse, closePersonalPlaylistMenu, closeTrackMenu, genre, mood, query, view]);

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
  const downloadedTracks = useMemo(() => catalogKnownTracks.filter((track) => downloadedTrackIds.has(track.id)), [catalogKnownTracks, downloadedTrackIds]);
  const selectedTrack = catalogKnownTracks.find((track) => track.id === preview.activeTrackId);
  const selectedBusinessLicenseTrack = businessLicenseTrackId
    ? knownTracks.find((track) => track.id === businessLicenseTrackId) ?? null
    : null;
  const menuTrack = trackMenu ? catalogKnownTracks.find((track) => track.id === trackMenu.trackId) : undefined;
  const menuTrackPersonalPlaylist = trackMenu?.personalPlaylistId ? personalPlaylists.find((playlist) => playlist.id === trackMenu.personalPlaylistId) ?? null : null;
  const menuPersonalPlaylist = personalPlaylistMenu ? personalPlaylists.find((playlist) => playlist.id === personalPlaylistMenu.playlistId) ?? null : null;
  const playlistComposerTrack = playlistComposerTrackId ? catalogKnownTracks.find((track) => track.id === playlistComposerTrackId) ?? null : null;
  useEffect(() => {
    if (preview.activeTrackId && !catalogKnownTracks.some((track) => track.id === preview.activeTrackId)) preview.stop();
  }, [catalogKnownTracks, preview.activeTrackId, preview.stop]);

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
    setActivePersonalPlaylistId(null);
    setQuery("");
    if (activeViewRef.current === "music") writeLibrarySelectionToLocation({});
  }

  function navigateToView(nextView: LibraryView) {
    const changesView = activeViewRef.current !== nextView;
    const leavesBusinessLicense = isBusinessWorkspace && activeViewRef.current === "license-song" && nextView !== "license-song";
    const historyMode = activeViewRef.current === nextView ? "replace" : "push";
    if (nextView === "license-song") {
      const requestedTrackId = new URLSearchParams(window.location.search).get("track")?.trim() ?? "";
      setBusinessLicenseTrackId(isStoredTrackId(requestedTrackId) ? requestedTrackId : null);
    } else {
      setBusinessLicenseTrackId(null);
    }
    activeViewRef.current = nextView;
    if (nextView !== "playlists" && activePlaylistId !== null) setActivePlaylistId(null);
    if (nextView !== "playlists" && activePersonalPlaylistId !== null) setActivePersonalPlaylistId(null);
    setView(nextView);
    const preserveTrack = (nextView === "music" || nextView === "license-song") && !leavesBusinessLicense;
    writeLibraryViewToLocation(nextView, historyMode, preserveTrack);
    if (changesView) scrollWorkspaceToTop();
  }

  function showMusic() {
    navigateToView("music");
  }

  function openBusinessLicenseRequest(track: WorkspaceTrack | null) {
    const historyMode = activeViewRef.current === "license-song" && businessLicenseTrackId === (track?.id ?? null) ? "replace" : "push";
    activeViewRef.current = "license-song";
    setBusinessLicenseTrackId(track?.id ?? null);
    setView("license-song");
    writeBusinessLicenseSelectionToLocation(track?.id ?? null, historyMode);
    scrollWorkspaceToTop();
    if (track) setActionStatus(`${track.title} selected for a licence request.`);
  }

  function openPlaylist(playlist: LofiGirlPlaylist) {
    if (!isCatalogPlaylistId(playlist.id)) return;
    activeViewRef.current = "playlists";
    setView("playlists");
    setActivePlaylistId(playlist.id);
    setActivePersonalPlaylistId(null);
    setActiveUse(null);
    setGenre("All genres");
    setMood("All moods");
    setQuery("");
    writePlaylistSelectionToLocation(playlist.id, "push");
  }

  function openPersonalPlaylist(playlist: PersonalPlaylist) {
    activeViewRef.current = "playlists";
    setView("playlists");
    setActivePlaylistId(null);
    setActivePersonalPlaylistId(playlist.id);
    setActiveUse(null);
    setGenre("All genres");
    setMood("All moods");
    setQuery("");
    writePersonalPlaylistSelectionToLocation(playlist.id, "push");
  }

  function closePlaylist() {
    setActivePlaylistId(null);
    setActivePersonalPlaylistId(null);
    writePlaylistSelectionToLocation(null, "push");
  }

  function openFacet(kind: FacetKind, value: string) {
    setGenre("All genres");
    setMood("All moods");
    setActiveUse(null);
    setActivePlaylistId(null);
    setActivePersonalPlaylistId(null);
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

  function openTrackMenu(
    track: WorkspaceTrack,
    x: number,
    y: number,
    mode: TrackMenuMode,
    opener: HTMLElement | null = null,
    personalPlaylistId: string | null = null,
    placement: TrackMenuPlacement = "auto",
  ) {
    trackMenuOpenerRef.current = opener;
    setTrackMenu({ trackId: track.id, x, y, mode, placement, personalPlaylistId });
  }

  function openAnchoredTrackDialog(track: WorkspaceTrack, opener: HTMLButtonElement, mode: "playlists" | "share") {
    const rect = opener.getBoundingClientRect();
    const fixedPlayer = opener.closest(".workspace-audio-player");
    const anchorY = fixedPlayer ? fixedPlayer.getBoundingClientRect().top - 12 : rect.bottom + 8;
    const popoverWidth = mode === "share" ? 360 : 242;
    openTrackMenu(track, rect.right - popoverWidth, anchorY, mode, opener, null, fixedPlayer ? "above" : "auto");
  }

  function openPlaylistChooser(track: WorkspaceTrack, opener: HTMLButtonElement) {
    openAnchoredTrackDialog(track, opener, "playlists");
  }

  function openShareChooser(track: WorkspaceTrack, opener: HTMLButtonElement) {
    openAnchoredTrackDialog(track, opener, "share");
  }

  function openPersonalPlaylistMenu(playlist: PersonalPlaylist, x: number, y: number, opener: HTMLElement) {
    personalPlaylistMenuOpenerRef.current = opener;
    setPersonalPlaylistMenu({ playlistId: playlist.id, x, y });
  }

  function requestPersonalPlaylistDeletion(playlist: PersonalPlaylist) {
    closePersonalPlaylistMenu(false);
    setPlaylistPendingDeletion(playlist);
  }

  function addTrackToPlaylist(track: WorkspaceTrack, playlistId: string) {
    const target = personalPlaylistsRef.current.find((playlist) => playlist.id === playlistId);
    const removing = target?.trackIds.includes(track.id) ?? false;
    updatePersonalPlaylists((current) => current.map((playlist) => playlist.id !== playlistId ? playlist : { ...playlist, trackIds: removing ? playlist.trackIds.filter((id) => id !== track.id) : [...playlist.trackIds, track.id] }));
    setActionStatus(removing ? `${track.title} removed from ${target?.name ?? "playlist"}.` : `${track.title} added to ${target?.name ?? "playlist"}.`);
  }

  function removeTrackFromPersonalPlaylist(track: WorkspaceTrack, playlistId: string) {
    const currentPlaylists = personalPlaylistsRef.current;
    const target = currentPlaylists.find((playlist) => playlist.id === playlistId);
    if (!target?.trackIds.includes(track.id)) return;
    const nextPlaylists = currentPlaylists.map((playlist) => playlist.id !== playlistId
      ? playlist
      : { ...playlist, trackIds: playlist.trackIds.filter((id) => id !== track.id) });
    try {
      window.localStorage.setItem("symbiome-personal-playlists-v1", JSON.stringify(nextPlaylists));
    } catch {
      setActionStatus(`${track.title} could not be removed from ${target.name}.`);
      return;
    }
    replacePersonalPlaylists(nextPlaylists);
    if (highlightedTrackId === track.id) setHighlightedTrackId(null);
    setActionStatus(`${track.title} removed from ${target.name}.`);
  }

  async function deletePersonalPlaylist(playlist: PersonalPlaylist) {
    const currentPlaylists = personalPlaylistsRef.current;
    const currentPlaylist = currentPlaylists.find((item) => item.id === playlist.id);
    if (!currentPlaylist) {
      setPlaylistPendingDeletion(null);
      return;
    }
    const nextPlaylists = currentPlaylists.filter((item) => item.id !== playlist.id);
    window.localStorage.setItem("symbiome-personal-playlists-v1", JSON.stringify(nextPlaylists));
    personalPlaylistImageSelectionTokenCache.delete(playlist.id);
    replacePersonalPlaylists(nextPlaylists);
    setPlaylistPendingDeletion(null);
    closePersonalPlaylistMenu(false);
    if (activePersonalPlaylistId === playlist.id) {
      setActivePersonalPlaylistId(null);
      writePersonalPlaylistSelectionToLocation(null, "replace");
    }
    setActionStatus(`${playlist.name} deleted. Its tracks remain in the catalogue.`);

    if (currentPlaylist.imageKey && !nextPlaylists.some((item) => item.imageKey === currentPlaylist.imageKey)) {
      forgetCachedPersonalPlaylistImage(currentPlaylist.imageKey);
      try { await deletePersonalPlaylistImage(currentPlaylist.imageKey); } catch { /* Metadata deletion stays authoritative if local image cleanup is unavailable. */ }
    }
  }

  async function updatePersonalPlaylistImage(playlist: PersonalPlaylist, image: Blob, selectionToken: symbol) {
    const previousUpdate = personalPlaylistImageUpdateQueue.get(playlist.id) ?? Promise.resolve();
    const queuedUpdate = previousUpdate.catch(() => undefined).then(async () => {
      if (personalPlaylistImageSelectionTokenCache.get(playlist.id) !== selectionToken) return;
      const currentPlaylist = personalPlaylistsRef.current.find((item) => item.id === playlist.id);
      if (!currentPlaylist) throw new Error("This playlist is no longer available.");
      const imageKey = currentPlaylist.imageKey ?? personalPlaylistImageKey(currentPlaylist.id);
      let previousImage: Blob | null = null;
      if (currentPlaylist.imageKey) {
        try {
          previousImage = await loadPersonalPlaylistImage(imageKey);
        } catch {
          throw new Error("The current playlist image could not be read safely.");
        }
        if (personalPlaylistImageSelectionTokenCache.get(playlist.id) !== selectionToken) return;
      }
      await savePersonalPlaylistImage(imageKey, image);
      if (personalPlaylistImageSelectionTokenCache.get(playlist.id) !== selectionToken) {
        try {
          if (personalPlaylistsRef.current.some((item) => item.id === playlist.id) && previousImage) {
            await savePersonalPlaylistImage(imageKey, previousImage);
          } else {
            await deletePersonalPlaylistImage(imageKey);
          }
        } catch {
          throw new Error("The previous playlist image could not be restored.");
        }
        return;
      }
      const latestPlaylists = personalPlaylistsRef.current;
      const latestPlaylist = latestPlaylists.find((item) => item.id === playlist.id);
      if (!latestPlaylist) {
        forgetCachedPersonalPlaylistImage(imageKey);
        try { await deletePersonalPlaylistImage(imageKey); } catch { /* The deleted playlist remains authoritative. */ }
        throw new Error("This playlist is no longer available.");
      }
      const nextPlaylists = latestPlaylists.map((item) => item.id === latestPlaylist.id ? { ...item, imageKey } : item);
      if (latestPlaylist.imageKey !== imageKey) {
        try {
          window.localStorage.setItem("symbiome-personal-playlists-v1", JSON.stringify(nextPlaylists));
        } catch {
          forgetCachedPersonalPlaylistImage(imageKey);
          try { await deletePersonalPlaylistImage(imageKey); } catch { /* Do not hide the metadata persistence failure. */ }
          throw new Error("The playlist image could not be saved on this device.");
        }
      }
      rememberPersonalPlaylistImage(imageKey, image);
      replacePersonalPlaylists(nextPlaylists);
      setActionStatus(`${latestPlaylist.name} artwork updated.`);
    });
    personalPlaylistImageUpdateQueue.set(playlist.id, queuedUpdate);
    try {
      await queuedUpdate;
    } finally {
      if (personalPlaylistImageUpdateQueue.get(playlist.id) === queuedUpdate) {
        personalPlaylistImageUpdateQueue.delete(playlist.id);
      }
    }
  }

  async function createPersonalPlaylist(draft: PersonalPlaylistDraft) {
    const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `playlist-${Date.now()}`;
    const track = playlistComposerTrackId ? knownTracksRef.current.find((item) => item.id === playlistComposerTrackId) ?? null : null;
    let imageKey: string | null = null;
    if (draft.image) {
      try {
        imageKey = personalPlaylistImageKey(id);
        await savePersonalPlaylistImage(imageKey, draft.image);
        rememberPersonalPlaylistImage(imageKey, draft.image);
      } catch {
        imageKey = null;
      }
    }
    const playlist: PersonalPlaylist = {
      id,
      name: draft.name,
      description: draft.description,
      imageKey,
      trackIds: track ? [track.id] : [],
    };
    updatePersonalPlaylists((current) => [...current, playlist]);
    setPlaylistComposerTrackId(undefined);
    setActionStatus(track
      ? `${draft.name} created with ${track.title}.`
      : imageKey || !draft.image
        ? `${draft.name} created.`
        : `${draft.name} created with the default Symbiome artwork because the image could not be saved.`);
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

  async function copyTrackShareLink(track: WorkspaceTrack, shareUrl: string) {
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
      return true;
    }

    setActionStatus(`Select the link to ${track.title}, then copy it.`);
    return false;
  }

  function renderTrackTable(source: readonly WorkspaceTrack[], label: string, personalPlaylist: PersonalPlaylist | null = null): ReactNode {
    return (
      <div className="music-track-table" role="list" aria-label={label}>
        <div className="music-track-table-head" aria-hidden="true">
          <span>Track</span><span>Player</span><span>Genre</span><span>Mood</span><span>Actions</span>
        </div>
        {source.map((track, index) => {
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
                  openTrackMenu(track, rect.left + Math.min(rect.width - 12, 280), rect.top + 48, "actions", event.currentTarget, personalPlaylist?.id ?? null);
                  return;
                }
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                togglePreview(track);
              }}
              onContextMenu={(event) => {
                if (isTrackControl(event.target)) return;
                event.preventDefault();
                openTrackMenu(track, event.clientX, event.clientY, "actions", event.currentTarget, personalPlaylist?.id ?? null);
              }}
              key={track.id}
            >
              <div className="music-track-identity">
                <TrackCover src={track.cover} width={64} height={64} priority={index < VISIBLE_COVER_PRELOAD_LIMIT} />
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
                {isBusinessWorkspace && !personalPlaylist && <button className="music-track-license" type="button" onClick={() => openBusinessLicenseRequest(track)} aria-label={`License ${track.title}`} title="License this song"><TrackActionIcon kind="license" /></button>}
                <button className={liked.has(track.id) ? "is-liked" : ""} type="button" onClick={() => toggleLiked(track.id)} aria-label={`${liked.has(track.id) ? "Unlike" : "Like"} ${track.title}`} aria-pressed={liked.has(track.id)}><TrackActionIcon kind="like" active={liked.has(track.id)} /></button>
                <button type="button" onClick={(event) => openPlaylistChooser(track, event.currentTarget)} aria-label={`Add ${track.title} to a playlist`} aria-haspopup="menu" aria-controls="music-track-context-menu" aria-expanded={trackMenu?.trackId === track.id && trackMenu.mode === "playlists"}><TrackActionIcon kind="playlist" /></button>
                <button className={downloadedTrackIds.has(track.id) ? "is-downloaded" : ""} type="button" disabled={track.previewDownloadUrl === null} title={track.previewDownloadUrl === null ? "Licensed download unavailable" : undefined} onClick={() => void downloadTrackPreview(track)} aria-label={track.previewDownloadUrl === null ? `Licensed download unavailable for ${track.title}` : `Download preview of ${track.title}${downloadedTrackIds.has(track.id) ? " again" : ""}`}><TrackActionIcon kind="download" /></button>
                <button type="button" onClick={(event) => openShareChooser(track, event.currentTarget)} aria-label={`Share ${track.title}`} aria-haspopup="dialog" aria-controls="music-track-context-menu" aria-expanded={trackMenu?.trackId === track.id && trackMenu.mode === "share"}><TrackActionIcon kind="share" /></button>
                {personalPlaylist && <button className="music-track-remove-from-playlist" type="button" onClick={() => removeTrackFromPersonalPlaylist(track, personalPlaylist.id)} aria-label={`Remove ${track.title} from ${personalPlaylist.name}`} title="Remove from playlist"><TrackActionIcon kind="delete" /></button>}
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

  const usesWideCanvas = view === "discover" || view === "music" || view === "playlists" || view === "liked" || view === "downloads" || view === "license-song" || view === "custom-song";

  return (
    <div className={`creator-music-app${isBusinessWorkspace ? " business-music-app" : ""}${isGuestWorkspace ? " guest-music-app" : ""}`}>
      <aside className="music-app-sidebar">
        <div className="music-app-brand"><Brand compact /><span>{isBusinessWorkspace ? "Business" : isGuestWorkspace ? "Guest" : "Creator"}</span></div>

        <nav className="music-app-nav" aria-label={`${isBusinessWorkspace ? "Business" : isGuestWorkspace ? "Guest" : "Creator"} music navigation`}>
          {activeNavGroups.map((group) => (
            <div className="music-app-nav-section" key={group.label}>
              <span className="music-app-nav-label">{group.label}</span>
              {group.items.map((item) => {
                const badge = item.id === "playlists" ? String(lofiGirlPlaylists.length + personalPlaylists.length) : item.id === "liked" && liked.size ? String(liked.size) : undefined;
                return (
                  <button
                    className={view === item.id ? "is-active" : ""}
                    {...(item.mobileSecondary ? { "data-mobile-secondary": "true" } : {})}
                    type="button"
                    onClick={() => navigateToView(item.id)}
                    aria-current={view === item.id ? "page" : undefined}
                    key={item.id}
                  >
                    <i aria-hidden="true"><WorkspaceNavIcon kind={item.icon} /></i><strong>{item.label}</strong>{badge && <small>{badge}</small>}
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
            activeRole={workspaceRole}
            compact
            activeLibraryView={view === "channels" || view === "licences" || view === "license-song" || view === "custom-song" ? view : undefined}
            onOpenLibraryView={navigateToView}
          />
        </header>

        {view === "discover" && (
          <div className="music-library-view music-workspace-view">
            <section className="music-discovery-intro">
              <div><p>HUMAN-MADE MUSIC</p><h2>Start with a direction.<br />Find the right track.</h2><span>Browse the catalogue through real genres, moods, themes and artists.</span></div>
              <div className="music-catalogue-proof"><strong><CatalogueMetric metric="tracks" /></strong><span>published tracks ready to listen</span><i>0 AI-generated</i></div>
            </section>

            <section className="music-recent-releases" aria-labelledby="recent-releases-title">
              <div className="music-recent-head">
                <div>
                  <span>NEW IN THE CATALOGUE</span>
                  <h3 id="recent-releases-title">Recent releases</h3>
                  <p role="status" aria-live="polite">
                    {recentCatalogTracks !== null
                      ? `${recentTracks.length} latest ${recentTracks.length === 1 ? "release" : "releases"} from ${recentCatalogTotal} published ${recentCatalogTotal === 1 ? "release" : "releases"} with artwork.`
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
                {recentTracks.map((track, index) => {
                  const isActive = preview.activeTrackId === track.id;
                  const isPlaying = isActive && preview.isPlaying;
                  return (
                    <article className={isActive ? "is-active" : ""} role="listitem" key={track.release?.id ?? track.id}>
                      <button className="music-recent-cover" type="button" onClick={() => togglePreview(track)} aria-label={`${isPlaying ? "Pause" : "Play"} ${track.title} from ${track.release?.title ?? track.title} by ${track.artist}`} aria-pressed={isPlaying}>
                        <TrackCover src={track.cover} width={420} height={420} priority={index < 4} fallbackClassName="music-recent-cover-placeholder" />
                        <span className="music-recent-play"><PlaybackGlyph playing={isPlaying} /></span>
                      </button>
                      <div className="music-recent-copy"><strong>{track.release?.title ?? track.title}</strong><span>{track.artist}</span><small>{releaseMeta(track)}</small></div>
                      <button className="music-recent-share" type="button" onClick={(event) => openShareChooser(track, event.currentTarget)} aria-label={`Share ${track.title}`} aria-haspopup="dialog" aria-controls="music-track-context-menu" aria-expanded={trackMenu?.trackId === track.id && trackMenu.mode === "share"}><TrackActionIcon kind="share" /></button>
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
                {lofiGirlPlaylists.slice(0, 8).map((playlist, index) => <PlaylistCard playlist={playlist} onOpen={openPlaylist} priority={index < 4} key={playlist.id} />)}
              </div>
            </section>
          </div>
        )}

        {view === "music" && (
          <section className="music-track-browser music-workspace-view" aria-label="Music catalogue">
            {isBusinessWorkspace && <BusinessLibraryIntro onLicense={() => openBusinessLicenseRequest(null)} onCustom={() => navigateToView("custom-song")} />}
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
            activePersonalPlaylist={activePersonalPlaylist}
            cataloguePager={playlistCataloguePager}
            catalogueStatus={playlistCatalogueStatus}
            onCreatePlaylist={() => setPlaylistComposerTrackId(null)}
            onBack={closePlaylist}
            onChangePersonalImage={updatePersonalPlaylistImage}
            onOpen={openPlaylist}
            onOpenPersonal={openPersonalPlaylist}
            onDeletePersonal={requestPersonalPlaylistDeletion}
            onOpenPersonalMenu={openPersonalPlaylistMenu}
            onRetryPersonal={() => setCatalogRetryNonce((value) => value + 1)}
            personalPlaylists={personalPlaylists}
            personalPlaylistLoadState={personalPlaylistLoadState}
            personalTrackList={activePersonalPlaylist && activePersonalPlaylistTracks.length ? renderTrackTable(activePersonalPlaylistTracks, `${activePersonalPlaylist.name} tracks`, activePersonalPlaylist) : null}
            trackCount={activePlaylist && catalogViewIsCurrent ? catalogPagination?.total ?? visibleTracks.length : null}
            trackList={activePlaylist && catalogViewIsCurrent ? renderTrackTable(visibleTracks, `${activePlaylist.title} tracks`) : null}
          />
        )}
        {view === "downloads" && (
          <DownloadsLibrary
            loadState={downloadsLoadState}
            loadedCount={downloadedTracks.length}
            onRetry={() => setCatalogRetryNonce((value) => value + 1)}
            savedCount={downloadedTrackIds.size}
            trackList={downloadedTracks.length ? renderTrackTable(downloadedTracks, "Downloaded tracks") : null}
          />
        )}
        {view === "channels" && <ChannelsView />}
        {view === "licences" && <LicencesView />}
        {view === "license-song" && <BusinessWorkspaceRequest kind="license" selectedTrack={selectedBusinessLicenseTrack} onBrowseLibrary={showMusic} />}
        {view === "custom-song" && <BusinessWorkspaceRequest kind="custom" onBrowseLibrary={showMusic} />}
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
            <TrackCover src={selectedTrack.cover} width={52} height={52} priority />
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
            {isBusinessWorkspace && <button type="button" onClick={() => openBusinessLicenseRequest(selectedTrack)} aria-label={`License ${selectedTrack.title}`} title="License this song"><TrackActionIcon kind="license" /></button>}
            <button className={liked.has(selectedTrack.id) ? "is-liked" : ""} type="button" onClick={() => toggleLiked(selectedTrack.id)} aria-label={`${liked.has(selectedTrack.id) ? "Unlike" : "Like"} ${selectedTrack.title}`} aria-pressed={liked.has(selectedTrack.id)}><TrackActionIcon kind="like" active={liked.has(selectedTrack.id)} /></button>
            <button type="button" onClick={(event) => openPlaylistChooser(selectedTrack, event.currentTarget)} aria-label={`Add ${selectedTrack.title} to a playlist`} aria-haspopup="menu" aria-controls="music-track-context-menu" aria-expanded={trackMenu?.trackId === selectedTrack.id && trackMenu.mode === "playlists"}><TrackActionIcon kind="playlist" /></button>
            <button className={downloadedTrackIds.has(selectedTrack.id) ? "is-downloaded" : ""} type="button" disabled={selectedTrack.previewDownloadUrl === null} title={selectedTrack.previewDownloadUrl === null ? "Licensed download unavailable" : undefined} onClick={() => void downloadTrackPreview(selectedTrack)} aria-label={selectedTrack.previewDownloadUrl === null ? `Licensed download unavailable for ${selectedTrack.title}` : `Download preview of ${selectedTrack.title}${downloadedTrackIds.has(selectedTrack.id) ? " again" : ""}`}><TrackActionIcon kind="download" /></button>
            <button type="button" onClick={(event) => openShareChooser(selectedTrack, event.currentTarget)} aria-label={`Share ${selectedTrack.title}`} aria-haspopup="dialog" aria-controls="music-track-context-menu" aria-expanded={trackMenu?.trackId === selectedTrack.id && trackMenu.mode === "share"}><TrackActionIcon kind="share" /></button>
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
          onShowShare={() => setTrackMenu((current) => current ? { ...current, mode: "share" } : current)}
          onAddToPlaylist={(playlistId) => addTrackToPlaylist(menuTrack, playlistId)}
          onOpenPlaylistCreator={() => {
            setPlaylistComposerTrackId(menuTrack.id);
            closeTrackMenu(false);
          }}
          onDownload={() => void downloadTrackPreview(menuTrack)}
          shareUrl={trackMenu.mode === "share" ? createTrackShareUrl(menuTrack.id) : null}
          onCopyShareLink={(shareUrl) => copyTrackShareLink(menuTrack, shareUrl)}
          onLicense={isBusinessWorkspace ? () => openBusinessLicenseRequest(menuTrack) : undefined}
          removeFromPlaylistName={menuTrackPersonalPlaylist?.name ?? null}
          onRemoveFromPlaylist={() => {
            if (menuTrackPersonalPlaylist) removeTrackFromPersonalPlaylist(menuTrack, menuTrackPersonalPlaylist.id);
          }}
          canDownload={menuTrack.previewDownloadUrl !== null}
        />
      )}

      {personalPlaylistMenu && menuPersonalPlaylist && (
        <PersonalPlaylistContextMenu
          state={personalPlaylistMenu}
          playlist={menuPersonalPlaylist}
          onClose={closePersonalPlaylistMenu}
          onDelete={requestPersonalPlaylistDeletion}
        />
      )}

      {playlistPendingDeletion && (
        <PlaylistDeleteDialog
          playlist={playlistPendingDeletion}
          onClose={() => setPlaylistPendingDeletion(null)}
          onConfirm={deletePersonalPlaylist}
        />
      )}

      {playlistComposerTrackId !== undefined && (
        <PlaylistComposerDialog
          trackTitle={playlistComposerTrack?.title ?? null}
          onClose={() => setPlaylistComposerTrackId(undefined)}
          onCreate={createPersonalPlaylist}
        />
      )}

      <div className="music-action-status" role="status" aria-live="polite" aria-atomic="true">{actionStatus}</div>
    </div>
  );
}

function PlaylistLibrary({
  activePlaylist,
  activePersonalPlaylist,
  cataloguePager,
  catalogueStatus,
  onCreatePlaylist,
  onBack,
  onChangePersonalImage,
  onOpen,
  onOpenPersonal,
  onDeletePersonal,
  onOpenPersonalMenu,
  onRetryPersonal,
  personalPlaylists,
  personalPlaylistLoadState,
  personalTrackList,
  trackCount,
  trackList,
}: {
  activePlaylist: LofiGirlPlaylist | null;
  activePersonalPlaylist: PersonalPlaylist | null;
  cataloguePager: ReactNode;
  catalogueStatus: ReactNode;
  onCreatePlaylist: () => void;
  onBack: () => void;
  onChangePersonalImage: (playlist: PersonalPlaylist, image: Blob, selectionToken: symbol) => Promise<void>;
  onOpen: (playlist: LofiGirlPlaylist) => void;
  onOpenPersonal: (playlist: PersonalPlaylist) => void;
  onDeletePersonal: (playlist: PersonalPlaylist) => void;
  onOpenPersonalMenu: (playlist: PersonalPlaylist, x: number, y: number, opener: HTMLElement) => void;
  onRetryPersonal: () => void;
  personalPlaylists: readonly PersonalPlaylist[];
  personalPlaylistLoadState: "idle" | "loading" | "error";
  personalTrackList: ReactNode;
  trackCount: number | null;
  trackList: ReactNode;
}) {
  const accent = activePlaylist ? getPlaylistAccent(activePlaylist) : null;
  const style = activePlaylist && accent ? {
    "--playlist-accent": accent.color,
    "--playlist-accent-ink": accent.ink,
    "--playlist-position": activePlaylist.imagePosition ?? "center",
  } as CSSProperties : undefined;
  const personalStyle = activePersonalPlaylist ? {
    "--playlist-accent": "#e06343",
    "--playlist-accent-ink": "#292832",
    "--playlist-position": "center",
  } as CSSProperties : undefined;
  const isPlaylistDetail = Boolean(activePlaylist || activePersonalPlaylist);

  return (
    <div className={`music-secondary-view music-playlists-view music-workspace-view${isPlaylistDetail ? " is-playlist-detail" : ""}`}>
      {activePlaylist ? (
        <>
          <section id="music-playlist-detail-hero" className="music-playlist-detail-hero" style={style} aria-labelledby="music-playlist-detail-title" tabIndex={-1}>
            <PlaylistHeroArtwork playlist={activePlaylist} />
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
      ) : activePersonalPlaylist ? (
        <>
          <section id="music-playlist-detail-hero" className="music-playlist-detail-hero is-personal" style={personalStyle} aria-labelledby="music-playlist-detail-title" tabIndex={-1}>
            <PersonalPlaylistArtwork playlist={activePersonalPlaylist} className="music-playlist-detail-photo" eager />
            <span className="music-playlist-detail-shade" aria-hidden="true" />
            <button className="music-playlist-detail-back" type="button" onClick={onBack}><span aria-hidden="true">←</span> All playlists</button>
            <PersonalPlaylistImagePicker playlist={activePersonalPlaylist} onChange={onChangePersonalImage} />
            <button className="music-playlist-detail-delete" type="button" onClick={() => onDeletePersonal(activePersonalPlaylist)} aria-label={`Delete playlist ${activePersonalPlaylist.name}`} title="Delete playlist"><TrackActionIcon kind="delete" /></button>
            <div className="music-playlist-detail-copy">
              <span className="music-playlist-detail-kicker">MY PLAYLIST</span>
              <h2 id="music-playlist-detail-title">{activePersonalPlaylist.name}</h2>
              {activePersonalPlaylist.description && <p>{activePersonalPlaylist.description}</p>}
              <div className="music-playlist-detail-meta" aria-label="Playlist details">
                <span>Created by you</span>
                <strong>{activePersonalPlaylist.trackIds.length} {activePersonalPlaylist.trackIds.length === 1 ? "track" : "tracks"}</strong>
              </div>
            </div>
          </section>
          <section className="music-playlist-detail-tracks" aria-labelledby="music-playlist-tracks-title">
            <div className="music-playlist-detail-track-head"><span>IN THIS PLAYLIST</span><h3 id="music-playlist-tracks-title">Tracks</h3></div>
            {personalPlaylistLoadState === "loading" && <p className="music-track-results-status music-playlist-detail-status" role="status" aria-live="polite">Loading saved tracks…</p>}
            {personalPlaylistLoadState === "error" && (
              <p className="music-track-results-status music-playlist-detail-status" role="status" aria-live="polite">
                Some saved tracks could not be loaded right now.
                <button className="cta-swipe" type="button" onClick={onRetryPersonal}>Retry playlist</button>
              </p>
            )}
            {personalTrackList ?? (
              <div className="music-empty-library"><strong>No tracks yet.</strong><p>Add tracks from Music and they will appear here.</p></div>
            )}
          </section>
        </>
      ) : (
        <>
          <section className="music-personal-playlists" aria-labelledby="personal-playlists-title">
            <div className="music-playlist-category-head">
              <div><span>YOUR LIBRARY</span><h2 id="personal-playlists-title">My playlists</h2><p>Your own collections, with optional artwork and notes.</p></div>
              <button className="cta-swipe" type="button" onClick={onCreatePlaylist}>Create playlist</button>
            </div>
            <div className="music-secondary-playlists">
              {personalPlaylists.length
                ? personalPlaylists.map((playlist, index) => <PersonalPlaylistCard playlist={playlist} onOpen={onOpenPersonal} onDelete={onDeletePersonal} onOpenMenu={onOpenPersonalMenu} priority={index < 3} key={playlist.id} />)
                : <div className="music-personal-playlists-empty"><strong>No personal playlists yet.</strong><p>Create one to collect tracks from the catalogue.</p></div>}
            </div>
          </section>
          <section className="music-symbiome-playlists" aria-labelledby="symbiome-playlists-title">
            <div className="music-playlist-category-head"><div><span>CURATED BY SYMBIOME</span><h2 id="symbiome-playlists-title">Symbiome playlists</h2><p>Official listening directions curated from the catalogue.</p></div></div>
            <div className="music-secondary-playlists">{lofiGirlPlaylists.map((playlist, index) => <PlaylistCard playlist={playlist} onOpen={onOpen} priority={index < 3} key={playlist.id} />)}</div>
          </section>
        </>
      )}
    </div>
  );
}

function DownloadsLibrary({ loadState, loadedCount, onRetry, savedCount, trackList }: { loadState: "idle" | "loading" | "error"; loadedCount: number; onRetry: () => void; savedCount: number; trackList: ReactNode | null }) {
  return (
    <div className="music-secondary-view music-track-browser music-workspace-view">
      {loadState === "loading" && savedCount > loadedCount && <p className="music-track-results-status music-downloads-sync-status" role="status" aria-live="polite">Loading {savedCount - loadedCount} saved {savedCount - loadedCount === 1 ? "download" : "downloads"}…</p>}
      {loadState === "error" && savedCount > loadedCount && (
        <p className="music-track-results-status music-playlist-detail-status music-downloads-sync-status" role="status" aria-live="polite">
          Some saved downloads could not be loaded right now.
          <button className="cta-swipe" type="button" onClick={onRetry}>Retry downloads</button>
        </p>
      )}
      {loadState === "idle" && savedCount > loadedCount && <p className="music-track-results-status music-downloads-sync-status" role="status" aria-live="polite">{loadedCount} loaded of {savedCount} saved downloads.</p>}
      {trackList ?? (savedCount === 0 ? <div className="music-empty-library"><strong>No downloads yet.</strong><p>Download a track from Music and it will appear here.</p></div> : null)}
    </div>
  );
}

function ChannelsView() {
  return <div className="music-secondary-view"><header><span>ACCOUNT</span><h2>Channels</h2><p>Creator plans will keep the channels and profiles connected to your account in one place.</p></header><div className="music-empty-library"><strong>No channels connected yet.</strong><p>Channel connections will appear here when creator subscriptions are enabled.</p></div></div>;
}

function LicencesView() {
  return <div className="music-secondary-view"><header><span>ACCOUNT</span><h2>Licences</h2><p>Each confirmed licence and its exact scope will be kept here.</p></header><div className="music-empty-library"><strong>No licences issued yet.</strong><p>Saving, previewing or downloading a listening copy does not create a licence.</p></div></div>;
}

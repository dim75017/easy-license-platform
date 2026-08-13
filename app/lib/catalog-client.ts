import {
  useCategories,
  type MusicUseSlug,
  type WorkspaceTrack,
} from "../data/catalog";

type CatalogPage = {
  tracks: WorkspaceTrack[];
  total: number;
};

const knownThemes = new Set<string>(useCategories.map(({ slug }) => slug));
const coverPath = /^\/api\/catalog\/releases\/\d+\/cover$/u;
const playbackPath = /^\/api\/catalog\/tracks\/\d+\/stream$/u;

/**
 * Keep the browser boundary deliberately smaller than the server response.
 * Source/storage identifiers and ingestion metadata are neither accepted nor
 * copied into UI state.
 */
export function parseCatalogPage(payload: unknown): CatalogPage | null {
  if (!isRecord(payload) || !Array.isArray(payload.tracks) || !isRecord(payload.pagination)) return null;

  const total = payload.pagination.total;
  if (!Number.isSafeInteger(total) || (total as number) < 0) return null;

  const tracks = payload.tracks.flatMap((value): WorkspaceTrack[] => {
    if (!isRecord(value)) return [];

    const numericId = value.id;
    const title = cleanText(value.title, 240);
    const artist = cleanText(value.artist, 240);
    const playbackUrl = cleanPath(value.playbackUrl, playbackPath);
    if (!Number.isSafeInteger(numericId) || (numericId as number) <= 0 || !title || !artist || !playbackUrl) return [];

    const release = isRecord(value.release) ? value.release : null;
    const cover = release ? cleanPath(release.coverUrl, coverPath) : null;
    const durationMs = Number.isSafeInteger(value.durationMs) && (value.durationMs as number) > 0
      ? value.durationMs as number
      : null;
    const durationSeconds = durationMs === null ? null : Math.round(durationMs / 1000);
    const genre = cleanText(value.genre, 120) ?? "Unclassified";
    const mood = cleanText(value.mood, 120);
    const theme = cleanText(value.theme, 120);

    return [{
      id: `CATALOG-${numericId}`,
      spotifyId: null,
      previewUrl: playbackUrl,
      previewDownloadUrl: null,
      spotifyUrl: null,
      title,
      artist,
      cover,
      genre,
      moods: mood ? [mood] : [],
      themes: theme && knownThemes.has(theme) ? [theme as MusicUseSlug] : [],
      duration: durationSeconds === null ? null : formatDuration(durationSeconds),
      durationIso: durationSeconds === null ? null : toDurationIso(durationSeconds),
      bpm: null,
    }];
  });

  return { tracks, total: total as number };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/gu, " ");
  if (!normalized || normalized.length > maxLength || /[\u0000-\u001f\u007f]/u.test(normalized)) return null;
  return normalized;
}

function cleanPath(value: unknown, pattern: RegExp): string | null {
  return typeof value === "string" && pattern.test(value) ? value : null;
}

function formatDuration(totalSeconds: number): `${number}:${number}` {
  const minutes = Math.floor(totalSeconds / 60);
  return `${minutes}:${String(totalSeconds % 60).padStart(2, "0")}` as `${number}:${number}`;
}

function toDurationIso(totalSeconds: number): `PT${number}M${number}S` {
  const minutes = Math.floor(totalSeconds / 60);
  return `PT${minutes}M${totalSeconds % 60}S` as `PT${number}M${number}S`;
}

import {
  useCategories,
  type MusicUseSlug,
  type WorkspaceRelease,
  type WorkspaceTrack,
} from "../data/catalog";

export type CatalogPagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  returned: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  previousPage: number | null;
  nextPage: number | null;
};

export type CatalogPage = {
  tracks: WorkspaceTrack[];
  pagination: CatalogPagination;
  view: "tracks" | "releases";
};

const knownThemes = new Set<string>(useCategories.map(({ slug }) => slug));
const canonicalCatalogApiOrigin = "https://easy-license.dsomoguy.chatgpt.site";
export const catalogApiOrigin =
  process.env.NEXT_PUBLIC_CATALOG_API_ORIGIN === canonicalCatalogApiOrigin
    ? canonicalCatalogApiOrigin
    : "";
const coverPath = /^\/api\/catalog\/releases\/(\d+)\/cover$/u;
const playbackPath = /^\/api\/catalog\/tracks\/(\d+)\/stream$/u;
const releaseDatePattern = /^\d{4}(?:-(?:0[1-9]|1[0-2])(?:-(?:0[1-9]|[12]\d|3[01]))?)?$/u;

/**
 * Keep the browser boundary deliberately smaller than the server response.
 * Source/storage identifiers and ingestion metadata are neither accepted nor
 * copied into UI state.
 */
export function parseCatalogPage(payload: unknown): CatalogPage | null {
  if (!isRecord(payload) || !Array.isArray(payload.tracks)) return null;

  const pagination = parsePagination(payload.pagination);
  const view = payload.view === "releases" ? "releases" : payload.view === "tracks" ? "tracks" : null;
  if (!pagination || !view) return null;

  const tracks = payload.tracks.flatMap((value): WorkspaceTrack[] => {
    if (!isRecord(value)) return [];

    const numericId = value.id;
    const title = cleanText(value.title, 500);
    const artist = cleanText(value.artist, 1000);
    const playbackPathname = cleanPath(value.playbackUrl, playbackPath);
    if (!Number.isSafeInteger(numericId) || (numericId as number) <= 0 || !title || !artist || !playbackPathname) return [];
    if (Number(playbackPathname.match(playbackPath)?.[1]) !== numericId) return [];

    const release = parseRelease(value.release);
    if (!release) return [];
    const coverPathname = cleanPath(value.release && isRecord(value.release) ? value.release.coverUrl : null, coverPath);
    if (coverPathname && `CATALOG-RELEASE-${coverPathname.match(coverPath)?.[1]}` !== release.id) return [];
    const playbackUrl = catalogAssetUrl(playbackPathname);
    const cover = coverPathname
      ? catalogAssetUrl(`${coverPathname}?variant=thumbnail`)
      : null;

    const durationMs = Number.isSafeInteger(value.durationMs) && (value.durationMs as number) > 0
      ? value.durationMs as number
      : null;
    const durationSeconds = durationMs === null ? null : Math.round(durationMs / 1000);
    const genre = cleanText(value.genre, 120) ?? "Unclassified";
    const mood = cleanText(value.mood, 120);
    const theme = cleanText(value.theme, 120);
    const publishedAt = cleanText(value.publishedAt, 40);

    return [{
      id: `CATALOG-${numericId}`,
      spotifyId: null,
      previewUrl: playbackUrl,
      previewDownloadUrl: playbackUrl,
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
      release,
      publishedAt,
    }];
  });

  return { tracks, pagination, view };
}

function parsePagination(value: unknown): CatalogPagination | null {
  if (!isRecord(value)) return null;

  const page = safeInteger(value.page, 1);
  const pageSize = safeInteger(value.pageSize, 1);
  const total = safeInteger(value.total, 0);
  const totalPages = safeInteger(value.totalPages, 0);
  const returned = safeInteger(value.returned, 0);
  if (page === null || pageSize === null || total === null || totalPages === null || returned === null) return null;
  if (typeof value.hasPreviousPage !== "boolean" || typeof value.hasNextPage !== "boolean") return null;

  const previousPage = nullablePositiveInteger(value.previousPage);
  const nextPage = nullablePositiveInteger(value.nextPage);
  if (previousPage === undefined || nextPage === undefined) return null;
  if (totalPages !== (total === 0 ? 0 : Math.ceil(total / pageSize))) return null;
  if (returned > pageSize) return null;
  if (value.hasPreviousPage !== (previousPage !== null) || value.hasNextPage !== (nextPage !== null)) return null;
  if (previousPage !== null && previousPage !== page - 1) return null;
  if (nextPage !== null && nextPage !== page + 1) return null;

  return {
    page,
    pageSize,
    total,
    totalPages,
    returned,
    hasPreviousPage: value.hasPreviousPage,
    hasNextPage: value.hasNextPage,
    previousPage,
    nextPage,
  };
}

function parseRelease(value: unknown): WorkspaceRelease | null {
  if (!isRecord(value) || !Number.isSafeInteger(value.id) || (value.id as number) <= 0) return null;
  const title = cleanText(value.title, 500);
  const type = cleanText(value.type, 40);
  const upc = value.upc === null ? null : cleanText(value.upc, 14);
  const releaseDate = value.releaseDate === null ? null : cleanText(value.releaseDate, 10);
  const trackCount = value.trackCount === null ? null : safeInteger(value.trackCount, 1);
  if (!title || !type || (value.trackCount !== null && trackCount === null)) return null;
  if (value.upc !== null && (!upc || !/^\d{8,14}$/u.test(upc))) return null;
  if (releaseDate && !releaseDatePattern.test(releaseDate)) return null;

  return {
    id: `CATALOG-RELEASE-${value.id}`,
    title,
    type,
    upc,
    releaseDate,
    trackCount,
  };
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

function catalogAssetUrl(pathname: string): string {
  return catalogApiOrigin ? new URL(pathname, catalogApiOrigin).toString() : pathname;
}

function safeInteger(value: unknown, minimum: number): number | null {
  return Number.isSafeInteger(value) && (value as number) >= minimum ? value as number : null;
}

function nullablePositiveInteger(value: unknown): number | null | undefined {
  if (value === null) return null;
  return safeInteger(value, 1) ?? undefined;
}

function formatDuration(totalSeconds: number): `${number}:${number}` {
  const minutes = Math.floor(totalSeconds / 60);
  return `${minutes}:${String(totalSeconds % 60).padStart(2, "0")}` as `${number}:${number}`;
}

function toDurationIso(totalSeconds: number): `PT${number}M${number}S` {
  const minutes = Math.floor(totalSeconds / 60);
  return `PT${minutes}M${totalSeconds % 60}S` as `PT${number}M${number}S`;
}

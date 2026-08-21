import { requireCatalogDatabase } from "@/db/catalog-runtime";
import {
  catalogErrorResponse,
  CatalogApiError,
  noStoreJson,
} from "../_lib/http";
import { normalizeCatalogText } from "../_lib/metadata";
import {
  publicCatalogOptionsResponse,
  publicCatalogResponse,
} from "../_lib/public-read";
import { moodFilterAliases, moodFilterGenreFallbacks } from "../../../lib/catalog-moods";
import { catalogPlaylistRule } from "../../../lib/catalog-playlists";

const DEFAULT_PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 100;
const MAX_TRACK_ID = 2_147_483_647;

type CatalogTrackRow = {
  id: number;
  title: string;
  artist_credit: string;
  version_label: string | null;
  isrc: string | null;
  duration_ms: number | null;
  genre: string | null;
  mood: string | null;
  theme: string | null;
  release_id: number;
  release_title: string;
  release_type: string;
  upc: string | null;
  release_date: string | null;
  has_cover: number;
  published_at: string;
  disc_number: number;
  track_number: number | null;
  release_track_count: number;
  release_rank: number;
};

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const page = queryInteger(url, "page", 1, 1, 1_000_000);
    const pageSize = queryInteger(
      url,
      "pageSize",
      DEFAULT_PAGE_SIZE,
      1,
      MAX_PAGE_SIZE,
    );
    const search = queryText(url, "q", 160);
    const genre = queryText(url, "genre", 120);
    const mood = queryText(url, "mood", 120);
    const theme = queryText(url, "theme", 120);
    const playlist = queryText(url, "playlist", 80);
    const playlistRule = playlist ? catalogPlaylistRule(playlist) : null;
    if (playlist && !playlistRule) {
      throw new CatalogApiError("playlist is invalid.");
    }
    const trackId = queryOptionalInteger(url, "trackId", 1, MAX_TRACK_ID);
    const onePerRelease = queryBoolean(url, "onePerRelease", false);
    const releaseTrackCountIsComplete = !search && !genre && !mood && !theme && !playlist && trackId === null;
    if (trackId !== null && onePerRelease) {
      throw new CatalogApiError(
        "trackId and onePerRelease cannot be used together.",
      );
    }
    const offset = (page - 1) * pageSize;

    const filters = [
      "t.status = 'published'",
      "t.rights_status = 'cleared'",
      "r.status = 'published'",
      `EXISTS (
        SELECT 1
        FROM track_assets playable
        WHERE playable.track_id = t.id
          AND playable.kind = 'streaming_copy'
          AND playable.status = 'available'
      )`,
    ];
    const parameters: unknown[] = [];

    if (search) {
      filters.push(
        "(t.normalized_title LIKE ? ESCAPE '\\' OR a.normalized_name LIKE ? ESCAPE '\\' OR r.normalized_title LIKE ? ESCAPE '\\')",
      );
      const pattern = `%${escapeLike(normalizeCatalogText(search))}%`;
      parameters.push(pattern, pattern, pattern);
    }
    if (genre) {
      filters.push("t.genre = ?");
      parameters.push(genre);
    }
    if (mood) {
      const acceptedMoods = moodFilterAliases(mood);
      const fallbackGenres = moodFilterGenreFallbacks(mood);
      const moodPlaceholders = acceptedMoods.map(() => "?").join(", ");
      if (fallbackGenres.length) {
        const genrePlaceholders = fallbackGenres.map(() => "?").join(", ");
        filters.push(`(t.mood IN (${moodPlaceholders}) OR (t.mood IS NULL AND t.genre IN (${genrePlaceholders})))`);
        parameters.push(...acceptedMoods, ...fallbackGenres);
      } else {
        filters.push(`t.mood IN (${moodPlaceholders})`);
        parameters.push(...acceptedMoods);
      }
    }
    if (theme) {
      filters.push("t.theme = ?");
      parameters.push(theme);
    }
    if (playlistRule) {
      filters.push(`t.genre IN (${playlistRule.genres.map(() => "?").join(", ")})`);
      parameters.push(...playlistRule.genres);
    }
    if (trackId !== null) {
      filters.push("t.id = ?");
      parameters.push(trackId);
    }

    const whereClause = filters.join(" AND ");
    const database = requireCatalogDatabase();
    const countStatement = database.prepare(
      `SELECT COUNT(${onePerRelease ? "DISTINCT r.id" : "*"}) AS total
       FROM tracks t
       JOIN releases r ON r.id = t.release_id
       JOIN artists a ON a.id = t.primary_artist_id
       WHERE ${whereClause}`,
    );
    const count = await bindIfNeeded(countStatement, parameters).first<{
      total: number;
    }>();
    const total = Number(count?.total ?? 0);

    const listStatement = database.prepare(
      `WITH eligible_tracks AS (
        SELECT
          t.id,
          t.title,
          t.artist_credit,
          t.version_label,
          t.isrc,
          t.duration_ms,
          t.genre,
          t.mood,
          t.theme,
          t.disc_number,
          t.track_number,
          COALESCE(t.published_at, t.created_at) AS published_at,
          r.id AS release_id,
          r.title AS release_title,
          r.type AS release_type,
          r.upc,
          r.release_date,
          CASE WHEN r.cover_storage_key IS NULL THEN 0 ELSE 1 END AS has_cover,
          COUNT(*) OVER (PARTITION BY r.id) AS release_track_count,
          ROW_NUMBER() OVER (
            PARTITION BY r.id
            ORDER BY
              t.disc_number ASC,
              CASE WHEN t.track_number IS NULL THEN 1 ELSE 0 END ASC,
              t.track_number ASC,
              t.id ASC
          ) AS release_rank
        FROM tracks t
        JOIN releases r ON r.id = t.release_id
        JOIN artists a ON a.id = t.primary_artist_id
        WHERE ${whereClause}
       )
       SELECT *
       FROM eligible_tracks
       ${onePerRelease ? "WHERE release_rank = 1" : ""}
       ORDER BY
         CASE WHEN release_date IS NULL THEN 1 ELSE 0 END ASC,
         release_date DESC,
         published_at DESC,
         release_id DESC,
         disc_number ASC,
         CASE WHEN track_number IS NULL THEN 1 ELSE 0 END ASC,
         track_number ASC,
         id ASC
       LIMIT ? OFFSET ?`,
    );
    const rows = await bindIfNeeded(listStatement, [
      ...parameters,
      pageSize,
      offset,
    ]).all<CatalogTrackRow>();

    const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
    const hasPreviousPage = page > 1 && total > 0;
    const hasNextPage = page < totalPages;

    return publicCatalogResponse(noStoreJson({
      tracks: rows.results.map((row) => ({
        id: row.id,
        title: row.title,
        artist: row.artist_credit,
        version: row.version_label,
        isrc: row.isrc,
        durationMs: row.duration_ms,
        genre: row.genre,
        mood: row.mood,
        theme: row.theme,
        release: {
          id: row.release_id,
          title: row.release_title,
          type: row.release_type,
          upc: row.upc,
          releaseDate: row.release_date,
          coverUrl:
            row.has_cover === 1
              ? `/api/catalog/releases/${row.release_id}/cover`
              : null,
          trackCount: releaseTrackCountIsComplete
            ? row.release_track_count
            : null,
        },
        publishedAt: row.published_at,
        playbackUrl: `/api/catalog/tracks/${row.id}/stream`,
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        returned: rows.results.length,
        hasPreviousPage,
        hasNextPage,
        previousPage: hasPreviousPage ? page - 1 : null,
        nextPage: hasNextPage ? page + 1 : null,
      },
      view: onePerRelease ? "releases" : "tracks",
      filters: { q: search, genre, mood, theme, playlist, trackId },
    }));
  } catch (error) {
    return publicCatalogResponse(catalogErrorResponse(error));
  }
}

export function OPTIONS(): Response {
  return publicCatalogOptionsResponse();
}

function bindIfNeeded(
  statement: D1PreparedStatement,
  parameters: unknown[],
): D1PreparedStatement {
  return parameters.length > 0 ? statement.bind(...parameters) : statement;
}

function queryInteger(
  url: URL,
  key: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const value = url.searchParams.get(key);
  if (value === null || value === "") return fallback;
  if (!/^\d+$/u.test(value)) {
    throw new CatalogApiError(`${key} must be an integer.`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new CatalogApiError(`${key} must be between ${min} and ${max}.`);
  }
  return parsed;
}

function queryOptionalInteger(
  url: URL,
  key: string,
  min: number,
  max: number,
): number | null {
  const value = url.searchParams.get(key);
  if (value === null || value === "") return null;
  if (!/^\d+$/u.test(value)) {
    throw new CatalogApiError(`${key} must be an integer.`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new CatalogApiError(`${key} must be between ${min} and ${max}.`);
  }
  return parsed;
}

function queryBoolean(url: URL, key: string, fallback: boolean): boolean {
  const value = url.searchParams.get(key);
  if (value === null || value === "") return fallback;
  if (value === "1" || value === "true") return true;
  if (value === "0" || value === "false") return false;
  throw new CatalogApiError(`${key} must be a boolean.`);
}

function queryText(url: URL, key: string, maxLength: number): string | null {
  const value = url.searchParams.get(key)?.trim() ?? "";
  if (!value) return null;
  if (value.length > maxLength || /[\u0000-\u001f\u007f]/u.test(value)) {
    throw new CatalogApiError(`${key} is invalid.`);
  }
  return value;
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/gu, "\\$&");
}

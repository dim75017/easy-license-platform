import { requireCatalogDatabase } from "@/db/catalog-runtime";
import { requireCatalogIdentity } from "../_lib/auth";
import {
  catalogErrorResponse,
  CatalogApiError,
  noStoreJson,
} from "../_lib/http";
import { normalizeCatalogText } from "../_lib/metadata";

const DEFAULT_PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 100;

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
};

export async function GET(request: Request): Promise<Response> {
  try {
    requireCatalogIdentity(request);
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
      filters.push("t.mood = ?");
      parameters.push(mood);
    }
    if (theme) {
      filters.push("t.theme = ?");
      parameters.push(theme);
    }

    const whereClause = filters.join(" AND ");
    const database = requireCatalogDatabase();
    const countStatement = database.prepare(
      `SELECT COUNT(*) AS total
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
      `SELECT
        t.id,
        t.title,
        t.artist_credit,
        t.version_label,
        t.isrc,
        t.duration_ms,
        t.genre,
        t.mood,
        t.theme,
        r.id AS release_id,
        r.title AS release_title,
        r.type AS release_type,
        r.upc,
        r.release_date,
        CASE WHEN r.cover_storage_key IS NULL THEN 0 ELSE 1 END AS has_cover
       FROM tracks t
       JOIN releases r ON r.id = t.release_id
       JOIN artists a ON a.id = t.primary_artist_id
       WHERE ${whereClause}
       ORDER BY COALESCE(t.published_at, t.created_at) DESC, t.id DESC
       LIMIT ? OFFSET ?`,
    );
    const rows = await bindIfNeeded(listStatement, [
      ...parameters,
      pageSize,
      offset,
    ]).all<CatalogTrackRow>();

    return noStoreJson({
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
        },
        playbackUrl: `/api/catalog/tracks/${row.id}/stream`,
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
      },
      filters: { q: search, genre, mood, theme },
    });
  } catch (error) {
    return catalogErrorResponse(error);
  }
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

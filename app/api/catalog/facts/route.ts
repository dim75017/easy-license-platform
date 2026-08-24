import { requireCatalogDatabase } from "@/db/catalog-runtime";
import { catalogErrorResponse } from "../_lib/http";
import {
  publicCatalogOptionsResponse,
  publicCatalogResponse,
} from "../_lib/public-read";

type CatalogueFactsRow = {
  track_count: number;
  artist_count: number;
  release_count: number;
  genre_count: number;
  latest_publication: string | null;
};

export async function GET(): Promise<Response> {
  try {
    const row = await requireCatalogDatabase()
      .prepare(
        `SELECT
           COUNT(DISTINCT t.id) AS track_count,
           COUNT(DISTINCT t.primary_artist_id) AS artist_count,
           COUNT(DISTINCT t.release_id) AS release_count,
           COUNT(DISTINCT NULLIF(TRIM(t.genre), '')) AS genre_count,
           MAX(COALESCE(t.published_at, t.updated_at)) AS latest_publication
         FROM tracks t
         JOIN releases r ON r.id = t.release_id
         WHERE t.status = 'published'
           AND t.rights_status = 'cleared'
           AND r.status = 'published'
           AND EXISTS (
             SELECT 1
             FROM track_assets playable
             WHERE playable.track_id = t.id
               AND playable.kind = 'streaming_copy'
               AND playable.status = 'available'
           )`,
      )
      .first<CatalogueFactsRow>();

    const response = Response.json(
      {
        catalogue: {
          tracks: safeCount(row?.track_count),
          artists: safeCount(row?.artist_count),
          releases: safeCount(row?.release_count),
          genres: safeCount(row?.genre_count),
          aiGeneratedTracks: 0,
        },
        latestPublication: row?.latest_publication ?? null,
      },
      {
        headers: {
          "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
        },
      },
    );
    return publicCatalogResponse(response);
  } catch (error) {
    return publicCatalogResponse(catalogErrorResponse(error));
  }
}

export function OPTIONS(): Response {
  return publicCatalogOptionsResponse();
}

function safeCount(value: number | undefined): number {
  const count = Number(value ?? 0);
  return Number.isSafeInteger(count) && count >= 0 ? count : 0;
}

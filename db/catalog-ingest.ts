import { requireCatalogDatabase } from "./catalog-runtime";
import type {
  CatalogMetadataBatch,
  CatalogMetadataItem,
} from "@/app/api/catalog/_lib/metadata";

type IdRow = { id: number };
type IngestRow = {
  id: number;
  track_id: number | null;
  status: string;
};

export type MetadataIngestResult = {
  index: number;
  ingestId: number;
  trackId: number | null;
  state: "ready" | "in_progress";
};

export async function ingestMetadataBatch(
  batch: CatalogMetadataBatch,
): Promise<MetadataIngestResult[]> {
  const database = requireCatalogDatabase();
  const results: MetadataIngestResult[] = [];

  for (let index = 0; index < batch.items.length; index += 1) {
    const item = batch.items[index];
    results.push(await ingestMetadataItem(database, batch.batchKey, item, index));
  }

  await database.prepare("PRAGMA optimize").run();
  return results;
}

async function ingestMetadataItem(
  database: D1Database,
  batchKey: string,
  item: CatalogMetadataItem,
  index: number,
): Promise<MetadataIngestResult> {
  await database
    .prepare(
      `INSERT INTO ingest_items (
        batch_key,
        source_key,
        source_row_number,
        source_file_name,
        source_sha256,
        declared_title,
        declared_artist,
        declared_duration_ms,
        status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'discovered')
      ON CONFLICT(batch_key, source_key) DO UPDATE SET
        source_row_number = excluded.source_row_number,
        source_file_name = excluded.source_file_name,
        source_sha256 = COALESCE(excluded.source_sha256, ingest_items.source_sha256),
        declared_title = excluded.declared_title,
        declared_artist = excluded.declared_artist,
        declared_duration_ms = excluded.declared_duration_ms,
        updated_at = CURRENT_TIMESTAMP`,
    )
    .bind(
      batchKey,
      item.sourceKey,
      item.sourceRowNumber,
      item.sourceFileName,
      item.sourceSha256,
      item.title,
      item.artistCredit,
      item.durationMs,
    )
    .run();

  const ingest = await database
    .prepare(
      `SELECT id, track_id, status
       FROM ingest_items
       WHERE batch_key = ? AND source_key = ?
       LIMIT 1`,
    )
    .bind(batchKey, item.sourceKey)
    .first<IngestRow>();

  if (!ingest) {
    throw new Error("The ingest item could not be created.");
  }

  if (ingest.track_id === null) {
    const claim = await database
      .prepare(
        `UPDATE ingest_items
         SET status = 'inspecting', updated_at = CURRENT_TIMESTAMP
         WHERE id = ?
           AND track_id IS NULL
           AND (
             status IN ('discovered', 'failed', 'ready', 'needs_review')
             OR updated_at < datetime('now', '-10 minutes')
           )`,
      )
      .bind(ingest.id)
      .run();

    if ((claim.meta.changes ?? 0) === 0) {
      const concurrent = await database
        .prepare("SELECT track_id FROM ingest_items WHERE id = ?")
        .bind(ingest.id)
        .first<{ track_id: number | null }>();
      return {
        index,
        ingestId: ingest.id,
        trackId: concurrent?.track_id ?? null,
        state: concurrent?.track_id ? "ready" : "in_progress",
      };
    }
  }

  try {
    const artistId = await findOrCreateArtist(database, item);
    const releaseId = await findOrCreateRelease(database, artistId, item);
    const trackId =
      ingest.track_id ??
      (await findOrCreateTrack(database, releaseId, artistId, item));

    await updateTrack(database, trackId, releaseId, artistId, item);
    await upsertSpotifyMatch(database, trackId, item);

    const ingestStatus =
      item.catalogStatus === "needs_review" ? "needs_review" : "ready";
    await database
      .prepare(
        `UPDATE ingest_items
         SET track_id = ?,
             status = ?,
             failure_code = NULL,
             review_note = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
      )
      .bind(trackId, ingestStatus, ingest.id)
      .run();

    return { index, ingestId: ingest.id, trackId, state: "ready" };
  } catch (error) {
    await database
      .prepare(
        `UPDATE ingest_items
         SET status = 'failed',
             failure_code = 'metadata_upsert_failed',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
      )
      .bind(ingest.id)
      .run();
    throw error;
  }
}

async function findOrCreateArtist(
  database: D1Database,
  item: CatalogMetadataItem,
): Promise<number> {
  const existing = await database
    .prepare(
      `SELECT id
       FROM artists
       WHERE normalized_name = ? AND status != 'archived'
       ORDER BY id ASC
       LIMIT 1`,
    )
    .bind(item.normalizedArtist)
    .first<IdRow>();

  if (existing) {
    await database
      .prepare(
        `UPDATE artists
         SET name = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
      )
      .bind(item.artist, existing.id)
      .run();
    return existing.id;
  }

  const inserted = await database
    .prepare(
      `INSERT INTO artists (name, normalized_name, status)
       VALUES (?, ?, 'active')`,
    )
    .bind(item.artist, item.normalizedArtist)
    .run();
  return insertedId(inserted, "artist");
}

async function findOrCreateRelease(
  database: D1Database,
  artistId: number,
  item: CatalogMetadataItem,
): Promise<number> {
  const existing = item.upc
    ? await database
        .prepare(
          `SELECT id
           FROM releases
           WHERE upc = ? AND status != 'archived'
           ORDER BY id ASC
           LIMIT 1`,
        )
        .bind(item.upc)
        .first<IdRow>()
    : await database
        .prepare(
          `SELECT id
           FROM releases
           WHERE primary_artist_id = ?
             AND normalized_title = ?
             AND status != 'archived'
           ORDER BY id ASC
           LIMIT 1`,
        )
        .bind(artistId, item.normalizedReleaseTitle)
        .first<IdRow>();

  if (existing) {
    await database
      .prepare(
        `UPDATE releases
         SET primary_artist_id = ?,
             title = ?,
             normalized_title = ?,
             artist_credit = ?,
             type = ?,
             upc = COALESCE(?, upc),
             release_date = COALESCE(?, release_date),
             status = CASE
               WHEN status IN ('published', 'archived') THEN status
               ELSE ?
             END,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
      )
      .bind(
        artistId,
        item.releaseTitle,
        item.normalizedReleaseTitle,
        item.artistCredit,
        item.releaseType,
        item.upc,
        item.releaseDate,
        item.catalogStatus,
        existing.id,
      )
      .run();
    return existing.id;
  }

  const inserted = await database
    .prepare(
      `INSERT INTO releases (
        primary_artist_id,
        title,
        normalized_title,
        artist_credit,
        type,
        upc,
        release_date,
        status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      artistId,
      item.releaseTitle,
      item.normalizedReleaseTitle,
      item.artistCredit,
      item.releaseType,
      item.upc,
      item.releaseDate,
      item.catalogStatus,
    )
    .run();
  return insertedId(inserted, "release");
}

async function findOrCreateTrack(
  database: D1Database,
  releaseId: number,
  artistId: number,
  item: CatalogMetadataItem,
): Promise<number> {
  if (item.isrc) {
    const conflictingRecording = await database
      .prepare(
        `SELECT id
         FROM tracks
         WHERE isrc = ?
           AND status = 'published'
           AND (
             normalized_title != ?
             OR COALESCE(version_label, '') != COALESCE(?, '')
             OR primary_artist_id != ?
           )
         ORDER BY id ASC
         LIMIT 1`,
      )
      .bind(
        item.isrc,
        item.normalizedTitle,
        item.versionLabel,
        artistId,
      )
      .first<IdRow>();

    if (conflictingRecording) {
      throw new Error(
        "The ISRC is already attached to a different published recording and requires manual review.",
      );
    }
  }

  const existing = item.isrc
    ? await database
        .prepare(
          `SELECT id
           FROM tracks
           WHERE isrc = ?
             AND release_id = ?
             AND normalized_title = ?
             AND (
               (version_label IS NULL AND ? IS NULL)
               OR version_label = ?
             )
             AND status != 'archived'
           ORDER BY id ASC
           LIMIT 1`,
        )
        .bind(
          item.isrc,
          releaseId,
          item.normalizedTitle,
          item.versionLabel,
          item.versionLabel,
        )
        .first<IdRow>()
    : await database
        .prepare(
          `SELECT id
           FROM tracks
           WHERE release_id = ?
             AND normalized_title = ?
             AND (
               (version_label IS NULL AND ? IS NULL)
               OR version_label = ?
             )
             AND status != 'archived'
           ORDER BY id ASC
           LIMIT 1`,
        )
        .bind(
          releaseId,
          item.normalizedTitle,
          item.versionLabel,
          item.versionLabel,
        )
        .first<IdRow>();

  if (existing) return existing.id;

  const inserted = await database
    .prepare(
      `INSERT INTO tracks (
        release_id,
        primary_artist_id,
        title,
        normalized_title,
        artist_credit,
        version_label,
        isrc,
        disc_number,
        track_number,
        duration_ms,
        genre,
        mood,
        theme,
        rights_status,
        status,
        published_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        CASE WHEN ? = 'published' THEN CURRENT_TIMESTAMP ELSE NULL END
      )`,
    )
    .bind(
      releaseId,
      artistId,
      item.title,
      item.normalizedTitle,
      item.artistCredit,
      item.versionLabel,
      item.isrc,
      item.discNumber,
      item.trackNumber,
      item.durationMs,
      item.genre,
      item.mood,
      item.theme,
      item.rightsStatus,
      item.catalogStatus,
      item.catalogStatus,
    )
    .run();
  return insertedId(inserted, "track");
}

async function updateTrack(
  database: D1Database,
  trackId: number,
  releaseId: number,
  artistId: number,
  item: CatalogMetadataItem,
): Promise<void> {
  if (item.isrc && item.rightsStatus !== "cleared") {
    await database
      .prepare(
        `UPDATE tracks
         SET rights_status = ?,
             status = CASE WHEN status = 'archived' THEN status ELSE 'hidden' END,
             published_at = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE isrc = ?`,
      )
      .bind(item.rightsStatus, item.isrc)
      .run();
  }

  await database
    .prepare(
      `UPDATE tracks
       SET release_id = ?,
           primary_artist_id = ?,
           title = ?,
           normalized_title = ?,
           artist_credit = ?,
           version_label = ?,
           isrc = COALESCE(?, isrc),
           disc_number = ?,
           track_number = ?,
           duration_ms = COALESCE(?, duration_ms),
           genre = COALESCE(?, genre),
           mood = COALESCE(?, mood),
           theme = COALESCE(?, theme),
           rights_status = ?,
           status = CASE
             WHEN status = 'archived' THEN status
             WHEN ? != 'cleared' THEN 'hidden'
             ELSE ?
           END,
           published_at = CASE
             WHEN ? = 'published' AND ? = 'cleared'
               THEN COALESCE(published_at, CURRENT_TIMESTAMP)
             WHEN ? != 'cleared' THEN NULL
             ELSE published_at
           END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    )
    .bind(
      releaseId,
      artistId,
      item.title,
      item.normalizedTitle,
      item.artistCredit,
      item.versionLabel,
      item.isrc,
      item.discNumber,
      item.trackNumber,
      item.durationMs,
      item.genre,
      item.mood,
      item.theme,
      item.rightsStatus,
      item.rightsStatus,
      item.catalogStatus,
      item.catalogStatus,
      item.rightsStatus,
      trackId,
    )
    .run();
}

async function upsertSpotifyMatch(
  database: D1Database,
  trackId: number,
  item: CatalogMetadataItem,
): Promise<void> {
  const spotify = item.spotify;
  if (!spotify) return;

  await database
    .prepare(
      `INSERT INTO spotify_matches (
        track_id,
        spotify_track_id,
        spotify_album_id,
        spotify_title,
        spotify_artist_credit,
        spotify_album_title,
        spotify_isrc,
        spotify_duration_ms,
        duration_delta_ms,
        cover_source_url,
        method,
        score,
        status,
        reviewed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        CASE WHEN ? = 'verified' THEN CURRENT_TIMESTAMP ELSE NULL END
      )
      ON CONFLICT(track_id, spotify_track_id) DO UPDATE SET
        spotify_album_id = excluded.spotify_album_id,
        spotify_title = excluded.spotify_title,
        spotify_artist_credit = excluded.spotify_artist_credit,
        spotify_album_title = excluded.spotify_album_title,
        spotify_isrc = excluded.spotify_isrc,
        spotify_duration_ms = excluded.spotify_duration_ms,
        duration_delta_ms = excluded.duration_delta_ms,
        cover_source_url = excluded.cover_source_url,
        method = excluded.method,
        score = excluded.score,
        status = excluded.status,
        checked_at = CURRENT_TIMESTAMP,
        reviewed_at = CASE
          WHEN excluded.status = 'verified' THEN CURRENT_TIMESTAMP
          ELSE spotify_matches.reviewed_at
        END,
        updated_at = CURRENT_TIMESTAMP`,
    )
    .bind(
      trackId,
      spotify.trackId,
      spotify.albumId,
      spotify.title,
      spotify.artistCredit,
      spotify.albumTitle,
      spotify.isrc,
      spotify.durationMs,
      spotify.durationDeltaMs,
      spotify.coverSourceUrl,
      spotify.method,
      spotify.score,
      spotify.status,
      spotify.status,
    )
    .run();

  if (spotify.albumId || spotify.coverSourceUrl) {
    await database
      .prepare(
        `UPDATE releases
         SET spotify_album_id = COALESCE(?, spotify_album_id),
             cover_source_url = COALESCE(?, cover_source_url),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
      )
      .bind(spotify.albumId, spotify.coverSourceUrl, await releaseIdForTrack(database, trackId))
      .run();
  }
}

async function releaseIdForTrack(
  database: D1Database,
  trackId: number,
): Promise<number> {
  const row = await database
    .prepare("SELECT release_id AS id FROM tracks WHERE id = ?")
    .bind(trackId)
    .first<IdRow>();
  if (!row) throw new Error("Track release is unavailable.");
  return row.id;
}

function insertedId(result: D1Result, label: string): number {
  const id = Number(result.meta.last_row_id);
  if (!Number.isSafeInteger(id) || id < 1) {
    throw new Error(`The ${label} identifier was not returned by D1.`);
  }
  return id;
}

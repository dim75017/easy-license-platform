import {
  requireCatalogAudioBucket,
  requireCatalogDatabase,
} from "@/db/catalog-runtime";
import { requireCatalogPipeline } from "../../_lib/auth";
import {
  assertAllowedKeys,
  catalogErrorResponse,
  CatalogApiError,
  noStoreJson,
  optionalInteger,
  optionalString,
  parseJsonObject,
  requiredString,
} from "../../_lib/http";

const MAX_PROMOTE_BODY_BYTES = 16 * 1024;
const MAX_DURATION_DELTA_MS = 2_000;
const CATALOG_OWNER_DIRECT_BATCH_KEY = "symbiome-catalog-owner-drain-v1";
const ALLOWED_KEYS = new Set([
  "trackId",
  "batchKey",
  "sourceKey",
  "sourceSha256",
  "measuredDurationMs",
  "verificationMode",
  "sourceMimeType",
  "sourceFormat",
  "allowMissingCover",
]);

type VerificationMode = "spotify" | "catalog_owner_direct";

type PromotionRow = {
  ingest_id: number;
  ingest_status: string;
  ingest_failure_code: string | null;
  ingest_review_note: string | null;
  source_row_number: number | null;
  source_sha256: string | null;
  measured_duration_ms: number | null;
  ingest_asset_id: number | null;
  verification_mode: string | null;
  owner_attestation_sha256: string | null;
  catalogue_scope_sha256: string | null;
  selection_sha256: string | null;
  master_inspection_sha256: string | null;
  master_read_complete: number | null;
  release_id: number;
  release_title: string;
  release_upc: string | null;
  track_title: string;
  track_artist_credit: string;
  track_isrc: string | null;
  track_status: string;
  track_duration_ms: number | null;
  rights_status: string;
  ai_review_status: string;
  release_status: string;
  cover_storage_key: string | null;
  spotify_duration_ms: number | null;
  spotify_duration_delta_ms: number | null;
  spotify_method: string | null;
  spotify_album_id: string | null;
  spotify_title: string | null;
  spotify_artist_credit: string | null;
  spotify_album_title: string | null;
  spotify_isrc: string | null;
};

type PromotionAsset = {
  id: number;
  kind: "source_master" | "streaming_copy" | "waveform_peaks";
  storage_key: string;
  mime_type: string;
  byte_size: number | null;
  duration_ms: number | null;
  sha256: string | null;
  derived_from_sha256: string | null;
};

export async function POST(request: Request): Promise<Response> {
  try {
    await requireCatalogPipeline(request);
    const payload = await parseJsonObject(request, MAX_PROMOTE_BODY_BYTES);
    assertAllowedKeys(payload, ALLOWED_KEYS);

    const trackId = optionalInteger(
      payload.trackId,
      "trackId",
      1,
      2_147_483_647,
    );
    if (trackId === null) {
      throw new CatalogApiError("trackId is required.");
    }
    const batchKey = requiredString(payload.batchKey, "batchKey", 160);
    const sourceKey = requiredString(payload.sourceKey, "sourceKey", 160);
    const sourceSha256 = requiredSha256(
      payload.sourceSha256,
      "sourceSha256",
    );
    const measuredDurationMs = optionalInteger(
      payload.measuredDurationMs,
      "measuredDurationMs",
      1,
      86_400_000,
    );
    if (measuredDurationMs === null) {
      throw new CatalogApiError("measuredDurationMs is required.");
    }
    const verificationMode = parseVerificationMode(payload.verificationMode);
    const allowMissingCover = parseAllowMissingCover(
      payload.allowMissingCover,
      verificationMode,
    );
    const { sourceMimeType, sourceFormat } = parseSourceDescriptor(
      payload.sourceMimeType,
      payload.sourceFormat,
      verificationMode,
    );

    const database = requireCatalogDatabase();
    const row = await database
      .prepare(
        `SELECT
           ii.id AS ingest_id,
           ii.status AS ingest_status,
           ii.failure_code AS ingest_failure_code,
           ii.review_note AS ingest_review_note,
           ii.source_row_number,
           ii.source_sha256,
           ii.measured_duration_ms,
           ii.asset_id AS ingest_asset_id,
           ii.verification_mode,
           ii.owner_attestation_sha256,
           ii.catalogue_scope_sha256,
           ii.selection_sha256,
           ii.master_inspection_sha256,
           ii.master_read_complete,
           t.release_id,
           r.title AS release_title,
           r.upc AS release_upc,
           t.title AS track_title,
           t.artist_credit AS track_artist_credit,
           t.isrc AS track_isrc,
           t.status AS track_status,
           t.duration_ms AS track_duration_ms,
           t.rights_status,
           t.ai_review_status,
           r.status AS release_status,
           r.cover_storage_key,
           sm.spotify_duration_ms,
           sm.duration_delta_ms AS spotify_duration_delta_ms,
           sm.method AS spotify_method,
           sm.spotify_album_id,
           sm.spotify_title,
           sm.spotify_artist_credit,
           sm.spotify_album_title,
           sm.spotify_isrc
         FROM ingest_items AS ii
         JOIN tracks AS t ON t.id = ii.track_id
         JOIN releases AS r ON r.id = t.release_id
         LEFT JOIN spotify_matches AS sm
           ON sm.track_id = t.id AND sm.status = 'verified'
         WHERE ii.batch_key = ?
           AND ii.source_key = ?
           AND ii.track_id = ?
         LIMIT 1`,
      )
      .bind(batchKey, sourceKey, trackId)
      .first<PromotionRow>();
    if (!row) {
      throw new CatalogApiError(
        "The source reference is not associated with this track.",
        409,
        "source_track_mismatch",
      );
    }

    if (
      verificationMode === "catalog_owner_direct" &&
      batchKey !== CATALOG_OWNER_DIRECT_BATCH_KEY
    ) {
      throw new CatalogApiError(
        "Catalog-owner direct promotion is restricted to its sealed pipeline batch.",
        409,
        "promotion_owner_direct_batch_mismatch",
      );
    }
    assertPromotionMetadata(
      row,
      sourceSha256,
      measuredDurationMs,
      verificationMode,
      allowMissingCover,
    );

    const assetRows = await database
      .prepare(
        `SELECT id, kind, storage_key, mime_type, byte_size, duration_ms,
                sha256, derived_from_sha256
         FROM track_assets
         WHERE track_id = ?
           AND kind IN ('source_master', 'streaming_copy', 'waveform_peaks')
           AND status = 'available'
           AND sha256 IS NOT NULL
           AND byte_size IS NOT NULL
           AND duration_ms IS NOT NULL
         ORDER BY id DESC`,
      )
      .bind(trackId)
      .all<PromotionAsset>();

    const sourceMaster = assetRows.results.find(
      (asset) =>
        asset.kind === "source_master" &&
        asset.id === row.ingest_asset_id &&
        asset.sha256 === sourceSha256 &&
        asset.duration_ms === measuredDurationMs,
    );
    const streamingCopy = assetRows.results.find(
      (asset) =>
        asset.kind === "streaming_copy" &&
        asset.derived_from_sha256 === sourceSha256,
    );
    const waveformPeaks = assetRows.results.find(
      (asset) =>
        asset.kind === "waveform_peaks" &&
        asset.derived_from_sha256 === sourceSha256,
    );
    if (!sourceMaster || !streamingCopy || !waveformPeaks) {
      throw new CatalogApiError(
        "Verified source master, streaming copy and waveform peaks are required.",
        409,
        "promotion_assets_incomplete",
      );
    }
    if (
      sourceMaster.mime_type !== sourceMimeType ||
      sourceFormatFromMimeType(sourceMaster.mime_type) !== sourceFormat
    ) {
      throw new CatalogApiError(
        "The source master MIME and format do not match the fully inspected source.",
        409,
        "promotion_owner_master_type_invalid",
      );
    }
    assertAssetDuration(streamingCopy, measuredDurationMs, "streaming copy");
    assertAssetDuration(waveformPeaks, measuredDurationMs, "waveform peaks");
    if (streamingCopy.mime_type !== "audio/mpeg") {
      throw new CatalogApiError(
        "The streaming copy must be an MP3.",
        409,
        "promotion_stream_type_invalid",
      );
    }
    if (waveformPeaks.mime_type !== "application/json") {
      throw new CatalogApiError(
        "The waveform peaks must be JSON.",
        409,
        "promotion_waveform_type_invalid",
      );
    }

    const coverStorageKey = row.cover_storage_key;
    const expectedCoverPrefix =
      `catalog/releases/${row.release_id}/cover_artwork/`;
    if (
      coverStorageKey !== null &&
      (!coverStorageKey || !coverStorageKey.startsWith(expectedCoverPrefix))
    ) {
      throw new CatalogApiError(
        "The release cover is not owned by this release.",
        409,
        "promotion_cover_not_owned",
      );
    }

    const bucket = requireCatalogAudioBucket();
    const [sourceObject, streamObject, waveformObject, coverObject] =
      await Promise.all([
        bucket.head(sourceMaster.storage_key),
        bucket.head(streamingCopy.storage_key),
        bucket.head(waveformPeaks.storage_key),
        coverStorageKey ? bucket.head(coverStorageKey) : Promise.resolve(null),
      ]);
    assertStoredAsset(sourceMaster, sourceObject);
    assertStoredAsset(streamingCopy, streamObject);
    assertStoredAsset(waveformPeaks, waveformObject);
    if (
      coverStorageKey &&
      (
        !coverObject ||
        coverObject.size < 1 ||
        !coverObject.httpMetadata?.contentType?.startsWith("image/")
      )
    ) {
      throw new CatalogApiError(
        "The release cover is unavailable in private storage.",
        409,
        "promotion_cover_unavailable",
      );
    }

    const alreadyPublished =
      row.track_status === "published" &&
      row.release_status === "published" &&
      row.ingest_status === "imported";
    if (alreadyPublished) {
      return noStoreJson({
        trackId,
        releaseId: row.release_id,
        trackStatus: "published",
        releaseStatus: "published",
        ingestStatus: "imported",
        idempotent: true,
      });
    }
    if (row.track_status !== "ready" || row.ingest_status !== "ready") {
      throw new CatalogApiError(
        "The track and ingest publication state is inconsistent.",
        409,
        "promotion_state_inconsistent",
      );
    }

    const results = await database.batch([
      database
        .prepare(
          `UPDATE track_assets
           SET status = 'deleted', updated_at = CURRENT_TIMESTAMP
           WHERE track_id = ?
             AND kind = 'streaming_copy'
             AND status = 'available'
             AND id != ?`,
        )
        .bind(trackId, streamingCopy.id),
      database
        .prepare(
          `UPDATE track_assets
           SET status = 'deleted', updated_at = CURRENT_TIMESTAMP
           WHERE track_id = ?
             AND kind = 'waveform_peaks'
             AND status = 'available'
             AND id != ?`,
        )
        .bind(trackId, waveformPeaks.id),
      database
        .prepare(
          `UPDATE tracks AS t
           SET status = 'published',
               published_at = COALESCE(published_at, CURRENT_TIMESTAMP),
               updated_at = CURRENT_TIMESTAMP
           WHERE t.id = ?
             AND t.release_id = ?
             AND t.rights_status = 'cleared'
             AND t.ai_review_status = 'cleared'
             AND t.status = 'ready'
             AND t.duration_ms IS NOT NULL
             AND ABS(t.duration_ms - ?) <= 2000
             AND t.title = ?
             AND t.artist_credit = ?
             AND EXISTS (
               SELECT 1
               FROM releases AS r
               WHERE r.id = t.release_id
                 AND r.status IN ('ready', 'published')
                 AND r.cover_storage_key IS ?
                 AND r.title = ?
             )
             AND EXISTS (
               SELECT 1
               FROM ingest_items AS ii
               WHERE ii.id = ?
                 AND ii.track_id = t.id
                 AND ii.batch_key = ?
                 AND ii.source_key = ?
                 AND ii.source_sha256 = ?
                 AND ii.measured_duration_ms = ?
                 AND ii.status = 'ready'
                 AND ii.failure_code IS NULL
                 AND ii.review_note IS NULL
                 AND (
                   (
                     ? = 'spotify'
                     AND ii.verification_mode IS NULL
                   )
                   OR (
                     ? = 'catalog_owner_direct'
                     AND ii.verification_mode = 'catalog_owner_direct'
                     AND ii.batch_key = 'symbiome-catalog-owner-drain-v1'
                     AND ii.source_row_number IS NOT NULL
                     AND ii.owner_attestation_sha256 = ?
                     AND ii.catalogue_scope_sha256 = ?
                     AND ii.selection_sha256 = ?
                     AND ii.master_inspection_sha256 = ?
                     AND ii.master_inspection_sha256 = ii.source_sha256
                     AND ii.master_read_complete = 1
                   )
                 )
             )
             AND (
               ? = 'catalog_owner_direct'
               OR (
                 ? = 'spotify'
                 AND EXISTS (
                   SELECT 1
                   FROM spotify_matches AS sm
                   JOIN releases AS sr ON sr.id = t.release_id
                   WHERE sm.track_id = t.id
                     AND sm.status = 'verified'
                     AND sm.spotify_duration_ms IS NOT NULL
                     AND sm.duration_delta_ms BETWEEN 0 AND 2000
                     AND ABS(sm.spotify_duration_ms - ?) <= 2000
                     AND sm.spotify_title = ?
                     AND sm.spotify_artist_credit = ?
                     AND sm.spotify_album_title = ?
                     AND (
                       (
                         sm.method = 'orchard_uri'
                         AND sr.upc = ?
                         AND sm.spotify_album_title = sr.title
                         AND sm.spotify_isrc = t.isrc
                       )
                       OR (
                         sm.method != 'orchard_uri'
                         AND sm.spotify_album_id IS NOT NULL
                       )
                     )
                   )
                 )
               )
             AND EXISTS (
               SELECT 1
               FROM track_assets AS master
               WHERE master.track_id = t.id
                 AND master.kind = 'source_master'
                 AND master.status = 'available'
                 AND master.id = ?
                 AND master.sha256 = ?
                 AND master.duration_ms = ?
                 AND master.byte_size IS NOT NULL
                 AND (
                   ? != 'catalog_owner_direct'
                   OR master.mime_type IN ('audio/wav', 'audio/mpeg')
                 )
             )
             AND EXISTS (
               SELECT 1
               FROM track_assets AS stream
               WHERE stream.track_id = t.id
                 AND stream.kind = 'streaming_copy'
                 AND stream.id = ?
                 AND stream.status = 'available'
                 AND stream.sha256 = ?
                 AND stream.derived_from_sha256 = ?
                 AND stream.byte_size IS NOT NULL
                 AND stream.mime_type = 'audio/mpeg'
                 AND ABS(stream.duration_ms - ?) <= 2000
             )
             AND EXISTS (
               SELECT 1
               FROM track_assets AS peaks
               WHERE peaks.track_id = t.id
                 AND peaks.kind = 'waveform_peaks'
                 AND peaks.id = ?
                 AND peaks.status = 'available'
                 AND peaks.sha256 = ?
                 AND peaks.derived_from_sha256 = ?
                 AND peaks.byte_size IS NOT NULL
                 AND peaks.mime_type = 'application/json'
                 AND ABS(peaks.duration_ms - ?) <= 2000
             )`,
        )
        .bind(
          trackId,
          row.release_id,
          measuredDurationMs,
          row.track_title,
          row.track_artist_credit,
          coverStorageKey,
          row.release_title,
          row.ingest_id,
          batchKey,
          sourceKey,
          sourceSha256,
          measuredDurationMs,
          verificationMode,
          verificationMode,
          row.owner_attestation_sha256,
          row.catalogue_scope_sha256,
          row.selection_sha256,
          row.master_inspection_sha256,
          verificationMode,
          verificationMode,
          measuredDurationMs,
          row.spotify_title,
          row.spotify_artist_credit,
          row.spotify_album_title,
          row.release_upc,
          sourceMaster.id,
          sourceSha256,
          measuredDurationMs,
          verificationMode,
          streamingCopy.id,
          streamingCopy.sha256,
          sourceSha256,
          measuredDurationMs,
          waveformPeaks.id,
          waveformPeaks.sha256,
          sourceSha256,
          measuredDurationMs,
        ),
      database
        .prepare(
          `UPDATE releases AS r
           SET status = 'published', updated_at = CURRENT_TIMESTAMP
           WHERE r.id = ?
             AND r.status IN ('ready', 'published')
             AND r.cover_storage_key IS ?
             AND EXISTS (
               SELECT 1
               FROM tracks AS t
               WHERE t.id = ?
                 AND t.release_id = r.id
                 AND t.status = 'published'
                 AND t.rights_status = 'cleared'
             )`,
        )
        .bind(row.release_id, coverStorageKey, trackId),
      database
        .prepare(
          `UPDATE ingest_items AS ii
           SET status = 'imported',
               failure_code = NULL,
               review_note = NULL,
               updated_at = CURRENT_TIMESTAMP
           WHERE ii.id = ?
             AND ii.status = 'ready'
             AND ii.source_sha256 = ?
             AND ii.measured_duration_ms = ?
             AND EXISTS (
               SELECT 1
               FROM tracks AS t
               JOIN releases AS r ON r.id = t.release_id
               WHERE t.id = ?
                 AND t.release_id = ?
                 AND t.status = 'published'
                 AND t.rights_status = 'cleared'
                 AND r.status = 'published'
             )`,
        )
        .bind(
          row.ingest_id,
          sourceSha256,
          measuredDurationMs,
          trackId,
          row.release_id,
        ),
    ]);

    const requiredChanges = [results[2], results[3], results[4]];
    if (requiredChanges.some((result) => (result.meta.changes ?? 0) !== 1)) {
      throw new CatalogApiError(
        "A publication gate changed while the track was being promoted.",
        409,
        "promotion_gate_changed",
      );
    }

    return noStoreJson({
      trackId,
      releaseId: row.release_id,
      trackStatus: "published",
      releaseStatus: "published",
      ingestStatus: "imported",
      idempotent: false,
    });
  } catch (error) {
    return catalogErrorResponse(error);
  }
}

function assertPromotionMetadata(
  row: PromotionRow,
  sourceSha256: string,
  measuredDurationMs: number,
  verificationMode: VerificationMode,
  allowMissingCover: boolean,
): void {
  if (!["ready", "imported"].includes(row.ingest_status)) {
    throw new CatalogApiError(
      "The ingest item has not passed metadata review.",
      409,
      "promotion_ingest_not_ready",
    );
  }
  if (row.ingest_failure_code || row.ingest_review_note) {
    throw new CatalogApiError(
      "The ingest item still has a failure or review marker.",
      409,
      "promotion_ingest_flagged",
    );
  }
  if (!["ready", "published"].includes(row.track_status)) {
    throw new CatalogApiError(
      "The track has not passed metadata review.",
      409,
      "promotion_track_not_ready",
    );
  }
  if (!["ready", "published"].includes(row.release_status)) {
    throw new CatalogApiError(
      "The release has not passed metadata review.",
      409,
      "promotion_release_not_ready",
    );
  }
  if (row.rights_status !== "cleared") {
    throw new CatalogApiError(
      "Track rights must be cleared before publication.",
      409,
      "promotion_rights_not_cleared",
    );
  }
  if (row.ai_review_status !== "cleared") {
    throw new CatalogApiError(
      "The human-made/AI review must be explicitly cleared before publication.",
      409,
      "promotion_ai_review_not_cleared",
    );
  }
  if (row.source_sha256 !== sourceSha256) {
    throw new CatalogApiError(
      "The source checksum does not match the ingest record.",
      409,
      "promotion_source_checksum_mismatch",
    );
  }
  if (row.measured_duration_ms !== measuredDurationMs) {
    throw new CatalogApiError(
      "The measured duration does not match the ingest record.",
      409,
      "promotion_duration_mismatch",
    );
  }
  if (
    row.track_duration_ms === null ||
    Math.abs(row.track_duration_ms - measuredDurationMs) > MAX_DURATION_DELTA_MS
  ) {
    throw new CatalogApiError(
      "The catalogue duration differs from the measured master by more than two seconds.",
      409,
      "promotion_catalog_duration_mismatch",
    );
  }
  if (verificationMode === "catalog_owner_direct") {
    assertCatalogOwnerDirectEvidence(row, sourceSha256);
  } else {
    if (row.verification_mode !== null) {
      throw new CatalogApiError(
        "The requested verification mode does not match the ingest authority.",
        409,
        "promotion_verification_mode_mismatch",
      );
    }
    assertSpotifyEvidence(row, measuredDurationMs);
  }
  if (!row.cover_storage_key && !allowMissingCover) {
    throw new CatalogApiError(
      "A private release cover is required.",
      409,
      "promotion_cover_missing",
    );
  }
}

function assertCatalogOwnerDirectEvidence(
  row: PromotionRow,
  sourceSha256: string,
): void {
  if (
    row.verification_mode !== "catalog_owner_direct" ||
    row.source_row_number === null ||
    row.source_row_number < 1 ||
    !isSha256(row.owner_attestation_sha256) ||
    !isSha256(row.catalogue_scope_sha256) ||
    !isSha256(row.selection_sha256) ||
    !isSha256(row.master_inspection_sha256) ||
    row.master_inspection_sha256 !== sourceSha256 ||
    row.master_read_complete !== 1
  ) {
    throw new CatalogApiError(
      "The sealed catalog-owner, source-scope and full-master evidence is incomplete or corrupt.",
      409,
      "promotion_owner_evidence_invalid",
    );
  }
}

function assertSpotifyEvidence(
  row: PromotionRow,
  measuredDurationMs: number,
): void {
  if (
    row.spotify_duration_ms === null ||
    row.spotify_duration_delta_ms === null
  ) {
    throw new CatalogApiError(
      "A verified Spotify duration is required.",
      409,
      "promotion_spotify_unverified",
    );
  }
  if (
    row.spotify_duration_delta_ms > MAX_DURATION_DELTA_MS ||
    Math.abs(row.spotify_duration_ms - measuredDurationMs) >
      MAX_DURATION_DELTA_MS
  ) {
    throw new CatalogApiError(
      "The verified Spotify duration differs by more than two seconds.",
      409,
      "promotion_spotify_duration_mismatch",
    );
  }
  if (row.spotify_method === "orchard_uri") {
    if (
      !row.release_upc ||
      normalizeEvidenceText(row.spotify_album_title) !==
        normalizeEvidenceText(row.release_title) ||
      normalizeEvidenceText(row.spotify_title) !==
        normalizeEvidenceText(row.track_title) ||
      normalizeEvidenceText(row.spotify_artist_credit) !==
        normalizeEvidenceText(row.track_artist_credit) ||
      !row.track_isrc ||
      row.spotify_isrc !== row.track_isrc
    ) {
      throw new CatalogApiError(
        "Verified Orchard evidence requires the release UPC, matching local release and ISRC.",
        409,
        "promotion_orchard_evidence_incomplete",
      );
    }
  } else if (!row.spotify_method || !row.spotify_album_id) {
    throw new CatalogApiError(
      "Verified non-Orchard evidence requires a Spotify album identifier.",
      409,
      "promotion_spotify_evidence_incomplete",
    );
  }
}

function isSha256(value: string | null): value is string {
  return value !== null && /^[a-f0-9]{64}$/u.test(value);
}

function normalizeEvidenceText(value: string | null): string {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .toLowerCase();
}

function requiredSha256(value: unknown, label: string): string {
  const sha256 = requiredString(value, label, 64).toLowerCase();
  if (!/^[a-f0-9]{64}$/u.test(sha256)) {
    throw new CatalogApiError(`${label} must be a hexadecimal SHA-256 digest.`);
  }
  return sha256;
}

function parseVerificationMode(value: unknown): VerificationMode {
  if (value === undefined || value === null) return "spotify";
  const verificationMode = requiredString(value, "verificationMode", 40);
  if (
    verificationMode !== "spotify" &&
    verificationMode !== "catalog_owner_direct"
  ) {
    throw new CatalogApiError(
      "verificationMode must be spotify or catalog_owner_direct.",
    );
  }
  return verificationMode;
}

function parseAllowMissingCover(
  value: unknown,
  verificationMode: VerificationMode,
): boolean {
  // Omission is intentionally fail-closed so a worker started before this
  // protocol existed cannot begin publishing coverless releases after a
  // rolling backend deployment.
  if (value === undefined) return false;
  if (typeof value !== "boolean") {
    throw new CatalogApiError(
      "allowMissingCover must be a boolean.",
      400,
      "promotion_missing_cover_policy_invalid",
    );
  }
  if (value && verificationMode !== "catalog_owner_direct") {
    throw new CatalogApiError(
      "Missing-cover promotion is restricted to catalog-owner direct verification.",
      409,
      "promotion_missing_cover_policy_invalid",
    );
  }
  return value;
}

function parseSourceDescriptor(
  mimeValue: unknown,
  formatValue: unknown,
  verificationMode: VerificationMode,
): { sourceMimeType: "audio/wav" | "audio/mpeg"; sourceFormat: "wav" | "mp3" } {
  const suppliedMimeType = optionalString(mimeValue, "sourceMimeType", 120);
  const suppliedFormat = optionalString(formatValue, "sourceFormat", 20);
  // Backward compatibility for already-running WAV-only workers during a
  // rolling deployment.  MP3 never uses this implicit descriptor.
  const sourceMimeType = suppliedMimeType ?? "audio/wav";
  const sourceFormat = suppliedFormat ?? "wav";
  if ((suppliedMimeType === null) !== (suppliedFormat === null)) {
    throw new CatalogApiError(
      "sourceMimeType and sourceFormat must be supplied together.",
      409,
      "promotion_source_format_invalid",
    );
  }
  const validPair =
    (sourceMimeType === "audio/wav" && sourceFormat === "wav") ||
    (sourceMimeType === "audio/mpeg" && sourceFormat === "mp3");
  if (!validPair || (verificationMode === "spotify" && sourceFormat !== "wav")) {
    throw new CatalogApiError(
      "sourceMimeType and sourceFormat must identify the same supported inspected source.",
      409,
      "promotion_source_format_invalid",
    );
  }
  return {
    sourceMimeType: sourceMimeType as "audio/wav" | "audio/mpeg",
    sourceFormat: sourceFormat as "wav" | "mp3",
  };
}

function sourceFormatFromMimeType(value: string): string | null {
  if (value === "audio/wav") return "wav";
  if (value === "audio/mpeg") return "mp3";
  return null;
}

function assertAssetDuration(
  asset: PromotionAsset,
  measuredDurationMs: number,
  label: string,
): void {
  if (
    asset.duration_ms === null ||
    Math.abs(asset.duration_ms - measuredDurationMs) > MAX_DURATION_DELTA_MS
  ) {
    throw new CatalogApiError(
      `The ${label} duration differs from the master by more than two seconds.`,
      409,
      "promotion_asset_duration_mismatch",
    );
  }
}

function assertStoredAsset(
  asset: PromotionAsset,
  stored: R2Object | null,
): void {
  if (
    !stored ||
    asset.byte_size === null ||
    asset.sha256 === null ||
    stored.size !== asset.byte_size ||
    stored.customMetadata?.sha256 !== asset.sha256 ||
    stored.httpMetadata?.contentType !== asset.mime_type ||
    (asset.kind === "source_master" &&
      ((stored.customMetadata?.sourceMimeType !== undefined &&
        stored.customMetadata.sourceMimeType !== asset.mime_type) ||
        (stored.customMetadata?.sourceFormat !== undefined &&
          stored.customMetadata.sourceFormat !==
            sourceFormatFromMimeType(asset.mime_type)))) ||
    (asset.derived_from_sha256 !== null &&
      stored.customMetadata?.sourceSha256 !== asset.derived_from_sha256)
  ) {
    throw new CatalogApiError(
      `The ${asset.kind} object failed private-storage verification.`,
      409,
      "promotion_asset_unavailable",
    );
  }
}

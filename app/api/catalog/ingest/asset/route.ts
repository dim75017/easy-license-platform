import {
  requireCatalogDatabase,
  requireCatalogAudioBucket,
} from "@/db/catalog-runtime";
import {
  stableStorageKey,
  streamDriveFileToR2,
  type IngestableAssetKind,
} from "@/worker/catalog-storage";
import { requireCatalogWrite } from "../../_lib/auth";
import {
  assertAllowedKeys,
  catalogErrorResponse,
  CatalogApiError,
  noStoreJson,
  optionalInteger,
  optionalString,
  parseJsonObject,
  requiredPositiveId,
  requiredString,
} from "../../_lib/http";

const MAX_ASSET_REQUEST_BYTES = 16 * 1024;
const ALLOWED_KEYS = new Set([
  "trackId",
  "releaseId",
  "batchKey",
  "sourceKey",
  "driveFileId",
  "sourceFileName",
  "assetKind",
  "expectedByteSize",
  "expectedContentType",
  "expectedSha256",
  "durationMs",
]);
const ASSET_KINDS = new Set<IngestableAssetKind>([
  "source_master",
  "streaming_copy",
  "download_copy",
  "waveform_peaks",
  "cover_artwork",
]);

type ExistingTrackAsset = {
  id: number;
  status: string;
  byte_size: number | null;
  mime_type: string;
  duration_ms: number | null;
  sha256: string | null;
};

export async function POST(request: Request): Promise<Response> {
  try {
    const writer = await requireCatalogWrite(request);
    const payload = await parseJsonObject(request, MAX_ASSET_REQUEST_BYTES);
    assertAllowedKeys(payload, ALLOWED_KEYS);

    const trackIdValue = optionalString(payload.trackId, "trackId", 32);
    const releaseIdValue = optionalString(payload.releaseId, "releaseId", 32);
    const batchKey = optionalString(payload.batchKey, "batchKey", 160);
    const sourceKey = optionalString(payload.sourceKey, "sourceKey", 160);
    const driveFileId = requiredString(
      payload.driveFileId,
      "driveFileId",
      200,
    );
    if (!/^[A-Za-z0-9_-]{8,200}$/u.test(driveFileId)) {
      throw new CatalogApiError("driveFileId is invalid.");
    }
    const sourceFileName = requiredString(
      payload.sourceFileName,
      "sourceFileName",
      1000,
    );
    const assetKindValue = requiredString(
      payload.assetKind,
      "assetKind",
      40,
    ) as IngestableAssetKind;
    if (!ASSET_KINDS.has(assetKindValue)) {
      throw new CatalogApiError(
        `assetKind must be one of: ${Array.from(ASSET_KINDS).join(", ")}.`,
      );
    }
    if (writer.kind === "pipeline" && assetKindValue !== "source_master") {
      throw new CatalogApiError(
        "The pipeline Drive route is restricted to private source masters.",
        403,
        "pipeline_drive_asset_forbidden",
      );
    }
    const expectedByteSize = optionalInteger(
      payload.expectedByteSize,
      "expectedByteSize",
      1,
      2 * 1024 * 1024 * 1024,
    );
    const expectedContentType = optionalString(
      payload.expectedContentType,
      "expectedContentType",
      120,
    );
    const expectedSha256 = optionalSha256(
      payload.expectedSha256,
      "expectedSha256",
    );
    const durationMs = optionalInteger(
      payload.durationMs,
      "durationMs",
      1,
      86_400_000,
    );
    if (
      writer.kind === "pipeline" &&
      assetKindValue === "source_master" &&
      (!expectedSha256 || durationMs === null)
    ) {
      throw new CatalogApiError(
        "Pipeline source masters require expectedSha256 and durationMs.",
        400,
        "source_master_evidence_required",
      );
    }

    const database = requireCatalogDatabase();
    if (assetKindValue === "cover_artwork") {
      if (!releaseIdValue || trackIdValue || batchKey || sourceKey) {
        throw new CatalogApiError(
          "cover_artwork requires releaseId and does not accept track ingest references.",
        );
      }
      const releaseId = requiredPositiveId(releaseIdValue, "releaseId");
      await assertReleaseWritable(database, releaseId);
      return await ingestCover({
        database,
        releaseId,
        driveFileId,
        sourceFileName,
        expectedByteSize,
        expectedContentType,
        expectedSha256,
      });
    }

    if (!trackIdValue || !batchKey || !sourceKey || releaseIdValue) {
      throw new CatalogApiError(
        "Track assets require trackId, batchKey and sourceKey.",
      );
    }
    const trackId = requiredPositiveId(trackIdValue, "trackId");
    const ingestItem = await database
      .prepare(
        `SELECT ii.id, ii.track_id, ii.status AS ingest_status,
                t.status AS track_status,
                r.status AS release_status
         FROM ingest_items AS ii
         JOIN tracks AS t ON t.id = ii.track_id
         JOIN releases AS r ON r.id = t.release_id
         WHERE ii.batch_key = ? AND ii.source_key = ?
         LIMIT 1`,
      )
      .bind(batchKey, sourceKey)
      .first<{
        id: number;
        track_id: number | null;
        ingest_status: string;
        track_status: string;
        release_status: string;
      }>();
    if (!ingestItem || ingestItem.track_id !== trackId) {
      throw new CatalogApiError(
        "The source reference is not associated with this track.",
        409,
        "source_track_mismatch",
      );
    }
    if (
      !["ready", "needs_review"].includes(ingestItem.ingest_status) ||
      ["published", "archived"].includes(ingestItem.track_status) ||
      ["archived"].includes(ingestItem.release_status)
    ) {
      throw new CatalogApiError(
        "Published tracks and archived releases have immutable assets.",
        409,
        "catalog_assets_locked",
      );
    }

    const storageKey = await stableStorageKey(
      "tracks",
      trackId,
      assetKindValue,
      `${batchKey}\u0000${sourceKey}\u0000${expectedSha256 ?? driveFileId}`,
      sourceFileName,
    );
    const existing = await database
      .prepare(
        `SELECT id, status, byte_size, mime_type, duration_ms, sha256
         FROM track_assets
         WHERE storage_key = ?
         LIMIT 1`,
      )
      .bind(storageKey)
      .first<ExistingTrackAsset>();
    if (existing?.status === "available") {
      if (
        (expectedSha256 !== null && existing.sha256 !== expectedSha256) ||
        (expectedByteSize !== null && existing.byte_size !== expectedByteSize) ||
        (durationMs !== null && existing.duration_ms !== durationMs)
      ) {
        throw new CatalogApiError(
          "The available asset does not match the supplied checksum, size or duration.",
          409,
          "asset_metadata_conflict",
        );
      }
      const storedObject = await requireCatalogAudioBucket().head(storageKey);
      if (
        !storedObject ||
        storedObject.size !== existing.byte_size ||
        (expectedSha256 !== null &&
          storedObject.customMetadata?.sha256 !== expectedSha256)
      ) {
        throw new CatalogApiError(
          "The available asset failed private-storage verification.",
          409,
          "asset_storage_mismatch",
        );
      }
      if (assetKindValue === "source_master") {
        await database
          .prepare(
            `UPDATE ingest_items
             SET asset_id = ?,
                 measured_duration_ms = COALESCE(?, measured_duration_ms),
                 failure_code = NULL,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ?
               AND status IN ('ready', 'needs_review')
               AND EXISTS (
                 SELECT 1
                 FROM tracks AS t
                 JOIN releases AS r ON r.id = t.release_id
                 WHERE t.id = ingest_items.track_id
                   AND t.status NOT IN ('published', 'archived')
                   AND r.status != 'archived'
               )`,
          )
          .bind(existing.id, durationMs, ingestItem.id)
          .run();
      }
      return noStoreJson({
        asset: {
          id: existing.id,
          trackId,
          kind: assetKindValue,
          status: "available",
          byteSize: existing.byte_size,
          contentType: existing.mime_type,
        },
        idempotent: true,
      });
    }

    let assetId = existing?.id ?? null;
    if (!assetId) {
      const inserted = await database
        .prepare(
          `INSERT INTO track_assets (
            track_id, kind, storage_key, mime_type, duration_ms, sha256, status
          ) VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
        )
        .bind(
          trackId,
          assetKindValue,
          storageKey,
          expectedContentType ?? "application/octet-stream",
          durationMs,
          expectedSha256,
        )
        .run();
      assetId = Number(inserted.meta.last_row_id);
    } else {
      await database
        .prepare(
          `UPDATE track_assets
           SET status = 'pending', updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
        )
        .bind(assetId)
        .run();
    }

    try {
      const stored = await streamDriveFileToR2({
        driveFileId,
        sourceFileName,
        assetKind: assetKindValue,
        storageKey,
        expectedByteSize,
        expectedContentType,
        expectedSha256,
      });
      const assetFinalised = await database
        .prepare(
          `UPDATE track_assets
           SET mime_type = ?,
               byte_size = ?,
               duration_ms = COALESCE(?, duration_ms),
               sha256 = COALESCE(?, sha256),
               status = 'available',
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ?
             AND status = 'pending'
             AND EXISTS (
               SELECT 1
               FROM tracks AS t
               WHERE t.id = track_assets.track_id
                 AND t.status NOT IN ('published', 'archived')
             )`,
        )
        .bind(
          stored.contentType,
          stored.byteSize,
          durationMs,
          stored.sha256,
          assetId,
        )
        .run();
      if ((assetFinalised.meta.changes ?? 0) !== 1) {
        throw new CatalogApiError(
          "The track was promoted while the master was uploading.",
          409,
          "source_master_asset_finalize_race",
        );
      }
      const ingestFinalised = await database
        .prepare(
          `UPDATE ingest_items
           SET asset_id = CASE
                 WHEN ? = 'source_master' THEN ?
                 ELSE asset_id
               END,
               measured_duration_ms = CASE
                 WHEN ? = 'source_master' THEN COALESCE(?, measured_duration_ms)
                 ELSE measured_duration_ms
               END,
               failure_code = NULL,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ?
             AND status IN ('ready', 'needs_review')
             AND EXISTS (
               SELECT 1
               FROM tracks AS t
               WHERE t.id = ingest_items.track_id
                 AND t.status NOT IN ('published', 'archived')
             )`,
        )
        .bind(
          assetKindValue,
          assetId,
          assetKindValue,
          durationMs,
          ingestItem.id,
        )
        .run();
      if ((ingestFinalised.meta.changes ?? 0) !== 1) {
        throw new CatalogApiError(
          "The ingest item was promoted while the master was uploading.",
          409,
          "source_master_finalize_race",
        );
      }

      return noStoreJson(
        {
          asset: {
            id: assetId,
            trackId,
            kind: assetKindValue,
            status: "available",
            byteSize: stored.byteSize,
            contentType: stored.contentType,
          },
          idempotent: false,
        },
        { status: 201 },
      );
    } catch (error) {
      await database
        .prepare(
          `UPDATE track_assets
           SET status = 'failed', updated_at = CURRENT_TIMESTAMP
           WHERE id = ?
             AND status = 'pending'
             AND EXISTS (
               SELECT 1
               FROM ingest_items AS ii
               JOIN tracks AS t ON t.id = ii.track_id
               JOIN releases AS r ON r.id = t.release_id
               WHERE ii.id = ?
                 AND ii.track_id = track_assets.track_id
                 AND ii.status IN ('ready', 'needs_review')
                 AND t.status NOT IN ('published', 'archived')
                 AND r.status != 'archived'
             )`,
        )
        .bind(assetId, ingestItem.id)
        .run();
      await database
        .prepare(
          `UPDATE ingest_items
           SET failure_code = 'asset_ingest_failed',
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ?
             AND status IN ('ready', 'needs_review')
             AND EXISTS (
               SELECT 1
               FROM tracks AS t
               JOIN releases AS r ON r.id = t.release_id
               WHERE t.id = ingest_items.track_id
                 AND t.status NOT IN ('published', 'archived')
                 AND r.status != 'archived'
             )`,
        )
        .bind(ingestItem.id)
        .run();
      throw error;
    }
  } catch (error) {
    return catalogErrorResponse(error);
  }
}

async function assertReleaseWritable(
  database: D1Database,
  releaseId: number,
): Promise<void> {
  const release = await database
    .prepare("SELECT id, status FROM releases WHERE id = ? LIMIT 1")
    .bind(releaseId)
    .first<{ id: number; status: string }>();
  if (!release) {
    throw new CatalogApiError("Release not found.", 404, "release_not_found");
  }
  if (["published", "archived"].includes(release.status)) {
    throw new CatalogApiError(
      "Published or archived releases have immutable covers.",
      409,
      "release_cover_locked",
    );
  }
}

async function ingestCover(options: {
  database: D1Database;
  releaseId: number;
  driveFileId: string;
  sourceFileName: string;
  expectedByteSize: number | null;
  expectedContentType: string | null;
  expectedSha256: string | null;
}): Promise<Response> {
  const storageKey = await stableStorageKey(
    "releases",
    options.releaseId,
    "cover_artwork",
    options.expectedSha256 ?? options.driveFileId,
    options.sourceFileName,
  );
  const current = await options.database
    .prepare("SELECT cover_storage_key FROM releases WHERE id = ?")
    .bind(options.releaseId)
    .first<{ cover_storage_key: string | null }>();
  if (current?.cover_storage_key === storageKey) {
    const stored = await requireCatalogAudioBucket().head(storageKey);
    if (stored) {
      return noStoreJson({
        asset: {
          releaseId: options.releaseId,
          kind: "cover_artwork",
          status: "available",
          byteSize: stored.size,
          contentType: stored.httpMetadata?.contentType ?? null,
        },
        idempotent: true,
      });
    }
  }

  const stored = await streamDriveFileToR2({
    driveFileId: options.driveFileId,
    sourceFileName: options.sourceFileName,
    assetKind: "cover_artwork",
    storageKey,
    expectedByteSize: options.expectedByteSize,
    expectedContentType: options.expectedContentType,
    expectedSha256: options.expectedSha256,
  });
  const updated = await options.database
    .prepare(
      `UPDATE releases
       SET cover_storage_key = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?
         AND status NOT IN ('published', 'archived')`,
    )
    .bind(storageKey, options.releaseId)
    .run();
  if ((updated.meta.changes ?? 0) !== 1) {
    throw new CatalogApiError(
      "The release was promoted while its cover was uploading.",
      409,
      "cover_finalize_race",
    );
  }

  return noStoreJson(
    {
      asset: {
        releaseId: options.releaseId,
        kind: "cover_artwork",
        status: "available",
        byteSize: stored.byteSize,
        contentType: stored.contentType,
      },
      idempotent: false,
    },
    { status: 201 },
  );
}

function optionalSha256(value: unknown, label: string): string | null {
  const sha256 = optionalString(value, label, 64)?.toLowerCase() ?? null;
  if (sha256 && !/^[a-f0-9]{64}$/u.test(sha256)) {
    throw new CatalogApiError(`${label} must be a hexadecimal SHA-256 digest.`);
  }
  return sha256;
}

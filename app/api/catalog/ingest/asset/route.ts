import {
  requireCatalogDatabase,
  requireCatalogAudioBucket,
} from "@/db/catalog-runtime";
import {
  stableStorageKey,
  streamDriveFileToR2,
  type IngestableAssetKind,
} from "@/worker/catalog-storage";
import { requireCatalogAdmin } from "../../_lib/auth";
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
};

export async function POST(request: Request): Promise<Response> {
  try {
    requireCatalogAdmin(request);
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
    const durationMs = optionalInteger(
      payload.durationMs,
      "durationMs",
      1,
      86_400_000,
    );

    const database = requireCatalogDatabase();
    if (assetKindValue === "cover_artwork") {
      if (!releaseIdValue || trackIdValue || batchKey || sourceKey) {
        throw new CatalogApiError(
          "cover_artwork requires releaseId and does not accept track ingest references.",
        );
      }
      const releaseId = requiredPositiveId(releaseIdValue, "releaseId");
      await assertReleaseExists(database, releaseId);
      return await ingestCover({
        database,
        releaseId,
        driveFileId,
        sourceFileName,
        expectedByteSize,
        expectedContentType,
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
        `SELECT id, track_id
         FROM ingest_items
         WHERE batch_key = ? AND source_key = ?
         LIMIT 1`,
      )
      .bind(batchKey, sourceKey)
      .first<{ id: number; track_id: number | null }>();
    if (!ingestItem || ingestItem.track_id !== trackId) {
      throw new CatalogApiError(
        "The source reference is not associated with this track.",
        409,
        "source_track_mismatch",
      );
    }

    const storageKey = await stableStorageKey(
      "tracks",
      trackId,
      assetKindValue,
      `${batchKey}\u0000${sourceKey}\u0000${driveFileId}`,
      sourceFileName,
    );
    const existing = await database
      .prepare(
        `SELECT id, status, byte_size, mime_type
         FROM track_assets
         WHERE storage_key = ?
         LIMIT 1`,
      )
      .bind(storageKey)
      .first<ExistingTrackAsset>();
    if (existing?.status === "available") {
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
            track_id, kind, storage_key, mime_type, duration_ms, status
          ) VALUES (?, ?, ?, ?, ?, 'pending')`,
        )
        .bind(
          trackId,
          assetKindValue,
          storageKey,
          expectedContentType ?? "application/octet-stream",
          durationMs,
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
      });
      await database
        .prepare(
          `UPDATE track_assets
           SET mime_type = ?,
               byte_size = ?,
               duration_ms = COALESCE(?, duration_ms),
               status = 'available',
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
        )
        .bind(stored.contentType, stored.byteSize, durationMs, assetId)
        .run();
      await database
        .prepare(
          `UPDATE ingest_items
           SET asset_id = ?,
               status = CASE
                 WHEN ? = 'streaming_copy' THEN 'imported'
                 ELSE status
               END,
               failure_code = NULL,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
        )
        .bind(assetId, assetKindValue, ingestItem.id)
        .run();

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
      await requireCatalogAudioBucket().delete(storageKey).catch(() => undefined);
      await database
        .prepare(
          `UPDATE track_assets
           SET status = 'failed', updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
        )
        .bind(assetId)
        .run();
      await database
        .prepare(
          `UPDATE ingest_items
           SET status = 'failed',
               failure_code = 'asset_ingest_failed',
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
        )
        .bind(ingestItem.id)
        .run();
      throw error;
    }
  } catch (error) {
    return catalogErrorResponse(error);
  }
}

async function assertReleaseExists(
  database: D1Database,
  releaseId: number,
): Promise<void> {
  const release = await database
    .prepare("SELECT id FROM releases WHERE id = ? LIMIT 1")
    .bind(releaseId)
    .first<{ id: number }>();
  if (!release) {
    throw new CatalogApiError("Release not found.", 404, "release_not_found");
  }
}

async function ingestCover(options: {
  database: D1Database;
  releaseId: number;
  driveFileId: string;
  sourceFileName: string;
  expectedByteSize: number | null;
  expectedContentType: string | null;
}): Promise<Response> {
  const storageKey = await stableStorageKey(
    "releases",
    options.releaseId,
    "cover_artwork",
    options.driveFileId,
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
  });
  await options.database
    .prepare(
      `UPDATE releases
       SET cover_storage_key = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    )
    .bind(storageKey, options.releaseId)
    .run();

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

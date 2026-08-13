import {
  requireCatalogAudioBucket,
  requireCatalogDatabase,
} from "@/db/catalog-runtime";
import { requireCatalogPipeline } from "../../_lib/auth";
import {
  catalogErrorResponse,
  CatalogApiError,
  isPlainObject,
  noStoreJson,
  requiredPositiveId,
  requiredString,
} from "../../_lib/http";

const MAX_DIRECT_ASSET_BYTES = 20 * 1024 * 1024;
const ASSET_LEASE_MINUTES = 5;
const DIRECT_ASSET_KINDS = new Set([
  "streaming_copy",
  "waveform_peaks",
  "cover_artwork",
] as const);

type DirectAssetKind =
  | "streaming_copy"
  | "waveform_peaks"
  | "cover_artwork";

type IngestReference = {
  id: number;
  status: string;
  track_status: string;
  release_id: number;
  release_status: string;
  cover_storage_key: string | null;
  source_sha256: string | null;
};

type TrackAssetRow = {
  id: number;
  track_id: number;
  kind: string;
  storage_key: string;
  mime_type: string;
  byte_size: number | null;
  duration_ms: number | null;
  sha256: string | null;
  derived_from_sha256: string | null;
  status: string;
};

export async function PUT(request: Request): Promise<Response> {
  try {
    await requireCatalogPipeline(request);

    const url = new URL(request.url);
    const trackId = requiredPositiveId(
      routeValue(request, url, "trackId", ["x-track-id", "x-catalog-track-id"]),
      "trackId",
    );
    const batchKey = requiredString(
      routeValue(request, url, "batchKey", ["x-batch-key", "x-catalog-batch-key"]),
      "batchKey",
      160,
    );
    const sourceKey = requiredString(
      routeValue(request, url, "sourceKey", ["x-source-key", "x-catalog-source-key"]),
      "sourceKey",
      160,
    );
    const kindValue = requiredString(
      routeValue(request, url, "kind", ["x-asset-kind", "x-catalog-asset-kind"]),
      "kind",
      40,
    );
    if (!DIRECT_ASSET_KINDS.has(kindValue as DirectAssetKind)) {
      throw new CatalogApiError(
        "kind must be streaming_copy, waveform_peaks or cover_artwork.",
      );
    }
    const kind = kindValue as DirectAssetKind;

    const contentLength = requiredContentLength(request);
    const contentType = requiredContentType(request, kind);
    const expectedSha256 = requiredSha256(
      request.headers.get("x-content-sha256"),
      "X-Content-Sha256",
    );
    const derivedFromSha256 =
      kind === "cover_artwork"
        ? null
        : requiredSha256(
            request.headers.get("x-source-sha256"),
            "X-Source-Sha256",
          );
    const durationMs =
      kind === "cover_artwork"
        ? null
        : requiredHeaderInteger(
            request.headers.get("x-duration-ms"),
            "X-Duration-Ms",
            1,
            86_400_000,
          );

    const body = await readBodyWithLimit(request, contentLength);
    if (body.byteLength !== contentLength) {
      throw new CatalogApiError(
        "The request body size does not match Content-Length.",
        409,
        "asset_size_mismatch",
      );
    }
    const actualSha256 = await sha256Hex(body);
    if (actualSha256 !== expectedSha256) {
      throw new CatalogApiError(
        "The request body checksum does not match X-Content-Sha256.",
        409,
        "asset_checksum_mismatch",
      );
    }
    if (kind === "waveform_peaks") {
      validateWaveformJson(body);
    }

    const database = requireCatalogDatabase();
    if (kind === "cover_artwork") {
      const reusableCover = await reuseAttachedReleaseCover({
        database,
        trackId,
        contentType,
        contentLength,
        expectedSha256,
      });
      if (reusableCover) {
        return reusableCover;
      }
    }

    const ingest = await database
      .prepare(
        `SELECT ii.id, ii.status, ii.source_sha256,
                t.status AS track_status,
                t.release_id, r.status AS release_status,
                r.cover_storage_key
         FROM ingest_items AS ii
         JOIN tracks AS t ON t.id = ii.track_id
         JOIN releases AS r ON r.id = t.release_id
         WHERE ii.batch_key = ?
           AND ii.source_key = ?
           AND ii.track_id = ?
         LIMIT 1`,
      )
      .bind(batchKey, sourceKey, trackId)
      .first<IngestReference>();
    if (!ingest) {
      throw new CatalogApiError(
        "The source reference is not associated with this track.",
        409,
        "source_track_mismatch",
      );
    }
    if (!["ready", "needs_review"].includes(ingest.status)) {
      throw new CatalogApiError(
        "The ingest item is not eligible for asset upload.",
        409,
        "ingest_not_uploadable",
      );
    }
    if (["published", "archived"].includes(ingest.track_status)) {
      throw new CatalogApiError(
        "Published or archived tracks cannot receive replacement assets.",
        409,
        "track_assets_locked",
      );
    }
    if (kind !== "cover_artwork" && ingest.source_sha256 !== derivedFromSha256) {
      throw new CatalogApiError(
        "X-Source-Sha256 does not match the ingest master checksum.",
        409,
        "asset_source_checksum_mismatch",
      );
    }

    if (kind === "cover_artwork") {
      return await storeReleaseCover({
        database,
        ingest,
        trackId,
        contentType,
        contentLength,
        expectedSha256,
        body,
      });
    }
    if (derivedFromSha256 === null) {
      throw new Error("Derived asset lineage validation was bypassed.");
    }
    if (durationMs === null) {
      throw new Error("Track asset duration validation was bypassed.");
    }

    const extension = kind === "streaming_copy" ? "mp3" : "json";
    const storageKey =
      `catalog/tracks/${trackId}/${kind}/${expectedSha256}.${extension}`;
    const inserted = await database
      .prepare(
        `INSERT OR IGNORE INTO track_assets (
          track_id,
          kind,
          storage_key,
          mime_type,
          byte_size,
          duration_ms,
          sha256,
          derived_from_sha256,
          status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      )
      .bind(
        trackId,
        kind,
        storageKey,
        contentType,
        contentLength,
        durationMs,
        expectedSha256,
        derivedFromSha256,
      )
      .run();

    const asset = await database
      .prepare(
        `SELECT id, track_id, kind, storage_key, mime_type, byte_size,
                duration_ms, sha256, derived_from_sha256, status
         FROM track_assets
         WHERE storage_key = ?
         LIMIT 1`,
      )
      .bind(storageKey)
      .first<TrackAssetRow>();
    if (!asset) {
      throw new Error("The direct asset reservation could not be read.");
    }
    assertMatchingReservation(asset, {
      trackId,
      kind,
      contentType,
      contentLength,
      durationMs,
      expectedSha256,
      derivedFromSha256,
    });

    const bucket = requireCatalogAudioBucket();
    if (asset.status === "available") {
      const existingObject = await bucket.head(storageKey);
      if (
        existingObject &&
        existingObject.size === contentLength &&
        existingObject.customMetadata?.sha256 === expectedSha256 &&
        existingObject.customMetadata?.sourceSha256 === derivedFromSha256
      ) {
        await database
          .prepare(
            `UPDATE ingest_items
             SET failure_code = CASE
                   WHEN failure_code = 'asset_ingest_failed' THEN NULL
                   ELSE failure_code
                 END,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
          )
          .bind(ingest.id)
          .run();
        return noStoreJson({
          asset: {
            id: asset.id,
            trackId,
            kind,
            status: "available",
            byteSize: contentLength,
            contentType,
            sha256: expectedSha256,
            durationMs,
          },
          idempotent: true,
        });
      }
    }

    let ownsLease = (inserted.meta.changes ?? 0) === 1;
    if (!ownsLease) {
      const claimed = await database
        .prepare(
          `UPDATE track_assets
           SET status = 'pending', updated_at = CURRENT_TIMESTAMP
           WHERE id = ?
             AND (
               status IN ('failed', 'deleted')
               OR (status = 'pending' AND updated_at < datetime('now', ?))
               OR status = 'available'
             )`,
        )
        .bind(asset.id, `-${ASSET_LEASE_MINUTES} minutes`)
        .run();
      ownsLease = (claimed.meta.changes ?? 0) === 1;
    }
    if (!ownsLease) {
      throw new CatalogApiError(
        asset.status === "quarantined"
          ? "The matching asset is quarantined."
          : "An upload for this asset is already in progress.",
        409,
        asset.status === "quarantined"
          ? "asset_quarantined"
          : "asset_upload_in_progress",
      );
    }

    const existingObject = await bucket.head(storageKey);
    let stored = existingObject;
    if (!stored) {
      stored = await bucket.put(storageKey, body, {
        sha256: expectedSha256,
        httpMetadata: {
          contentType,
          contentDisposition: "inline",
        },
        customMetadata: {
          assetKind: kind,
          trackId: String(trackId),
          sha256: expectedSha256,
          sourceSha256: derivedFromSha256,
          durationMs: String(durationMs),
          ingestedAt: new Date().toISOString(),
        },
      });
    }
    if (
      stored.size !== contentLength ||
      stored.customMetadata?.sha256 !== expectedSha256 ||
      stored.customMetadata?.sourceSha256 !== derivedFromSha256
    ) {
      throw new CatalogApiError(
        "The stored asset failed integrity verification.",
        502,
        "stored_asset_integrity_mismatch",
      );
    }

    const finalised = await database
      .prepare(
        `UPDATE track_assets
         SET status = 'available', updated_at = CURRENT_TIMESTAMP
         WHERE id = ?
           AND status = 'pending'
           AND track_id = ?
           AND kind = ?
           AND storage_key = ?
           AND byte_size = ?
           AND duration_ms = ?
           AND sha256 = ?
           AND derived_from_sha256 = ?
           AND EXISTS (
             SELECT 1
             FROM tracks AS t
             WHERE t.id = track_assets.track_id
               AND t.status NOT IN ('published', 'archived')
           )`,
      )
      .bind(
        asset.id,
        trackId,
        kind,
        storageKey,
        contentLength,
        durationMs,
        expectedSha256,
        derivedFromSha256,
      )
      .run();
    if ((finalised.meta.changes ?? 0) !== 1) {
      throw new CatalogApiError(
        "The asset upload lease changed before finalisation.",
        409,
        "asset_upload_lease_lost",
      );
    }
    await database
      .prepare(
        `UPDATE ingest_items
         SET failure_code = CASE
               WHEN failure_code = 'asset_ingest_failed' THEN NULL
               ELSE failure_code
             END,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
      )
      .bind(ingest.id)
      .run();

    return noStoreJson(
      {
        asset: {
          id: asset.id,
          trackId,
          kind,
          status: "available",
          byteSize: contentLength,
          contentType,
          sha256: expectedSha256,
          durationMs,
        },
        idempotent: false,
      },
      { status: 201 },
    );
  } catch (error) {
    // The content-addressed object is deliberately never deleted here. A
    // retry can safely verify and finalise it after the short D1 lease expires.
    return catalogErrorResponse(error);
  }
}

function routeValue(
  request: Request,
  url: URL,
  queryName: string,
  headerNames: string[],
): string {
  const queryValue = url.searchParams.get(queryName)?.trim() ?? "";
  const headerValues = headerNames
    .map((name) => request.headers.get(name)?.trim() ?? "")
    .filter(Boolean);
  const providedValues = [queryValue, ...headerValues].filter(Boolean);
  if (providedValues.length === 0) {
    throw new CatalogApiError(`${queryName} is required.`);
  }
  if (providedValues.some((value) => value !== providedValues[0])) {
    throw new CatalogApiError(
      `${queryName} differs between the query string and request headers.`,
      400,
      "conflicting_request_reference",
    );
  }
  return providedValues[0];
}

function requiredContentLength(request: Request): number {
  const raw = request.headers.get("content-length") ?? "";
  if (!/^[1-9]\d*$/u.test(raw)) {
    throw new CatalogApiError(
      "Content-Length must be a positive integer.",
      411,
      "content_length_required",
    );
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value > MAX_DIRECT_ASSET_BYTES) {
    throw new CatalogApiError(
      `The asset must not exceed ${MAX_DIRECT_ASSET_BYTES} bytes.`,
      413,
      "asset_too_large",
    );
  }
  return value;
}

function requiredContentType(request: Request, kind: DirectAssetKind): string {
  const contentType = (request.headers.get("content-type") ?? "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  const allowed =
    kind === "streaming_copy"
      ? new Set(["audio/mpeg"])
      : kind === "waveform_peaks"
        ? new Set(["application/json"])
        : new Set(["image/jpeg", "image/png", "image/webp"]);
  if (!allowed.has(contentType)) {
    throw new CatalogApiError(
      `${kind} has an unsupported Content-Type.`,
      415,
      "invalid_asset_type",
    );
  }
  return contentType;
}

async function readBodyWithLimit(
  request: Request,
  advertisedLength: number,
): Promise<ArrayBuffer> {
  if (!request.body) {
    throw new CatalogApiError("The asset body is required.");
  }
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > MAX_DIRECT_ASSET_BYTES || received > advertisedLength) {
        await reader.cancel();
        throw new CatalogApiError(
          "The request body exceeds its allowed size.",
          413,
          "asset_too_large",
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body.buffer;
}

function requiredSha256(value: string | null, label: string): string {
  const sha256 = (value ?? "").trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/u.test(sha256)) {
    throw new CatalogApiError(
      `${label} must be a hexadecimal SHA-256 digest.`,
    );
  }
  return sha256;
}

function requiredHeaderInteger(
  value: string | null,
  label: string,
  min: number,
  max: number,
): number {
  const raw = (value ?? "").trim();
  if (!/^\d+$/u.test(raw)) {
    throw new CatalogApiError(`${label} must be an integer.`);
  }
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new CatalogApiError(
      `${label} must be between ${min} and ${max}.`,
    );
  }
  return parsed;
}

async function sha256Hex(value: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", value);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function validateWaveformJson(value: ArrayBuffer): void {
  let parsed: unknown;
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(value);
    parsed = JSON.parse(text);
  } catch {
    throw new CatalogApiError(
      "waveform_peaks must contain valid UTF-8 JSON.",
      400,
      "invalid_waveform_json",
    );
  }
  if (!Array.isArray(parsed) && !isPlainObject(parsed)) {
    throw new CatalogApiError(
      "waveform_peaks JSON must be an array or object.",
      400,
      "invalid_waveform_shape",
    );
  }
}

function assertMatchingReservation(
  asset: TrackAssetRow,
  expected: {
    trackId: number;
    kind: DirectAssetKind;
    contentType: string;
    contentLength: number;
    durationMs: number;
    expectedSha256: string;
    derivedFromSha256: string | null;
  },
): void {
  if (
    asset.track_id !== expected.trackId ||
    asset.kind !== expected.kind ||
    asset.mime_type !== expected.contentType ||
    asset.byte_size !== expected.contentLength ||
    asset.duration_ms !== expected.durationMs ||
    asset.sha256 !== expected.expectedSha256 ||
    asset.derived_from_sha256 !== expected.derivedFromSha256
  ) {
    throw new CatalogApiError(
      "The content-addressed asset already exists with different metadata.",
      409,
      "asset_metadata_conflict",
    );
  }
}

async function storeReleaseCover(options: {
  database: D1Database;
  ingest: IngestReference;
  trackId: number;
  contentType: string;
  contentLength: number;
  expectedSha256: string;
  body: ArrayBuffer;
}): Promise<Response> {
  const bucket = requireCatalogAudioBucket();
  const storageKey = coverStorageKey(
    options.ingest.release_id,
    options.expectedSha256,
    options.contentType,
  );
  if (options.ingest.cover_storage_key) {
    const currentCover = await bucket.head(options.ingest.cover_storage_key);
    if (
      options.ingest.cover_storage_key === storageKey &&
      currentCover &&
      currentCover.size === options.contentLength &&
      currentCover.httpMetadata?.contentType === options.contentType &&
      currentCover.customMetadata?.sha256 === options.expectedSha256
    ) {
      return noStoreJson({
        asset: {
          trackId: options.trackId,
          releaseId: options.ingest.release_id,
          kind: "cover_artwork",
          status: "available",
          byteSize: currentCover.size,
          contentType: currentCover.httpMetadata.contentType,
          sha256: options.expectedSha256,
        },
        idempotent: true,
        existingCoverPreserved: true,
      });
    }
  }

  // A multi-track release may already be published by an earlier track in the
  // same batch. An exact replay is safe; any different cover remains immutable.
  if (["published", "archived"].includes(options.ingest.release_status)) {
    throw new CatalogApiError(
      "Published or archived releases cannot receive a replacement cover.",
      409,
      "release_cover_locked",
    );
  }

  const claimed = await options.database
    .prepare(
      `UPDATE releases
       SET cover_storage_key = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?
         AND status NOT IN ('published', 'archived')
         AND (
           cover_storage_key IS NULL
           OR cover_storage_key = ?
           OR cover_storage_key = ?
         )`,
    )
    .bind(
      storageKey,
      options.ingest.release_id,
      storageKey,
      options.ingest.cover_storage_key,
    )
    .run();
  if ((claimed.meta.changes ?? 0) !== 1) {
    throw new CatalogApiError(
      "A different cover is already reserved for this release.",
      409,
      "release_cover_conflict",
    );
  }

  let stored = await bucket.head(storageKey);
  if (!stored) {
    stored = await bucket.put(storageKey, options.body, {
      sha256: options.expectedSha256,
      httpMetadata: {
        contentType: options.contentType,
        contentDisposition: "inline",
      },
      customMetadata: {
        assetKind: "cover_artwork",
        releaseId: String(options.ingest.release_id),
        sha256: options.expectedSha256,
        ingestedAt: new Date().toISOString(),
      },
    });
  }
  if (
    stored.size !== options.contentLength ||
    stored.customMetadata?.sha256 !== options.expectedSha256
  ) {
    throw new CatalogApiError(
      "The stored cover failed integrity verification.",
      502,
      "stored_cover_integrity_mismatch",
    );
  }

  return noStoreJson(
    {
      asset: {
        trackId: options.trackId,
        releaseId: options.ingest.release_id,
        kind: "cover_artwork",
        status: "available",
        byteSize: options.contentLength,
        contentType: options.contentType,
        sha256: options.expectedSha256,
      },
      idempotent: false,
    },
    { status: 201 },
  );
}

async function reuseAttachedReleaseCover(options: {
  database: D1Database;
  trackId: number;
  contentType: string;
  contentLength: number;
  expectedSha256: string;
}): Promise<Response | null> {
  const release = await options.database
    .prepare(
      `SELECT r.id AS release_id, r.cover_storage_key
       FROM tracks AS t
       JOIN releases AS r ON r.id = t.release_id
       WHERE t.id = ?
       LIMIT 1`,
    )
    .bind(options.trackId)
    .first<{ release_id: number; cover_storage_key: string | null }>();
  if (!release?.cover_storage_key) {
    return null;
  }

  const storageKey = coverStorageKey(
    release.release_id,
    options.expectedSha256,
    options.contentType,
  );
  if (release.cover_storage_key !== storageKey) {
    return null;
  }

  const currentCover = await requireCatalogAudioBucket().head(storageKey);
  if (
    !currentCover ||
    currentCover.size !== options.contentLength ||
    currentCover.httpMetadata?.contentType !== options.contentType ||
    currentCover.customMetadata?.sha256 !== options.expectedSha256
  ) {
    return null;
  }

  return noStoreJson({
    asset: {
      trackId: options.trackId,
      releaseId: release.release_id,
      kind: "cover_artwork",
      status: "available",
      byteSize: currentCover.size,
      contentType: currentCover.httpMetadata.contentType,
      sha256: options.expectedSha256,
    },
    idempotent: true,
    existingCoverPreserved: true,
  });
}

function coverStorageKey(
  releaseId: number,
  sha256: string,
  contentType: string,
): string {
  const extension =
    contentType === "image/png"
      ? "png"
      : contentType === "image/webp"
        ? "webp"
        : "jpg";
  return `catalog/releases/${releaseId}/cover_artwork/${sha256}.${extension}`;
}

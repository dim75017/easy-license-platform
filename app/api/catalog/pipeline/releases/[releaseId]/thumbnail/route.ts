import {
  requireCatalogAudioBucket,
  requireCatalogDatabase,
} from "@/db/catalog-runtime";
import {
  coverSourceSha256,
  coverThumbnailStorageKey,
} from "../../../../_lib/cover-artwork";
import { requireCatalogPipeline } from "../../../../_lib/auth";
import {
  catalogErrorResponse,
  CatalogApiError,
  noStoreJson,
  requiredPositiveId,
} from "../../../../_lib/http";

const MAX_COVER_THUMBNAIL_BYTES = 512 * 1024;
const sha256Pattern = /^[a-f0-9]{64}$/u;

type RouteContext = { params: Promise<{ releaseId: string }> };

export async function PUT(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  try {
    await requireCatalogPipeline(request);
    const { releaseId: rawReleaseId } = await context.params;
    const releaseId = requiredPositiveId(rawReleaseId, "releaseId");
    const contentLength = requiredContentLength(request);
    if (request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "image/webp") {
      throw new CatalogApiError(
        "Cover thumbnails must use image/webp.",
        415,
        "cover_thumbnail_type_invalid",
      );
    }
    const expectedSha256 = requiredSha256(
      request.headers.get("x-content-sha256"),
      "X-Content-Sha256",
      "cover_thumbnail_sha256_invalid",
    );
    const expectedSourceSha256 = requiredSha256(
      request.headers.get("x-source-sha256"),
      "X-Source-Sha256",
      "cover_thumbnail_source_sha256_invalid",
    );
    const body = await readBodyWithLimit(request, contentLength);
    if (body.byteLength !== contentLength) {
      throw new CatalogApiError(
        "The request body size does not match Content-Length.",
        409,
        "cover_thumbnail_size_mismatch",
      );
    }
    if (!isWebp(body)) {
      throw new CatalogApiError(
        "The cover thumbnail is not a valid WebP payload.",
        415,
        "cover_thumbnail_type_invalid",
      );
    }
    const actualSha256 = await sha256Hex(body);
    if (actualSha256 !== expectedSha256) {
      throw new CatalogApiError(
        "The request body checksum does not match X-Content-Sha256.",
        409,
        "cover_thumbnail_checksum_mismatch",
      );
    }

    const database = requireCatalogDatabase();
    const release = await database
      .prepare(
        `SELECT status, cover_storage_key
         FROM releases
         WHERE id = ?
         LIMIT 1`,
      )
      .bind(releaseId)
      .first<{ status: string; cover_storage_key: string | null }>();
    if (
      !release
      || !["ready", "published"].includes(release.status)
      || !release.cover_storage_key
    ) {
      throw new CatalogApiError(
        "A ready or published release cover is required.",
        409,
        "published_release_cover_required",
      );
    }
    const sourceSha256 = coverSourceSha256(releaseId, release.cover_storage_key);
    const storageKey = coverThumbnailStorageKey(releaseId, release.cover_storage_key);
    if (!sourceSha256 || !storageKey) {
      throw new CatalogApiError(
        "The release cover lineage is invalid.",
        409,
        "cover_lineage_invalid",
      );
    }

    const bucket = requireCatalogAudioBucket();
    const sourceCover = await bucket.head(release.cover_storage_key);
    if (
      !sourceCover
      || sourceCover.size < 1
      || !sourceCover.httpMetadata?.contentType?.startsWith("image/")
      || sourceCover.customMetadata?.sha256 !== sourceSha256
    ) {
      throw new CatalogApiError(
        "The release cover is unavailable in private storage.",
        409,
        "release_cover_unavailable",
      );
    }
    if (expectedSourceSha256 !== sourceSha256) {
      throw new CatalogApiError(
        "The thumbnail source checksum does not match the immutable release cover.",
        409,
        "cover_thumbnail_source_checksum_mismatch",
      );
    }
    const existing = await bucket.head(storageKey);
    if (
      existing
      && existing.size > 0
      && existing.size <= MAX_COVER_THUMBNAIL_BYTES
      && existing.httpMetadata?.contentType === "image/webp"
      && sha256Pattern.test(existing.customMetadata?.sha256 ?? "")
      && existing.customMetadata?.sourceSha256 === sourceSha256
    ) {
      return noStoreJson({ stored: true, idempotent: true });
    }
    if (existing) {
      throw new CatalogApiError(
        "A different thumbnail already exists for this release cover.",
        409,
        "cover_thumbnail_locked",
      );
    }

    await bucket.put(storageKey, body, {
      httpMetadata: {
        contentType: "image/webp",
        cacheControl: "public, max-age=86400",
      },
      customMetadata: {
        sha256: expectedSha256,
        sourceSha256,
        generatedAt: new Date().toISOString(),
      },
    });
    const stored = await bucket.head(storageKey);
    if (
      !stored
      || stored.size !== contentLength
      || stored.customMetadata?.sha256 !== expectedSha256
      || stored.customMetadata?.sourceSha256 !== sourceSha256
    ) {
      throw new CatalogApiError(
        "The stored cover thumbnail failed integrity verification.",
        502,
        "stored_cover_thumbnail_integrity_mismatch",
      );
    }

    return noStoreJson({ stored: true, idempotent: false }, { status: 201 });
  } catch (error) {
    return catalogErrorResponse(error);
  }
}

function requiredContentLength(request: Request): number {
  const value = request.headers.get("content-length")?.trim() ?? "";
  if (!/^\d+$/u.test(value)) {
    throw new CatalogApiError("Content-Length is required.", 411, "content_length_required");
  }
  const contentLength = Number(value);
  if (!Number.isSafeInteger(contentLength) || contentLength < 1 || contentLength > MAX_COVER_THUMBNAIL_BYTES) {
    throw new CatalogApiError(
      "The cover thumbnail exceeds the upload limit.",
      413,
      "cover_thumbnail_too_large",
    );
  }
  return contentLength;
}

function requiredSha256(value: string | null, headerName: string, code: string): string {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (!sha256Pattern.test(normalized)) {
    throw new CatalogApiError(`${headerName} is invalid.`, 400, code);
  }
  return normalized;
}

async function readBodyWithLimit(request: Request, contentLength: number): Promise<ArrayBuffer> {
  if (!request.body) throw new CatalogApiError("The request body is required.", 400, "body_required");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > contentLength || total > MAX_COVER_THUMBNAIL_BYTES) {
      await reader.cancel();
      throw new CatalogApiError(
        "The cover thumbnail exceeds the upload limit.",
        413,
        "cover_thumbnail_too_large",
      );
    }
    chunks.push(value);
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body.buffer;
}

function isWebp(value: ArrayBuffer): boolean {
  const bytes = new Uint8Array(value);
  return bytes.byteLength >= 16
    && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
    && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
}

async function sha256Hex(value: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", value);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

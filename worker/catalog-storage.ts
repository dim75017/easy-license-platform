import {
  googleDriveAccessToken,
  requireCatalogAudioBucket,
} from "@/db/catalog-runtime";
import { CatalogApiError } from "@/app/api/catalog/_lib/http";

export type IngestableAssetKind =
  | "source_master"
  | "streaming_copy"
  | "download_copy"
  | "waveform_peaks"
  | "cover_artwork";

type DriveIngestOptions = {
  driveFileId: string;
  sourceFileName: string;
  assetKind: IngestableAssetKind;
  storageKey: string;
  expectedByteSize: number | null;
  expectedContentType: string | null;
  expectedSha256: string | null;
};

export type StoredDriveAsset = {
  byteSize: number;
  contentType: string;
  sha256: string | null;
};

const MAX_ASSET_BYTES = 2 * 1024 * 1024 * 1024;

export async function stableStorageKey(
  namespace: "tracks" | "releases",
  ownerId: number,
  assetKind: IngestableAssetKind,
  stableSourceReference: string,
  sourceFileName: string,
): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(stableSourceReference),
  );
  const fingerprint = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  )
    .join("")
    .slice(0, 32);
  const extension = safeExtension(sourceFileName, assetKind);
  return `catalog/${namespace}/${ownerId}/${assetKind}/${fingerprint}.${extension}`;
}

export async function streamDriveFileToR2(
  options: DriveIngestOptions,
): Promise<StoredDriveAsset> {
  const sourceResponse = await fetchDriveFile(options.driveFileId);
  if (!sourceResponse.ok || !sourceResponse.body) {
    sourceResponse.body?.cancel().catch(() => undefined);
    throw new CatalogApiError(
      "The Drive source file could not be fetched.",
      502,
      "drive_fetch_failed",
    );
  }

  const rawContentType =
    sourceResponse.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() ??
    "";
  const contentType = validatedContentType(
    rawContentType,
    options.sourceFileName,
    options.assetKind,
  );
  if (
    options.expectedContentType &&
    normalizeContentType(options.expectedContentType) !== contentType
  ) {
    await sourceResponse.body.cancel();
    throw new CatalogApiError(
      "The Drive source content type does not match the manifest.",
      409,
      "asset_content_type_mismatch",
    );
  }

  const contentLength = parseContentLength(
    sourceResponse.headers.get("content-length"),
  );
  if (contentLength === null) {
    await sourceResponse.body.cancel();
    throw new CatalogApiError(
      "The Drive source did not provide a verifiable byte size.",
      422,
      "asset_size_unavailable",
    );
  }
  if (contentLength > MAX_ASSET_BYTES) {
    await sourceResponse.body.cancel();
    throw new CatalogApiError(
      "The Drive source is too large for direct ingestion.",
      413,
      "asset_too_large",
    );
  }
  if (
    options.expectedByteSize !== null &&
    options.expectedByteSize !== contentLength
  ) {
    await sourceResponse.body.cancel();
    throw new CatalogApiError(
      "The Drive source byte size does not match the manifest.",
      409,
      "asset_size_mismatch",
    );
  }

  const bucket = requireCatalogAudioBucket();
  const stored = await bucket.put(options.storageKey, sourceResponse.body, {
    sha256: options.expectedSha256 ?? undefined,
    httpMetadata: {
      contentType,
      contentDisposition:
        options.assetKind === "cover_artwork" ? "inline" : "inline",
    },
    customMetadata: {
      assetKind: options.assetKind,
      ingestedAt: new Date().toISOString(),
      sourceMimeType: contentType,
      sourceFormat: sourceFormatFromContentType(contentType),
      ...(options.expectedSha256 ? { sha256: options.expectedSha256 } : {}),
    },
  });

  // R2 reports the persisted object's size, so this verifies the streamed copy
  // without ever materialising the audio master in Worker memory.
  if (stored.size !== contentLength) {
    throw new CatalogApiError(
      "The stored asset failed its byte-size verification.",
      502,
      "stored_asset_size_mismatch",
    );
  }

  return {
    byteSize: stored.size,
    contentType,
    sha256: options.expectedSha256,
  };
}

async function fetchDriveFile(driveFileId: string): Promise<Response> {
  const accessToken = googleDriveAccessToken();
  if (accessToken) {
    const url = new URL(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveFileId)}`,
    );
    url.searchParams.set("alt", "media");
    url.searchParams.set("supportsAllDrives", "true");
    return fetch(url, {
      redirect: "follow",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  }

  const url = new URL("https://drive.usercontent.google.com/download");
  url.searchParams.set("id", driveFileId);
  url.searchParams.set("export", "download");
  url.searchParams.set("confirm", "t");
  return fetch(url, { redirect: "follow" });
}

function validatedContentType(
  rawContentType: string,
  sourceFileName: string,
  assetKind: IngestableAssetKind,
): string {
  const inferred = contentTypeFromExtension(sourceFileName);
  const contentType =
    !rawContentType || rawContentType === "application/octet-stream"
      ? inferred
      : normalizeContentType(rawContentType);

  const allowed = allowedContentTypes(assetKind);
  if (!contentType || !allowed.has(contentType)) {
    throw new CatalogApiError(
      `The source file type is not valid for ${assetKind}.`,
      415,
      "invalid_asset_type",
    );
  }
  return contentType;
}

function normalizeContentType(value: string): string {
  const normalized = value.split(";", 1)[0].trim().toLowerCase();
  if (normalized === "audio/x-wav" || normalized === "audio/vnd.wave") {
    return "audio/wav";
  }
  if (normalized === "audio/x-flac") return "audio/flac";
  if (normalized === "audio/mp3" || normalized === "audio/x-mp3") {
    return "audio/mpeg";
  }
  if (normalized === "image/jpg") return "image/jpeg";
  return normalized;
}

function allowedContentTypes(assetKind: IngestableAssetKind): ReadonlySet<string> {
  switch (assetKind) {
    case "source_master":
      return new Set([
        "audio/wav",
        "audio/flac",
        "audio/aiff",
        "audio/x-aiff",
        "audio/mpeg",
      ]);
    case "download_copy":
      return new Set([
        "audio/wav",
        "audio/flac",
        "audio/aiff",
        "audio/x-aiff",
      ]);
    case "streaming_copy":
      return new Set([
        "audio/mpeg",
        "audio/mp4",
        "audio/aac",
        "audio/ogg",
        "audio/webm",
      ]);
    case "waveform_peaks":
      return new Set(["application/json"]);
    case "cover_artwork":
      return new Set(["image/jpeg", "image/png", "image/webp"]);
  }
}

function sourceFormatFromContentType(contentType: string): string {
  switch (contentType) {
    case "audio/wav":
      return "wav";
    case "audio/mpeg":
      return "mp3";
    case "audio/flac":
      return "flac";
    case "audio/aiff":
    case "audio/x-aiff":
      return "aiff";
    case "audio/mp4":
      return "mp4";
    case "audio/aac":
      return "aac";
    case "audio/ogg":
      return "ogg";
    case "audio/webm":
      return "webm";
    case "application/json":
      return "json";
    case "image/jpeg":
      return "jpeg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return "unknown";
  }
}

function contentTypeFromExtension(sourceFileName: string): string {
  const extension = sourceFileName.split(".").pop()?.toLowerCase();
  switch (extension) {
    case "wav":
    case "wave":
      return "audio/wav";
    case "flac":
      return "audio/flac";
    case "aif":
    case "aiff":
      return "audio/aiff";
    case "mp3":
      return "audio/mpeg";
    case "m4a":
    case "mp4":
      return "audio/mp4";
    case "aac":
      return "audio/aac";
    case "ogg":
    case "oga":
      return "audio/ogg";
    case "webm":
      return "audio/webm";
    case "json":
      return "application/json";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    default:
      return "";
  }
}

function safeExtension(
  sourceFileName: string,
  assetKind: IngestableAssetKind,
): string {
  const extension = sourceFileName.split(".").pop()?.toLowerCase() ?? "";
  if (/^[a-z0-9]{2,5}$/u.test(extension)) return extension;
  switch (assetKind) {
    case "source_master":
    case "download_copy":
      return "wav";
    case "streaming_copy":
      return "mp3";
    case "waveform_peaks":
      return "json";
    case "cover_artwork":
      return "jpg";
  }
}

function parseContentLength(value: string | null): number | null {
  if (!value || !/^\d+$/u.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

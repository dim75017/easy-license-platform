import {
  assertAllowedKeys,
  CatalogApiError,
  isPlainObject,
  optionalInteger,
  optionalString,
  requiredString,
} from "./http";

const BATCH_KEYS = new Set(["batchKey", "items"]);
const ITEM_KEYS = new Set([
  "sourceKey",
  "sourceFileName",
  "sourceRowNumber",
  "sourceSha256",
  "title",
  "artist",
  "artistCredit",
  "releaseTitle",
  "releaseType",
  "upc",
  "releaseDate",
  "versionLabel",
  "isrc",
  "discNumber",
  "trackNumber",
  "durationMs",
  "genre",
  "mood",
  "theme",
  "rightsStatus",
  "catalogStatus",
  "spotify",
]);
const SPOTIFY_KEYS = new Set([
  "trackId",
  "albumId",
  "title",
  "artistCredit",
  "albumTitle",
  "isrc",
  "durationMs",
  "coverSourceUrl",
  "method",
  "score",
  "status",
]);
const MAX_BATCH_ITEMS = 50;

const RELEASE_TYPES = new Set([
  "single",
  "ep",
  "album",
  "compilation",
  "other",
]);
const CATALOG_STATUSES = new Set([
  "draft",
  "needs_review",
  "ready",
  "published",
]);
const RIGHTS_STATUSES = new Set(["pending", "cleared", "restricted"]);
const SPOTIFY_METHODS = new Set([
  "distributor_uri",
  "orchard_uri",
  "isrc",
  "exact_metadata",
  "metadata_duration",
  "manual",
]);
const SPOTIFY_STATUSES = new Set([
  "candidate",
  "verified",
  "rejected",
  "stale",
]);

export type CatalogSpotifyMatchInput = {
  trackId: string;
  albumId: string | null;
  title: string | null;
  artistCredit: string | null;
  albumTitle: string | null;
  isrc: string | null;
  durationMs: number | null;
  durationDeltaMs: number | null;
  coverSourceUrl: string | null;
  method:
    | "distributor_uri"
    | "orchard_uri"
    | "isrc"
    | "exact_metadata"
    | "metadata_duration"
    | "manual";
  score: number;
  status: "candidate" | "verified" | "rejected" | "stale";
};

export type CatalogMetadataItem = {
  sourceKey: string;
  sourceFileName: string;
  sourceRowNumber: number | null;
  sourceSha256: string | null;
  title: string;
  normalizedTitle: string;
  artist: string;
  normalizedArtist: string;
  artistCredit: string;
  releaseTitle: string;
  normalizedReleaseTitle: string;
  releaseType: "single" | "ep" | "album" | "compilation" | "other";
  upc: string | null;
  releaseDate: string | null;
  versionLabel: string | null;
  isrc: string | null;
  discNumber: number;
  trackNumber: number | null;
  durationMs: number | null;
  genre: string | null;
  mood: string | null;
  theme: string | null;
  rightsStatus: "pending" | "cleared" | "restricted";
  catalogStatus: "draft" | "needs_review" | "ready" | "published";
  spotify: CatalogSpotifyMatchInput | null;
};

export type CatalogMetadataBatch = {
  batchKey: string;
  items: CatalogMetadataItem[];
};

export function parseMetadataBatch(
  payload: Record<string, unknown>,
): CatalogMetadataBatch {
  assertAllowedKeys(payload, BATCH_KEYS);
  const batchKey = requiredString(payload.batchKey, "batchKey", 160);
  if (!/^[\p{L}\p{N}][\p{L}\p{N}._:-]*$/u.test(batchKey)) {
    throw new CatalogApiError(
      "batchKey may only contain letters, numbers, dots, underscores, colons and hyphens.",
    );
  }

  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    throw new CatalogApiError("items must be a non-empty array.");
  }
  if (payload.items.length > MAX_BATCH_ITEMS) {
    throw new CatalogApiError(
      `A metadata batch may contain at most ${MAX_BATCH_ITEMS} items.`,
      413,
      "batch_too_large",
    );
  }

  return {
    batchKey,
    items: payload.items.map((item, index) => parseMetadataItem(item, index)),
  };
}

function parseMetadataItem(value: unknown, index: number): CatalogMetadataItem {
  if (!isPlainObject(value)) {
    throw new CatalogApiError(`items[${index}] must be an object.`);
  }
  assertAllowedKeys(value, ITEM_KEYS, `items[${index}]`);
  const prefix = `items[${index}]`;

  const sourceKey = requiredString(value.sourceKey, `${prefix}.sourceKey`, 160);
  const sourceFileName = requiredString(
    value.sourceFileName,
    `${prefix}.sourceFileName`,
    1000,
  );
  const title = requiredString(value.title, `${prefix}.title`, 500);
  const artist = requiredString(value.artist, `${prefix}.artist`, 300);
  const artistCredit =
    optionalString(value.artistCredit, `${prefix}.artistCredit`, 1000) ?? artist;
  const releaseTitle = requiredString(
    value.releaseTitle,
    `${prefix}.releaseTitle`,
    500,
  );

  const releaseType = enumValue(
    value.releaseType ?? "other",
    `${prefix}.releaseType`,
    RELEASE_TYPES,
  ) as CatalogMetadataItem["releaseType"];
  const rightsStatus = enumValue(
    value.rightsStatus ?? "pending",
    `${prefix}.rightsStatus`,
    RIGHTS_STATUSES,
  ) as CatalogMetadataItem["rightsStatus"];
  const catalogStatus = enumValue(
    value.catalogStatus ?? "needs_review",
    `${prefix}.catalogStatus`,
    CATALOG_STATUSES,
  ) as CatalogMetadataItem["catalogStatus"];
  // Batch ingestion is a staging surface, never a publication shortcut.
  // Promotion must remain a separate server-side operation that can verify
  // the measured audio, checksum, rights, artwork and Spotify evidence.
  if (catalogStatus === "published") {
    throw new CatalogApiError(
      `${prefix} cannot be published through metadata ingestion.`,
      409,
      "publication_gate_required",
    );
  }
  const durationMs = optionalInteger(
    value.durationMs,
    `${prefix}.durationMs`,
    1,
    86_400_000,
  );
  const spotify = parseSpotifyMatch(value.spotify, prefix, durationMs);

  return {
    sourceKey,
    sourceFileName,
    sourceRowNumber: optionalInteger(
      value.sourceRowNumber,
      `${prefix}.sourceRowNumber`,
      1,
      10_000_000,
    ),
    sourceSha256: optionalSha256(value.sourceSha256, `${prefix}.sourceSha256`),
    title,
    normalizedTitle: normalizeCatalogText(title),
    artist,
    normalizedArtist: normalizeCatalogText(artist),
    artistCredit,
    releaseTitle,
    normalizedReleaseTitle: normalizeCatalogText(releaseTitle),
    releaseType,
    upc: optionalUpc(value.upc, `${prefix}.upc`),
    releaseDate: optionalReleaseDate(value.releaseDate, `${prefix}.releaseDate`),
    versionLabel: optionalString(
      value.versionLabel,
      `${prefix}.versionLabel`,
      300,
    ),
    isrc: optionalIsrc(value.isrc, `${prefix}.isrc`),
    discNumber:
      optionalInteger(value.discNumber, `${prefix}.discNumber`, 1, 999) ?? 1,
    trackNumber: optionalInteger(
      value.trackNumber,
      `${prefix}.trackNumber`,
      1,
      9999,
    ),
    durationMs,
    genre: optionalString(value.genre, `${prefix}.genre`, 120),
    mood: optionalString(value.mood, `${prefix}.mood`, 120),
    theme: optionalString(value.theme, `${prefix}.theme`, 120),
    rightsStatus,
    catalogStatus,
    spotify,
  };
}

function parseSpotifyMatch(
  value: unknown,
  itemPrefix: string,
  declaredDurationMs: number | null,
): CatalogSpotifyMatchInput | null {
  if (value === undefined || value === null) return null;
  if (!isPlainObject(value)) {
    throw new CatalogApiError(`${itemPrefix}.spotify must be an object.`);
  }
  assertAllowedKeys(value, SPOTIFY_KEYS, `${itemPrefix}.spotify`);
  const prefix = `${itemPrefix}.spotify`;

  const trackId = requiredString(value.trackId, `${prefix}.trackId`, 64);
  if (!/^[A-Za-z0-9]{8,64}$/u.test(trackId)) {
    throw new CatalogApiError(`${prefix}.trackId is invalid.`);
  }
  const albumId = optionalString(value.albumId, `${prefix}.albumId`, 64);
  const title = optionalString(value.title, `${prefix}.title`, 500);
  const artistCredit = optionalString(
    value.artistCredit,
    `${prefix}.artistCredit`,
    1000,
  );
  const albumTitle = optionalString(
    value.albumTitle,
    `${prefix}.albumTitle`,
    500,
  );
  const durationMs = optionalInteger(
    value.durationMs,
    `${prefix}.durationMs`,
    1,
    86_400_000,
  );
  const status = enumValue(
    value.status ?? "candidate",
    `${prefix}.status`,
    SPOTIFY_STATUSES,
  ) as CatalogSpotifyMatchInput["status"];
  const method = enumValue(
    value.method,
    `${prefix}.method`,
    SPOTIFY_METHODS,
  ) as CatalogSpotifyMatchInput["method"];

  if (
    status === "verified" &&
    (!albumId || !title || !artistCredit || !albumTitle || durationMs === null)
  ) {
    throw new CatalogApiError(
      `${prefix} needs albumId, title, artistCredit, albumTitle and durationMs before it can be verified.`,
    );
  }

  return {
    trackId,
    albumId,
    title,
    artistCredit,
    albumTitle,
    isrc: optionalIsrc(value.isrc, `${prefix}.isrc`),
    durationMs,
    durationDeltaMs:
      durationMs !== null && declaredDurationMs !== null
        ? Math.abs(durationMs - declaredDurationMs)
        : null,
    coverSourceUrl: optionalHttpUrl(
      value.coverSourceUrl,
      `${prefix}.coverSourceUrl`,
    ),
    method,
    score:
      optionalInteger(value.score, `${prefix}.score`, 0, 10_000) ?? 0,
    status,
  };
}

function enumValue(
  value: unknown,
  label: string,
  allowed: ReadonlySet<string>,
): string {
  if (typeof value !== "string" || !allowed.has(value)) {
    throw new CatalogApiError(
      `${label} must be one of: ${Array.from(allowed).join(", ")}.`,
    );
  }
  return value;
}

function optionalUpc(value: unknown, label: string): string | null {
  const upc = optionalString(value, label, 14)?.replace(/\s+/gu, "") ?? null;
  if (upc && !/^\d{8,14}$/u.test(upc)) {
    throw new CatalogApiError(`${label} must contain 8 to 14 digits.`);
  }
  return upc;
}

function optionalIsrc(value: unknown, label: string): string | null {
  const isrc =
    optionalString(value, label, 32)?.replace(/[\s-]+/gu, "").toUpperCase() ??
    null;
  if (isrc && !/^[A-Z]{2}[A-Z0-9]{3}\d{7}$/u.test(isrc)) {
    throw new CatalogApiError(`${label} must be a valid 12-character ISRC.`);
  }
  return isrc;
}

function optionalSha256(value: unknown, label: string): string | null {
  const sha256 = optionalString(value, label, 64)?.toLowerCase() ?? null;
  if (sha256 && !/^[a-f0-9]{64}$/u.test(sha256)) {
    throw new CatalogApiError(`${label} must be a hexadecimal SHA-256 digest.`);
  }
  return sha256;
}

function optionalReleaseDate(value: unknown, label: string): string | null {
  const releaseDate = optionalString(value, label, 10);
  if (releaseDate && !/^\d{4}(?:-(?:0[1-9]|1[0-2])(?:-(?:0[1-9]|[12]\d|3[01]))?)?$/u.test(releaseDate)) {
    throw new CatalogApiError(`${label} must use YYYY, YYYY-MM or YYYY-MM-DD.`);
  }
  return releaseDate;
}

function optionalHttpUrl(value: unknown, label: string): string | null {
  const urlValue = optionalString(value, label, 2048);
  if (!urlValue) return null;
  let url: URL;
  try {
    url = new URL(urlValue);
  } catch {
    throw new CatalogApiError(`${label} must be a valid URL.`);
  }
  if (url.protocol !== "https:") {
    throw new CatalogApiError(`${label} must use HTTPS.`);
  }
  return url.toString();
}

export function normalizeCatalogText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .replace(/[’‘`]/gu, "'")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .toLowerCase();
}

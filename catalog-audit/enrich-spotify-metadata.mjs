#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const AUDIT_DIR = path.dirname(SCRIPT_PATH);
const REPOSITORY_ROOT = path.dirname(AUDIT_DIR);
const PRIVATE_DIR = path.join(AUDIT_DIR, "private");
const DEFAULT_OUTPUT_DIR = path.join(PRIVATE_DIR, "spotify-enrichment");
const DEFAULT_PUBLIC_REPORT = path.join(AUDIT_DIR, "spotify-enrichment-summary.json");
const SPOTIFY_ID_PATTERN = /^[A-Za-z0-9]{22}$/;
const SPOTIFY_IMAGE_HOST_SUFFIXES = [".scdn.co", ".spotifycdn.com"];
const SPOTIFY_CACHE_SCHEMA_VERSION = 2;

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const name = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      args[name] = true;
    } else {
      args[name] = value;
      index += 1;
    }
  }
  return args;
}

function parseDelimited(text, delimiter) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => String(value ?? "").trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell);
  if (row.some((value) => String(value ?? "").trim())) rows.push(row);
  return rows;
}

function rowsToObjects(rows) {
  if (!rows.length) return [];
  const headers = rows[0].map((value, index) => String(value ?? "").trim() || `Column_${index + 1}`);
  return rows
    .slice(1)
    .filter((row) => row.some((value) => String(value ?? "").trim()))
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])));
}

function loadRecords(filePath) {
  const text = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  const extension = path.extname(filePath).toLowerCase();

  if (extension === ".json") {
    const parsed = JSON.parse(text);
    const rows = Array.isArray(parsed)
      ? parsed
      : parsed.records ?? parsed.tracks ?? parsed.values;
    if (!Array.isArray(rows)) {
      throw new Error("The JSON input must be an array, or expose records, tracks or values as an array.");
    }
    return Array.isArray(rows[0]) ? rowsToObjects(rows) : rows;
  }

  if (extension === ".jsonl" || extension === ".ndjson") {
    return text
      .split(/\r?\n/)
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line));
  }

  if (extension === ".tsv") return rowsToObjects(parseDelimited(text, "\t"));
  if (extension === ".csv") {
    const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
    const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
    return rowsToObjects(parseDelimited(text, delimiter));
  }

  throw new Error("Supported input formats are JSON, JSONL, NDJSON, CSV and TSV.");
}

function normalizeHeader(value) {
  return String(value ?? "").normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function indexedRecord(record) {
  const index = new Map();
  for (const [key, value] of Object.entries(record ?? {})) index.set(normalizeHeader(key), value);
  return index;
}

function readValue(index, ...aliases) {
  for (const alias of aliases) {
    const value = index.get(normalizeHeader(alias));
    if (value !== undefined && value !== null && String(value).trim() !== "") return value;
  }
  return "";
}

function extractSpotifyId(...values) {
  for (const value of values) {
    const candidate = String(value ?? "").trim();
    if (SPOTIFY_ID_PATTERN.test(candidate)) return candidate;
    const match = candidate.match(/(?:spotify:track:|open\.spotify\.com\/(?:embed\/)?track\/)([A-Za-z0-9]{22})/i);
    if (match) return match[1];
  }
  return "";
}

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/[‐‑‒–—−]/g, "-")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSimilarity(left, right) {
  const leftTokens = new Set(normalizeText(left).split(" ").filter(Boolean));
  const rightTokens = new Set(normalizeText(right).split(" ").filter(Boolean));
  if (!leftTokens.size || !rightTokens.size) return 0;
  let intersection = 0;
  for (const token of leftTokens) if (rightTokens.has(token)) intersection += 1;
  return (2 * intersection) / (leftTokens.size + rightTokens.size);
}

function parseDurationMs(value, explicitUnit = "auto") {
  if (value === null || value === undefined || value === "") return null;
  const text = String(value).trim();
  if (/^\d+:\d{2}(?::\d{2})?$/.test(text)) {
    const parts = text.split(":").map(Number);
    const seconds = parts.length === 2
      ? parts[0] * 60 + parts[1]
      : parts[0] * 3600 + parts[1] * 60 + parts[2];
    return seconds * 1000;
  }

  const numeric = Number(text.replace(",", "."));
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  if (explicitUnit === "milliseconds") return Math.round(numeric);
  if (explicitUnit === "seconds") return Math.round(numeric * 1000);
  if (numeric > 10_000) return Math.round(numeric);
  if (numeric > 0 && numeric < 1) return Math.round(numeric * 86_400_000);
  return Math.round(numeric * 1000);
}

function parseBoolean(value) {
  if (typeof value === "boolean") return value;
  const normalized = normalizeText(value);
  if (["1", "yes", "true", "oui", "present", "available"].includes(normalized)) return true;
  if (["0", "no", "false", "non", "absent", "missing"].includes(normalized)) return false;
  return null;
}

function spotifyEntityId(uri, entityType) {
  const match = String(uri ?? "").trim().match(new RegExp(`^spotify:${entityType}:([A-Za-z0-9]{22})$`));
  return match ? match[1] : null;
}

function sanitizeSpotifyImageUrl(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    const allowedHost = SPOTIFY_IMAGE_HOST_SUFFIXES.some(
      (suffix) => hostname === suffix.slice(1) || hostname.endsWith(suffix),
    );
    if (url.protocol !== "https:" || !allowedHost) return null;
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function normalizedReleaseDate(value) {
  const text = String(value ?? "").trim();
  const match = text.match(/^(\d{4}-\d{2}-\d{2})(?:T.*)?$/);
  if (!match || Number.isNaN(Date.parse(`${match[1]}T00:00:00Z`))) return null;
  return match[1];
}

function hyperlinkDisplayText(value) {
  const text = String(value ?? "").trim();
  const match = text.match(/^=HYPERLINK\("(?:[^"]|"")*"\s*[,;]\s*"((?:[^"]|"")*)"\)$/i);
  return match ? match[1].replace(/""/g, '"').trim() : text;
}

function toLocalTrack(record, inputIndex) {
  const index = indexedRecord(record);
  const nestedTrack = record?.track && typeof record.track === "object" ? record.track : {};
  const nestedInspection = record?.inspection && typeof record.inspection === "object" ? record.inspection : {};
  const nestedWav = nestedInspection?.wav && typeof nestedInspection.wav === "object" ? nestedInspection.wav : {};
  const nestedCover = record?.cover && typeof record.cover === "object" ? record.cover : {};
  const ingestionManifest = Boolean(record?.track && record?.candidate_id);
  const spotifyId = extractSpotifyId(
    readValue(index, "spotifyId", "spotify_id", "Spotify ID", "Spotify URI", "spotifyUri", "spotifyUrl", "URL"),
  );
  const title = String(
    readValue(index, "title", "trackTitle", "Track Title", "Track Name", "name") || nestedTrack.title || "",
  ).trim();

  const rawArtists = readValue(index, "artists");
  let artists = Array.isArray(rawArtists)
    ? rawArtists.map(String).map((value) => value.trim()).filter(Boolean)
    : [
        readValue(index, "artist", "artistName", "Artist Name", "Artist 1"),
        readValue(index, "Artist 2"),
        readValue(index, "Artist 3"),
        readValue(index, "Artist 4"),
      ].map(String).map((value) => value.trim()).filter(Boolean);
  if (!artists.length && Array.isArray(nestedTrack.artists)) {
    artists = nestedTrack.artists.map(String).map((value) => value.trim()).filter(Boolean);
  }

  const explicitDurationMs = readValue(index, "durationMs", "duration_ms");
  const explicitDurationSeconds = readValue(index, "durationSeconds", "duration_seconds");
  const genericDuration = readValue(index, "duration", "trackTime", "Track Time", "length");
  const measuredDurationMs = nestedInspection.status === "complete"
    ? parseDurationMs(nestedWav.duration_seconds, "seconds")
    : null;
  const declaredDurationMs = parseDurationMs(nestedTrack.duration_seconds, "seconds");
  const recordDurationMs = explicitDurationMs !== ""
    ? parseDurationMs(explicitDurationMs, "milliseconds")
    : explicitDurationSeconds !== ""
      ? parseDurationMs(explicitDurationSeconds, "seconds")
      : parseDurationMs(genericDuration);
  const durationMs = measuredDurationMs ?? recordDurationMs ?? declaredDurationMs;
  const durationSource = measuredDurationMs !== null
    ? "measured_wav"
    : recordDurationMs !== null
      ? "record"
      : declaredDurationMs !== null
        ? "declared_catalogue"
        : "missing";
  const sourceSha256 = nestedInspection.status === "complete"
    && /^[a-f0-9]{64}$/i.test(String(nestedInspection.sha256 ?? ""))
    ? String(nestedInspection.sha256).toLowerCase()
    : null;

  const explicitOwnedArtwork = parseBoolean(readValue(
    index,
    "ownedArtworkPresent",
    "hasOwnedArtwork",
    "driveArtworkPresent",
    "hasDriveArtwork",
  ));
  const ownedArtworkReference = readValue(
    index,
    "ownedArtwork",
    "ownedArtworkUrl",
    "driveArtwork",
    "driveArtworkId",
    "coverAlbum",
    "coverUrl",
  );
  const ownedArtworkPresent = explicitOwnedArtwork
    ?? (Boolean(String(ownedArtworkReference ?? "").trim()) || Boolean(String(nestedCover.file_id ?? "").trim()));

  const suppliedKey = String(
    readValue(index, "recordKey", "candidate_id", "candidateId", "catalogId", "trackId", "id", "ISRC", "isrc") ?? "",
  ).trim();
  const fallbackKey = crypto
    .createHash("sha256")
    .update(`${inputIndex}|${spotifyId}|${title}|${artists.join("|")}|${durationMs ?? ""}`)
    .digest("hex")
    .slice(0, 16);

  return {
    inputIndex,
    recordKey: suppliedKey || `row-${fallbackKey}`,
    spotifyId,
    title,
    artists,
    durationMs,
    declaredDurationMs,
    durationSource,
    ingestionManifest,
    audioInspectionComplete: measuredDurationMs !== null && sourceSha256 !== null,
    sourceSha256,
    ownedArtworkPresent,
    isrc: String(nestedTrack.isrc ?? readValue(index, "ISRC", "isrc") ?? "").trim() || null,
    upc: String(nestedTrack.upc ?? readValue(index, "UPC", "upc") ?? "").trim() || null,
    releaseTitle: hyperlinkDisplayText(nestedTrack.release ?? readValue(index, "release", "releaseTitle", "album")) || null,
  };
}

function selectOEmbedMetadata(payload) {
  if (!payload || payload.provider_name !== "Spotify" || payload.type !== "rich") {
    throw new Error("Unexpected Spotify oEmbed response.");
  }
  return {
    title: String(payload.title ?? "").trim(),
    thumbnailUrl: sanitizeSpotifyImageUrl(payload.thumbnail_url),
    thumbnailWidth: Number.isFinite(payload.thumbnail_width) ? payload.thumbnail_width : null,
    thumbnailHeight: Number.isFinite(payload.thumbnail_height) ? payload.thumbnail_height : null,
  };
}

function parseEmbedMetadata(html, expectedSpotifyId) {
  const match = String(html).match(/<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!match) throw new Error("Spotify Embed metadata was not found.");

  let parsed;
  try {
    parsed = JSON.parse(match[1]);
  } catch {
    throw new Error("Spotify Embed metadata is not valid JSON.");
  }

  const entity = parsed?.props?.pageProps?.state?.data?.entity;
  if (!entity || entity.type !== "track" || entity.id !== expectedSpotifyId) {
    throw new Error("Spotify Embed returned an unexpected entity.");
  }

  const spotifyUri = String(entity.uri ?? "").trim();
  if (spotifyEntityId(spotifyUri, "track") !== expectedSpotifyId) {
    throw new Error("Spotify Embed returned an unexpected track URI.");
  }

  const artistEntities = Array.isArray(entity.artists)
    ? entity.artists
      .map((artist) => {
        const name = String(artist?.name ?? "").trim();
        const uri = String(artist?.uri ?? "").trim();
        const id = spotifyEntityId(uri, "artist");
        return name ? { name, id, uri: id ? uri : null } : null;
      })
      .filter(Boolean)
    : [];
  const images = Array.isArray(entity.visualIdentity?.image)
    ? entity.visualIdentity.image
      .map((image) => {
        const url = sanitizeSpotifyImageUrl(image?.url);
        if (!url) return null;
        const width = Number.isFinite(image?.maxWidth) && image.maxWidth > 0 ? Math.round(image.maxWidth) : null;
        const height = Number.isFinite(image?.maxHeight) && image.maxHeight > 0 ? Math.round(image.maxHeight) : null;
        return { url, width, height };
      })
      .filter(Boolean)
      .sort((left, right) => ((right.width ?? 0) * (right.height ?? 0)) - ((left.width ?? 0) * (left.height ?? 0)))
    : [];

  // Deliberately select only non-session metadata. The source document also
  // contains anonymous access tokens and preview URLs; neither leaves memory.
  return {
    spotifyId: expectedSpotifyId,
    spotifyUri,
    title: String(entity.title ?? entity.name ?? "").trim(),
    artists: artistEntities.map((artist) => artist.name),
    artistEntities,
    durationMs: Number.isFinite(entity.duration) && entity.duration >= 0 ? Math.round(entity.duration) : null,
    playable: typeof entity.isPlayable === "boolean" ? entity.isPlayable : null,
    explicit: typeof entity.isExplicit === "boolean" ? entity.isExplicit : null,
    hasVideo: typeof entity.hasVideo === "boolean" ? entity.hasVideo : null,
    releaseDate: normalizedReleaseDate(entity.releaseDate?.isoString),
    contentRatingLabels: Array.isArray(entity.contentRatings?.labels)
      ? entity.contentRatings.labels.map(String).map((label) => label.trim()).filter(Boolean)
      : [],
    thumbnailUrl: images[0]?.url ?? null,
    images,
    // The official unauthenticated oEmbed/Embed payload does not expose album
    // identity. Keep this explicit so no caller mistakes a guessed release for
    // verified Spotify album metadata.
    albumId: null,
    albumTitle: null,
    albumUri: null,
  };
}

function retryAfterMs(response) {
  const header = response.headers.get("retry-after");
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const timestamp = Date.parse(header);
  return Number.isFinite(timestamp) ? Math.max(0, timestamp - Date.now()) : null;
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function createStartLimiter(minimumIntervalMs) {
  let nextStart = 0;
  let tail = Promise.resolve();
  return async function waitForStart() {
    let release;
    const previous = tail;
    tail = new Promise((resolve) => { release = resolve; });
    await previous;
    try {
      const delay = Math.max(0, nextStart - Date.now());
      if (delay) await sleep(delay);
      nextStart = Date.now() + minimumIntervalMs;
    } finally {
      release();
    }
  };
}

async function fetchWithRetry(url, options, policy) {
  let lastError;
  for (let attempt = 0; attempt <= policy.retries; attempt += 1) {
    await policy.waitForStart();
    try {
      const response = await policy.fetchImpl(url, {
        ...options,
        headers: {
          accept: options?.accept ?? "application/json",
          "user-agent": "SymbiomeCatalogAudit/1.0 (metadata validation; no audio scraping)",
          ...options?.headers,
        },
        signal: AbortSignal.timeout(policy.timeoutMs),
      });
      if (response.ok) return response;
      const shouldRetry = response.status === 429 || response.status >= 500;
      if (!shouldRetry || attempt === policy.retries) {
        const error = new Error(`Spotify request failed with HTTP ${response.status}.`);
        error.status = response.status;
        throw error;
      }
      const serverDelay = retryAfterMs(response);
      const backoff = Math.min(policy.maximumBackoffMs, policy.baseBackoffMs * (2 ** attempt));
      await sleep(serverDelay ?? backoff + Math.floor(Math.random() * 250));
    } catch (error) {
      lastError = error;
      const retryable = error?.name === "TimeoutError" || error?.name === "AbortError" || !error?.status || error.status >= 500 || error.status === 429;
      if (!retryable || attempt === policy.retries) throw error;
      const backoff = Math.min(policy.maximumBackoffMs, policy.baseBackoffMs * (2 ** attempt));
      await sleep(backoff + Math.floor(Math.random() * 250));
    }
  }
  throw lastError ?? new Error("Spotify request failed.");
}

function safeFailure(error) {
  return {
    name: String(error?.name ?? "Error").slice(0, 80),
    status: Number.isInteger(error?.status) ? error.status : null,
    message: String(error?.message ?? "Spotify metadata unavailable").replace(/https?:\/\/\S+/g, "[url]").slice(0, 200),
  };
}

async function fetchSpotifyMetadata(spotifyId, localTrack, policy) {
  const spotifyUrl = `https://open.spotify.com/track/${spotifyId}`;
  let oembed = null;
  let embed = null;
  const failures = [];

  try {
    const response = await fetchWithRetry(
      `https://open.spotify.com/oembed?url=${encodeURIComponent(spotifyUrl)}`,
      { accept: "application/json" },
      policy,
    );
    oembed = selectOEmbedMetadata(await response.json());
  } catch (error) {
    failures.push({ source: "oembed", ...safeFailure(error) });
  }

  const needsEmbed = !policy.skipEmbed && (localTrack.artists.length > 0 || localTrack.durationMs !== null);
  if (needsEmbed) {
    try {
      const response = await fetchWithRetry(
        `https://open.spotify.com/embed/track/${spotifyId}`,
        { accept: "text/html,application/xhtml+xml" },
        policy,
      );
      // Never cache or log this HTML: it can contain session/access-token data.
      embed = parseEmbedMetadata(await response.text(), spotifyId);
    } catch (error) {
      failures.push({ source: "embed", ...safeFailure(error) });
    }
  }

  const metadata = {
    schemaVersion: SPOTIFY_CACHE_SCHEMA_VERSION,
    cachedAt: new Date().toISOString(),
    sources: {
      oembed: oembed ? "ok" : "unavailable",
      embed: needsEmbed ? (embed ? "ok" : "unavailable") : "not_needed",
    },
    title: embed?.title || oembed?.title || "",
    artists: embed?.artists ?? [],
    artistEntities: embed?.artistEntities ?? [],
    durationMs: embed?.durationMs ?? null,
    playable: embed?.playable ?? null,
    explicit: embed?.explicit ?? null,
    hasVideo: embed?.hasVideo ?? null,
    releaseDate: embed?.releaseDate ?? null,
    contentRatingLabels: embed?.contentRatingLabels ?? [],
    spotifyUri: embed?.spotifyUri ?? `spotify:track:${spotifyId}`,
    albumId: null,
    albumTitle: null,
    albumUri: null,
    thumbnailUrl: oembed?.thumbnailUrl || embed?.thumbnailUrl || null,
    thumbnailWidth: oembed?.thumbnailWidth ?? null,
    thumbnailHeight: oembed?.thumbnailHeight ?? null,
    images: embed?.images ?? [],
    metadataLimitations: ["album_identity_not_exposed_by_official_oembed_or_embed"],
    failures,
  };
  return metadata;
}

function compareTitle(localTitle, spotifyTitle) {
  if (!localTitle) return { status: "missing_local", similarity: null };
  if (!spotifyTitle) return { status: "missing_spotify", similarity: null };
  if (normalizeText(localTitle) === normalizeText(spotifyTitle)) return { status: "exact", similarity: 1 };
  const similarity = tokenSimilarity(localTitle, spotifyTitle);
  return { status: similarity >= 0.9 ? "near" : "mismatch", similarity: Number(similarity.toFixed(3)) };
}

function compareArtists(localArtists, spotifyArtists) {
  if (!localArtists.length) return { status: "missing_local", similarity: null };
  if (!spotifyArtists.length) return { status: "missing_spotify", similarity: null };
  const local = localArtists.map(normalizeText).filter(Boolean);
  const spotify = spotifyArtists.map(normalizeText).filter(Boolean);
  const spotifySet = new Set(spotify);
  if (local.length === spotify.length && local.every((artist) => spotifySet.has(artist))) {
    return { status: "exact", similarity: 1 };
  }
  const overlap = local.some((artist) => spotifySet.has(artist));
  const similarity = tokenSimilarity(local.join(" "), spotify.join(" "));
  return {
    status: overlap ? "overlap" : similarity >= 0.85 ? "near" : "mismatch",
    similarity: Number(similarity.toFixed(3)),
  };
}

function compareDuration(localDurationMs, spotifyDurationMs) {
  if (localDurationMs === null) return { status: "missing_local", differenceMs: null, differenceRatio: null };
  if (spotifyDurationMs === null) return { status: "missing_spotify", differenceMs: null, differenceRatio: null };
  const differenceMs = Math.abs(localDurationMs - spotifyDurationMs);
  const differenceRatio = spotifyDurationMs ? differenceMs / spotifyDurationMs : null;
  let status = "mismatch";
  if (differenceMs <= 2_000) status = "match";
  else if (differenceMs <= 5_000 && differenceRatio !== null && differenceRatio <= 0.02) status = "warning";
  else if (differenceMs > 10_000) status = "severe_mismatch";
  return {
    status,
    differenceMs,
    differenceRatio: differenceRatio === null ? null : Number(differenceRatio.toFixed(5)),
  };
}

function validateTrack(localTrack, spotifyMetadata) {
  if (!spotifyMetadata) {
    return {
      disposition: "unavailable",
      reasons: ["spotify_metadata_unavailable"],
      checks: null,
      artworkRecommendation: localTrack.ownedArtworkPresent ? "owned_drive_artwork" : "missing",
    };
  }

  const checks = {
    title: compareTitle(localTrack.title, spotifyMetadata.title),
    artists: compareArtists(localTrack.artists, spotifyMetadata.artists),
    duration: compareDuration(localTrack.durationMs, spotifyMetadata.durationMs),
  };
  const reasons = [];
  if (checks.title.status !== "exact") reasons.push(`title_${checks.title.status}`);
  if (checks.artists.status !== "exact") reasons.push(`artists_${checks.artists.status}`);
  if (checks.duration.status !== "match") reasons.push(`duration_${checks.duration.status}`);
  if (localTrack.ingestionManifest && !localTrack.audioInspectionComplete) reasons.push("audio_full_inspection_missing");
  if (spotifyMetadata.playable === false) reasons.push("spotify_not_playable");
  if ((spotifyMetadata.failures ?? []).length) reasons.push("partial_spotify_metadata");

  return {
    disposition: reasons.length ? "review" : "accepted",
    reasons,
    checks,
    artworkRecommendation: localTrack.ownedArtworkPresent
      ? "owned_drive_artwork"
      : spotifyMetadata.thumbnailUrl
        ? "spotify_thumbnail_reference"
        : "missing",
  };
}

function isWithin(parentPath, childPath) {
  const relative = path.relative(parentPath, childPath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function assertPrivateArtifactPath(filePath, label) {
  const resolved = path.resolve(filePath);
  if (isWithin(REPOSITORY_ROOT, resolved) && !isWithin(PRIVATE_DIR, resolved)) {
    throw new Error(`${label} must be outside the repository or inside catalog-audit/private/.`);
  }
}

function atomicWriteJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  fs.renameSync(temporaryPath, filePath);
}

function loadCache(cachePath) {
  if (!fs.existsSync(cachePath)) return {};
  const parsed = JSON.parse(fs.readFileSync(cachePath, "utf8"));
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
}

function cacheEntryIsFresh(entry, maximumAgeMs) {
  if (entry?.schemaVersion !== SPOTIFY_CACHE_SCHEMA_VERSION) return false;
  const timestamp = Date.parse(entry?.cachedAt ?? "");
  const effectiveMaximumAgeMs = entry?.failures?.length
    ? Math.min(maximumAgeMs, 6 * 60 * 60 * 1000)
    : maximumAgeMs;
  return Number.isFinite(timestamp) && Date.now() - timestamp <= effectiveMaximumAgeMs;
}

function buildPrivateResult(localTrack, spotifyMetadata, fromCache) {
  const validation = validateTrack(localTrack, spotifyMetadata);
  return {
    recordKey: localTrack.recordKey,
    inputIndex: localTrack.inputIndex,
    spotifyId: localTrack.spotifyId || null,
    local: {
      title: localTrack.title,
      artists: localTrack.artists,
      durationMs: localTrack.durationMs,
      declaredDurationMs: localTrack.declaredDurationMs ?? null,
      durationSource: localTrack.durationSource ?? null,
      audioInspectionComplete: localTrack.audioInspectionComplete ?? null,
      sourceSha256: localTrack.sourceSha256 ?? null,
      ownedArtworkPresent: localTrack.ownedArtworkPresent,
      isrc: localTrack.isrc ?? null,
      upc: localTrack.upc ?? null,
      releaseTitle: localTrack.releaseTitle ?? null,
    },
    spotify: spotifyMetadata ? {
      title: spotifyMetadata.title,
      artists: spotifyMetadata.artists,
      artistEntities: spotifyMetadata.artistEntities ?? [],
      durationMs: spotifyMetadata.durationMs,
      playable: spotifyMetadata.playable,
      explicit: spotifyMetadata.explicit ?? null,
      hasVideo: spotifyMetadata.hasVideo ?? null,
      releaseDate: spotifyMetadata.releaseDate ?? null,
      contentRatingLabels: spotifyMetadata.contentRatingLabels ?? [],
      spotifyUri: spotifyMetadata.spotifyUri ?? (localTrack.spotifyId ? `spotify:track:${localTrack.spotifyId}` : null),
      albumId: spotifyMetadata.albumId ?? null,
      albumTitle: spotifyMetadata.albumTitle ?? null,
      albumUri: spotifyMetadata.albumUri ?? null,
      thumbnailUrl: spotifyMetadata.thumbnailUrl,
      images: spotifyMetadata.images ?? [],
      openUrl: localTrack.spotifyId ? `https://open.spotify.com/track/${localTrack.spotifyId}` : null,
      sources: spotifyMetadata.sources,
      metadataLimitations: spotifyMetadata.metadataLimitations ?? [],
    } : null,
    cache: fromCache ? "hit" : "miss",
    ...validation,
  };
}

function incrementCounter(object, key) {
  object[key] = (object[key] ?? 0) + 1;
}

function buildPublicSummary(results, runStats, generatedAt = new Date().toISOString()) {
  const summary = {
    schemaVersion: 1,
    generatedAt,
    records: {
      input: results.length,
      withValidSpotifyId: 0,
      missingOrInvalidSpotifyId: 0,
    },
    retrieval: {
      cacheHits: runStats.cacheHits,
      cacheMisses: runStats.cacheMisses,
      uniqueSpotifyIdsFetched: runStats.uniqueSpotifyIdsFetched,
      metadataAvailable: 0,
      metadataUnavailable: 0,
    },
    validation: {},
    reviewReasons: {},
    artwork: {
      ownedDriveArtworkPreferred: 0,
      spotifyThumbnailReferenceFallback: 0,
      missing: 0,
    },
    spotifyFields: {
      durationAvailable: 0,
      artistsAvailable: 0,
      releaseDateAvailable: 0,
      albumIdentityAvailable: 0,
      coverReferenceAvailable: 0,
    },
  };

  for (const result of results) {
    if (result.spotifyId) summary.records.withValidSpotifyId += 1;
    else summary.records.missingOrInvalidSpotifyId += 1;
    if (result.spotify) summary.retrieval.metadataAvailable += 1;
    else summary.retrieval.metadataUnavailable += 1;
    if (result.spotify?.durationMs !== null && result.spotify?.durationMs !== undefined) summary.spotifyFields.durationAvailable += 1;
    if (result.spotify?.artists?.length) summary.spotifyFields.artistsAvailable += 1;
    if (result.spotify?.releaseDate) summary.spotifyFields.releaseDateAvailable += 1;
    if (result.spotify?.albumId && result.spotify?.albumTitle) summary.spotifyFields.albumIdentityAvailable += 1;
    if (result.spotify?.thumbnailUrl) summary.spotifyFields.coverReferenceAvailable += 1;
    incrementCounter(summary.validation, result.disposition);
    for (const reason of result.reasons) incrementCounter(summary.reviewReasons, reason);
    if (result.artworkRecommendation === "owned_drive_artwork") summary.artwork.ownedDriveArtworkPreferred += 1;
    else if (result.artworkRecommendation === "spotify_thumbnail_reference") summary.artwork.spotifyThumbnailReferenceFallback += 1;
    else summary.artwork.missing += 1;
  }

  return summary;
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

async function run(options) {
  const inputPath = path.resolve(options.input);
  const outputDir = path.resolve(options.outputDir ?? DEFAULT_OUTPUT_DIR);
  const cachePath = path.resolve(options.cache ?? path.join(outputDir, "cache.json"));
  const publicReportPath = path.resolve(options.publicReport ?? DEFAULT_PUBLIC_REPORT);
  assertPrivateArtifactPath(inputPath, "Input manifest");
  assertPrivateArtifactPath(outputDir, "Private output directory");
  assertPrivateArtifactPath(cachePath, "Cache");

  const rawRecords = loadRecords(inputPath);
  const limit = options.limit ? Math.max(0, Number.parseInt(options.limit, 10)) : rawRecords.length;
  const localTracks = rawRecords.slice(0, limit).map(toLocalTrack);
  const validTracks = localTracks.filter((track) => SPOTIFY_ID_PATTERN.test(track.spotifyId));
  const representativeBySpotifyId = new Map();
  for (const track of validTracks) if (!representativeBySpotifyId.has(track.spotifyId)) representativeBySpotifyId.set(track.spotifyId, track);

  const cache = loadCache(cachePath);
  const maximumAgeMs = Number(options.cacheMaxAgeDays ?? 30) * 86_400_000;
  const refresh = Boolean(options.refresh);
  const runStats = { cacheHits: 0, cacheMisses: 0, uniqueSpotifyIdsFetched: 0 };
  const metadataBySpotifyId = new Map();
  const idsToFetch = [];

  for (const [spotifyId] of representativeBySpotifyId) {
    if (!refresh && cacheEntryIsFresh(cache[spotifyId], maximumAgeMs)) {
      metadataBySpotifyId.set(spotifyId, cache[spotifyId]);
      runStats.cacheHits += 1;
    } else {
      idsToFetch.push(spotifyId);
      runStats.cacheMisses += 1;
    }
  }

  const concurrency = Math.min(4, Math.max(1, Number.parseInt(options.concurrency ?? 2, 10)));
  const minimumIntervalMs = Math.max(200, Number.parseInt(options.minIntervalMs ?? 300, 10));
  const policy = {
    retries: Math.min(6, Math.max(0, Number.parseInt(options.retries ?? 4, 10))),
    timeoutMs: Math.max(5_000, Number.parseInt(options.timeoutMs ?? 15_000, 10)),
    baseBackoffMs: 750,
    maximumBackoffMs: 30_000,
    waitForStart: createStartLimiter(minimumIntervalMs),
    fetchImpl: options.fetchImpl ?? globalThis.fetch,
    skipEmbed: Boolean(options.skipEmbed),
  };

  let completed = 0;
  await mapWithConcurrency(idsToFetch, concurrency, async (spotifyId) => {
    const localTrack = representativeBySpotifyId.get(spotifyId);
    let metadata;
    try {
      metadata = await fetchSpotifyMetadata(spotifyId, localTrack, policy);
      if (!metadata.title && !metadata.artists.length && metadata.durationMs === null && !metadata.thumbnailUrl) metadata = null;
    } catch (error) {
      metadata = {
        schemaVersion: SPOTIFY_CACHE_SCHEMA_VERSION,
        cachedAt: new Date().toISOString(),
        sources: { oembed: "unavailable", embed: "unavailable" },
        title: "",
        artists: [],
        artistEntities: [],
        durationMs: null,
        playable: null,
        explicit: null,
        hasVideo: null,
        releaseDate: null,
        contentRatingLabels: [],
        spotifyUri: `spotify:track:${spotifyId}`,
        albumId: null,
        albumTitle: null,
        albumUri: null,
        thumbnailUrl: null,
        thumbnailWidth: null,
        thumbnailHeight: null,
        images: [],
        metadataLimitations: ["album_identity_not_exposed_by_official_oembed_or_embed"],
        failures: [{ source: "request", ...safeFailure(error) }],
      };
    }
    if (metadata) {
      cache[spotifyId] = metadata;
      metadataBySpotifyId.set(spotifyId, metadata);
    }
    runStats.uniqueSpotifyIdsFetched += 1;
    completed += 1;
    if (completed % 25 === 0) atomicWriteJson(cachePath, cache);
    if (completed % 100 === 0 || completed === idsToFetch.length) {
      process.stderr.write(`Spotify metadata: ${completed}/${idsToFetch.length} unique IDs processed.\n`);
    }
  });
  atomicWriteJson(cachePath, cache);

  const idsToFetchSet = new Set(idsToFetch);
  const results = localTracks.map((track) => {
    const metadata = track.spotifyId ? metadataBySpotifyId.get(track.spotifyId) ?? null : null;
    const fromCache = Boolean(track.spotifyId && !idsToFetchSet.has(track.spotifyId));
    return buildPrivateResult(track, metadata, fromCache);
  });
  const reviewQueue = results.filter((result) => result.disposition !== "accepted");
  const generatedAt = new Date().toISOString();
  const summary = buildPublicSummary(results, runStats, generatedAt);

  atomicWriteJson(path.join(outputDir, "enriched-tracks.json"), { schemaVersion: 1, generatedAt, records: results });
  atomicWriteJson(path.join(outputDir, "review-queue.json"), { schemaVersion: 1, generatedAt, records: reviewQueue });
  atomicWriteJson(publicReportPath, summary);
  return { summary, outputDir, publicReportPath };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input) {
    throw new Error(
      "Usage: node catalog-audit/enrich-spotify-metadata.mjs --input <private-manifest.json|csv|tsv> " +
      "[--output-dir catalog-audit/private/spotify-enrichment] [--public-report catalog-audit/spotify-enrichment-summary.json]",
    );
  }
  const result = await run({
    input: args.input,
    outputDir: args["output-dir"],
    cache: args.cache,
    publicReport: args["public-report"],
    cacheMaxAgeDays: args["cache-max-age-days"],
    concurrency: args.concurrency,
    minIntervalMs: args["min-interval-ms"],
    retries: args.retries,
    timeoutMs: args["timeout-ms"],
    limit: args.limit,
    refresh: args.refresh,
    skipEmbed: args["skip-embed"],
  });
  process.stdout.write(`${JSON.stringify(result.summary, null, 2)}\n`);
}

if (path.resolve(process.argv[1] ?? "") === SCRIPT_PATH) {
  main().catch((error) => {
    process.stderr.write(`Spotify enrichment failed: ${safeFailure(error).message}\n`);
    process.exitCode = 1;
  });
}

export {
  buildPrivateResult,
  buildPublicSummary,
  compareArtists,
  compareDuration,
  compareTitle,
  extractSpotifyId,
  parseDurationMs,
  parseEmbedMetadata,
  run,
  selectOEmbedMetadata,
  toLocalTrack,
  validateTrack,
};

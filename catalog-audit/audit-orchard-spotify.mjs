#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

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
      if (row.some((value) => String(value).trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell);
  if (row.some((value) => String(value).trim() !== "")) rows.push(row);
  return rows;
}

function loadRows(filePath) {
  const text = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  const extension = path.extname(filePath).toLowerCase();

  if (extension === ".json") {
    const parsed = JSON.parse(text);
    const rows = Array.isArray(parsed) ? parsed : parsed.values;
    if (!Array.isArray(rows)) {
      throw new Error(`${filePath}: JSON must be a row matrix or an object with a values array.`);
    }
    return rows;
  }

  if (extension === ".tsv") return parseDelimited(text, "\t");
  if (extension === ".csv") {
    const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
    const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
    return parseDelimited(text, delimiter);
  }

  throw new Error(`${filePath}: supported formats are .json, .csv and .tsv.`);
}

function rowsToObjects(rows) {
  if (!rows.length) return [];
  const headers = rows[0].map((value) => String(value ?? "").trim());
  return rows
    .slice(1)
    .filter((row) => row.some((value) => String(value ?? "").trim() !== ""))
    .map((row) => Object.fromEntries(headers.map((header, index) => [header || `Column_${index + 1}`, row[index] ?? ""])));
}

function value(row, ...names) {
  for (const name of names) {
    if (Object.hasOwn(row, name)) return row[name];
  }
  return "";
}

function clean(valueToClean) {
  return String(valueToClean ?? "").trim();
}

function normalizeUpc(valueToNormalize) {
  return clean(valueToNormalize).replace(/\D/g, "").replace(/^0+(?=\d)/, "");
}

function normalizeText(valueToNormalize) {
  return clean(valueToNormalize)
    .normalize("NFKC")
    .toLocaleLowerCase("fr-FR")
    .replace(/[’‘`´]/g, "'")
    .replace(/[‐‑‒–—−]/g, "-")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9à-öø-ÿ]+/giu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractSpotifyId(...values) {
  for (const candidate of values) {
    const match = clean(candidate).match(/(?:spotify:track:|open\.spotify\.com\/track\/)([A-Za-z0-9]{22})/);
    if (match) return match[1];
  }
  return "";
}

function normalizeIsrc(valueToNormalize) {
  return clean(valueToNormalize).replace(/\s/g, "").toUpperCase();
}

function parseDuration(valueToParse) {
  const duration = clean(valueToParse);
  let match = duration.match(/^(\d+):([0-5]\d)$/);
  if (match) return Number(match[1]) * 60 + Number(match[2]);
  match = duration.match(/^(\d+):([0-5]\d):([0-5]\d)$/);
  if (match) return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
  return null;
}

function makeKey(...parts) {
  return parts.every(Boolean) ? parts.join("|") : "";
}

function addIndex(map, key, index) {
  if (!key) return;
  if (!map.has(key)) map.set(key, new Set());
  map.get(key).add(index);
}

function duplicateStats(map) {
  let groups = 0;
  let rows = 0;
  let maximumGroupSize = 0;
  for (const indices of map.values()) {
    if (indices.size < 2) continue;
    groups += 1;
    rows += indices.size;
    maximumGroupSize = Math.max(maximumGroupSize, indices.size);
  }
  return { groups, rows, surplusRows: rows - groups, maximumGroupSize };
}

function requireHeaders(rows, sourceName, requiredHeaders) {
  const actualHeaders = new Set((rows[0] ?? []).map((header) => clean(header)));
  const missing = requiredHeaders.filter((header) => !actualHeaders.has(header));
  if (missing.length) throw new Error(`${sourceName}: missing headers: ${missing.join(", ")}`);
}

function classifyOrchard(row, maps) {
  let matches = maps.strict.get(makeKey(row.upc, row.release, row.track, row.artist));
  if (matches?.size === 1) return { kind: "strict", index: [...matches][0] };
  if (matches?.size > 1) return { kind: "strictAmbiguous" };

  matches = maps.noArtist.get(makeKey(row.upc, row.release, row.track));
  if (matches?.size) return { kind: "artistMismatch" };

  matches = maps.noRelease.get(makeKey(row.upc, row.track, row.artist));
  if (matches?.size) return { kind: "releaseMismatch" };

  matches = maps.upcTrack.get(makeKey(row.upc, row.track));
  if (matches?.size) return { kind: "upcTrackOnly" };
  return { kind: "unmatched" };
}

function classifyPublishing(row, maps) {
  const strictIndices = new Set();
  for (const artist of new Set([...row.artists, row.artistSequence])) {
    for (const index of maps.strict.get(makeKey(row.upc, row.release, row.track, artist)) ?? []) strictIndices.add(index);
  }
  if (strictIndices.size === 1) return { kind: "strict", index: [...strictIndices][0] };
  if (strictIndices.size > 1) return { kind: "strictAmbiguous" };

  let matches = maps.noArtist.get(makeKey(row.upc, row.release, row.track));
  if (matches?.size) return { kind: "artistMismatch" };

  const noReleaseIndices = new Set();
  for (const artist of new Set([...row.artists, row.artistSequence])) {
    for (const index of maps.noRelease.get(makeKey(row.upc, row.track, artist)) ?? []) noReleaseIndices.add(index);
  }
  if (noReleaseIndices.size) return { kind: "releaseMismatch" };

  matches = maps.upcTrack.get(makeKey(row.upc, row.track));
  if (matches?.size) return { kind: "upcTrackOnly" };
  return { kind: "unmatched" };
}

function emptyJoinCounts() {
  return {
    strict: 0,
    strictAmbiguous: 0,
    artistMismatch: 0,
    releaseMismatch: 0,
    upcTrackOnly: 0,
    unmatched: 0,
    strictWithSpotifyId: 0,
    strictWithoutSpotifyId: 0,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.orchard || !args.publishing) {
    throw new Error("Usage: node catalog-audit/audit-orchard-spotify.mjs --orchard <json|csv|tsv> --publishing <json|csv|tsv> [--output report.json]");
  }

  const orchardRows = loadRows(args.orchard);
  const publishingRows = loadRows(args.publishing);
  requireHeaders(orchardRows, "Orchard export", ["UPC", "Artist Name", "Release Name", "Track Name", "Spotify URI"]);
  requireHeaders(publishingRows, "Publishing catalogue", ["Album Name (Drive Link)", "UPC", "Track Title", "Artist 1", "Track Time", "ISRC"]);

  const orchard = rowsToObjects(orchardRows).map((row) => ({
    upc: normalizeUpc(value(row, "UPC")),
    artist: normalizeText(value(row, "Artist Name")),
    release: normalizeText(value(row, "Release Name")),
    track: normalizeText(value(row, "Track Name")),
    spotifyId: extractSpotifyId(value(row, "Spotify URI"), value(row, "URL"), value(row, "Column_9")),
    active: normalizeText(value(row, "Is Active (Yes / No)")) === "yes",
  }));

  const publishing = rowsToObjects(publishingRows).map((row) => {
    const artists = ["Artist 1", "Artist 2", "Artist 3", "Artist 4"]
      .map((header) => normalizeText(value(row, header)))
      .filter(Boolean);
    return {
      upc: normalizeUpc(value(row, "UPC")),
      release: normalizeText(value(row, "Album Name (Drive Link)")),
      track: normalizeText(value(row, "Track Title")),
      artists,
      artistSequence: normalizeText(artists.join(" ")),
      durationSeconds: parseDuration(value(row, "Track Time")),
      isrc: normalizeIsrc(value(row, "ISRC")),
    };
  });

  const orchardMaps = { strict: new Map(), noArtist: new Map(), noRelease: new Map(), upcTrack: new Map(), spotifyId: new Map() };
  const publishingMaps = { strict: new Map(), noArtist: new Map(), noRelease: new Map(), upcTrack: new Map(), isrc: new Map() };

  orchard.forEach((row, index) => {
    addIndex(orchardMaps.strict, makeKey(row.upc, row.release, row.track, row.artist), index);
    addIndex(orchardMaps.noArtist, makeKey(row.upc, row.release, row.track), index);
    addIndex(orchardMaps.noRelease, makeKey(row.upc, row.track, row.artist), index);
    addIndex(orchardMaps.upcTrack, makeKey(row.upc, row.track), index);
    addIndex(orchardMaps.spotifyId, row.spotifyId, index);
  });

  publishing.forEach((row, index) => {
    for (const artist of new Set([...row.artists, row.artistSequence])) {
      addIndex(publishingMaps.strict, makeKey(row.upc, row.release, row.track, artist), index);
      addIndex(publishingMaps.noRelease, makeKey(row.upc, row.track, artist), index);
    }
    addIndex(publishingMaps.noArtist, makeKey(row.upc, row.release, row.track), index);
    addIndex(publishingMaps.upcTrack, makeKey(row.upc, row.track), index);
    addIndex(publishingMaps.isrc, row.isrc, index);
  });

  const orchardJoin = emptyJoinCounts();
  let preliminaryEligible = 0;
  let strictSpotifyDurationMissing = 0;
  let strictSpotifyDurationUnder30Seconds = 0;
  for (const row of orchard) {
    const classification = classifyOrchard(row, publishingMaps);
    orchardJoin[classification.kind] += 1;
    if (classification.kind !== "strict") continue;
    if (row.spotifyId) orchardJoin.strictWithSpotifyId += 1;
    else orchardJoin.strictWithoutSpotifyId += 1;
    if (!row.spotifyId) continue;
    const duration = publishing[classification.index].durationSeconds;
    if (duration === null) strictSpotifyDurationMissing += 1;
    else if (duration < 30) strictSpotifyDurationUnder30Seconds += 1;
    else if (row.active) preliminaryEligible += 1;
  }

  const publishingJoin = emptyJoinCounts();
  for (const row of publishing) {
    const classification = classifyPublishing(row, orchardMaps);
    publishingJoin[classification.kind] += 1;
    if (classification.kind !== "strict") continue;
    if (orchard[classification.index].spotifyId) publishingJoin.strictWithSpotifyId += 1;
    else publishingJoin.strictWithoutSpotifyId += 1;
  }

  const durations = publishing.map((row) => row.durationSeconds).filter(Number.isFinite);
  const report = {
    generatedAt: new Date().toISOString(),
    sourceRows: { orchard: orchard.length, publishing: publishing.length },
    orchard: {
      active: orchard.filter((row) => row.active).length,
      inactive: orchard.filter((row) => !row.active).length,
      spotifyIdPresent: orchard.filter((row) => row.spotifyId).length,
      spotifyIdMissing: orchard.filter((row) => !row.spotifyId).length,
      uniqueSpotifyIds: orchardMaps.spotifyId.size,
      duplicateSpotifyIds: duplicateStats(orchardMaps.spotifyId),
      duplicateCanonicalComposites: duplicateStats(orchardMaps.strict),
    },
    publishing: {
      upcPresent: publishing.filter((row) => row.upc).length,
      upcMissing: publishing.filter((row) => !row.upc).length,
      uniqueUpcs: new Set(publishing.map((row) => row.upc).filter(Boolean)).size,
      isrcPresent: publishing.filter((row) => row.isrc).length,
      isrcMissing: publishing.filter((row) => !row.isrc).length,
      uniqueIsrcs: publishingMaps.isrc.size,
      duplicateIsrcs: duplicateStats(publishingMaps.isrc),
      durationValid: durations.length,
      durationMissingOrInvalid: publishing.length - durations.length,
      durationExactlyZero: durations.filter((duration) => duration === 0).length,
      durationUnder30Seconds: durations.filter((duration) => duration < 30).length,
      durationOver10Minutes: durations.filter((duration) => duration > 600).length,
      durationMinSeconds: Math.min(...durations),
      durationMaxSeconds: Math.max(...durations),
    },
    joins: {
      fromOrchard: orchardJoin,
      fromPublishing: publishingJoin,
      preliminaryEligible,
      strictSpotifyDurationMissing,
      strictSpotifyDurationUnder30Seconds,
    },
    spotifyDurationComparison: {
      available: false,
      reason: "The Orchard mapping export has no Spotify duration field. Fetch duration_ms from an authenticated Spotify metadata source before publication.",
    },
  };

  const json = `${JSON.stringify(report, null, 2)}\n`;
  if (args.output) fs.writeFileSync(args.output, json, "utf8");
  else process.stdout.write(json);
}

main();

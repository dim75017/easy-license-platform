import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPrivateResult,
  buildPublicSummary,
  compareDuration,
  extractSpotifyId,
  parseEmbedMetadata,
  selectOEmbedMetadata,
  toLocalTrack,
  validateTrack,
} from "./enrich-spotify-metadata.mjs";

const GENERIC_SPOTIFY_ID = "A".repeat(22);

test("extractSpotifyId accepts track URIs and URLs only", () => {
  assert.equal(extractSpotifyId(`spotify:track:${GENERIC_SPOTIFY_ID}`), GENERIC_SPOTIFY_ID);
  assert.equal(extractSpotifyId(`https://open.spotify.com/embed/track/${GENERIC_SPOTIFY_ID}?theme=0`), GENERIC_SPOTIFY_ID);
  assert.equal(extractSpotifyId("spotify:album:AAAAAAAAAAAAAAAAAAAAAA"), "");
});

test("oEmbed selection drops iframe HTML and keeps public metadata only", () => {
  const selected = selectOEmbedMetadata({
    provider_name: "Spotify",
    type: "rich",
    title: "Fixture track",
    thumbnail_url: "https://i.scdn.co/image/cover.jpg?token=discarded",
    thumbnail_width: 300,
    thumbnail_height: 300,
    html: '<iframe data-secret="must-not-survive"></iframe>',
  });
  assert.deepEqual(selected, {
    title: "Fixture track",
    thumbnailUrl: "https://i.scdn.co/image/cover.jpg",
    thumbnailWidth: 300,
    thumbnailHeight: 300,
  });
  assert.doesNotMatch(JSON.stringify(selected), /must-not-survive/);
});

test("Embed parser never returns session tokens or preview audio URLs", () => {
  const nextData = {
    props: {
      pageProps: {
        state: {
          data: {
            entity: {
              type: "track",
              id: GENERIC_SPOTIFY_ID,
              title: "Fixture track",
              uri: `spotify:track:${GENERIC_SPOTIFY_ID}`,
              artists: [{ name: "Fixture artist", uri: `spotify:artist:${"B".repeat(22)}` }],
              duration: 180_123,
              isPlayable: true,
              isExplicit: false,
              hasVideo: false,
              releaseDate: { isoString: "2026-05-13T00:00:00Z" },
              contentRatings: { labels: ["none"] },
              audioPreview: { url: "https://audio.example/secret-preview.mp3" },
              visualIdentity: {
                image: [
                  { url: "https://i.scdn.co/image/small", maxWidth: 64, maxHeight: 64 },
                  { url: "https://i.scdn.co/image/large?secret=discarded", maxWidth: 640, maxHeight: 640 },
                  { url: "https://attacker.example/image.jpg", maxWidth: 1200, maxHeight: 1200 },
                ],
              },
            },
          },
          settings: { session: { accessToken: "must-not-survive" } },
        },
      },
    },
  };
  const html = `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(nextData)}</script></html>`;
  const selected = parseEmbedMetadata(html, GENERIC_SPOTIFY_ID);
  assert.equal(selected.durationMs, 180_123);
  assert.deepEqual(selected.artists, ["Fixture artist"]);
  assert.deepEqual(selected.artistEntities, [{
    name: "Fixture artist",
    id: "B".repeat(22),
    uri: `spotify:artist:${"B".repeat(22)}`,
  }]);
  assert.equal(selected.releaseDate, "2026-05-13");
  assert.equal(selected.thumbnailUrl, "https://i.scdn.co/image/large");
  assert.equal(selected.albumId, null);
  assert.equal(selected.albumTitle, null);
  assert.doesNotMatch(JSON.stringify(selected), /must-not-survive|secret-preview/);
  assert.doesNotMatch(JSON.stringify(selected), /attacker\.example|discarded/);
});

test("nested ingestion manifests use measured WAV duration and owned cover evidence", () => {
  const local = toLocalTrack({
    candidate_id: "candidate-123",
    spotify_id: GENERIC_SPOTIFY_ID,
    track: {
      title: "Nested fixture",
      artists: ["Nested artist"],
      duration_seconds: 180,
      isrc: "FRABC2600001",
      upc: "1234567890123",
      release: '=HYPERLINK("https://drive.google.com/example", "Nested release")',
    },
    inspection: {
      status: "complete",
      sha256: "c".repeat(64),
      wav: { duration_seconds: 181.2344 },
    },
    cover: { file_id: "owned-drive-cover" },
  }, 7);

  assert.equal(local.recordKey, "candidate-123");
  assert.equal(local.spotifyId, GENERIC_SPOTIFY_ID);
  assert.equal(local.title, "Nested fixture");
  assert.deepEqual(local.artists, ["Nested artist"]);
  assert.equal(local.durationMs, 181_234);
  assert.equal(local.declaredDurationMs, 180_000);
  assert.equal(local.durationSource, "measured_wav");
  assert.equal(local.audioInspectionComplete, true);
  assert.equal(local.sourceSha256, "c".repeat(64));
  assert.equal(local.ownedArtworkPresent, true);
  assert.equal(local.releaseTitle, "Nested release");
  assert.equal(local.isrc, "FRABC2600001");
  assert.equal(local.upc, "1234567890123");
});

test("nested ingestion records cannot be accepted before full WAV inspection", () => {
  const local = toLocalTrack({
    candidate_id: "candidate-pending",
    spotify_id: GENERIC_SPOTIFY_ID,
    track: {
      title: "Pending fixture",
      artists: ["Pending artist"],
      duration_seconds: 180,
    },
    inspection: { status: "pending", wav: null, sha256: null },
    cover: { file_id: "owned-drive-cover" },
  }, 8);
  const validation = validateTrack(local, {
    title: "Pending fixture",
    artists: ["Pending artist"],
    durationMs: 180_000,
    playable: true,
    thumbnailUrl: "https://i.scdn.co/image/fixture",
    failures: [],
  });

  assert.equal(local.durationSource, "declared_catalogue");
  assert.equal(local.audioInspectionComplete, false);
  assert.equal(validation.disposition, "review");
  assert.deepEqual(validation.reasons, ["audio_full_inspection_missing"]);
});

test("duration thresholds quarantine suspicious variants", () => {
  assert.equal(compareDuration(180_000, 181_500).status, "match");
  assert.equal(compareDuration(180_000, 183_000).status, "warning");
  assert.equal(compareDuration(180_000, 186_000).status, "mismatch");
  assert.equal(compareDuration(180_000, 191_000).status, "severe_mismatch");
});

test("owned Drive artwork remains the preferred cover", () => {
  const validation = validateTrack(
    { title: "Fixture track", artists: ["Fixture artist"], durationMs: 180_000, ownedArtworkPresent: true },
    {
      title: "Fixture track",
      artists: ["Fixture artist"],
      durationMs: 180_000,
      playable: true,
      thumbnailUrl: "https://image.example/spotify.jpg",
      failures: [],
    },
  );
  assert.equal(validation.disposition, "accepted");
  assert.equal(validation.artworkRecommendation, "owned_drive_artwork");
});

test("public summary contains aggregate counts and no catalog rows", () => {
  const privateResult = buildPrivateResult(
    {
      recordKey: "private-record-key",
      inputIndex: 0,
      spotifyId: GENERIC_SPOTIFY_ID,
      title: "Private title",
      artists: ["Private artist"],
      durationMs: 180_000,
      ownedArtworkPresent: false,
    },
    {
      title: "Private title",
      artists: ["Private artist"],
      durationMs: 180_000,
      playable: true,
      thumbnailUrl: "https://image.example/spotify.jpg",
      sources: { oembed: "ok", embed: "ok" },
      failures: [],
    },
    false,
  );
  const summary = buildPublicSummary(
    [privateResult],
    { cacheHits: 0, cacheMisses: 1, uniqueSpotifyIdsFetched: 1 },
    "2026-01-01T00:00:00.000Z",
  );
  const serialized = JSON.stringify(summary);
  assert.equal(summary.validation.accepted, 1);
  assert.doesNotMatch(serialized, /private-record-key|Private title|Private artist|A{22}/);
});

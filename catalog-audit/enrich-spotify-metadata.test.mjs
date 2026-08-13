import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPrivateResult,
  buildPublicSummary,
  compareDuration,
  extractSpotifyId,
  parseEmbedMetadata,
  selectOEmbedMetadata,
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
    thumbnail_url: "https://image.example/cover.jpg",
    thumbnail_width: 300,
    thumbnail_height: 300,
    html: '<iframe data-secret="must-not-survive"></iframe>',
  });
  assert.deepEqual(selected, {
    title: "Fixture track",
    thumbnailUrl: "https://image.example/cover.jpg",
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
              artists: [{ name: "Fixture artist", uri: "spotify:artist:fixture" }],
              duration: 180_123,
              isPlayable: true,
              audioPreview: { url: "https://audio.example/secret-preview.mp3" },
              visualIdentity: { image: [{ url: "https://image.example/cover.jpg" }] },
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
  assert.doesNotMatch(JSON.stringify(selected), /must-not-survive|secret-preview/);
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

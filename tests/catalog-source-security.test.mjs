import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const files = {
  auth: "app/api/catalog/_lib/auth.ts",
  batch: "app/api/catalog/ingest/batch/route.ts",
  asset: "app/api/catalog/ingest/asset/route.ts",
  pipelineAsset: "app/api/catalog/pipeline/assets/route.ts",
  promote: "app/api/catalog/pipeline/promote/route.ts",
  list: "app/api/catalog/tracks/route.ts",
  stream: "app/api/catalog/tracks/[trackId]/stream/route.ts",
  download: "app/api/catalog/tracks/[trackId]/download/route.ts",
  storage: "worker/catalog-storage.ts",
  metadata: "app/api/catalog/_lib/metadata.ts",
  ingest: "db/catalog-ingest.ts",
  runtime: "db/catalog-runtime.ts",
  schema: "db/schema.ts",
  worker: "worker/index.ts",
  cloudflareTypes: "cloudflare-env.d.ts",
  orchardMigration: "drizzle/0003_orchard_evidence_gate.sql",
  aiReviewMigration: "drizzle/0004_bouncy_bastion.sql",
  lineageMigration: "drizzle/0005_volatile_bulldozer.sql",
};

async function source(name) {
  return readFile(files[name], "utf8");
}

function applyMigration(database, sql) {
  database.exec("BEGIN");
  try {
    database.exec(sql);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

test("catalogue routes enforce Sites identity or the scoped pipeline token", async () => {
  for (const name of ["list", "stream", "download"]) {
    assert.match(await source(name), /requireCatalogIdentity\(request\)/u);
  }
  for (const name of ["batch", "asset"]) {
    assert.match(await source(name), /await requireCatalogWrite\(request\)/u);
  }
  for (const name of ["pipelineAsset", "promote"]) {
    assert.match(await source(name), /await requireCatalogPipeline\(request\)/u);
  }
  assert.match(await source("auth"), /allowedEmails\.size === 0/u);
  assert.match(await source("auth"), /admin_allowlist_unconfigured/u);
  assert.match(await source("auth"), /CATALOG_PIPELINE_TOKEN|catalogPipelineToken/u);
  assert.match(await source("auth"), /crypto\.subtle\.digest\("SHA-256"/u);
  assert.match(await source("auth"), /difference \|=/u);
  assert.doesNotMatch(await source("auth"), /configuredToken\s*===\s*suppliedToken/u);
});

test("write routes do not echo private source identifiers", async () => {
  for (const name of ["batch", "asset"]) {
    const text = await source(name);
    assert.doesNotMatch(
      text,
      /"(?:sourceKey|driveFileId|storageKey)"\s*:/u,
    );
  }
});

test("streaming is limited to streaming copies and honours byte ranges", async () => {
  const text = await source("stream");
  assert.match(text, /ta\.kind = 'streaming_copy'/u);
  assert.match(text, /status:\s*206/u);
  assert.match(text, /Content-Range/u);
  assert.match(text, /status:\s*416/u);
  assert.doesNotMatch(text, /source_master/u);
});

test("master download endpoint fails closed without entitlement", async () => {
  const text = await source("download");
  assert.match(text, /download_entitlement_not_implemented/u);
  assert.doesNotMatch(text, /R2|storage_key|streaming_copy|source_master/u);
});

test("Drive ingestion streams to R2 and rejects unverifiable sizes", async () => {
  const text = await source("storage");
  assert.match(text, /bucket\.put\(options\.storageKey, sourceResponse\.body/u);
  assert.match(text, /asset_size_unavailable/u);
  assert.match(text, /MAX_ASSET_BYTES/u);
  assert.doesNotMatch(text, /arrayBuffer\(\)|bytes\(\)|text\(\)/u);
});

test("metadata and asset ingestion contain idempotency guards", async () => {
  assert.match(await source("batch"), /ingestMetadataBatch/u);
  const asset = await source("asset");
  assert.match(asset, /idempotent:\s*true/u);
  assert.match(asset, /stableStorageKey/u);
});

test("direct pipeline uploads are bounded, content-addressed and retry safe", async () => {
  const text = await source("pipelineAsset");
  assert.match(text, /MAX_DIRECT_ASSET_BYTES = 20 \* 1024 \* 1024/u);
  assert.match(text, /readBodyWithLimit\(request, contentLength\)/u);
  assert.match(text, /crypto\.subtle\.digest\("SHA-256", value\)/u);
  assert.match(text, /asset_checksum_mismatch/u);
  assert.match(text, /\$\{expectedSha256\}\.\$\{extension\}/u);
  assert.match(text, /INSERT OR IGNORE INTO track_assets/u);
  assert.match(text, /updated_at < datetime\('now', \?\)/u);
  assert.match(text, /sha256: expectedSha256/u);
  assert.match(text, /x-source-sha256/u);
  assert.match(text, /derived_from_sha256/u);
  assert.match(text, /sourceSha256: derivedFromSha256/u);
  assert.match(text, /stored\.customMetadata\?\.sha256 !== expectedSha256/u);
  assert.doesNotMatch(text, /bucket\.delete\(|\.delete\(storageKey\)/u);
});

test("the pipeline can upload an owned release cover without an audio duration", async () => {
  const text = await source("pipelineAsset");
  assert.match(text, /"cover_artwork"/u);
  assert.match(text, /kind === "cover_artwork"\s*\? null/su);
  assert.match(text, /image\/jpeg/u);
  assert.match(text, /image\/png/u);
  assert.match(text, /image\/webp/u);
  assert.match(text, /catalog\/releases\/\$\{options\.ingest\.release_id\}\/cover_artwork\//u);
  assert.match(text, /SET cover_storage_key = \?/u);
  const exactReplayCheck = text.indexOf(
    "options.ingest.cover_storage_key === storageKey",
  );
  const publishedReleaseLock = text.indexOf(
    '["published", "archived"].includes(options.ingest.release_status)',
  );
  assert.ok(exactReplayCheck >= 0, "the exact cover replay must be detected");
  assert.ok(
    publishedReleaseLock > exactReplayCheck,
    "exact cover replays must be accepted before the published-release lock",
  );
  assert.match(text, /currentCover\.size === options\.contentLength/u);
  assert.match(text, /currentCover\.httpMetadata\?\.contentType === options\.contentType/u);
  assert.match(text, /currentCover\.customMetadata\?\.sha256 === options\.expectedSha256/u);
});

test("promotion rechecks every publication gate and commits one D1 batch", async () => {
  const text = await source("promote");
  for (const gate of [
    /source_sha256/u,
    /measured_duration_ms/u,
    /rights_status = 'cleared'/u,
    /ai_review_status = 'cleared'/u,
    /sm\.status = 'verified'/u,
    /sm\.method = 'orchard_uri'/u,
    /sr\.upc = \?/u,
    /sm\.spotify_album_title = sr\.title/u,
    /sm\.spotify_isrc = t\.isrc/u,
    /MAX_DURATION_DELTA_MS = 2_000/u,
    /master\.kind = 'source_master'/u,
    /stream\.derived_from_sha256 = \?/u,
    /peaks\.derived_from_sha256 = \?/u,
    /stream\.kind = 'streaming_copy'/u,
    /peaks\.kind = 'waveform_peaks'/u,
    /expectedCoverPrefix/u,
    /bucket\.head\(sourceMaster\.storage_key\)/u,
    /database\.batch\(\[/u,
    /SET status = 'deleted'/u,
    /SET status = 'published'/u,
    /SET status = 'imported'/u,
  ]) {
    assert.match(text, gate);
  }
});

test("legacy Drive writes cannot mutate published media or bypass promotion", async () => {
  const text = await source("asset");
  assert.match(text, /writer\.kind === "pipeline" && assetKindValue !== "source_master"/u);
  assert.match(text, /pipeline_drive_asset_forbidden/u);
  assert.match(text, /t\.status NOT IN \('published', 'archived'\)/u);
  assert.match(text, /status NOT IN \('published', 'archived'\)/u);
  assert.match(text, /source_master_asset_finalize_race/u);
  assert.match(text, /ii\.status AS ingest_status/u);
  assert.match(text, /!\["ready", "needs_review"\]\.includes\(ingestItem\.ingest_status\)/u);
  assert.match(
    text,
    /SET asset_id = \?,[\s\S]*?WHERE id = \?[\s\S]*?status IN \('ready', 'needs_review'\)[\s\S]*?t\.status NOT IN \('published', 'archived'\)/u,
  );
  assert.match(
    text,
    /SET status = 'failed'[\s\S]*?ii\.status IN \('ready', 'needs_review'\)[\s\S]*?t\.status NOT IN \('published', 'archived'\)/u,
  );
  assert.match(
    text,
    /SET failure_code = 'asset_ingest_failed'[\s\S]*?status IN \('ready', 'needs_review'\)[\s\S]*?t\.status NOT IN \('published', 'archived'\)/u,
  );
  assert.doesNotMatch(text, /requireCatalogAudioBucket\(\)\.delete/u);
});

test("AI review is explicit, defaults closed and is a database publication invariant", async () => {
  const metadata = await source("metadata");
  const schema = await source("schema");
  const ingest = await source("ingest");
  const promote = await source("promote");
  assert.match(metadata, /value\.aiReviewStatus \?\? "pending"/u);
  assert.match(schema, /aiReviewStatuses = \["pending", "cleared", "rejected"\]/u);
  assert.match(schema, /tracks_publish_ai_review_check/u);
  assert.match(ingest, /item\.aiReviewStatus !== "cleared"/u);
  assert.match(promote, /promotion_ai_review_not_cleared/u);
});

test("verified Orchard evidence is explicit and narrower than generic verification", async () => {
  const metadata = await source("metadata");
  const schema = await source("schema");
  const migration = await source("orchardMigration");
  assert.match(metadata, /method !== "orchard_uri" && !albumId/u);
  assert.match(metadata, /spotify_orchard_metadata_mismatch/u);
  assert.match(metadata, /spotify_orchard_isrc_mismatch/u);
  assert.match(metadata, /upc is required for verified Orchard evidence/u);
  assert.match(schema, /spotifyAlbumId\} IS NOT NULL OR \$\{table\.method\} = 'orchard_uri'/u);
  assert.match(migration, /spotify_album_id" IS NOT NULL OR "__new_spotify_matches"\."method" = 'orchard_uri'/u);
});

test("the pipeline secret is typed in every runtime boundary", async () => {
  assert.match(await source("runtime"), /CATALOG_PIPELINE_TOKEN\?: string/u);
  assert.match(await source("worker"), /CATALOG_PIPELINE_TOKEN\?: string/u);
  assert.match(await source("cloudflareTypes"), /CATALOG_PIPELINE_TOKEN\?: string/u);
});

test("the Orchard evidence migration preserves rows and narrows the album exception", async () => {
  const database = new DatabaseSync(":memory:");
  try {
    database.exec(await readFile("drizzle/0001_tearful_caretaker.sql", "utf8"));
    database.exec(`
      INSERT INTO artists (id, name, normalized_name, status)
      VALUES (1, 'Artist', 'artist', 'active');
      INSERT INTO releases (
        id, primary_artist_id, title, normalized_title, artist_credit,
        type, upc, status
      ) VALUES (1, 1, 'Release', 'release', 'Artist', 'album', '12345678', 'ready');
      INSERT INTO tracks (
        id, release_id, primary_artist_id, title, normalized_title,
        artist_credit, isrc, duration_ms, rights_status, status
      ) VALUES
        (1, 1, 1, 'Track', 'track', 'Artist', 'FRABC1234567', 180000, 'cleared', 'ready'),
        (2, 1, 1, 'Track 2', 'track 2', 'Artist', 'FRABC1234568', 181000, 'cleared', 'ready');
      INSERT INTO spotify_matches (
        track_id, spotify_track_id, method, score, status
      ) VALUES (1, 'candidate1', 'orchard_uri', 9000, 'candidate');
    `);

    applyMigration(database, await source("orchardMigration"));
    assert.equal(
      database.prepare("SELECT count(*) AS count FROM spotify_matches").get().count,
      1,
    );

    database.exec(`
      INSERT INTO spotify_matches (
        track_id, spotify_track_id, spotify_album_id, spotify_title,
        spotify_artist_credit, spotify_album_title, spotify_isrc,
        spotify_duration_ms, duration_delta_ms, method, score, status
      ) VALUES (
        1, 'verified1', NULL, 'Track', 'Artist', 'Release', 'FRABC1234567',
        180000, 0, 'orchard_uri', 10000, 'verified'
      );
    `);

    assert.throws(
      () =>
        database.exec(`
          INSERT INTO spotify_matches (
            track_id, spotify_track_id, spotify_album_id, spotify_title,
            spotify_artist_credit, spotify_album_title, spotify_isrc,
            spotify_duration_ms, duration_delta_ms, method, score, status
          ) VALUES (
            2, 'verified2', NULL, 'Track 2', 'Artist', 'Release', 'FRABC1234568',
            181000, 0, 'exact_metadata', 10000, 'verified'
          );
        `),
      /spotify_matches_verified_shape_check/u,
    );
  } finally {
    database.close();
  }
});

test("catalog migrations apply in order and backfill new security fields fail-closed", async () => {
  const database = new DatabaseSync(":memory:");
  try {
    database.exec(await readFile("drizzle/0001_tearful_caretaker.sql", "utf8"));
    database.exec(`
      INSERT INTO artists (id, name, normalized_name, status)
      VALUES (1, 'Artist', 'artist', 'active');
      INSERT INTO releases (
        id, primary_artist_id, title, normalized_title, artist_credit,
        type, upc, status
      ) VALUES (1, 1, 'Release', 'release', 'Artist', 'album', '12345678', 'ready');
      INSERT INTO tracks (
        id, release_id, primary_artist_id, title, normalized_title,
        artist_credit, isrc, duration_ms, rights_status, status
      ) VALUES (1, 1, 1, 'Track', 'track', 'Artist', 'FRABC1234567', 180000, 'cleared', 'ready');
      INSERT INTO track_assets (
        id, track_id, kind, storage_key, mime_type, byte_size,
        duration_ms, sha256, status
      ) VALUES (
        1, 1, 'streaming_copy', 'catalog/legacy.mp3', 'audio/mpeg', 100,
        180000, '${"a".repeat(64)}', 'available'
      );
    `);
    applyMigration(database, await source("orchardMigration"));
    applyMigration(database, await source("aiReviewMigration"));
    applyMigration(database, await source("lineageMigration"));

    const track = database
      .prepare("SELECT ai_review_status FROM tracks WHERE id = 1")
      .get();
    const asset = database
      .prepare("SELECT derived_from_sha256 FROM track_assets WHERE id = 1")
      .get();
    assert.equal(track.ai_review_status, "pending");
    assert.equal(asset.derived_from_sha256, null);
    assert.throws(
      () => database.exec("UPDATE tracks SET status = 'published' WHERE id = 1"),
      /tracks_publish_ai_review_check/u,
    );
  } finally {
    database.close();
  }
});

test("metadata ingestion cannot bypass the publication quality gate", async () => {
  const text = await source("metadata");
  assert.match(text, /publication_gate_required/u);
  assert.match(text, /cannot be published through metadata ingestion/u);
});

test("duplicate ISRCs stay release-scoped and rights restrictions fail closed", async () => {
  const text = await source("ingest");
  assert.match(
    text,
    /WHERE isrc = \?\s+AND release_id = \?\s+AND normalized_title = \?/su,
  );
  assert.match(text, /different published recording and requires manual review/u);
  assert.match(
    text,
    /WHERE isrc = \?[\s\S]{0,180}status = 'published'[\s\S]{0,260}normalized_title != \?/u,
  );
  assert.match(
    text,
    /UPDATE tracks[\s\S]{0,220}published_at = NULL[\s\S]{0,140}WHERE isrc = \?/u,
  );
  assert.match(text, /WHEN \? != 'cleared' THEN 'hidden'/u);
  assert.match(text, /WHEN \? != 'cleared' OR \? != 'cleared' THEN NULL/u);
  assert.match(text, /ai_review_status/u);
  assert.doesNotMatch(text, /WHEN status = 'published' THEN rights_status/u);
});

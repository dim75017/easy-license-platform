import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const files = {
  auth: "app/api/catalog/_lib/auth.ts",
  batch: "app/api/catalog/ingest/batch/route.ts",
  asset: "app/api/catalog/ingest/asset/route.ts",
  list: "app/api/catalog/tracks/route.ts",
  stream: "app/api/catalog/tracks/[trackId]/stream/route.ts",
  download: "app/api/catalog/tracks/[trackId]/download/route.ts",
  storage: "worker/catalog-storage.ts",
  metadata: "app/api/catalog/_lib/metadata.ts",
  ingest: "db/catalog-ingest.ts",
};

async function source(name) {
  return readFile(files[name], "utf8");
}

test("all catalogue routes enforce forwarded Sites identity", async () => {
  for (const name of ["batch", "asset", "list", "stream", "download"]) {
    assert.match(await source(name), /requireCatalog(?:Admin|Identity)\(request\)/u);
  }
  assert.match(await source("auth"), /allowedEmails\.size === 0/u);
  assert.match(await source("auth"), /admin_allowlist_unconfigured/u);
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
  assert.match(text, /WHEN \? != 'cleared' THEN NULL/u);
  assert.doesNotMatch(text, /WHEN status = 'published' THEN rights_status/u);
});

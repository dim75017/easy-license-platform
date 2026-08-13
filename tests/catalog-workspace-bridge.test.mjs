import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("CreatorWorkspace loads only the first authenticated catalogue page and keeps the static fallback", async () => {
  const workspace = await source("app/components/CreatorWorkspace.tsx");

  assert.match(workspace, /fetch\("\/api\/catalog\/tracks\?page=1&pageSize=30"/);
  assert.match(workspace, /credentials:\s*"same-origin"/);
  assert.match(workspace, /const libraryTracks = catalogTracks\?\.length \? catalogTracks : workspaceTracks/);
  assert.match(workspace, /!page \|\| page\.tracks\.length === 0[\s\S]{0,120}setCatalogLoadState\("fallback"\)/);
  assert.match(workspace, /catalogLoadState === "loading"[\s\S]{0,180}Loading your private catalogue/);
});

test("catalog response mapper exposes only safe playback and cover routes", async () => {
  const client = await source("app/lib/catalog-client.ts");

  assert.match(client, /playbackPath = \/\^\\\/api\\\/catalog\\\/tracks\\\/\\d\+\\\/stream\$\/u/);
  assert.match(client, /coverPath = \/\^\\\/api\\\/catalog\\\/releases\\\/\\d\+\\\/cover\$\/u/);
  assert.match(client, /previewDownloadUrl:\s*null/);
  assert.match(client, /spotifyId:\s*null/);
  assert.doesNotMatch(client, /storageKey|sourceKey|driveFileId|googleDriveId/);
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("CreatorWorkspace pages and filters the live catalogue without contacting the API from Pages", async () => {
  const workspace = await source("app/components/CreatorWorkspace.tsx");

  assert.match(workspace, /const isStaticDemo = process\.env\.NEXT_PUBLIC_STATIC_DEMO === "true"/u);
  assert.match(workspace, /const CATALOG_PAGE_SIZE = 40/u);
  assert.match(workspace, /params\.set\("q", filters\.query\.trim\(\)\)/u);
  assert.match(workspace, /params\.set\("genre", filters\.genre\)/u);
  assert.match(workspace, /params\.set\("mood", filters\.mood\)/u);
  assert.match(workspace, /params\.set\("theme", filters\.theme\)/u);
  assert.ok(
    workspace.indexOf("if (isStaticDemo) return;") < workspace.indexOf("fetch(catalogRequestUrl({ page: 1, filters: catalogFilters })"),
    "the static Pages demo must stop before the live catalogue request",
  );
  assert.match(workspace, /credentials:\s*"same-origin"/u);
  assert.match(workspace, /page\.view !== "tracks"/u);
  assert.doesNotMatch(workspace, /page\.tracks\.length === 0[\s\S]{0,160}setCatalogLoadState\("fallback"\)/u);
  assert.match(workspace, /catalogFilterSignature\(catalogFilters\)/u);
  assert.match(workspace, /const requestGeneration = \+\+catalogRequestGenerationRef\.current/u);
  assert.match(workspace, /setCatalogTracks\(\[\]\)[\s\S]{0,80}setCatalogPagination\(null\)/u);
  assert.match(workspace, /catalogRequestGenerationRef\.current !== requestGeneration[\s\S]{0,120}catalogQuerySignatureRef\.current !== requestSignature/u);

  assert.match(workspace, /const nextPage = catalogPagination\?\.nextPage/u);
  assert.match(workspace, /catalogRequestUrl\(\{ page: nextPage, filters: catalogFilters \}\)/u);
  assert.match(workspace, /setCatalogTracks\(\(current\) => mergeTrackPages\(current \?\? \[\], page\.tracks\)\)/u);
  assert.match(workspace, /className="cta-swipe"[\s\S]{0,180}loadMoreCatalog\(\)/u);
  assert.match(workspace, /catalogPagination\?\.hasNextPage/u);
});

test("a failed refresh preserves the last live page and offers an explicit retry", async () => {
  const workspace = await source("app/components/CreatorWorkspace.tsx");

  assert.match(workspace, /const catalogHasLoadedRef = useRef\(false\)/u);
  assert.match(workspace, /catalogHasLoadedRef\.current = true/u);
  assert.match(workspace, /if \(!catalogHasLoadedRef\.current\)[\s\S]{0,220}setCatalogLoadState\("fallback"\)[\s\S]{0,180}else \{[\s\S]{0,120}setCatalogLoadState\("live"\)/u);
  assert.match(workspace, /Update failed, previous results kept/u);
  assert.match(workspace, /Retry live catalogue/u);
});

test("saved actions are never purged just because a track is outside the visible page", async () => {
  const workspace = await source("app/components/CreatorWorkspace.tsx");

  assert.match(workspace, /storedLiked\.filter\(isStoredTrackId\)/u);
  assert.match(workspace, /record\.trackIds\.filter\(isStoredTrackId\)/u);
  assert.match(workspace, /storedDownloads\.filter\(isStoredTrackId\)/u);
  assert.doesNotMatch(workspace, /knownTrackIds\.has\(id\)/u);
  assert.match(workspace, /\{likedTracks\.length\} loaded of \{liked\.size\} saved/u);
  assert.match(workspace, /Other saved IDs remain intact while catalogue pages load/u);
});

test("Discover requests distinct releases and deep links can resolve a track outside page one", async () => {
  const workspace = await source("app/components/CreatorWorkspace.tsx");

  assert.match(workspace, /onePerRelease:\s*true/u);
  assert.match(workspace, /page\.view !== "releases"/u);
  assert.match(workspace, /key=\{track\.release\?\.id \?\? track\.id\}/u);
  assert.match(workspace, /track\.release\?\.title \?\? track\.title/u);
  assert.match(workspace, /releaseMeta\(track\)/u);
  assert.match(workspace, /catalogNumericTrackId\(trackId\)/u);
  assert.match(workspace, /catalogRequestUrl\(\{ page: 1, pageSize: 1, trackId: numericTrackId \}\)/u);
  const resolver = workspace.slice(
    workspace.indexOf("async function resolveSharedTrack"),
    workspace.indexOf("void resolveSharedTrack"),
  );
  assert.ok(
    resolver.indexOf("sharedTrackHandledRef.current = trackId") > resolver.indexOf("const sharedTrack = page?.tracks[0]"),
    "a temporary deep-link request failure must remain retryable",
  );
  assert.match(resolver, /setCatalogRequestFailed\(true\)/u);
  assert.match(workspace, /\}, \[catalogLoadState, catalogRetryNonce\]\);/u);
});

test("catalog response mapper exposes only safe routes plus release and pagination metadata", async () => {
  const client = await source("app/lib/catalog-client.ts");

  assert.match(client, /playbackPath = \/\^\\\/api\\\/catalog\\\/tracks\\\/\(\\d\+\)\\\/stream\$\/u/u);
  assert.match(client, /coverPath = \/\^\\\/api\\\/catalog\\\/releases\\\/\(\\d\+\)\\\/cover\$\/u/u);
  assert.match(client, /previewDownloadUrl:\s*playbackUrl/u);
  assert.match(client, /spotifyId:\s*null/u);
  assert.match(client, /export type CatalogPagination/u);
  assert.match(client, /hasNextPage:\s*boolean/u);
  assert.match(client, /release,\s*\n\s*publishedAt/u);
  assert.match(client, /value\.trackCount === null \? null : safeInteger\(value\.trackCount, 1\)/u);
  assert.doesNotMatch(client, /storageKey|sourceKey|driveFileId|googleDriveId/u);
});

test("catalog API uses deterministic release-first ordering and complete pagination metadata", async () => {
  const route = await source("app/api/catalog/tracks/route.ts");

  assert.match(route, /COUNT\(\$\{onePerRelease \? "DISTINCT r\.id" : "\*"\}\)/u);
  assert.match(route, /ROW_NUMBER\(\) OVER \([\s\S]{0,220}PARTITION BY r\.id/u);
  assert.match(route, /CASE WHEN release_date IS NULL THEN 1 ELSE 0 END ASC,[\s\S]{0,100}release_date DESC,[\s\S]{0,100}published_at DESC,[\s\S]{0,100}release_id DESC/u);
  assert.match(route, /returned:\s*rows\.results\.length/u);
  assert.match(route, /hasPreviousPage/u);
  assert.match(route, /hasNextPage/u);
  assert.match(route, /previousPage:\s*hasPreviousPage \? page - 1 : null/u);
  assert.match(route, /nextPage:\s*hasNextPage \? page \+ 1 : null/u);
  assert.match(route, /releaseTrackCountIsComplete = !search && !genre && !mood && !theme && trackId === null/u);
  assert.match(route, /trackCount:\s*releaseTrackCountIsComplete[\s\S]{0,80}\? row\.release_track_count[\s\S]{0,40}: null/u);
  assert.match(route, /publishedAt:\s*row\.published_at/u);
});

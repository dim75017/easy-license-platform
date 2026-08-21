import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("CreatorWorkspace filters and infinitely pages the live catalogue on Sites and GitHub Pages", async () => {
  const workspace = await source("app/components/CreatorWorkspace.tsx");

  assert.doesNotMatch(workspace, /if \(isStaticDemo\) return/u);
  assert.match(workspace, /const CATALOG_PAGE_SIZE = 40/u);
  assert.match(workspace, /params\.set\("q", filters\.query\.trim\(\)\)/u);
  assert.match(workspace, /params\.set\("genre", filters\.genre\)/u);
  assert.match(workspace, /params\.set\("mood", filters\.mood\)/u);
  assert.match(workspace, /params\.set\("theme", filters\.theme\)/u);
  assert.match(workspace, /params\.set\("playlist", filters\.playlist\)/u);
  assert.match(workspace, /readLibrarySelectionFromLocation/u);
  assert.match(workspace, /requestedPlaylist && isCatalogPlaylistId\(requestedPlaylist\)[\s\S]{0,60}return "playlists"/u);
  assert.match(workspace, /function writePlaylistSelectionToLocation[\s\S]{0,180}url\.searchParams\.set\("view", "playlists"\)[\s\S]{0,180}url\.searchParams\.set\("playlist", playlist\)/u);
  assert.match(workspace, /function openPlaylist[\s\S]{0,260}activeViewRef\.current = "playlists"[\s\S]{0,100}setView\("playlists"\)[\s\S]{0,260}writePlaylistSelectionToLocation\(playlist\.id, "push"\)/u);
  assert.doesNotMatch(workspace.match(/function openPlaylist[\s\S]*?\n  \}/u)?.[0] ?? "", /showMusic\(\)/u);
  assert.match(workspace, /nextView !== "playlists" && activePlaylistId !== null[\s\S]{0,60}setActivePlaylistId\(null\)/u);
  assert.match(workspace, /writeLibrarySelectionToLocation\(\{ mood: kind === "mood" \? value : null \}\)/u);
  assert.match(workspace, /catalogFetchCredentials: RequestCredentials = catalogApiOrigin \? "omit" : "same-origin"/u);
  assert.match(workspace, /return `\$\{catalogApiOrigin\}\/api\/catalog\/tracks\?\$\{params\.toString\(\)\}`/u);
  assert.match(workspace, /credentials:\s*catalogFetchCredentials/u);
  assert.match(workspace, /page\.view !== "tracks"/u);
  assert.doesNotMatch(workspace, /page\.tracks\.length === 0[\s\S]{0,160}setCatalogLoadState\("fallback"\)/u);
  assert.match(workspace, /catalogFilterSignature\(catalogFilters\)/u);
  assert.match(workspace, /const requestGeneration = \+\+catalogRequestGenerationRef\.current/u);
  assert.match(workspace, /setCatalogTracks\(\[\]\)[\s\S]{0,80}setCatalogPagination\(null\)/u);
  assert.match(workspace, /catalogRequestGenerationRef\.current !== requestGeneration[\s\S]{0,120}catalogQuerySignatureRef\.current !== requestSignature/u);

  assert.match(workspace, /const nextPage = catalogPagination\?\.nextPage/u);
  assert.match(workspace, /catalogRequestUrl\(\{ page: nextPage, filters: catalogFilters \}\)/u);
  assert.match(workspace, /setCatalogTracks\(\(current\) => mergeTrackPages\(current \?\? \[\], page\.tracks\)\)/u);
  assert.match(workspace, /const catalogLoadMoreSentinelRef = useRef<HTMLDivElement \| null>\(null\)/u);
  assert.match(workspace, /"IntersectionObserver" in window/u);
  assert.match(workspace, /new IntersectionObserver\(\(\[entry\]\)[\s\S]{0,120}entry\?\.isIntersecting[\s\S]{0,80}loadMoreCatalog\(\)/u);
  assert.match(workspace, /const catalogueIsVisible = view === "music" \|\| \(view === "playlists" && activePlaylistId !== null\)/u);
  assert.match(workspace, /rootMargin: "720px 0px", threshold: 0/u);
  assert.match(workspace, /ref=\{catalogLoadMoreSentinelRef\}/u);
  assert.match(workspace, /catalogInfiniteScrollSupported === false \|\| catalogLoadMoreFailed/u);
  assert.match(workspace, /Retry loading more tracks/u);
  assert.match(workspace, /loadMoreControllerRef\.current !== null/u);
  assert.match(workspace, /catalogQuerySignatureRef\.current !== requestSignature[\s\S]{0,120}catalogResolvedSignatureRef\.current !== requestSignature/u);
  assert.match(workspace, /catalogPagination\?\.hasNextPage/u);
});

test("GitHub Pages reads the canonical live catalogue without exposing arbitrary origins", async () => {
  const [client, pagesBuild, cors] = await Promise.all([
    source("app/lib/catalog-client.ts"),
    source("scripts/build-pages.mjs"),
    source("app/api/catalog/_lib/public-read.ts"),
  ]);

  assert.match(pagesBuild, /NEXT_PUBLIC_CATALOG_API_ORIGIN: "https:\/\/easy-license\.dsomoguy\.chatgpt\.site"/u);
  assert.match(client, /process\.env\.NEXT_PUBLIC_CATALOG_API_ORIGIN === canonicalCatalogApiOrigin/u);
  assert.match(client, /new URL\(pathname, catalogApiOrigin\)\.toString\(\)/u);
  assert.match(cors, /allowedOrigin = "https:\/\/dim75017\.github\.io"/u);
  assert.match(cors, /Access-Control-Allow-Origin/u);
  assert.match(cors, /Cross-Origin-Resource-Policy/u);
});

test("a failed refresh preserves the last live page and offers an explicit retry", async () => {
  const workspace = await source("app/components/CreatorWorkspace.tsx");

  assert.match(workspace, /const catalogHasLoadedRef = useRef\(false\)/u);
  assert.match(workspace, /catalogHasLoadedRef\.current = true/u);
  assert.match(workspace, /if \(!catalogHasLoadedRef\.current\)[\s\S]{0,220}setCatalogTracks\(\[\]\)[\s\S]{0,120}setCatalogLoadState\("fallback"\)[\s\S]{0,180}else \{[\s\S]{0,120}setCatalogLoadState\("live"\)/u);
  assert.match(workspace, /Update failed, previous results kept/u);
  assert.match(workspace, /Retry live catalogue/u);
});

test("a live catalogue failure never masquerades as the twelve-track demo", async () => {
  const workspace = await source("app/components/CreatorWorkspace.tsx");

  assert.match(workspace, /catalogTracks \?\? \[\]/u);
  assert.match(workspace, /catalogLoadState === "live" \? catalogKnownTracks : \[\]/u);
  assert.match(workspace, /The live catalogue is temporarily unavailable\. Retry to load it\./u);
  assert.doesNotMatch(workspace, /Live catalogue unavailable[\s\S]{0,100}Demo catalogue only/u);
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
  assert.match(workspace, /setRecentCatalogRequestFailed\(true\)/u);
  assert.match(workspace, /\}, \[catalogRetryNonce\]\);/u);
  assert.match(workspace, /recentCatalogTracks !== null[\s\S]{0,260}recentCatalogRequestFailed[\s\S]{0,220}Loading the latest releases from the live catalogue\./u);
  assert.match(workspace, /recentCatalogRequestFailed \? "Retry live catalogue" : "Browse all music"/u);
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
  const [client, workspace] = await Promise.all([
    source("app/lib/catalog-client.ts"),
    source("app/components/CreatorWorkspace.tsx"),
  ]);

  assert.match(client, /playbackPath = \/\^\\\/api\\\/catalog\\\/tracks\\\/\(\\d\+\)\\\/stream\$\/u/u);
  assert.match(client, /cleanText\(value\.title, 500\)/u);
  assert.match(client, /cleanText\(value\.artist, 1000\)/u);
  assert.match(client, /coverPath = \/\^\\\/api\\\/catalog\\\/releases\\\/\(\\d\+\)\\\/cover\$\/u/u);
  assert.match(client, /previewDownloadUrl:\s*playbackUrl/u);
  assert.match(client, /spotifyId:\s*null/u);
  assert.match(client, /export type CatalogPagination/u);
  assert.match(client, /hasNextPage:\s*boolean/u);
  assert.match(client, /release,\s*\n\s*publishedAt/u);
  assert.match(client, /value\.trackCount === null \? null : safeInteger\(value\.trackCount, 1\)/u);
  assert.match(client, /const cover = coverPathname \? catalogAssetUrl\(coverPathname\) : null/u);
  assert.match(workspace, /track\.cover \? <img[\s\S]{0,180}music-track-cover-placeholder/u);
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
  assert.match(route, /releaseTrackCountIsComplete = !search && !genre && !mood && !theme && !playlist && trackId === null/u);
  assert.match(route, /trackCount:\s*releaseTrackCountIsComplete[\s\S]{0,80}\? row\.release_track_count[\s\S]{0,40}: null/u);
  assert.match(route, /publishedAt:\s*row\.published_at/u);
  assert.match(route, /const acceptedMoods = moodFilterAliases\(mood\)/u);
  assert.match(route, /const fallbackGenres = moodFilterGenreFallbacks\(mood\)/u);
  assert.match(route, /t\.mood IS NULL AND t\.genre IN \(\$\{genrePlaceholders\}\)/u);
  assert.match(route, /const playlistRule = playlist \? catalogPlaylistRule\(playlist\) : null/u);
  assert.match(route, /t\.genre IN \(\$\{playlistRule\.genres\.map\(\(\) => "\?"\)\.join\(", "\)\}\)/u);
  assert.match(route, /filters: \{ q: search, genre, mood, theme, playlist, trackId \}/u);
});

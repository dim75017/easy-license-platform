# Symbiome catalog ingestion audit

This directory contains only reproducible, aggregate audit tooling. It must
never contain Drive file IDs, private URLs, raw catalog rows, contacts, WAV
files, Spotify credentials, or permanent audio URLs.

## Orchard ↔ editorial catalog audit

Run the join against private exports kept outside Git:

```text
node catalog-audit/audit-orchard-spotify.mjs \
  --orchard <orchard-export.csv> \
  --publishing <publishing-export.csv> \
  --output <aggregate-report.json>
```

Supported inputs are JSON row matrices (or `{ "values": [...] }`), CSV and
TSV. The command emits aggregate counts only; it never outputs matching rows.

The current reviewed result is documented in
[`orchard-spotify-join-report.md`](./orchard-spotify-join-report.md).

## Private working files

Put temporary exports, manifests and per-track review queues in
`catalog-audit/private/`. The directory is ignored by Git. Masters belong in
private object storage, not in this repository or the public site build.

## Resumable Drive/WAV ingestion manifest

[`ingest_catalog.py`](./ingest_catalog.py) builds the private hand-off manifest
used before storage ingestion. It joins:

- `Publishing catalogue` for title, artist, ISRC, UPC and expected duration;
- `Release Drive link + Audio` and `Release Drive + Audio 2` for direct WAVs
  and release folders;
- `Cover Album` for the owned artwork keyed by UPC;
- the private Orchard export for the exact Spotify track URI;
- optionally, a private Drive connector inventory for WAVs found directly or
  below `WAV`, `WAVE`, `.WAV`, `Music` or `Musique` folders.

No private row, Drive identifier, URL, WAV or credential is versioned. Output
is restricted to `catalog-audit/private/` when it lives inside this repository.

The command requires Python 3.11+ and `openpyxl`. Start with a read-only plan:

```text
python catalog-audit/ingest_catalog.py \
  --workbook "<private>/All DATA.xlsx" \
  --orchard "<private>/URl_LOFIGIRL_THEORCHARD.xlsx" \
  --dry-run
```

### Three-release smoke test

This selects one WAV from each already-audited release (`Time`, `Rise` and
`Signal Flow`) and reads only the beginning of each file. It does not retain
audio and cannot produce a SHA-256 yet:

```text
python catalog-audit/ingest_catalog.py \
  --workbook "<private>/All DATA.xlsx" \
  --orchard "<private>/URl_LOFIGIRL_THEORCHARD.xlsx" \
  --apply --smoke --inspect range --allow-network
```

### Resumable batches

Range verification checks RIFF/RF64, codec, channels, sample rate, bit depth
and duration. Each file is committed to SQLite before the next file, so rerun
the same command after an interruption:

```text
python catalog-audit/ingest_catalog.py \
  --workbook "<private>/All DATA.xlsx" \
  --orchard "<private>/URl_LOFIGIRL_THEORCHARD.xlsx" \
  --apply --inspect range --batch-size 25 --allow-network
```

Full verification downloads one master at a time to the operating system's
temporary directory, calculates SHA-256, then deletes the temporary file in a
`finally` block. Keep batches deliberately small:

```text
python catalog-audit/ingest_catalog.py \
  --workbook "<private>/All DATA.xlsx" \
  --orchard "<private>/URl_LOFIGIRL_THEORCHARD.xlsx" \
  --apply --inspect full --batch-size 5 --allow-network
```

If the workbook has only a release-folder link, pass a private connector export
with `id`, `name`, `mimeType`, `parents`, `path` and `release_folder_id`, then
add `--drive-inventory <private.json> --discover-drive`. Live Drive API folder
discovery is also supported when `GOOGLE_DRIVE_ACCESS_TOKEN` is already present
in the environment. Tokens must never be placed in a command, manifest or repo.

The private output includes an idempotent `ingestion-state.sqlite3`, the full
`manifest.jsonl`, separate `exact.jsonl`, `review.jsonl`, and
`quarantine.jsonl`, plus aggregate `summary.json`.

- `exact`: unique title/file match, exact Orchard mapping, valid square owned
  cover, full SHA-256, and duration deltas at most two seconds;
- `review`: safe but incomplete evidence (for example no Spotify duration,
  range-only inspection or artwork needing review);
- `quarantine`: missing/ambiguous audio, version mismatch, suspicious sample,
  invalid WAV, duration under 30 seconds, or duration delta over five seconds
  / two percent.

Run the offline parser and matching tests with:

```text
python -m unittest discover -s catalog-audit/tests -p "test_*.py"
```

## Resumable full-length publication pipeline

[`process_catalog.py`](./process_catalog.py) is the fail-closed hand-off from
the private `exact.jsonl` manifest to the catalogue backend. It handles one
track at a time and removes its temporary workspace before selecting the next:

- stream and re-hash the Drive WAV, then re-check its WAV duration;
- create a full-length 192 kb/s MP3 and exactly 512 mono PCM peak bins;
- ask the backend to copy the verified source master from Drive into private R2;
- download, identify and re-check the square owned cover, then upload the MP3,
  peaks and cover with their calculated SHA-256 values;
- bind MP3 and peaks to the exact master SHA as cryptographic lineage;
- request publication only after every server-side evidence gate passes.

The sealed catalogue-owner lane additionally accepts central MP3 sources only
when one exact ISRC, UPC+title, artist+title or release+title pin is injective in
both directions. Title-only, fuzzy/scored, contradictory and multiply claimed
MP3 matches are excluded. Every accepted MP3 is fully downloaded and hashed,
signature-checked, decoded/probed to a positive duration, transcoded to the same
deterministic full-length 192 kb/s listening copy and reduced to the same 512
peaks. Its original bytes remain a private source master. Canonical source MIME
and format are checkpointed locally and recorded on the private stored asset;
promotion binds those values before publication.

The private `pipeline-state.sqlite3` checkpoints metadata, master, stream,
peaks, cover and promotion independently. Re-run the same command after an
interruption. The log contains aggregate counters and stable redacted error
codes only; it never prints catalogue, Drive or Spotify identifiers or URLs.
The default backend batch key is intentionally stable as new exact rows are
added; each candidate fingerprint still resets only its own changed checkpoint.
Use `--batch-key` only when a genuinely separate backend ingestion namespace is
required.

Publication requires an `accepted` row in the private Spotify enrichment file
for the same `candidate_id`. The pipeline checks the official oEmbed and Embed
sources, title, artists, duration, full WAV SHA, UPC and release again before it
sends a `verified` Orchard match. Spotify album ID remains null: the verified
album evidence is the strict Orchard UPC/release join, not a guessed Spotify ID.

### Safe canary sequence

First complete full WAV inspection. Then enrich that measured private manifest,
merge its official Spotify duration back into SQLite, and let the classifier
regenerate `exact.jsonl`:

```text
python catalog-audit/ingest_catalog.py \
  --workbook catalog-audit/private/all-data.xlsx \
  --orchard catalog-audit/private/orchard.json \
  --output-dir catalog-audit/private/publish-canary \
  --apply --inspect full --batch-size 3 --allow-network

node catalog-audit/enrich-spotify-metadata.mjs \
  --input catalog-audit/private/publish-canary/manifest.jsonl \
  --output-dir catalog-audit/private/publish-canary/spotify-enrichment \
  --public-report catalog-audit/private/publish-canary/spotify-summary.json \
  --limit 3

python catalog-audit/process_catalog.py \
  --step merge_spotify_metadata \
  --ingestion-state catalog-audit/private/publish-canary/ingestion-state.sqlite3 \
  --spotify-enrichment catalog-audit/private/publish-canary/spotify-enrichment/enriched-tracks.json \
  --dry-run --limit 3

python catalog-audit/process_catalog.py \
  --step merge_spotify_metadata \
  --ingestion-state catalog-audit/private/publish-canary/ingestion-state.sqlite3 \
  --spotify-enrichment catalog-audit/private/publish-canary/spotify-enrichment/enriched-tracks.json \
  --apply --limit 3

python catalog-audit/process_catalog.py \
  --exact-manifest catalog-audit/private/publish-canary/exact.jsonl \
  --spotify-enrichment catalog-audit/private/publish-canary/spotify-enrichment/enriched-tracks.json \
  --pipeline-state catalog-audit/private/publish-canary/pipeline-state.sqlite3 \
  --dry-run --limit 3
```

Only after reviewing those aggregate plans, configure
`CATALOG_PIPELINE_TOKEN` and `OAI_SITES_AUTHORIZATION` in the secure process
environment (never on a command line or in this repository), then attest the
selected catalogue rights and human-made editorial review explicitly. These
are separate acknowledgements and neither is inferred from catalogue presence:

```text
python catalog-audit/process_catalog.py \
  --exact-manifest catalog-audit/private/publish-canary/exact.jsonl \
  --spotify-enrichment catalog-audit/private/publish-canary/spotify-enrichment/enriched-tracks.json \
  --pipeline-state catalog-audit/private/publish-canary/pipeline-state.sqlite3 \
  --apply --limit 3 --rights-cleared --human-made-cleared
```

`CATALOG_API_BASE_URL` can override the deployed backend origin. A local
`GOOGLE_DRIVE_ACCESS_TOKEN` is optional when files are publicly downloadable;
the Sites backend needs its own Drive token only when the master is private.
The current direct-upload contract is capped at 20 MiB per MP3, peaks file or
cover (and 2 GiB for a Drive master). At 192 kb/s, an unusually long track near
14 minutes can exceed the MP3 cap and will fail explicitly; raise the backend
limit before processing such a title rather than shortening its audio. Apply
mode also refuses to start with less than 3 GiB free on the temporary volume.
Dry-run is the default and performs no network request or write. A missing or
mismatched accepted Spotify result, full hash, exact duration, owned square
cover, either operator acknowledgement, server credential, R2 binding or
backend Drive access stops staging or publication rather than weakening the
gate.

## Responsible Spotify metadata enrichment

`enrich-spotify-metadata.mjs` validates a private manifest from known Spotify
track IDs. It uses Spotify's public [oEmbed API](https://developer.spotify.com/documentation/embeds/reference/oembed)
for the canonical title and thumbnail. When artist or duration validation is
needed, it reads only the track entity from Spotify's official Embed page. The
curated result keeps the track ID/URI, title, artist names and IDs, duration,
playability, explicit flag, release date and allowlisted Spotify CDN artwork
references. Query strings and fragments are removed from artwork URLs. This
Embed fallback is best-effort rather than a stable metadata API; migrate it to
Spotify's Web API when approved client credentials are available.

```text
node catalog-audit/enrich-spotify-metadata.mjs \
  --input catalog-audit/private/catalog-manifest.json \
  --output-dir catalog-audit/private/spotify-enrichment \
  --public-report catalog-audit/spotify-enrichment-summary.json
```

The command deliberately uses low concurrency, a global request interval,
retry/backoff (including `Retry-After`) and a versioned 30-day private cache.
Cache entries from an older curated-field schema are refreshed automatically.
The private output contains a curated enriched manifest and a review queue. The
public report contains aggregate counts only: no title, artist, Spotify ID,
Drive ID, URL or raw row.

The Embed document is never cached or logged. Anonymous session/access tokens,
audio-preview URLs and untrusted image hosts found in that document are
discarded immediately. The tool neither downloads nor scrapes Spotify audio.
Inputs, cache and row-level outputs are refused inside the repository unless
they live under the ignored `catalog-audit/private/` directory.

The ingestion manifest's nested `track`, `inspection`, `cover`, `candidate_id`
and `spotify_id` fields are supported directly. A completed WAV inspection is
the duration source of truth; the catalogue duration is retained separately as
the declared duration. This prevents a 30-second or otherwise truncated asset
from being accepted against Spotify using only spreadsheet metadata. Nested
ingestion rows remain in review until a full WAV inspection provides both a
measured duration and a valid SHA-256 checksum.

Spotify's unauthenticated oEmbed and Embed payloads do **not** expose a reliable
album ID, album URI, album title, UPC or ISRC. Those fields remain explicitly
null and must never be inferred from the track title, artwork or local release.
The publication gate therefore accepts a null Spotify album ID only when the
same row has an exact Orchard distributor URI + UPC + release + track + artist
join and the official Embed title, artists and duration all match. Without that
independent distributor evidence, album verification remains closed. The Embed
release date alone is not album identity.

Owned Drive artwork remains the first choice. A Spotify thumbnail is recorded
only as a private fallback reference. If the publishing pipeline is later
allowed to mirror it, it should fetch server-side only from the stored
allowlisted HTTPS Spotify CDN URL, reject redirects outside that allowlist,
require an `image/*` content type, enforce strict byte and pixel limits, decode
the image, compute its own SHA-256, and store that hash beside the derived R2
object. Do not hotlink it or treat it as owned artwork; preserve the applicable
Spotify attribution and usage requirements.

Useful safety controls:

- `--concurrency 1` to be even more conservative (default: 2, maximum: 4)
- `--min-interval-ms 500` to slow global request starts (default/minimum: 300/200)
- `--limit 2` for a smoke test
- `--refresh` to ignore fresh cache entries
- `--skip-embed` to use oEmbed only (artist/duration will enter review)

Run the deterministic fixture tests with:

```text
node --test catalog-audit/enrich-spotify-metadata.test.mjs
```

## Recurring continuation

[`sync_lofi_drive.py`](./sync_lofi_drive.py) maintains the private, resumable
inventory and detects new or changed release folders without downloading the
media. [`continue_catalog_sync.py`](./continue_catalog_sync.py) then refreshes
the source workbook and continues inspection, enrichment, merge and
publication preparation in bounded batches. The default is network-free and
publication remains gated by two explicit evidence files bound to the current
exact selection. Setup, recovery and the recommended hourly Codex heartbeat are documented in
[`CATALOG_SYNC_RUNBOOK.md`](./CATALOG_SYNC_RUNBOOK.md).

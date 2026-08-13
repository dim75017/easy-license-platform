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

## Responsible Spotify metadata enrichment

`enrich-spotify-metadata.mjs` validates a private manifest from known Spotify
track IDs. It uses Spotify's public [oEmbed API](https://developer.spotify.com/documentation/embeds/reference/oembed)
for the canonical title and thumbnail. When artist or duration validation is
needed, it reads only the track entity from Spotify's official Embed page. This
Embed fallback is best-effort rather than a stable metadata API; migrate it to
Spotify's Web API when approved client credentials are available.

```text
node catalog-audit/enrich-spotify-metadata.mjs \
  --input catalog-audit/private/catalog-manifest.json \
  --output-dir catalog-audit/private/spotify-enrichment \
  --public-report catalog-audit/spotify-enrichment-summary.json
```

The command deliberately uses low concurrency, a global request interval,
retry/backoff (including `Retry-After`) and a 30-day private cache. The private
output contains a curated enriched manifest and a review queue. The public
report contains aggregate counts only: no title, artist, Spotify ID, Drive ID,
URL or raw row.

The Embed document is never cached or logged. Anonymous session/access tokens
and audio-preview URLs found in that document are discarded immediately. The
tool neither downloads nor scrapes Spotify audio. Inputs, cache and row-level
outputs are refused inside the repository unless they live under the ignored
`catalog-audit/private/` directory.

Owned Drive artwork remains the first choice. A Spotify thumbnail is recorded
only as a private fallback reference and should not be mirrored or published
without the applicable Spotify attribution and usage requirements.

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

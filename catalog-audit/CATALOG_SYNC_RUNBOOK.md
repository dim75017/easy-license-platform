# Recurring Drive catalogue continuation

`continue_catalog_sync.py` is the safe recurring entry point for the existing
Drive → full WAV inspection → Spotify evidence → exact manifest → Symbiome
pipeline. It never prints row-level data. All IDs, filenames, state, evidence
and provider responses stay below `catalog-audit/private/`, which Git ignores.

## One-time private setup

Create `catalog-audit/private/drive-sync/config.json` locally. Do not commit or
paste it into an issue, task or terminal transcript.

```json
{
  "schemaVersion": 1,
  "workDirectory": "catalog-audit/private/drive-sync",
  "workbook": "catalog-audit/private/drive-sync/all-data.xlsx",
  "workbookSourceUrl": "PUT_THE_PRIVATE_GOOGLE_SHEET_SHARE_URL_HERE",
  "orchard": "catalog-audit/private/orchard.json",
  "driveSeed": "catalog-audit/private/lofi-drive-release-seed.json",
  "driveInventoryDirectory": "catalog-audit/private/lofi-drive-sync",
  "ffmpegExecutable": "catalog-audit/private/python-packages/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe",
  "driveInventoryReleasesPerRun": 25,
  "inspectionBatchSize": 15,
  "spotifyBatchSize": 50,
  "publicationBatchSize": 3,
  "maximumReleasesPerRun": 2,
  "maximumRunMinutes": 45,
  "rightsEvidence": "catalog-audit/private/drive-sync/rights-evidence.json",
  "humanMadeEvidence": "catalog-audit/private/drive-sync/human-made-evidence.json"
}
```

`workbookSourceUrl` is the private config's Google Sheets share URL. Each
networked run converts it to the official XLSX export URL, caps the response at
50 MiB, validates the workbook and its required sheets, then atomically replaces
the private copy. `orchard` is optional: curated Orchard Spotify URIs take
priority when present, while the refreshed `Identity Info` sheet fills strict
UPC/release/title/artist/duration mappings. A numeric distributor `track Id` is
never fabricated into a Spotify ID, so that row remains in review until a real
22-character Spotify mapping exists.

The public Drive crawler consumes the ignored 743-release seed through
`sync_lofi_drive.py`; it does not require an API key, OAuth token or browser
cookie. It checkpoints at most 25 releases per heartbeat until the initial
backlog is complete, then continues to detect additions and changes.

Publication also needs the existing `CATALOG_PIPELINE_TOKEN` and
`OAI_SITES_AUTHORIZATION` secrets in the environment. The script never stores
or echoes them.

`ffmpegExecutable` is optional. When present, it must resolve to an existing
file (a repository-relative value is restricted to `catalog-audit/private/`).
Without it, the wrapper looks for the private/local `imageio_ffmpeg` package,
then an executable on `PATH`; if none is usable it stops with the aggregate
`ffmpeg_missing` code. `SYMBIOME_FFMPEG_EXECUTABLE` may explicitly override
the private setting with an existing local file for a particular machine. The
resolved path is passed to both the publication dry-run and apply commands but
is never included in stdout or `last-run.json`.

## Safe recurring run

The default is a local, network-free plan:

```text
python catalog-audit/continue_catalog_sync.py --mode plan
```

The recurring continuation refreshes the complete Drive inventory on every
run. The first runs consume the whole initial backlog (including the existing
hundreds of releases); later runs pick up additions and changes. Each heartbeat
fully inspects at most fifteen pending WAVs from at most two releases, with a
45-minute soft budget checked between files, enriches at most fifty fully
inspected rows, merges the verified Spotify duration, rebuilds `exact.jsonl`,
and performs an aggregate publication dry-run for at most three unpublished
exact rows:

```text
python catalog-audit/continue_catalog_sync.py --mode continue --allow-network
```

Interrupted work is resumed from `ingestion-state.sqlite3`,
`pipeline-state.sqlite3`, the Spotify cache and `continuation-state.json`.
Temporary WAVs are still handled one at a time by the existing pipeline and
removed in `finally` blocks. The last aggregate result is kept in
`last-run.json`; it contains no IDs, titles, filenames or URLs.
The aggregate `remaining` and `remainingReleases` counters show the initial
backlog draining across heartbeats. A single in-flight Drive read is allowed to
finish so its checksum can be committed atomically; Drive itself is capped at
ten minutes per file.
Before new downloads begin, the wrapper seeds the current candidate set without
inspection and reuses historical full WAV checksums only when both candidate ID
and source fingerprint still match. It similarly imports the 261 known
published checkpoints only after reconstructing and matching their exact
Spotify-attached manifest fingerprints. Removed rows are quarantined only once
the refreshed Drive snapshot explicitly reports `complete: true`; a partial
inventory can never delete or hide catalogue state. Permanent inspection
failures are ordered after new work and rotated by their last attempt time.

## Publication gate

`continue` never publishes. When it reports `review_required`, review the
private `publication-selection.jsonl`. It contains exact rows only: unique
audio match, full WAV checksum and duration, exact Orchard mapping, accepted
Spotify title/artist/duration evidence and owned square artwork.

After the catalogue team separately confirms rights and the human-made
editorial review for that exact selection, create the two ignored JSON files.
Bind both to the aggregate `selectionSha256` and `selected` count printed by the
continuation run:

```json
{
  "schemaVersion": 1,
  "kind": "rights_clearance",
  "approved": true,
  "selectionSha256": "COPY_THE_64_CHARACTER_AGGREGATE_HASH",
  "selectionCount": 3,
  "reviewer": "Catalogue team",
  "reviewedAt": "2026-08-19T12:00:00+02:00"
}
```

The second file has the same shape with
`"kind": "human_made_editorial_review"`. An optional future `expiresAt` is
supported. A missing, expired or mismatched file closes the gate. The wrapper
does not infer either approval from folder membership, Orchard presence or a
past batch.

Only then run:

```text
python catalog-audit/continue_catalog_sync.py --mode publish --allow-network
```

The wrapper repeats the dry-run, validates both evidence files against the
current exact selection, and only then passes the two explicit attestations to
the existing publisher. Changed rows receive a new hash and therefore require
new evidence.

## Recommended Codex heartbeat

Frequency: hourly at minute `15` in `Europe/Paris` (`15 * * * *`). A run has a
45-minute soft inspection budget, leaving recovery room before the next
heartbeat. With 15 WAVs and 25 Drive releases per run, this drains the initial
743-release backlog instead of limiting the schedule to future deltas.

Exact prompt:

> In the Symbiome repository, read `catalog-audit/CATALOG_SYNC_RUNBOOK.md`, load the bundled workspace Python runtime if `python` is not on PATH, then run `python catalog-audit/continue_catalog_sync.py --config catalog-audit/private/drive-sync/config.json --mode continue --allow-network`. Continue the initial backlog as well as later deltas. Keep all private files and credentials out of Git and report only the aggregate JSON. Do not weaken a gate, invent rights or human-made evidence, print IDs/titles/URLs, or publish from folder membership alone. If the run reports `review_required`, stop and report the selection count plus aggregate selection hash so a human can review the ignored selection and create both evidence files. Run `--mode publish` only when the two existing private evidence files match the current selection exactly; otherwise do not publish. On transient failure, leave resumable state intact and report only the stable aggregate error code.

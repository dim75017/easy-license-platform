# Recurring Drive catalogue continuation

`continue_catalog_sync.py` is the safe recurring entry point for the existing
Drive → full WAV inspection → Spotify evidence → exact manifest → Symbiome
pipeline. It never prints row-level data. All IDs, filenames, state, evidence
and provider responses stay below `catalog-audit/private/`, which Git ignores.

It also exposes an explicit catalogue-owner drain lane. That lane is reserved
for the configured Sheet + Drive roots after the catalogue owner has confirmed
that those sources are authoritative. It removes the Spotify dependency, but
not the technical audio, ownership, source-association or publication gates.

## One-time private setup

Create `catalog-audit/private/drive-sync/config.json` locally. Do not commit or
paste it into an issue, task or terminal transcript.

```json
{
  "schemaVersion": 1,
  "workDirectory": "catalog-audit/private/drive-sync",
  "workbook": "catalog-audit/private/drive-sync/all-data.xlsx",
  "workbookSourceUrl": "PUT_THE_PRIVATE_GOOGLE_SHEET_SHARE_URL_HERE",
  "catalogueSourceUrl": "https://lofi-records.netlify.app/#/catalog",
  "orchard": "catalog-audit/private/orchard.json",
  "driveSeed": "catalog-audit/private/lofi-drive-release-seed.json",
  "driveInventoryDirectory": "catalog-audit/private/lofi-drive-sync",
  "centralDriveInventory": "catalog-audit/private/central-drive-connector/partial-inventory.json",
  "ffmpegExecutable": "catalog-audit/private/python-packages/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe",
  "driveInventoryReleasesPerRun": 50,
  "inspectionBatchSize": 50,
  "spotifyBatchSize": 50,
  "publicationBatchSize": 25,
  "maximumReleasesPerRun": 10,
  "maximumRunMinutes": 55,
  "pipelineToken": "PUT_THE_PRIVATE_CATALOGUE_PIPELINE_TOKEN_HERE",
  "sitesAuthorization": "PUT_THE_PRIVATE_SITES_AUTHORIZATION_HERE",
  "catalogOwnerAttestation": "catalog-audit/private/drive-sync/catalog-owner-attestation.json",
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
cookie. It checkpoints at most 50 releases per heartbeat until the initial
backlog is complete, then continues to detect additions and changes.

The optional `centralDriveInventory` is a private Google Drive connector/API
snapshot of the flat `Fichiers` / `FICHIER` and `Artwork` /
`Artwork les bon` folders below the same owner-approved Drive root. It is an
additive recovery source for catalogue rows whose release folder is missing an
audio or cover link. Connector page caps must be recorded as `complete: false`;
a partial snapshot can add a positive deterministic match but can never remove
or replace an existing release mapping. Refreshing that snapshot never writes
to Drive and must keep all file IDs, names and links below
`catalog-audit/private/`.

Publication needs `pipelineToken` and `sitesAuthorization` in this ignored
private config. Existing `CATALOG_PIPELINE_TOKEN` and
`OAI_SITES_AUTHORIZATION` environment variables remain a compatibility
fallback. Both values are type/length/control-character validated, removed
from every ordinary child process and injected only into the environment of
the final publication apply subprocess. They are never placed on a command
line or in stdout, stderr summaries or `last-run.json`; detected child output
containing either value is blocked behind an aggregate error code.

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

## Catalogue-owner global drain

Use this one top-level invocation only after the scoped private owner
attestation is valid and the owner has explicitly accepted Sheet + Drive as the
publication authority without independent Spotify confirmation:

```text
python catalog-audit/continue_catalog_sync.py --config catalog-audit/private/drive-sync/config.json --mode drain --allow-network
```

`drain` is intentionally not an arbitrary publication microbatch. It keeps the
singleton lock for the whole run, refreshes the workbook once, drains the
checkpointed Drive release inventory sequentially until complete (or until a
full pass makes no progress), seeds all current candidates without downloading
or pre-inspecting WAVs, and creates the ignored
`catalog-owner-direct.jsonl`. That manifest accepts only a unique, deterministic
Sheet-row ↔ Drive-file association. Missing, ambiguous, multiply claimed or
stale audio is excluded. Missing workbook artwork is filled only when a unique
owned image, or a clearly ranked cover/front/artwork image, exists inside the
same release folder. Ambiguous artwork is excluded; absent artwork is allowed
only in this owner-direct lane and produces the public neutral placeholder.

When `centralDriveInventory` exists, the drain also considers its flat central
files after release-folder matching. The established release/WAV path remains
unchanged. Additional central WAV or MP3 sources use a separate monotone pin:
an exact unique ISRC, exact UPC+title, exact artist+title, or exact
release+title must resolve the file to one workbook row, and that row must be
claimed by exactly one file. The MP3 lane never accepts a title-only or scored
filename match. Contradictory exact signals, renamed MIME/extension conflicts,
multiple rows and multiple file claims all fail closed. Aggregate output keeps
WAV, MP3 and per-rule pin counts separate. Central covers require one unique
UPC filename or one release name that maps to a single UPC. `Artwork les bon`
outranks the general `Artwork` folder only when exactly one image exists at
that higher rank; ties stay excluded.

The selected manifest is then processed to exhaustion in the same invocation,
without the recurring lane's wall-clock cutoff, one track at a time and with
one FFmpeg thread. Each selected source is downloaded fully while SHA-256 is
calculated. WAV follows the established parser and complete decode path
unchanged. A strictly pinned MP3 must have a valid signature and complete a
positive-duration FFmpeg decode/probe. A source MP3 declared at exactly
192 kb/s is remuxed with metadata stripped; all other sources are
deterministically transcoded to a full-length 192 kb/s listening MP3. Remux
failure falls back to transcoding. On a fresh item, one complete decode of that
public copy verifies its duration and simultaneously derives the 512-point
waveform, avoiding a second redundant decode. The measured source duration
becomes the catalogue duration for this
owner-authoritative lane; an absent or different Sheet duration and a short but
valid source do not block it. A corrupt, unreadable or undecodable file fails
only its own checkpoint. Covers are kept when already bounded and square,
otherwise normalized to a bounded square JPEG. Source masters stay in private
storage; only listening copies, waveforms and cover delivery are public.

The processor checkpoints each completed stage separately. A resumed item does
not repeat metadata ingestion, private-master registration, MP3 transcoding or
waveform generation when that exact manifest fingerprint already completed the
stage. The measured source checksum, byte size, MIME, format and duration are
retained in the ignored pipeline state; a retry still re-downloads and
checksum-verifies the source
whenever a missing derivative needs its bytes. This preserves the full-read and
lineage gates while avoiding unrelated work after a late network failure.

Release artwork is also release-aware. When a selected record supplies a cover,
the worker always validates and uploads it before promotion; an exact cover
already owned by the release is accepted idempotently by the backend. Repeated
uses during the same sealed run reuse the exact prepared bytes from a random
process-local LRU cache capped at 512 MiB. When the owner manifest has no cover,
the new worker sends an explicit owner-direct-only opt-in; omission remains
fail-closed so an older worker cannot start publishing coverless releases during
a rolling deployment. The cache contains no raw identifier in its filenames,
is removed when the process exits, and never bypasses the backend integrity gate.

Every backend metadata row stores the owner-attestation hash, configured source
scope hash, whole-selection hash, measured master hash and a completed full-read
flag under the sealed batch `symbiome-catalog-owner-drain-v1`. Promotion repeats
the checksum, measured-duration, private-master, MP3, waveform, supplied-cover,
rights and human-made gates atomically, but deliberately has no Spotify gate.
Coverless promotion additionally requires the explicit opt-in described above.
Existing published checkpoints return `already_published`, so interruption or machine
restart resumes instead of starting over. Output and `last-run.json` remain
aggregate-only; row data stays private.

The legacy `continue` / `publish` lane below remains unchanged and continues to
require exact Spotify evidence. The direct lane never consumes `review.jsonl`
or `quarantine.jsonl` wholesale; it consumes only its separately derived,
deterministic owner manifest.

The recurring continuation refreshes the complete Drive inventory on every
run. The first runs consume the whole initial backlog (including the existing
hundreds of releases); later runs pick up additions and changes. Each heartbeat
fully inspects at most 50 pending WAVs from at most 10 releases, with a
55-minute soft budget checked between files, enriches at most 50 fully
inspected rows, merges the verified Spotify duration, rebuilds `exact.jsonl`,
and performs an aggregate publication dry-run for at most 25 unpublished
exact rows:

```text
python catalog-audit/continue_catalog_sync.py --mode continue --allow-network
```

Every mode first takes a non-blocking operating-system lock at the ignored
`workDirectory/.catalog-sync.lock`. If an automation and a manual run overlap,
the second exits immediately with code `1` and the aggregate
`sync_already_running` error; it does not start a child process, touch SQLite or
R2, or overwrite `last-run.json`. The file intentionally contains no PID,
title, URL or other metadata and may remain on disk. Its OS lock is released on
normal exit, exception, interruption or process crash, so the file must not be
deleted as a recovery step.

The wrapper also lowers its own scheduling priority at startup (Windows
`BELOW_NORMAL_PRIORITY_CLASS`, or a positive POSIX nice increment) on a
best-effort basis. Every Python, Node and FFmpeg child receives single-thread
caps for OpenMP, MKL, OpenBLAS, NumExpr and vecLib; an existing valid one-thread
cap is preserved. Failure to change process priority never blocks or weakens a
catalogue gate.

Interrupted work is resumed from `ingestion-state.sqlite3`,
`pipeline-state.sqlite3`, the Spotify cache and `continuation-state.json`.
Temporary WAVs are still handled one at a time by the existing pipeline and
removed in `finally` blocks. The last aggregate result is kept in
`last-run.json`; it contains no IDs, titles, filenames or URLs.
Increasing the configured batch counts therefore increases only the number of
sequential checkpoints attempted during a run, not the number of simultaneous
downloads or the peak temporary-disk footprint. The hard configuration caps
remain 50 Drive releases, 50 WAV inspections, 50 Spotify enrichments, 25
publications, 10 inspected releases and 60 inspection minutes per invocation.
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

### Durable catalogue-owner attestation

When the catalogue owner explicitly confirms that the whole configured,
already-released catalogue is cleared for full-length public listening and
licensed downloads, and that it contains no generative-AI music, that approval
can be recorded once in the ignored private `catalogOwnerAttestation` file:

```json
{
  "schemaVersion": 1,
  "kind": "catalog_owner_attestation",
  "approved": true,
  "claims": {
    "catalogueAlreadyReleased": true,
    "rightsToPublishFullLengthListeningCopies": true,
    "rightsToOfferLicensedDownloads": true,
    "humanMadeNoGenerativeAI": true
  },
  "scope": {
    "catalogueSourceUrl": "https://lofi-records.netlify.app/#/catalog",
    "workbookSourceUrl": "PUT_THE_PRIVATE_GOOGLE_SHEET_SHARE_URL_HERE",
    "driveSourceFolderId": "PUT_THE_PRIVATE_DRIVE_ROOT_ID_HERE"
  },
  "reviewer": "Catalogue owner",
  "reviewerRole": "catalogue_owner",
  "reviewedAt": "2026-08-19T12:00:00+02:00"
}
```

An optional future `expiresAt` is supported. The wrapper validates every claim
and binds this attestation to three stable source identities: the exact Netlify
catalogue route, the canonical Google Sheets document and the Drive root from
the configured seed. Adding releases below the same roots stays in scope;
changing any source closes the gate. The attestation is never inferred from
folder membership and never appears in aggregate output.

With a valid owner attestation, `continue` still performs the full exact-match
and publication dry-run gates, then derives the two ignored selection evidence
files for the current `selectionSha256` and count. It reports
`publish_ready`; it does not publish. `publish` repeats the run, accepts exact
manual evidence first, otherwise safely re-derives evidence for the current
selection, validates both files, and only then applies the batch. Derived files
contain source and attestation hashes, not catalogue IDs, titles or URLs. A new
selection therefore gets new selection-bound evidence without weakening the
exact/review/quarantine separation.

A publication apply may finish with some exact rows published and a small
number failed or promotion-blocked. The child process return code `2` is
accepted only for this apply step and only when its aggregate counters confirm
that partial outcome. The wrapper records `status: partial`, keeps the published
checkpoints and exits successfully so the run remains resumable. Fresh exact
rows that have no matching pipeline state are always selected before retries;
older failures are then rotated by fewest attempts and oldest attempt time.
Broken sources therefore cannot monopolize the publication batch. Rights,
human-made, Spotify, review and quarantine gates remain unchanged.

## Recommended Codex heartbeat

Frequency: hourly at minute `15` in `Europe/Paris` (`15 * * * *`). A run has a
55-minute soft inspection budget checked between files. With 50 WAVs, 50 Drive
releases and at most 25 exact publications per run, the initial backlog drains
substantially faster while every file remains sequential and resumable. The
60-minute hard inspection cap prevents a misconfigured heartbeat from removing
the safety boundary.

Exact prompt:

> In the Symbiome repository, read `catalog-audit/CATALOG_SYNC_RUNBOOK.md`, load the bundled workspace Python runtime if `python` is not on PATH, then run `python catalog-audit/continue_catalog_sync.py --config catalog-audit/private/drive-sync/config.json --mode continue --allow-network`. Continue the initial backlog as well as later deltas. Keep all private files and credentials out of Git and report only the aggregate JSON. Do not weaken a gate, invent rights or human-made evidence, print IDs/titles/URLs, or publish from folder membership alone. If the run reports `publish_ready`, immediately run the same wrapper with `--mode publish --allow-network`; the wrapper must validate the scoped owner attestation and the exact current selection before applying. If it reports `review_required`, stop and report only the aggregate selection count/hash for human review. Never publish review/quarantine rows. On transient failure, leave resumable state intact and report only the stable aggregate error code.

# Aggregate Drive/WAV ingestion smoke test

Read-only validation performed on 13 August 2026. This report contains no raw
catalogue row, Drive identifier, private URL, contact, credential or filename
that was not already part of the named release examples.

## Reproducible dry-run

The full workbook dry-run completed without a network request or repository
write:

| Check | Result |
| --- | ---: |
| Publishing rows with a release or track title | 8,607 |
| Parsed release/audio groups across both helper sheets | 2,452 |
| Candidate records, including unmatched audio quarantine records | 10,035 |
| Preliminary review | 6,764 |
| Preliminary quarantine | 3,271 |

These are deliberately preliminary counts. The smoke environment did not have
the private Orchard export materialised locally, no SHA-256 was calculated and
only three WAV headers were inspected. Therefore none of these records is
labelled publication-ready by this run.

## Folder-pattern and WAV smoke test

The three known Drive layouts are covered:

| Release example | Layout covered |
| --- | --- |
| Time | WAV directly in the release root |
| Rise | WAV directly in root alongside a `Wav` folder |
| Signal Flow | WAV files inside a nested `Wav` folder |

One selected WAV per release was inspected with an HTTP byte range only:

| Check | Result |
| --- | ---: |
| Range reads attempted | 3 |
| Valid RIFF/WAVE headers | 3 |
| PCM, stereo, 16-bit | 3 |
| 44.1 kHz | 2 |
| 48 kHz | 1 |
| Full master downloads | 0 |
| Retained audio files | 0 |

Two files matched the catalogue duration within one second (0.49 s and 0.99 s).
The third differed by 22.95 s and was correctly moved to quarantine instead of
being auto-approved. Because this was range-only and did not use the local
Orchard export, the final aggregate state is two `review`, one `quarantine`, and
zero `exact`. This is the intended fail-closed behaviour.

## Resume and privacy controls verified

- Network access is refused unless `--allow-network` is explicit.
- State is committed in ignored SQLite after every inspected file.
- An unchanged completed range inspection is skipped on the next run.
- Full mode uses one operating-system temporary file, hashes it, and deletes it
  in a `finally` block; full mode was not run in this smoke test.
- Private manifests and IDs stay under `catalog-audit/private/`, which Git
  ignores.
- The repository contains only the ingestion code, offline tests and aggregate
  reports.

Offline parser/matching tests: 6 passed.

#!/usr/bin/env python3
"""Process publication-ready Symbiome catalogue audio one track at a time.

The command is intentionally dry-run by default.  In apply mode it downloads
one private/publicly-downloadable Drive WAV into a generic temporary directory,
verifies its existing audit evidence, creates a full-length 192 kb/s MP3 and a
512-bin waveform JSON, copies the verified master, uploads the derivatives and
owned cover, then asks the backend to promote the track.  Per-track checkpoints live in ignored SQLite state so a
rerun never republishes a completed item and safely retries idempotent API
steps.

Private identifiers are used only in requests and ignored local state.  CLI
output is aggregate and error reporting uses stable codes instead of provider
URLs, file IDs, filenames or response bodies.
"""

from __future__ import annotations

import argparse
import array
import contextlib
import datetime as dt
import hashlib
import json
import math
import os
from pathlib import Path
import re
import shutil
import sqlite3
import subprocess
import sys
import tempfile
import time
from typing import Any, BinaryIO, Callable, Mapping, Sequence
import urllib.error
import urllib.parse
import urllib.request
import warnings

import ingest_catalog as ingest


AUDIT_DIRECTORY = Path(__file__).resolve().parent
PRIVATE_DIRECTORY = AUDIT_DIRECTORY / "private"
DEFAULT_EXACT_MANIFEST = PRIVATE_DIRECTORY / "exact.jsonl"
DEFAULT_INGESTION_STATE = PRIVATE_DIRECTORY / "ingestion-state.sqlite3"
DEFAULT_PIPELINE_STATE = PRIVATE_DIRECTORY / "pipeline-state.sqlite3"
DEFAULT_SPOTIFY_ENRICHMENT = PRIVATE_DIRECTORY / "spotify-enrichment" / "enriched-tracks.json"
DEFAULT_API_BASE_URL = "https://easy-license.dsomoguy.chatgpt.site"
DEFAULT_BATCH_KEY = "symbiome-catalog-v1"
PEAK_BIN_COUNT = 512
PEAK_SAMPLE_RATE = 8_000
MP3_BITRATE = "192k"
MAX_SOURCE_BYTES = 2 * 1024 * 1024 * 1024
MAX_DERIVED_ASSET_BYTES = 20 * 1024 * 1024
MIN_TEMP_FREE_BYTES = 3 * 1024 * 1024 * 1024
MAX_EXACT_DURATION_DELTA_SECONDS = 2.0
DRIVE_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{8,200}$")
SHA256_PATTERN = re.compile(r"^[a-f0-9]{64}$")
CANDIDATE_ID_PATTERN = re.compile(r"^[a-f0-9]{16,64}$")
SPOTIFY_ID_PATTERN = re.compile(r"^[A-Za-z0-9]{22}$")
SAFE_ERROR_CODE_PATTERN = re.compile(r"[^a-z0-9_]+")


class PipelineError(RuntimeError):
    """A redacted operational error safe to persist and aggregate."""

    def __init__(self, code: str, *, retryable: bool = False) -> None:
        self.code = sanitize_error_code(code)
        self.retryable = retryable
        super().__init__(self.code)


class ApiHttpError(PipelineError):
    def __init__(self, status: int, provider_code: str = "") -> None:
        safe_provider_code = sanitize_error_code(provider_code) if provider_code else "request_failed"
        super().__init__(
            f"api_{status}_{safe_provider_code}",
            retryable=status == 429 or 500 <= status <= 599,
        )
        self.status = status


def sanitize_error_code(value: object) -> str:
    normalized = SAFE_ERROR_CODE_PATTERN.sub("_", str(value).strip().lower()).strip("_")
    return (normalized or "pipeline_failed")[:120]


def utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat()


def emit_aggregate(value: Mapping[str, Any]) -> None:
    """Print only caller-curated aggregate values."""

    print(json.dumps(value, ensure_ascii=False, sort_keys=True))


def assert_private_artifact_path(path: Path, label: str) -> None:
    """Keep row-level artifacts out of versioned repository locations."""

    repository = AUDIT_DIRECTORY.parent
    resolved = path.resolve()
    try:
        relative = resolved.relative_to(repository)
    except ValueError:
        return
    if relative.parts[:2] != ("catalog-audit", "private"):
        raise PipelineError(f"{sanitize_error_code(label)}_must_be_private")


def canonical_fingerprint(record: Mapping[str, Any]) -> str:
    payload = json.dumps(record, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def sha256_file(path: Path) -> tuple[str, int]:
    digest = hashlib.sha256()
    size = 0
    with path.open("rb") as handle:
        while True:
            chunk = handle.read(1024 * 1024)
            if not chunk:
                break
            digest.update(chunk)
            size += len(chunk)
    return digest.hexdigest(), size


def positive_number(value: object) -> float | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    number = float(value)
    return number if math.isfinite(number) and number > 0 else None


def positive_integer(value: object) -> int | None:
    number = positive_number(value)
    if number is None or not number.is_integer():
        return None
    integer = int(number)
    return integer if integer > 0 else None


def require_text(value: object, code: str, maximum: int) -> str:
    if not isinstance(value, str):
        raise PipelineError(code)
    normalized = value.strip()
    if not normalized or len(normalized) > maximum or re.search(r"[\x00-\x1f\x7f]", normalized):
        raise PipelineError(code)
    return normalized


def load_exact_manifest(path: Path) -> list[dict[str, Any]]:
    assert_private_artifact_path(path, "exact_manifest")
    if not path.is_file():
        raise PipelineError("exact_manifest_missing")

    records: list[dict[str, Any]] = []
    seen: set[str] = set()
    with path.open("r", encoding="utf-8-sig") as handle:
        for line in handle:
            if not line.strip():
                continue
            try:
                record = json.loads(line)
            except json.JSONDecodeError as error:
                raise PipelineError("exact_manifest_invalid_json") from error
            validate_exact_record(record)
            candidate_id = record["candidate_id"]
            if candidate_id in seen:
                raise PipelineError("exact_manifest_duplicate_candidate")
            seen.add(candidate_id)
            records.append(record)
    return sorted(records, key=lambda item: item["candidate_id"])


def validate_exact_record(value: object) -> None:
    if not isinstance(value, dict):
        raise PipelineError("exact_record_invalid")
    if value.get("status") != "exact" or value.get("reasons") not in ([], None):
        raise PipelineError("non_exact_record_refused")

    candidate_id = require_text(value.get("candidate_id"), "candidate_id_invalid", 64)
    if not CANDIDATE_ID_PATTERN.fullmatch(candidate_id):
        raise PipelineError("candidate_id_invalid")

    track = value.get("track")
    audio = value.get("audio")
    cover = value.get("cover")
    inspection = value.get("inspection")
    if not all(isinstance(item, dict) for item in (track, audio, cover, inspection)):
        raise PipelineError("exact_record_evidence_missing")

    require_text(track.get("title"), "track_title_missing", 500)
    require_text(track.get("release"), "release_title_missing", 500)
    artists = track.get("artists")
    if not isinstance(artists, list) or not artists or not all(isinstance(item, str) and item.strip() for item in artists):
        raise PipelineError("track_artist_missing")

    drive_file_id = require_text(audio.get("file_id"), "drive_file_id_invalid", 200)
    if not DRIVE_ID_PATTERN.fullmatch(drive_file_id):
        raise PipelineError("drive_file_id_invalid")
    require_text(audio.get("name"), "source_file_name_missing", 1000)

    if cover.get("is_square") is not True or not DRIVE_ID_PATTERN.fullmatch(str(cover.get("file_id", ""))):
        raise PipelineError("owned_square_cover_missing")

    source_sha256 = str(inspection.get("sha256") or "").strip().lower()
    wav = inspection.get("wav")
    if (
        inspection.get("status") != "complete"
        or inspection.get("mode") != "full"
        or not SHA256_PATTERN.fullmatch(source_sha256)
        or not isinstance(wav, dict)
        or positive_number(wav.get("duration_seconds")) is None
    ):
        raise PipelineError("full_source_inspection_missing")

    spotify_id = str(value.get("spotify_id") or "").strip()
    spotify_duration = positive_number(value.get("spotify_duration_seconds"))
    if value.get("spotify_match_kind") != "exact" or not SPOTIFY_ID_PATTERN.fullmatch(spotify_id) or spotify_duration is None:
        raise PipelineError("verified_spotify_evidence_missing")


def open_pipeline_state(path: Path) -> sqlite3.Connection:
    assert_private_artifact_path(path, "pipeline_state")
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA journal_mode=WAL")
    connection.execute("PRAGMA foreign_keys=ON")
    connection.executescript(
        """
        CREATE TABLE IF NOT EXISTS pipeline_items (
          candidate_id TEXT PRIMARY KEY,
          manifest_fingerprint TEXT NOT NULL,
          batch_key TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'planned',
          attempts INTEGER NOT NULL DEFAULT 0,
          ingest_id INTEGER,
          track_id INTEGER,
          source_sha256 TEXT,
          measured_duration_ms INTEGER,
          streaming_sha256 TEXT,
          streaming_byte_size INTEGER,
          streaming_duration_ms INTEGER,
          peaks_sha256 TEXT,
          peaks_byte_size INTEGER,
          cover_sha256 TEXT,
          cover_byte_size INTEGER,
          cover_content_type TEXT,
          metadata_uploaded INTEGER NOT NULL DEFAULT 0,
          master_uploaded INTEGER NOT NULL DEFAULT 0,
          streaming_uploaded INTEGER NOT NULL DEFAULT 0,
          peaks_uploaded INTEGER NOT NULL DEFAULT 0,
          cover_uploaded INTEGER NOT NULL DEFAULT 0,
          rights_cleared_ack INTEGER NOT NULL DEFAULT 0,
          human_made_cleared_ack INTEGER NOT NULL DEFAULT 0,
          last_error_code TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS pipeline_items_status_idx
          ON pipeline_items(status, updated_at);
        """
    )
    columns = {str(row[1]) for row in connection.execute("PRAGMA table_info(pipeline_items)")}
    migrations = {
        "cover_sha256": "TEXT",
        "cover_byte_size": "INTEGER",
        "cover_content_type": "TEXT",
        "master_uploaded": "INTEGER NOT NULL DEFAULT 0",
        "cover_uploaded": "INTEGER NOT NULL DEFAULT 0",
        "rights_cleared_ack": "INTEGER NOT NULL DEFAULT 0",
        "human_made_cleared_ack": "INTEGER NOT NULL DEFAULT 0",
    }
    for column, definition in migrations.items():
        if column not in columns:
            connection.execute(f"ALTER TABLE pipeline_items ADD COLUMN {column} {definition}")
    connection.commit()
    return connection


STATE_COLUMNS = {
    "status",
    "attempts",
    "ingest_id",
    "track_id",
    "source_sha256",
    "measured_duration_ms",
    "streaming_sha256",
    "streaming_byte_size",
    "streaming_duration_ms",
    "peaks_sha256",
    "peaks_byte_size",
    "cover_sha256",
    "cover_byte_size",
    "cover_content_type",
    "metadata_uploaded",
    "master_uploaded",
    "streaming_uploaded",
    "peaks_uploaded",
    "cover_uploaded",
    "last_error_code",
}


def ensure_state_row(
    connection: sqlite3.Connection,
    record: Mapping[str, Any],
    batch_key: str,
    rights_cleared_ack: bool,
    human_made_cleared_ack: bool,
) -> sqlite3.Row:
    candidate_id = record["candidate_id"]
    fingerprint = canonical_fingerprint(record)
    now = utc_now()
    existing = connection.execute(
        "SELECT * FROM pipeline_items WHERE candidate_id = ?",
        (candidate_id,),
    ).fetchone()
    if existing is None:
        connection.execute(
            """
            INSERT INTO pipeline_items (
              candidate_id, manifest_fingerprint, batch_key, status,
              rights_cleared_ack, human_made_cleared_ack, created_at, updated_at
            ) VALUES (?, ?, ?, 'planned', ?, ?, ?, ?)
            """,
            (
                candidate_id,
                fingerprint,
                batch_key,
                int(rights_cleared_ack),
                int(human_made_cleared_ack),
                now,
                now,
            ),
        )
    elif (
        existing["manifest_fingerprint"] != fingerprint
        or existing["batch_key"] != batch_key
        or bool(existing["rights_cleared_ack"]) != rights_cleared_ack
        or bool(existing["human_made_cleared_ack"]) != human_made_cleared_ack
    ):
        connection.execute(
            """
            UPDATE pipeline_items
            SET manifest_fingerprint=?, batch_key=?, status='planned', attempts=0,
                ingest_id=NULL, track_id=NULL, source_sha256=NULL,
                measured_duration_ms=NULL, streaming_sha256=NULL,
                streaming_byte_size=NULL, streaming_duration_ms=NULL,
                peaks_sha256=NULL, peaks_byte_size=NULL,
                cover_sha256=NULL, cover_byte_size=NULL, cover_content_type=NULL,
                metadata_uploaded=0, master_uploaded=0, streaming_uploaded=0,
                peaks_uploaded=0, cover_uploaded=0,
                rights_cleared_ack=?, human_made_cleared_ack=?,
                last_error_code=NULL, updated_at=?
            WHERE candidate_id=?
            """,
            (
                fingerprint,
                batch_key,
                int(rights_cleared_ack),
                int(human_made_cleared_ack),
                now,
                candidate_id,
            ),
        )
    connection.commit()
    row = connection.execute(
        "SELECT * FROM pipeline_items WHERE candidate_id = ?",
        (candidate_id,),
    ).fetchone()
    if row is None:
        raise PipelineError("pipeline_state_unavailable")
    return row


def update_state(
    connection: sqlite3.Connection,
    candidate_id: str,
    **values: object,
) -> sqlite3.Row:
    if not values or not set(values).issubset(STATE_COLUMNS):
        raise PipelineError("pipeline_state_update_invalid")
    assignments = ", ".join(f"{column}=?" for column in values)
    connection.execute(
        f"UPDATE pipeline_items SET {assignments}, updated_at=? WHERE candidate_id=?",  # noqa: S608 - columns are allowlisted
        (*values.values(), utc_now(), candidate_id),
    )
    connection.commit()
    row = connection.execute(
        "SELECT * FROM pipeline_items WHERE candidate_id = ?",
        (candidate_id,),
    ).fetchone()
    if row is None:
        raise PipelineError("pipeline_state_unavailable")
    return row


def state_counts(connection: sqlite3.Connection) -> dict[str, int]:
    return {
        str(row["status"]): int(row["count"])
        for row in connection.execute(
            "SELECT status, COUNT(*) AS count FROM pipeline_items GROUP BY status ORDER BY status"
        )
    }


def drive_media_url(file_id: str, access_token: str | None) -> str:
    quoted = urllib.parse.quote(file_id)
    if access_token:
        return f"https://www.googleapis.com/drive/v3/files/{quoted}?alt=media&supportsAllDrives=true"
    return f"https://drive.usercontent.google.com/download?id={quoted}&export=download&confirm=t"


class DriveDownloader:
    def __init__(
        self,
        access_token: str | None = None,
        *,
        opener: Callable[..., Any] = urllib.request.urlopen,
        sleeper: Callable[[float], None] = time.sleep,
        maximum_attempts: int = 4,
    ) -> None:
        self.access_token = access_token.strip() if access_token else None
        if self.access_token and re.search(r"[\r\n]", self.access_token):
            raise PipelineError("google_drive_access_token_invalid")
        self.opener = opener
        self.sleeper = sleeper
        self.maximum_attempts = maximum_attempts

    def download(
        self,
        drive_file_id: str,
        destination: Path,
        *,
        expected_sha256: str | None,
        expected_size: int | None,
        maximum_bytes: int = MAX_SOURCE_BYTES,
    ) -> tuple[str, int]:
        for attempt in range(1, self.maximum_attempts + 1):
            with contextlib.suppress(FileNotFoundError):
                destination.unlink()
            try:
                return self._download_once(
                    drive_file_id,
                    destination,
                    expected_sha256=expected_sha256,
                    expected_size=expected_size,
                    maximum_bytes=maximum_bytes,
                )
            except PipelineError as error:
                if not error.retryable or attempt >= self.maximum_attempts:
                    raise
            except (OSError, urllib.error.URLError) as error:
                if attempt >= self.maximum_attempts:
                    raise PipelineError("drive_download_failed", retryable=True) from error
            self.sleeper(min(2 ** (attempt - 1), 8))
        raise PipelineError("drive_download_failed")

    def _download_once(
        self,
        drive_file_id: str,
        destination: Path,
        *,
        expected_sha256: str | None,
        expected_size: int | None,
        maximum_bytes: int,
    ) -> tuple[str, int]:
        headers = {"User-Agent": "SymbiomeCatalogPipeline/1.0", "Accept": "application/octet-stream,*/*;q=0.8"}
        if self.access_token:
            headers["Authorization"] = f"Bearer {self.access_token}"
        request = urllib.request.Request(drive_media_url(drive_file_id, self.access_token), headers=headers)
        digest = hashlib.sha256()
        size = 0
        prefix = bytearray()
        try:
            with self.opener(request, timeout=900) as response, destination.open("xb") as output:
                raw_status = getattr(response, "status", None)
                status = int(raw_status if raw_status is not None else response.getcode())
                if status < 200 or status >= 300:
                    raise PipelineError("drive_download_failed", retryable=status == 429 or status >= 500)
                content_type = str(response.headers.get("content-type") or "").casefold()
                if "text/html" in content_type:
                    raise PipelineError("drive_source_not_audio")
                while True:
                    chunk = response.read(1024 * 1024)
                    if not chunk:
                        break
                    if len(prefix) < 512:
                        prefix.extend(chunk[: 512 - len(prefix)])
                    size += len(chunk)
                    if size > maximum_bytes:
                        raise PipelineError("drive_source_too_large")
                    digest.update(chunk)
                    output.write(chunk)
        except urllib.error.HTTPError as error:
            raise PipelineError(
                "drive_download_failed",
                retryable=error.code == 429 or 500 <= error.code <= 599,
            ) from error

        if bytes(prefix).lstrip().lower().startswith((b"<!doctype html", b"<html")):
            raise PipelineError("drive_source_not_audio")
        actual_sha256 = digest.hexdigest()
        if expected_size is not None and size != expected_size:
            raise PipelineError("source_size_mismatch")
        if expected_sha256 is not None and actual_sha256 != expected_sha256:
            raise PipelineError("source_sha256_mismatch")
        return actual_sha256, size


def inspect_cover_artwork(path: Path) -> tuple[str, int, int]:
    with path.open("rb") as handle:
        prefix = handle.read(32)
        if prefix.startswith(b"\x89PNG\r\n\x1a\n") and len(prefix) >= 24:
            width = int.from_bytes(prefix[16:20], "big")
            height = int.from_bytes(prefix[20:24], "big")
            content_type = "image/png"
        elif prefix.startswith(b"\xff\xd8\xff"):
            handle.seek(2)
            width = height = 0
            while True:
                marker_prefix = handle.read(1)
                if not marker_prefix:
                    break
                if marker_prefix != b"\xff":
                    continue
                marker = handle.read(1)
                while marker == b"\xff":
                    marker = handle.read(1)
                if not marker or marker in {b"\xd8", b"\xd9"}:
                    continue
                length_bytes = handle.read(2)
                if len(length_bytes) != 2:
                    break
                segment_length = int.from_bytes(length_bytes, "big")
                if segment_length < 2:
                    break
                if marker[0] in {0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF}:
                    geometry = handle.read(5)
                    if len(geometry) == 5:
                        height = int.from_bytes(geometry[1:3], "big")
                        width = int.from_bytes(geometry[3:5], "big")
                    break
                handle.seek(segment_length - 2, os.SEEK_CUR)
            content_type = "image/jpeg"
        elif len(prefix) >= 30 and prefix[:4] == b"RIFF" and prefix[8:12] == b"WEBP":
            chunk = prefix[12:16]
            if chunk == b"VP8X":
                width = int.from_bytes(prefix[24:27], "little") + 1
                height = int.from_bytes(prefix[27:30], "little") + 1
            elif chunk == b"VP8L" and prefix[20:21] == b"\x2f":
                packed = prefix[21:25]
                width = 1 + packed[0] + ((packed[1] & 0x3F) << 8)
                height = 1 + (packed[1] >> 6) + (packed[2] << 2) + ((packed[3] & 0x0F) << 10)
            elif chunk == b"VP8 " and prefix[23:26] == b"\x9d\x01\x2a":
                width = int.from_bytes(prefix[26:28], "little") & 0x3FFF
                height = int.from_bytes(prefix[28:30], "little") & 0x3FFF
            else:
                raise PipelineError("cover_artwork_type_invalid")
            content_type = "image/webp"
        else:
            raise PipelineError("cover_artwork_type_invalid")
    if width < 1 or height < 1 or width != height:
        raise PipelineError("cover_artwork_not_square")
    return content_type, width, height


def inspect_downloaded_wav(path: Path, record: Mapping[str, Any]) -> tuple[ingest.WavInfo, int]:
    with path.open("rb") as handle:
        prefix = handle.read(8 * 1024 * 1024)
    try:
        wav = ingest.parse_wav_prefix(prefix)
    except ValueError as error:
        raise PipelineError("source_wav_invalid") from error

    if wav.codec not in {"PCM", "IEEE_FLOAT", "EXTENSIBLE"}:
        raise PipelineError("source_wav_codec_unsupported")
    if wav.channels < 1 or wav.channels > 32 or wav.sample_rate < 8_000 or wav.sample_rate > 384_000:
        raise PipelineError("source_wav_shape_invalid")
    if wav.duration_seconds < 30:
        raise PipelineError("source_wav_too_short")

    inspection = record["inspection"]
    references = [
        positive_number((inspection.get("wav") or {}).get("duration_seconds")),
        positive_number((record.get("track") or {}).get("duration_seconds")),
        positive_number(record.get("spotify_duration_seconds")),
    ]
    if any(
        reference is None or abs(wav.duration_seconds - reference) > MAX_EXACT_DURATION_DELTA_SECONDS
        for reference in references
    ):
        raise PipelineError("source_duration_mismatch")
    duration_ms = max(1, round(wav.duration_seconds * 1000))
    return wav, duration_ms


def resolve_ffmpeg(explicit_path: Path | None) -> Path:
    if explicit_path:
        executable = explicit_path.resolve()
    else:
        try:
            import imageio_ffmpeg  # type: ignore[import-not-found]
        except ImportError as error:
            raise PipelineError("imageio_ffmpeg_missing") from error
        executable = Path(imageio_ffmpeg.get_ffmpeg_exe()).resolve()
    if not executable.is_file():
        raise PipelineError("ffmpeg_missing")
    return executable


def validate_ffmpeg(executable: Path) -> None:
    try:
        result = subprocess.run(
            [str(executable), "-hide_banner", "-encoders"],
            capture_output=True,
            check=False,
            timeout=60,
        )
    except (OSError, subprocess.SubprocessError) as error:
        raise PipelineError("ffmpeg_unavailable") from error
    encoders = (result.stdout + result.stderr).decode("utf-8", errors="ignore")
    if result.returncode != 0 or "libmp3lame" not in encoders:
        raise PipelineError("ffmpeg_libmp3lame_missing")


def transcode_mp3(executable: Path, source: Path, destination: Path) -> None:
    command = [
        str(executable),
        "-hide_banner",
        "-nostdin",
        "-loglevel",
        "error",
        "-y",
        "-i",
        str(source),
        "-map",
        "0:a:0",
        "-vn",
        "-sn",
        "-dn",
        "-map_metadata",
        "-1",
        "-map_chapters",
        "-1",
        "-codec:a",
        "libmp3lame",
        "-b:a",
        MP3_BITRATE,
        "-write_xing",
        "1",
        str(destination),
    ]
    try:
        result = subprocess.run(command, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, timeout=3600, check=False)
    except (OSError, subprocess.SubprocessError) as error:
        raise PipelineError("ffmpeg_transcode_failed") from error
    if result.returncode != 0 or not destination.is_file() or destination.stat().st_size < 1:
        raise PipelineError("ffmpeg_transcode_failed")
    if destination.stat().st_size > MAX_DERIVED_ASSET_BYTES:
        raise PipelineError("streaming_copy_too_large")


def parse_ffmpeg_timestamp(value: str) -> float | None:
    match = re.fullmatch(r"(\d+):(\d{2}):(\d{2}(?:\.\d+)?)", value.strip())
    if not match:
        return None
    return int(match.group(1)) * 3600 + int(match.group(2)) * 60 + float(match.group(3))


def probe_audio_duration(executable: Path, source: Path) -> int:
    command = [
        str(executable),
        "-hide_banner",
        "-nostdin",
        "-loglevel",
        "error",
        "-i",
        str(source),
        "-map",
        "0:a:0",
        "-progress",
        "pipe:1",
        "-nostats",
        "-f",
        "null",
        os.devnull,
    ]
    try:
        result = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=3600, check=False)
    except (OSError, subprocess.SubprocessError) as error:
        raise PipelineError("ffmpeg_duration_probe_failed") from error
    if result.returncode != 0:
        raise PipelineError("ffmpeg_duration_probe_failed")
    duration_seconds: float | None = None
    for raw_line in result.stdout.decode("utf-8", errors="ignore").splitlines():
        key, separator, raw_value = raw_line.partition("=")
        if not separator:
            continue
        if key == "out_time_us" and raw_value.isdigit():
            duration_seconds = int(raw_value) / 1_000_000
        elif key == "out_time":
            parsed = parse_ffmpeg_timestamp(raw_value)
            if parsed is not None:
                duration_seconds = parsed
    if duration_seconds is None or duration_seconds <= 0:
        raise PipelineError("ffmpeg_duration_probe_failed")
    return max(1, round(duration_seconds * 1000))


def pcm_peak(fragment: bytes) -> int:
    if len(fragment) % 2:
        fragment = fragment[:-1]
    if not fragment:
        return 0
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", DeprecationWarning)
            import audioop  # type: ignore[deprecated]

        return int(audioop.max(fragment, 2))
    except (ImportError, AttributeError):
        samples = array.array("h")
        samples.frombytes(fragment)
        if sys.byteorder != "little":
            samples.byteswap()
        return max((abs(value) for value in samples), default=0)


def read_exact(handle: BinaryIO, size: int) -> bytes:
    chunks = bytearray()
    while len(chunks) < size:
        chunk = handle.read(size - len(chunks))
        if not chunk:
            break
        chunks.extend(chunk)
    return bytes(chunks)


def generate_peaks(
    executable: Path,
    source: Path,
    *,
    duration_ms: int,
    bins: int = PEAK_BIN_COUNT,
    sample_rate: int = PEAK_SAMPLE_RATE,
) -> list[float]:
    if bins < 1 or sample_rate < 1 or duration_ms < 1:
        raise PipelineError("peaks_configuration_invalid")
    expected_samples = max(bins, round(duration_ms / 1000 * sample_rate))
    command = [
        str(executable),
        "-hide_banner",
        "-nostdin",
        "-loglevel",
        "error",
        "-i",
        str(source),
        "-map",
        "0:a:0",
        "-ac",
        "1",
        "-ar",
        str(sample_rate),
        "-acodec",
        "pcm_s16le",
        "-f",
        "s16le",
        "pipe:1",
    ]
    try:
        process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    except OSError as error:
        raise PipelineError("ffmpeg_peaks_failed") from error
    if process.stdout is None or process.stderr is None:
        process.kill()
        raise PipelineError("ffmpeg_peaks_failed")

    peaks: list[int] = []
    consumed_samples = 0
    try:
        for index in range(bins):
            boundary = round((index + 1) * expected_samples / bins)
            samples_for_bin = max(0, boundary - consumed_samples)
            fragment = read_exact(process.stdout, samples_for_bin * 2)
            consumed_samples += len(fragment) // 2
            peaks.append(pcm_peak(fragment))
        remainder = process.stdout.read()
        if remainder:
            peaks[-1] = max(peaks[-1], pcm_peak(remainder))
        process.stderr.read()
        return_code = process.wait(timeout=60)
    except BaseException:
        process.kill()
        process.wait()
        raise
    finally:
        process.stdout.close()
        process.stderr.close()
    if return_code != 0 or consumed_samples == 0:
        raise PipelineError("ffmpeg_peaks_failed")
    return [round(min(1.0, peak / 32768), 6) for peak in peaks]


def write_peaks_json(path: Path, peaks: Sequence[float], duration_ms: int) -> None:
    payload = {
        "schemaVersion": 1,
        "bins": PEAK_BIN_COUNT,
        "sampleRate": PEAK_SAMPLE_RATE,
        "durationMs": duration_ms,
        "peaks": list(peaks),
    }
    path.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8",
        newline="\n",
    )


def bearer_value(raw_value: str, code: str) -> str:
    value = raw_value.strip()
    if not value or re.search(r"[\r\n]", value):
        raise PipelineError(code)
    return value if value.lower().startswith("bearer ") else f"Bearer {value}"


def retry_after_seconds(headers: Mapping[str, str]) -> float | None:
    raw = str(headers.get("Retry-After") or headers.get("retry-after") or "").strip()
    if not raw:
        return None
    try:
        return min(60.0, max(0.0, float(raw)))
    except ValueError:
        return None


class CatalogApiClient:
    def __init__(
        self,
        base_url: str,
        pipeline_token: str,
        sites_authorization: str,
        *,
        opener: Callable[..., Any] = urllib.request.urlopen,
        sleeper: Callable[[float], None] = time.sleep,
        maximum_attempts: int = 4,
        timeout: int = 300,
    ) -> None:
        parsed = urllib.parse.urlsplit(base_url.strip())
        if parsed.scheme != "https" or not parsed.netloc or parsed.username or parsed.password:
            raise PipelineError("catalog_api_base_url_invalid")
        self.base_url = urllib.parse.urlunsplit((parsed.scheme, parsed.netloc, parsed.path.rstrip("/"), "", ""))
        self.authorization = bearer_value(pipeline_token, "catalog_pipeline_token_missing")
        self.sites_authorization = bearer_value(sites_authorization, "oai_sites_authorization_missing")
        self.opener = opener
        self.sleeper = sleeper
        self.maximum_attempts = maximum_attempts
        self.timeout = timeout

    def _headers(self, content_type: str) -> dict[str, str]:
        return {
            "Authorization": self.authorization,
            "OAI-Sites-Authorization": self.sites_authorization,
            "Content-Type": content_type,
            "Accept": "application/json",
            "User-Agent": "SymbiomeCatalogPipeline/1.0",
        }

    def _decode_response(self, response: Any) -> dict[str, Any]:
        try:
            payload = json.loads(response.read().decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise PipelineError("api_response_invalid") from error
        if not isinstance(payload, dict):
            raise PipelineError("api_response_invalid")
        return payload

    @staticmethod
    def _provider_error_code(error: urllib.error.HTTPError) -> str:
        try:
            payload = json.loads(error.read(16 * 1024).decode("utf-8"))
            code = payload.get("error", {}).get("code") if isinstance(payload, dict) else ""
            return sanitize_error_code(code) if isinstance(code, str) else ""
        except (UnicodeDecodeError, json.JSONDecodeError, AttributeError):
            return ""

    def _request_json(self, request_factory: Callable[[], urllib.request.Request]) -> dict[str, Any]:
        for attempt in range(1, self.maximum_attempts + 1):
            request = request_factory()
            try:
                with self.opener(request, timeout=self.timeout) as response:
                    raw_status = getattr(response, "status", None)
                    status = int(raw_status if raw_status is not None else response.getcode())
                    if status < 200 or status >= 300:
                        raise ApiHttpError(status)
                    return self._decode_response(response)
            except urllib.error.HTTPError as error:
                api_error = ApiHttpError(error.code, self._provider_error_code(error))
                if not api_error.retryable or attempt >= self.maximum_attempts:
                    raise api_error from error
                delay = retry_after_seconds(error.headers) or min(2 ** (attempt - 1), 8)
            except (OSError, urllib.error.URLError) as error:
                if attempt >= self.maximum_attempts:
                    raise PipelineError("api_network_failed", retryable=True) from error
                delay = min(2 ** (attempt - 1), 8)
            finally:
                body = getattr(request, "data", None)
                if hasattr(body, "close"):
                    with contextlib.suppress(Exception):
                        body.close()
            self.sleeper(delay)
        raise PipelineError("api_request_failed")

    def post_json(self, path: str, payload: Mapping[str, Any]) -> dict[str, Any]:
        body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        url = f"{self.base_url}{path}"

        def request_factory() -> urllib.request.Request:
            headers = self._headers("application/json")
            headers["Content-Length"] = str(len(body))
            return urllib.request.Request(url, data=body, headers=headers, method="POST")

        return self._request_json(request_factory)

    def ingest_metadata(
        self,
        batch_key: str,
        source_key: str,
        record: Mapping[str, Any],
        source_sha256: str,
        duration_ms: int,
        rights_cleared: bool,
        human_made_cleared: bool,
    ) -> tuple[int, int]:
        payload = {
            "batchKey": batch_key,
            "items": [
                metadata_item(
                    source_key,
                    record,
                    source_sha256,
                    duration_ms,
                    rights_cleared,
                    human_made_cleared,
                )
            ],
        }
        response = self.post_json("/api/catalog/ingest/batch", payload)
        items = response.get("items")
        if not isinstance(items, list) or len(items) != 1 or not isinstance(items[0], dict):
            raise PipelineError("metadata_response_invalid")
        ingest_id = positive_integer(items[0].get("ingestId"))
        track_id = positive_integer(items[0].get("trackId"))
        if ingest_id is None or track_id is None:
            raise PipelineError("metadata_ingest_in_progress", retryable=True)
        return ingest_id, track_id

    def ingest_source_master(
        self,
        *,
        track_id: int,
        batch_key: str,
        source_key: str,
        drive_file_id: str,
        source_file_name: str,
        expected_byte_size: int,
        expected_sha256: str,
        duration_ms: int,
    ) -> dict[str, Any]:
        response = self.post_json(
            "/api/catalog/ingest/asset",
            {
                # This older endpoint parses references as strings even though
                # the batch endpoint returns numeric identifiers.
                "trackId": str(track_id),
                "batchKey": batch_key,
                "sourceKey": source_key,
                "driveFileId": drive_file_id,
                "sourceFileName": source_file_name,
                "assetKind": "source_master",
                "expectedByteSize": expected_byte_size,
                "expectedContentType": "audio/wav",
                "expectedSha256": expected_sha256,
                "durationMs": duration_ms,
            },
        )
        asset = response.get("asset")
        if not isinstance(asset, dict) or asset.get("status") != "available":
            raise PipelineError("source_master_ingest_in_progress", retryable=True)
        return response

    def upload_asset(
        self,
        path: Path,
        *,
        track_id: int,
        batch_key: str,
        source_key: str,
        kind: str,
        content_type: str,
        sha256: str,
        duration_ms: int | None,
        source_sha256: str | None = None,
    ) -> dict[str, Any]:
        size = path.stat().st_size
        if size < 1 or size > MAX_DERIVED_ASSET_BYTES:
            raise PipelineError("derived_asset_size_invalid")
        query = urllib.parse.urlencode(
            {
                "trackId": track_id,
                "batchKey": batch_key,
                "sourceKey": source_key,
                "kind": kind,
            }
        )
        url = f"{self.base_url}/api/catalog/pipeline/assets?{query}"

        # Derived assets are bounded to 20 MiB by the backend contract.  Bytes
        # avoid urllib's ambiguous treatment of file iterators (line chunks)
        # and make every retry send the complete identical body.
        body = path.read_bytes()
        if len(body) != size:
            raise PipelineError("derived_asset_read_failed")

        def request_factory() -> urllib.request.Request:
            headers = self._headers(content_type)
            headers.update(
                {
                    "Content-Length": str(size),
                    "X-Content-Sha256": sha256,
                }
            )
            if duration_ms is not None:
                headers["X-Duration-Ms"] = str(duration_ms)
            if source_sha256 is not None:
                if not SHA256_PATTERN.fullmatch(source_sha256):
                    raise PipelineError("source_sha256_invalid")
                headers["X-Source-Sha256"] = source_sha256
            return urllib.request.Request(url, data=body, headers=headers, method="PUT")

        return self._request_json(request_factory)

    def promote(
        self,
        *,
        track_id: int,
        batch_key: str,
        source_key: str,
        source_sha256: str,
        measured_duration_ms: int,
    ) -> dict[str, Any]:
        return self.post_json(
            "/api/catalog/pipeline/promote",
            {
                "trackId": track_id,
                "batchKey": batch_key,
                "sourceKey": source_key,
                "sourceSha256": source_sha256,
                "measuredDurationMs": measured_duration_ms,
            },
        )


def metadata_item(
    source_key: str,
    record: Mapping[str, Any],
    source_sha256: str,
    duration_ms: int,
    rights_cleared: bool,
    human_made_cleared: bool,
) -> dict[str, Any]:
    track = record["track"]
    evidence = record.get("_spotify_evidence")
    if not isinstance(evidence, dict):
        raise PipelineError("accepted_spotify_enrichment_missing")
    artists = [str(item).strip() for item in evidence.get("artists", []) if str(item).strip()]
    if not artists:
        raise PipelineError("accepted_spotify_enrichment_invalid")
    artist_credit = " & ".join(artists)
    release_type = str(track.get("release_type") or "other").strip().lower()
    if release_type not in {"single", "ep", "album", "compilation", "other"}:
        release_type = "other"
    # Publication authority is never inferred from catalogue membership.  The
    # apply command requires an explicit operator acknowledgement and records
    # it in the private resumable state.
    rights_status = "cleared" if rights_cleared else "pending"
    ai_review_status = "cleared" if human_made_cleared else "pending"

    spotify_id = str(evidence.get("track_id") or "").strip()
    spotify_duration_ms = positive_integer(evidence.get("duration_ms"))
    spotify_title = require_text(evidence.get("title"), "accepted_spotify_enrichment_invalid", 500)
    album_title = require_text(evidence.get("album_title"), "accepted_spotify_enrichment_invalid", 500)
    if not SPOTIFY_ID_PATTERN.fullmatch(spotify_id) or spotify_duration_ms is None:
        raise PipelineError("accepted_spotify_enrichment_invalid")
    spotify = {
        "trackId": spotify_id,
        # Official oEmbed/Embed does not expose an album ID.  The backend's
        # orchard_uri policy verifies the exact Orchard UPC/release join and
        # deliberately permits null rather than accepting an invented ID.
        "albumId": None,
        "title": spotify_title,
        "artistCredit": artist_credit,
        "albumTitle": album_title,
        "isrc": str(track.get("isrc") or "").strip() or None,
        "durationMs": spotify_duration_ms,
        "coverSourceUrl": evidence.get("cover_source_url"),
        "method": "orchard_uri",
        "score": 10_000,
        "status": "verified",
    }

    return {
        "sourceKey": source_key,
        "sourceFileName": record["audio"]["name"],
        "sourceRowNumber": positive_integer(track.get("source_row")),
        "sourceSha256": source_sha256,
        "title": spotify_title,
        "artist": artists[0],
        "artistCredit": artist_credit,
        "releaseTitle": track["release"],
        "releaseType": release_type,
        "upc": str(track.get("upc") or "").strip() or None,
        "releaseDate": track.get("release_date") or None,
        "versionLabel": track.get("version_label") or None,
        "isrc": str(track.get("isrc") or "").strip() or None,
        "discNumber": positive_integer(track.get("disc_number")) or 1,
        "trackNumber": positive_integer(track.get("track_number")),
        "durationMs": duration_ms,
        "genre": str(track.get("genre") or "").strip() or None,
        "mood": str(track.get("mood") or "").strip() or None,
        "theme": str(track.get("theme") or "").strip() or None,
        "rightsStatus": rights_status,
        "aiReviewStatus": ai_review_status,
        "catalogStatus": "ready",
        "spotify": spotify,
    }


def promotion_succeeded(payload: Mapping[str, Any]) -> bool:
    if payload.get("published") is True or payload.get("status") == "published":
        return True
    track = payload.get("track")
    return isinstance(track, dict) and track.get("status") == "published"


def try_promote(
    connection: sqlite3.Connection,
    api: CatalogApiClient,
    row: sqlite3.Row,
) -> str:
    try:
        response = api.promote(
            track_id=int(row["track_id"]),
            batch_key=str(row["batch_key"]),
            source_key=str(row["candidate_id"]),
            source_sha256=str(row["source_sha256"]),
            measured_duration_ms=int(row["measured_duration_ms"]),
        )
    except ApiHttpError as error:
        if error.status in {409, 422}:
            update_state(
                connection,
                row["candidate_id"],
                status="promotion_blocked",
                last_error_code=error.code,
            )
            return "promotion_blocked"
        raise
    status = "published" if promotion_succeeded(response) else "promotion_blocked"
    update_state(
        connection,
        row["candidate_id"],
        status=status,
        last_error_code=None if status == "published" else "promotion_gate_not_satisfied",
    )
    return status


def process_record(
    connection: sqlite3.Connection,
    record: Mapping[str, Any],
    batch_key: str,
    downloader: DriveDownloader,
    api: CatalogApiClient,
    ffmpeg: Path,
    *,
    rights_cleared: bool,
    human_made_cleared: bool,
    temporary_root: Path | None = None,
) -> str:
    row = ensure_state_row(
        connection,
        record,
        batch_key,
        rights_cleared,
        human_made_cleared,
    )
    candidate_id = record["candidate_id"]
    if row["status"] == "published":
        return "already_published"
    if (
        row["metadata_uploaded"]
        and row["master_uploaded"]
        and row["streaming_uploaded"]
        and row["peaks_uploaded"]
        and row["cover_uploaded"]
    ):
        return try_promote(connection, api, row)

    row = update_state(
        connection,
        candidate_id,
        status="processing",
        attempts=int(row["attempts"]) + 1,
        last_error_code=None,
    )
    expected_sha256 = str(record["inspection"]["sha256"]).lower()
    expected_size = positive_integer(record["inspection"].get("content_length"))

    try:
        with tempfile.TemporaryDirectory(prefix="symbiome-catalog-", dir=temporary_root) as temporary:
            directory = Path(temporary)
            source_path = directory / "source.wav"
            streaming_path = directory / "stream.mp3"
            peaks_path = directory / "peaks.json"
            cover_path = directory / "cover.bin"

            source_sha256, source_size = downloader.download(
                record["audio"]["file_id"],
                source_path,
                expected_sha256=expected_sha256,
                expected_size=expected_size,
            )
            _wav, source_duration_ms = inspect_downloaded_wav(source_path, record)
            transcode_mp3(ffmpeg, source_path, streaming_path)
            streaming_duration_ms = probe_audio_duration(ffmpeg, streaming_path)
            if abs(streaming_duration_ms - source_duration_ms) > round(MAX_EXACT_DURATION_DELTA_SECONDS * 1000):
                raise PipelineError("streaming_duration_mismatch")
            peaks = generate_peaks(ffmpeg, source_path, duration_ms=source_duration_ms)
            if len(peaks) != PEAK_BIN_COUNT:
                raise PipelineError("peaks_bin_count_invalid")
            write_peaks_json(peaks_path, peaks, source_duration_ms)

            cover_sha256, cover_size = downloader.download(
                record["cover"]["file_id"],
                cover_path,
                expected_sha256=None,
                expected_size=None,
                maximum_bytes=MAX_DERIVED_ASSET_BYTES,
            )
            cover_type, _cover_width, _cover_height = inspect_cover_artwork(cover_path)

            streaming_sha256, streaming_size = sha256_file(streaming_path)
            peaks_sha256, peaks_size = sha256_file(peaks_path)
            row = update_state(
                connection,
                candidate_id,
                source_sha256=source_sha256,
                measured_duration_ms=source_duration_ms,
                streaming_sha256=streaming_sha256,
                streaming_byte_size=streaming_size,
                streaming_duration_ms=streaming_duration_ms,
                peaks_sha256=peaks_sha256,
                peaks_byte_size=peaks_size,
                cover_sha256=cover_sha256,
                cover_byte_size=cover_size,
                cover_content_type=cover_type,
            )

            if not row["metadata_uploaded"]:
                ingest_id, track_id = api.ingest_metadata(
                    batch_key,
                    candidate_id,
                    record,
                    source_sha256,
                    source_duration_ms,
                    rights_cleared,
                    human_made_cleared,
                )
                row = update_state(
                    connection,
                    candidate_id,
                    ingest_id=ingest_id,
                    track_id=track_id,
                    metadata_uploaded=1,
                    status="metadata_uploaded",
                )

            if not row["master_uploaded"]:
                api.ingest_source_master(
                    track_id=int(row["track_id"]),
                    batch_key=batch_key,
                    source_key=candidate_id,
                    drive_file_id=record["audio"]["file_id"],
                    source_file_name=record["audio"]["name"],
                    expected_byte_size=source_size,
                    expected_sha256=source_sha256,
                    duration_ms=source_duration_ms,
                )
                row = update_state(
                    connection,
                    candidate_id,
                    master_uploaded=1,
                    status="master_uploaded",
                )

            if not row["streaming_uploaded"]:
                api.upload_asset(
                    streaming_path,
                    track_id=int(row["track_id"]),
                    batch_key=batch_key,
                    source_key=candidate_id,
                    kind="streaming_copy",
                    content_type="audio/mpeg",
                    sha256=streaming_sha256,
                    duration_ms=streaming_duration_ms,
                    source_sha256=source_sha256,
                )
                row = update_state(
                    connection,
                    candidate_id,
                    streaming_uploaded=1,
                    status="streaming_uploaded",
                )

            if not row["peaks_uploaded"]:
                api.upload_asset(
                    peaks_path,
                    track_id=int(row["track_id"]),
                    batch_key=batch_key,
                    source_key=candidate_id,
                    kind="waveform_peaks",
                    content_type="application/json",
                    sha256=peaks_sha256,
                    duration_ms=source_duration_ms,
                    source_sha256=source_sha256,
                )
                row = update_state(
                    connection,
                    candidate_id,
                    peaks_uploaded=1,
                    status="assets_uploaded",
                )

            if not row["cover_uploaded"]:
                api.upload_asset(
                    cover_path,
                    track_id=int(row["track_id"]),
                    batch_key=batch_key,
                    source_key=candidate_id,
                    kind="cover_artwork",
                    content_type=cover_type,
                    sha256=cover_sha256,
                    duration_ms=None,
                )
                row = update_state(
                    connection,
                    candidate_id,
                    cover_uploaded=1,
                    status="assets_uploaded",
                )
    except PipelineError as error:
        update_state(
            connection,
            candidate_id,
            status="failed",
            last_error_code=error.code,
        )
        raise
    except Exception as error:
        update_state(
            connection,
            candidate_id,
            status="failed",
            last_error_code="unexpected_processing_failure",
        )
        raise PipelineError("unexpected_processing_failure") from error

    return try_promote(connection, api, row)


def derive_batch_key(_exact_manifest: Path, requested: str | None) -> str:
    if requested:
        value = requested.strip()
        if not re.fullmatch(r"[\w][\w.:-]{0,159}", value, flags=re.UNICODE):
            raise PipelineError("batch_key_invalid")
        return value
    # The candidate_id is already the stable per-item source key.  A manifest
    # hash would change whenever the next qualified row is appended and would
    # force thousands of completed checkpoints into a new backend batch.
    return DEFAULT_BATCH_KEY


def read_spotify_enrichment_records(path: Path) -> list[dict[str, Any]]:
    assert_private_artifact_path(path, "spotify_enrichment")
    if not path.is_file():
        raise PipelineError("spotify_enrichment_missing")
    try:
        payload = json.loads(path.read_text(encoding="utf-8-sig"))
    except (OSError, json.JSONDecodeError) as error:
        raise PipelineError("spotify_enrichment_invalid") from error
    records = payload.get("records") if isinstance(payload, dict) else None
    if not isinstance(records, list) or not all(isinstance(record, dict) for record in records):
        raise PipelineError("spotify_enrichment_invalid")
    return records


def load_spotify_enrichment(path: Path, limit: int | None = None) -> tuple[dict[str, dict[str, Any]], dict[str, int]]:
    records = read_spotify_enrichment_records(path)

    metadata: dict[str, dict[str, Any]] = {}
    ambiguous: set[str] = set()
    counts = {"records": len(records), "accepted": 0, "eligible": 0, "ambiguous": 0}
    for record in records:
        if not isinstance(record, dict) or record.get("disposition") != "accepted":
            continue
        counts["accepted"] += 1
        spotify_id = str(record.get("spotifyId") or "").strip()
        spotify = record.get("spotify")
        duration_ms = positive_integer(spotify.get("durationMs")) if isinstance(spotify, dict) else None
        if not SPOTIFY_ID_PATTERN.fullmatch(spotify_id) or duration_ms is None:
            continue
        previous = metadata.get(spotify_id)
        if previous and previous["duration_ms"] != duration_ms:
            ambiguous.add(spotify_id)
            metadata.pop(spotify_id, None)
            continue
        if spotify_id not in ambiguous:
            metadata[spotify_id] = {"duration_ms": duration_ms}
    for spotify_id in ambiguous:
        metadata.pop(spotify_id, None)
    counts["ambiguous"] = len(ambiguous)
    if limit is not None:
        metadata = dict(list(sorted(metadata.items()))[:limit])
    counts["eligible"] = len(metadata)
    return metadata, counts


def attach_verified_spotify_evidence(
    records: Sequence[dict[str, Any]],
    enrichment_path: Path,
) -> dict[str, int]:
    """Attach only accepted official evidence to its original exact row.

    Association is by the private candidate fingerprint, then independently
    checked against Spotify ID, full WAV hash and the local Orchard join.  A
    positional or Spotify-ID-only merge could otherwise attach a valid result
    to the wrong catalogue row when an export contains duplicates.
    """

    enriched_records = read_spotify_enrichment_records(enrichment_path)
    accepted: dict[str, dict[str, Any]] = {}
    ambiguous: set[str] = set()
    for enriched in enriched_records:
        if enriched.get("disposition") != "accepted":
            continue
        candidate_id = str(enriched.get("recordKey") or "").strip()
        if not CANDIDATE_ID_PATTERN.fullmatch(candidate_id):
            continue
        if candidate_id in accepted:
            ambiguous.add(candidate_id)
            accepted.pop(candidate_id, None)
            continue
        accepted[candidate_id] = enriched
    for candidate_id in ambiguous:
        accepted.pop(candidate_id, None)

    attached = 0
    for record in records:
        candidate_id = record["candidate_id"]
        enriched = accepted.get(candidate_id)
        if enriched is None:
            raise PipelineError("accepted_spotify_enrichment_missing")
        spotify = enriched.get("spotify")
        local = enriched.get("local")
        checks = enriched.get("checks")
        if not all(isinstance(item, dict) for item in (spotify, local, checks)):
            raise PipelineError("accepted_spotify_enrichment_invalid")

        spotify_id = str(enriched.get("spotifyId") or "").strip()
        spotify_title = str(spotify.get("title") or "").strip()
        spotify_artists = spotify.get("artists")
        spotify_duration_ms = positive_integer(spotify.get("durationMs"))
        source_sha256 = str(local.get("sourceSha256") or "").strip().lower()
        sources = spotify.get("sources")
        title_check = checks.get("title")
        artists_check = checks.get("artists")
        duration_check = checks.get("duration")
        if (
            spotify_id != str(record.get("spotify_id") or "").strip()
            or not SPOTIFY_ID_PATTERN.fullmatch(spotify_id)
            or not spotify_title
            or not isinstance(spotify_artists, list)
            or not spotify_artists
            or not all(isinstance(artist, str) and artist.strip() for artist in spotify_artists)
            or spotify_duration_ms is None
            or local.get("audioInspectionComplete") is not True
            or source_sha256 != str(record["inspection"]["sha256"]).lower()
            or str(local.get("upc") or "").strip() != str(record["track"].get("upc") or "").strip()
            or ingest.normalize_text(local.get("releaseTitle")) != ingest.normalize_text(record["track"]["release"])
            or not isinstance(sources, dict)
            or sources.get("oembed") != "ok"
            or sources.get("embed") != "ok"
            or not isinstance(title_check, dict)
            or title_check.get("status") != "exact"
            or not isinstance(artists_check, dict)
            or artists_check.get("status") != "exact"
            or not isinstance(duration_check, dict)
            or duration_check.get("status") != "match"
            or abs(spotify_duration_ms / 1000 - float(record["spotify_duration_seconds"]))
            > MAX_EXACT_DURATION_DELTA_SECONDS
        ):
            raise PipelineError("accepted_spotify_enrichment_mismatch")

        record["_spotify_evidence"] = {
            "track_id": spotify_id,
            "title": spotify_title,
            "artists": [str(artist).strip() for artist in spotify_artists],
            "duration_ms": spotify_duration_ms,
            # Album identity is the independently exact Orchard UPC/release
            # join, not a fabricated Spotify album identifier.
            "album_title": str(record["track"]["release"]).strip(),
            "cover_source_url": None,
        }
        attached += 1
    return {
        "records": len(records),
        "acceptedCandidates": len(accepted),
        "attached": attached,
        "ambiguous": len(ambiguous),
    }


def merge_spotify_metadata(arguments: argparse.Namespace) -> int:
    metadata, enrichment_counts = load_spotify_enrichment(arguments.spotify_enrichment, arguments.limit)
    if not arguments.apply:
        matched_candidates = 0
        if arguments.ingestion_state.is_file():
            connection = sqlite3.connect(
                f"file:{arguments.ingestion_state.resolve().as_posix()}?mode=ro",
                uri=True,
            )
            try:
                for spotify_id in metadata:
                    matched_candidates += int(
                        connection.execute(
                            "SELECT COUNT(*) FROM candidates WHERE json_extract(payload_json, '$.spotify_id') = ?",
                            (spotify_id,),
                        ).fetchone()[0]
                    )
            finally:
                connection.close()
        emit_aggregate(
            {
                "mode": "dry-run",
                "step": "merge_spotify_metadata",
                "enrichment": enrichment_counts,
                "matchedCandidates": matched_candidates,
            }
        )
        return 0

    assert_private_artifact_path(arguments.ingestion_state, "ingestion_state")
    if not arguments.ingestion_state.is_file():
        raise PipelineError("ingestion_state_missing")
    connection = sqlite3.connect(arguments.ingestion_state)
    connection.row_factory = sqlite3.Row
    try:
        merged = ingest.apply_spotify_metadata(connection, metadata)
        manifest_counts = ingest.export_private_manifests(connection, arguments.ingestion_state.parent)
    finally:
        connection.close()
    emit_aggregate(
        {
            "mode": "apply",
            "step": "merge_spotify_metadata",
            "enrichment": enrichment_counts,
            "merge": merged,
            "manifest": manifest_counts,
        }
    )
    return 0


def process_exact_catalog(arguments: argparse.Namespace) -> int:
    records = load_exact_manifest(arguments.exact_manifest)
    selected_records = records[: arguments.limit] if arguments.limit is not None else records
    enrichment_counts = attach_verified_spotify_evidence(selected_records, arguments.spotify_enrichment)
    batch_key = derive_batch_key(arguments.exact_manifest, arguments.batch_key)
    if not arguments.apply:
        existing_counts: dict[str, int] = {}
        if arguments.pipeline_state.is_file():
            connection = sqlite3.connect(
                f"file:{arguments.pipeline_state.resolve().as_posix()}?mode=ro",
                uri=True,
            )
            connection.row_factory = sqlite3.Row
            try:
                existing_counts = state_counts(connection)
            finally:
                connection.close()
        emit_aggregate(
            {
                "mode": "dry-run",
                "step": "process",
                "exactRecords": len(records),
                "selected": len(selected_records),
                "spotifyEnrichment": enrichment_counts,
                "rightsClearanceAcknowledged": bool(arguments.rights_cleared),
                "humanMadeClearanceAcknowledged": bool(arguments.human_made_cleared),
                "pipelineState": existing_counts,
            }
        )
        return 0

    if not arguments.rights_cleared:
        raise PipelineError("rights_clearance_ack_required")
    if not arguments.human_made_cleared:
        raise PipelineError("human_made_clearance_ack_required")
    pipeline_token = os.environ.get("CATALOG_PIPELINE_TOKEN", "")
    sites_authorization = os.environ.get("OAI_SITES_AUTHORIZATION", "")
    base_url = arguments.base_url or os.environ.get("CATALOG_API_BASE_URL") or DEFAULT_API_BASE_URL
    ffmpeg = resolve_ffmpeg(arguments.ffmpeg)
    validate_ffmpeg(ffmpeg)
    temporary_volume = arguments.temporary_root or Path(tempfile.gettempdir())
    if shutil.disk_usage(temporary_volume).free < MIN_TEMP_FREE_BYTES:
        raise PipelineError("temporary_disk_space_insufficient")
    downloader = DriveDownloader(os.environ.get("GOOGLE_DRIVE_ACCESS_TOKEN"))
    api = CatalogApiClient(base_url, pipeline_token, sites_authorization, timeout=arguments.timeout)
    connection = open_pipeline_state(arguments.pipeline_state)
    counts = {
        "selected": len(selected_records),
        "published": 0,
        "already_published": 0,
        "promotion_blocked": 0,
        "failed": 0,
    }
    try:
        for index, record in enumerate(selected_records, start=1):
            try:
                outcome = process_record(
                    connection,
                    record,
                    batch_key,
                    downloader,
                    api,
                    ffmpeg,
                    rights_cleared=True,
                    human_made_cleared=True,
                    temporary_root=arguments.temporary_root,
                )
                counts[outcome] = counts.get(outcome, 0) + 1
            except PipelineError as error:
                counts["failed"] += 1
                if (
                    isinstance(error, ApiHttpError)
                    and error.status in {400, 401, 403, 404, 405}
                ) or (error.retryable and error.code.startswith("api_")):
                    raise
            if index % 25 == 0:
                emit_aggregate({"mode": "apply", "step": "process", "progress": index, "counts": counts})
        final_state = state_counts(connection)
    finally:
        connection.close()
    emit_aggregate({"mode": "apply", "step": "process", "counts": counts, "pipelineState": final_state})
    return 0 if counts["failed"] == 0 and counts["promotion_blocked"] == 0 else 2


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.ArgumentDefaultsHelpFormatter)
    parser.add_argument("--step", choices=("process", "merge_spotify_metadata"), default="process")
    parser.add_argument("--exact-manifest", type=Path, default=DEFAULT_EXACT_MANIFEST)
    parser.add_argument("--ingestion-state", type=Path, default=DEFAULT_INGESTION_STATE)
    parser.add_argument("--pipeline-state", type=Path, default=DEFAULT_PIPELINE_STATE)
    parser.add_argument("--spotify-enrichment", type=Path, default=DEFAULT_SPOTIFY_ENRICHMENT)
    parser.add_argument("--base-url", help="HTTPS catalogue backend origin; defaults to CATALOG_API_BASE_URL.")
    parser.add_argument("--batch-key", help="Stable backend batch key; derived from exact.jsonl by default.")
    parser.add_argument("--ffmpeg", type=Path, help="Full FFmpeg executable; imageio-ffmpeg is used by default.")
    parser.add_argument("--temporary-root", type=Path, help="Optional volume for the one-track temporary workspace.")
    parser.add_argument("--timeout", type=int, default=300, help="Backend request timeout in seconds.")
    parser.add_argument("--limit", type=int, help="Maximum exact/enrichment records selected in this invocation.")
    parser.add_argument(
        "--rights-cleared",
        action="store_true",
        help="Explicitly attest that every selected exact track is cleared for Symbiome publication (required with --apply).",
    )
    parser.add_argument(
        "--human-made-cleared",
        action="store_true",
        help="Explicitly attest that every selected track passed human-made/editorial review (required with --apply).",
    )
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--apply", action="store_true", help="Write state, transfer assets and request promotion.")
    mode.add_argument("--dry-run", action="store_true", help="Print an aggregate plan without writes or network calls (default).")
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    arguments = build_parser().parse_args(argv)
    if arguments.limit is not None and arguments.limit < 1:
        raise PipelineError("limit_invalid")
    if arguments.timeout < 1 or arguments.timeout > 3600:
        raise PipelineError("timeout_invalid")
    arguments.apply = bool(arguments.apply)
    arguments.exact_manifest = arguments.exact_manifest.resolve()
    arguments.ingestion_state = arguments.ingestion_state.resolve()
    arguments.pipeline_state = arguments.pipeline_state.resolve()
    arguments.spotify_enrichment = arguments.spotify_enrichment.resolve()
    if arguments.temporary_root:
        arguments.temporary_root = arguments.temporary_root.resolve()
        if not arguments.temporary_root.is_dir():
            raise PipelineError("temporary_root_missing")
    if arguments.step == "merge_spotify_metadata":
        return merge_spotify_metadata(arguments)
    return process_exact_catalog(arguments)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        emit_aggregate({"status": "interrupted", "resume": True})
        raise SystemExit(130)
    except PipelineError as error:
        emit_aggregate({"status": "failed", "error": error.code})
        raise SystemExit(1)
    except Exception as error:
        emit_aggregate({"status": "failed", "error": sanitize_error_code(type(error).__name__)})
        raise SystemExit(1)

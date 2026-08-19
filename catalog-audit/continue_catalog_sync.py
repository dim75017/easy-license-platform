#!/usr/bin/env python3
"""Continue the private Drive catalogue audit in small, resumable batches.

This is an orchestration layer around ``ingest_catalog.py``,
``enrich-spotify-metadata.mjs`` and ``process_catalog.py``.  It keeps every
row-level artefact below an ignored private directory and emits aggregate JSON
only.  Publication is impossible unless two explicit, selection-bound evidence
files are present and the operator deliberately chooses ``--mode publish``.
"""

from __future__ import annotations

import argparse
import contextlib
import datetime as dt
import hashlib
import importlib
import io
import json
import os
from pathlib import Path
import re
import shutil
import sqlite3
import subprocess
import sys
import tempfile
from typing import Any, Iterable, Mapping, Sequence
import urllib.error
import urllib.parse
import urllib.request

import ingest_catalog as ingest
import process_catalog as process


AUDIT_DIRECTORY = Path(__file__).resolve().parent
REPOSITORY_ROOT = AUDIT_DIRECTORY.parent
DEFAULT_CONFIG = AUDIT_DIRECTORY / "private" / "drive-sync" / "config.json"
SHA256_PATTERN = re.compile(r"^[a-f0-9]{64}$")
MAX_INSPECTION_BATCH = 25
MAX_SPOTIFY_BATCH = 50
MAX_PUBLICATION_BATCH = 5
MAX_RELEASE_BATCH = 10
MAX_RUN_MINUTES = 60
MAX_INVENTORY_RELEASE_BATCH = 50
MAX_WORKBOOK_BYTES = 50 * 1024 * 1024


class SyncError(RuntimeError):
    """A stable error code safe to expose in aggregate output."""

    def __init__(self, code: str) -> None:
        self.code = re.sub(r"[^a-z0-9_]+", "_", str(code).casefold()).strip("_")[:100] or "sync_failed"
        super().__init__(self.code)


def utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat()


def atomic_write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    handle, temporary_name = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    temporary = Path(temporary_name)
    try:
        with os.fdopen(handle, "w", encoding="utf-8", newline="\n") as stream:
            stream.write(text)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        with contextlib.suppress(FileNotFoundError):
            temporary.unlink()


def atomic_write_json(path: Path, value: object) -> None:
    atomic_write_text(path, json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n")


def atomic_write_bytes(path: Path, payload: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    handle, temporary_name = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    temporary = Path(temporary_name)
    try:
        with os.fdopen(handle, "wb") as stream:
            stream.write(payload)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        with contextlib.suppress(FileNotFoundError):
            temporary.unlink()


def assert_private_path(path: Path, label: str) -> Path:
    resolved = path.resolve()
    try:
        relative = resolved.relative_to(REPOSITORY_ROOT)
    except ValueError:
        return resolved
    if relative.parts[:2] != ("catalog-audit", "private"):
        raise SyncError(f"{label}_must_be_private")
    return resolved


def resolve_config_path(value: object, *, base: Path, label: str) -> Path:
    raw = str(value or "").strip()
    if not raw:
        raise SyncError(f"{label}_missing")
    path = Path(raw)
    if not path.is_absolute():
        path = (base / path).resolve()
    return assert_private_path(path, label)


def bounded_integer(config: Mapping[str, Any], key: str, default: int, maximum: int) -> int:
    try:
        value = int(config.get(key, default))
    except (TypeError, ValueError) as error:
        raise SyncError(f"{key}_invalid") from error
    if value < 1 or value > maximum:
        raise SyncError(f"{key}_out_of_bounds")
    return value


def load_config(path: Path) -> dict[str, Any]:
    path = assert_private_path(path, "config")
    if not path.is_file():
        raise SyncError("config_missing")
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise SyncError("config_invalid") from error
    if not isinstance(payload, dict) or payload.get("schemaVersion") != 1:
        raise SyncError("config_schema_invalid")
    base = REPOSITORY_ROOT
    work_directory = resolve_config_path(payload.get("workDirectory"), base=base, label="work_directory")
    workbook = resolve_config_path(payload.get("workbook"), base=base, label="workbook")
    orchard = (
        resolve_config_path(payload.get("orchard"), base=base, label="orchard")
        if payload.get("orchard")
        else None
    )
    if not workbook.is_file():
        raise SyncError("workbook_missing")
    if orchard is not None and not orchard.is_file():
        orchard = None
    workbook_source_url = str(payload.get("workbookSourceUrl") or "").strip()
    if not workbook_source_url:
        raise SyncError("workbook_source_url_missing")
    drive_seed = resolve_config_path(
        payload.get("driveSeed") or "catalog-audit/private/lofi-drive-release-seed.json",
        base=base,
        label="drive_seed",
    )
    if not drive_seed.is_file():
        raise SyncError("drive_seed_missing")
    inventory_directory = resolve_config_path(
        payload.get("driveInventoryDirectory") or "catalog-audit/private/lofi-drive-sync",
        base=base,
        label="drive_inventory_directory",
    )
    ffmpeg_executable = (
        resolve_config_path(
            payload["ffmpegExecutable"],
            base=base,
            label="ffmpeg_executable",
        )
        if payload.get("ffmpegExecutable")
        else None
    )
    if ffmpeg_executable is not None and not ffmpeg_executable.is_file():
        raise SyncError("ffmpeg_executable_missing")
    return {
        "work_directory": work_directory,
        "workbook": workbook,
        "orchard": orchard,
        "workbook_source_url": workbook_source_url,
        "drive_seed": drive_seed,
        "inventory_directory": inventory_directory,
        "ffmpeg_executable": ffmpeg_executable,
        "inventory_release_batch": bounded_integer(
            payload, "driveInventoryReleasesPerRun", 25, MAX_INVENTORY_RELEASE_BATCH
        ),
        "inspection_batch": bounded_integer(payload, "inspectionBatchSize", 15, MAX_INSPECTION_BATCH),
        "spotify_batch": bounded_integer(payload, "spotifyBatchSize", 50, MAX_SPOTIFY_BATCH),
        "publication_batch": bounded_integer(payload, "publicationBatchSize", 3, MAX_PUBLICATION_BATCH),
        "release_batch": bounded_integer(payload, "maximumReleasesPerRun", 2, MAX_RELEASE_BATCH),
        "maximum_run_minutes": bounded_integer(payload, "maximumRunMinutes", 45, MAX_RUN_MINUTES),
        "rights_evidence": resolve_config_path(payload["rightsEvidence"], base=base, label="rights_evidence")
        if payload.get("rightsEvidence")
        else None,
        "human_evidence": resolve_config_path(payload["humanMadeEvidence"], base=base, label="human_evidence")
        if payload.get("humanMadeEvidence")
        else None,
    }


def google_sheet_export_url(value: str) -> str:
    try:
        parsed = urllib.parse.urlparse(value.strip())
    except ValueError as error:
        raise SyncError("workbook_source_url_invalid") from error
    if parsed.scheme != "https" or parsed.hostname != "docs.google.com":
        raise SyncError("workbook_source_url_invalid")
    match = re.fullmatch(r"/spreadsheets/d/([A-Za-z0-9_-]{15,200})(?:/.*)?", parsed.path)
    if not match:
        raise SyncError("workbook_source_url_invalid")
    identifier = match.group(1)
    return f"https://docs.google.com/spreadsheets/d/{identifier}/export?format=xlsx"


def refresh_workbook(
    source_url: str,
    destination: Path,
    *,
    opener: Any = urllib.request.urlopen,
) -> dict[str, Any]:
    destination = assert_private_path(destination, "workbook")
    request = urllib.request.Request(
        google_sheet_export_url(source_url),
        headers={"Accept": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "User-Agent": "SymbiomeCatalogContinuation/1.0"},
    )
    payload = bytearray()
    try:
        with opener(request, timeout=180) as response:
            while True:
                chunk = response.read(1024 * 1024)
                if not chunk:
                    break
                payload.extend(chunk)
                if len(payload) > MAX_WORKBOOK_BYTES:
                    raise SyncError("workbook_too_large")
    except SyncError:
        raise
    except (OSError, urllib.error.URLError, urllib.error.HTTPError) as error:
        raise SyncError("workbook_refresh_failed") from error
    if not bytes(payload).startswith(b"PK"):
        raise SyncError("workbook_payload_invalid")
    try:
        import openpyxl  # type: ignore[import-not-found]

        workbook = openpyxl.load_workbook(io.BytesIO(payload), read_only=True, data_only=False)
        required = {
            "Publishing catalogue",
            "Cover Album",
            "Identity Info",
        }
        if not required.issubset(workbook.sheetnames):
            workbook.close()
            raise SyncError("workbook_sheets_missing")
        workbook.close()
    except SyncError:
        raise
    except Exception as error:
        raise SyncError("workbook_payload_invalid") from error
    digest = hashlib.sha256(payload).hexdigest()
    previous_digest = ""
    if destination.is_file():
        with contextlib.suppress(OSError):
            previous_digest = hashlib.sha256(destination.read_bytes()).hexdigest()
    if digest != previous_digest:
        atomic_write_bytes(destination, bytes(payload))
    return {"changed": digest != previous_digest, "byteSize": len(payload), "sha256": digest}


def parse_json_documents(text: str) -> list[object]:
    decoder = json.JSONDecoder()
    cursor = 0
    documents: list[object] = []
    while cursor < len(text):
        while cursor < len(text) and text[cursor].isspace():
            cursor += 1
        if cursor >= len(text):
            break
        try:
            document, cursor = decoder.raw_decode(text, cursor)
        except json.JSONDecodeError as error:
            raise SyncError("subprocess_output_invalid") from error
        documents.append(document)
    return documents


def run_step(step: str, command: Sequence[str], *, timeout: int = 7_200) -> list[object]:
    try:
        result = subprocess.run(
            list(command),
            cwd=REPOSITORY_ROOT,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as error:
        raise SyncError(f"{step}_execution_failed") from error
    if result.returncode != 0:
        raise SyncError(f"{step}_failed")
    return parse_json_documents(result.stdout)


def resolve_node_executable(
    *,
    environment: Mapping[str, str] | None = None,
    which: Any = shutil.which,
    python_executable: str | Path | None = None,
) -> str:
    """Resolve Node from PATH, an explicit override, or Codex's bundled runtime."""

    environment = environment if environment is not None else os.environ
    override = str(environment.get("SYMBIOME_NODE_EXECUTABLE") or "").strip()
    if override:
        if re.search(r"[\r\n\x00]", override):
            raise SyncError("node_executable_invalid")
        override_path = Path(override).expanduser()
        if override_path.is_file():
            return str(override_path.resolve())
        resolved_override = which(override)
        if resolved_override:
            return str(Path(resolved_override).resolve())
        raise SyncError("node_executable_invalid")

    for executable_name in ("node", "node.exe"):
        resolved = which(executable_name)
        if resolved:
            return str(Path(resolved).resolve())

    names = ("node.exe", "node") if os.name == "nt" else ("node", "node.exe")
    candidates: list[Path] = []
    python_path = Path(python_executable or sys.executable).expanduser().resolve()
    for parent in python_path.parents:
        if parent.name.casefold() == "dependencies":
            candidates.extend(parent / "node" / "bin" / name for name in names)
            break

    user_profile = str(environment.get("USERPROFILE") or environment.get("HOME") or "").strip()
    if user_profile and not re.search(r"[\r\n\x00]", user_profile):
        runtime_root = Path(user_profile).expanduser() / ".cache" / "codex-runtimes"
        candidates.extend(
            runtime_root / runtime_name / "dependencies" / "node" / "bin" / name
            for runtime_name in ("codex-primary-runtime", "codex-runtime")
            for name in names
        )
        if runtime_root.is_dir():
            for dependency_root in sorted(runtime_root.glob("*/dependencies")):
                candidates.extend(dependency_root / "node" / "bin" / name for name in names)

    seen: set[Path] = set()
    for candidate in candidates:
        resolved = candidate.resolve()
        if resolved in seen:
            continue
        seen.add(resolved)
        if resolved.is_file():
            return str(resolved)
    raise SyncError("node_missing")


def imageio_ffmpeg_executable() -> str | None:
    """Resolve imageio-ffmpeg, including the ignored local package directory."""

    module: Any = None
    try:
        module = importlib.import_module("imageio_ffmpeg")
    except ImportError:
        private_packages = AUDIT_DIRECTORY / "private" / "python-packages"
        if private_packages.is_dir():
            sys.path.insert(0, str(private_packages))
            try:
                module = importlib.import_module("imageio_ffmpeg")
            except ImportError:
                module = None
            finally:
                with contextlib.suppress(ValueError):
                    sys.path.remove(str(private_packages))
    if module is None:
        return None
    try:
        value = module.get_ffmpeg_exe()
    except Exception:
        return None
    return str(value) if value else None


def resolve_ffmpeg_executable(
    configured_path: Path | None,
    *,
    environment: Mapping[str, str] | None = None,
    which: Any = shutil.which,
    imageio_getter: Any = imageio_ffmpeg_executable,
) -> Path:
    """Resolve one existing FFmpeg file without exposing it in aggregate output."""

    environment = environment if environment is not None else os.environ
    override = str(environment.get("SYMBIOME_FFMPEG_EXECUTABLE") or "").strip()
    if override:
        if re.search(r"[\r\n\x00]", override):
            raise SyncError("ffmpeg_executable_invalid")
        override_path = Path(override).expanduser()
        if not override_path.is_file():
            raise SyncError("ffmpeg_executable_missing")
        return override_path.resolve()

    if configured_path is not None:
        configured = Path(configured_path).expanduser()
        if not configured.is_file():
            raise SyncError("ffmpeg_executable_missing")
        return configured.resolve()

    imageio_value = imageio_getter()
    if imageio_value and not re.search(r"[\r\n\x00]", str(imageio_value)):
        imageio_path = Path(str(imageio_value)).expanduser()
        if imageio_path.is_file():
            return imageio_path.resolve()

    for executable_name in ("ffmpeg", "ffmpeg.exe"):
        resolved = which(executable_name)
        if not resolved or re.search(r"[\r\n\x00]", str(resolved)):
            continue
        resolved_path = Path(str(resolved)).expanduser()
        if resolved_path.is_file():
            return resolved_path.resolve()
    raise SyncError("ffmpeg_missing")


def build_drive_sync_command(config: Mapping[str, Any]) -> list[str]:
    script = AUDIT_DIRECTORY / "sync_lofi_drive.py"
    if not script.is_file():
        raise SyncError("drive_sync_script_missing")
    return [
        sys.executable,
        str(script),
        "--seed",
        str(config["drive_seed"]),
        "--output-dir",
        str(config["inventory_directory"]),
        "--allow-network",
        "--apply",
        "--max-releases",
        str(config["inventory_release_batch"]),
        "--resume",
    ]


def drive_inventory_summary(path: Path) -> dict[str, Any]:
    path = assert_private_path(path, "drive_inventory")
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise SyncError("drive_inventory_invalid") from error
    files = payload.get("files", []) if isinstance(payload, dict) else []
    if not isinstance(files, list) or any(not isinstance(item, dict) for item in files):
        raise SyncError("drive_inventory_invalid")
    return {
        "complete": payload.get("complete") is True,
        "items": len(files),
        "wavFiles": sum(
            str(item.get("name") or "").casefold().endswith(".wav")
            or str(item.get("mimeType") or "").casefold() in ingest.WAV_MIME_TYPES
            for item in files
        ),
    }


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    if not path.is_file():
        return []
    records: list[dict[str, Any]] = []
    try:
        for line in path.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            value = json.loads(line)
            if not isinstance(value, dict):
                raise SyncError("private_manifest_invalid")
            records.append(value)
    except (OSError, json.JSONDecodeError) as error:
        raise SyncError("private_manifest_invalid") from error
    return records


def write_jsonl(path: Path, records: Iterable[Mapping[str, Any]]) -> str:
    encoded = "".join(json.dumps(record, ensure_ascii=False, sort_keys=True) + "\n" for record in records)
    atomic_write_text(assert_private_path(path, "private_manifest"), encoded)
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


def load_continuation_state(path: Path) -> dict[str, Any]:
    if not path.is_file():
        return {"schemaVersion": 1, "spotifyAttempts": {}}
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise SyncError("continuation_state_invalid") from error
    if not isinstance(payload, dict) or payload.get("schemaVersion") != 1:
        raise SyncError("continuation_state_invalid")
    if not isinstance(payload.get("spotifyAttempts", {}), dict):
        raise SyncError("continuation_state_invalid")
    return payload


def select_spotify_batch(
    manifest: Sequence[Mapping[str, Any]], state: Mapping[str, Any], limit: int
) -> list[dict[str, Any]]:
    attempts = state.get("spotifyAttempts", {}) if isinstance(state.get("spotifyAttempts", {}), dict) else {}
    eligible: list[dict[str, Any]] = []
    for record in manifest:
        inspection = record.get("inspection") if isinstance(record.get("inspection"), dict) else {}
        spotify_id = str(record.get("spotify_id") or "")
        if (
            inspection.get("status") != "complete"
            or inspection.get("mode") != "full"
            or not SHA256_PATTERN.fullmatch(str(inspection.get("sha256") or ""))
            or not re.fullmatch(r"[A-Za-z0-9]{22}", spotify_id)
            or record.get("spotify_duration_seconds") is not None
        ):
            continue
        eligible.append(dict(record))
    eligible.sort(
        key=lambda record: (
            int((attempts.get(str(record.get("candidate_id")), {}) or {}).get("count", 0)),
            str((attempts.get(str(record.get("candidate_id")), {}) or {}).get("lastAttemptAt", "")),
            str(record.get("candidate_id", "")),
        )
    )
    return eligible[:limit]


def update_spotify_attempts(state: dict[str, Any], records: Sequence[Mapping[str, Any]]) -> None:
    attempts = state.setdefault("spotifyAttempts", {})
    now = utc_now()
    for record in records:
        candidate_id = str(record.get("candidate_id") or "")
        current = attempts.get(candidate_id) if isinstance(attempts.get(candidate_id), dict) else {}
        attempts[candidate_id] = {"count": int(current.get("count", 0)) + 1, "lastAttemptAt": now}


def normalize_spotify_evidence_record(value: object) -> dict[str, Any] | None:
    """Return the publication-relevant, structurally safe part of an enrichment row."""

    if not isinstance(value, dict):
        return None
    record_key = str(value.get("recordKey") or "").strip()
    spotify_id = str(value.get("spotifyId") or "").strip()
    disposition = value.get("disposition")
    local = value.get("local")
    spotify = value.get("spotify")
    checks = value.get("checks")
    reasons = value.get("reasons")
    if (
        not process.CANDIDATE_ID_PATTERN.fullmatch(record_key)
        or disposition not in {"accepted", "review"}
        or not process.SPOTIFY_ID_PATTERN.fullmatch(spotify_id)
        or not all(isinstance(item, dict) for item in (local, spotify, checks))
        or not isinstance(reasons, list)
        or not all(isinstance(reason, str) and reason.strip() for reason in reasons)
    ):
        return None
    if disposition == "review" and not reasons:
        return None
    if disposition == "accepted":
        artists = spotify.get("artists")
        sources = spotify.get("sources")
        title_check = checks.get("title")
        artists_check = checks.get("artists")
        duration_check = checks.get("duration")
        duration_ms = spotify.get("durationMs")
        source_sha256 = str(local.get("sourceSha256") or "").strip().lower()
        if (
            reasons
            or local.get("audioInspectionComplete") is not True
            or not SHA256_PATTERN.fullmatch(source_sha256)
            or not isinstance(duration_ms, int)
            or isinstance(duration_ms, bool)
            or duration_ms <= 0
            or not isinstance(spotify.get("title"), str)
            or not spotify["title"].strip()
            or not isinstance(artists, list)
            or not artists
            or not all(isinstance(artist, str) and artist.strip() for artist in artists)
            or not isinstance(sources, dict)
            or sources.get("oembed") != "ok"
            or sources.get("embed") != "ok"
            or not isinstance(title_check, dict)
            or title_check.get("status") != "exact"
            or not isinstance(artists_check, dict)
            or artists_check.get("status") != "exact"
            or not isinstance(duration_check, dict)
            or duration_check.get("status") != "match"
        ):
            return None

    normalized = {
        "recordKey": record_key,
        "spotifyId": spotify_id,
        "local": local,
        "spotify": spotify,
        "disposition": disposition,
        "reasons": reasons,
        "checks": checks,
    }
    if isinstance(value.get("artworkRecommendation"), str):
        normalized["artworkRecommendation"] = value["artworkRecommendation"]
    return normalized


def spotify_evidence_fingerprint(record: Mapping[str, Any]) -> str:
    encoded = json.dumps(record, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


def read_spotify_evidence_source(path: Path) -> list[object]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8-sig"))
    except (OSError, json.JSONDecodeError) as error:
        raise SyncError("spotify_evidence_invalid") from error
    records = payload.get("records") if isinstance(payload, dict) else None
    if not isinstance(records, list):
        raise SyncError("spotify_evidence_invalid")
    return records


def bootstrap_cumulative_spotify(
    cumulative_path: Path,
    *,
    search_root: Path,
    allowed_record_keys: Iterable[str],
) -> dict[str, int]:
    """Rebuild cumulative evidence from private history without guessing conflicts."""

    cumulative_path = assert_private_path(cumulative_path, "spotify_evidence")
    search_root = assert_private_path(search_root, "spotify_evidence_search_root")
    allowed = {
        str(record_key).strip()
        for record_key in allowed_record_keys
        if process.CANDIDATE_ID_PATTERN.fullmatch(str(record_key).strip())
    }
    sources = sorted(search_root.rglob("enriched-tracks.json")) if search_root.is_dir() else []
    if cumulative_path.is_file():
        sources.append(cumulative_path)
    grouped: dict[str, dict[str, dict[str, Any]]] = {}
    counts = {
        "sourceFiles": len(sources),
        "invalidSources": 0,
        "sourceRecords": 0,
        "invalidRecords": 0,
        "staleRecords": 0,
        "duplicates": 0,
        "ambiguous": 0,
        "records": 0,
        "accepted": 0,
        "review": 0,
    }
    for source in sources:
        try:
            source_records = read_spotify_evidence_source(source)
        except SyncError:
            counts["invalidSources"] += 1
            continue
        counts["sourceRecords"] += len(source_records)
        for raw_record in source_records:
            record_key = (
                str(raw_record.get("recordKey") or "").strip()
                if isinstance(raw_record, dict)
                else ""
            )
            if record_key and not process.CANDIDATE_ID_PATTERN.fullmatch(record_key):
                counts["invalidRecords"] += 1
                continue
            if record_key and record_key not in allowed:
                counts["staleRecords"] += 1
                continue
            record = normalize_spotify_evidence_record(raw_record)
            if record is None:
                counts["invalidRecords"] += 1
                continue
            fingerprint = spotify_evidence_fingerprint(record)
            versions = grouped.setdefault(record["recordKey"], {})
            if fingerprint in versions:
                counts["duplicates"] += 1
            versions[fingerprint] = record

    records: list[dict[str, Any]] = []
    for record_key in sorted(grouped):
        versions = grouped[record_key]
        if len(versions) != 1:
            counts["ambiguous"] += 1
            continue
        records.append(next(iter(versions.values())))
    counts["records"] = len(records)
    counts["accepted"] = sum(record["disposition"] == "accepted" for record in records)
    counts["review"] = sum(record["disposition"] == "review" for record in records)
    atomic_write_json(
        cumulative_path,
        {"schemaVersion": 1, "updatedAt": utc_now(), "records": records},
    )
    return counts


def merge_cumulative_spotify(current_path: Path, cumulative_path: Path) -> dict[str, int]:
    try:
        current_records = read_spotify_evidence_source(current_path)
    except SyncError as error:
        raise SyncError("spotify_enrichment_invalid") from error
    previous_records: list[object] = []
    if cumulative_path.is_file():
        previous_records = read_spotify_evidence_source(cumulative_path)

    by_key: dict[str, dict[str, Any]] = {}
    previous_groups: dict[str, dict[str, dict[str, Any]]] = {}
    for raw_record in previous_records:
        record = normalize_spotify_evidence_record(raw_record)
        if record is None:
            continue
        previous_groups.setdefault(record["recordKey"], {})[
            spotify_evidence_fingerprint(record)
        ] = record
    for record_key, versions in previous_groups.items():
        if len(versions) == 1:
            by_key[record_key] = next(iter(versions.values()))

    current_seen: set[str] = set()
    current_groups: dict[str, dict[str, dict[str, Any]]] = {}
    current_invalid = 0
    for raw_record in current_records:
        record_key = (
            str(raw_record.get("recordKey") or "").strip()
            if isinstance(raw_record, dict)
            else ""
        )
        if process.CANDIDATE_ID_PATTERN.fullmatch(record_key):
            current_seen.add(record_key)
        record = normalize_spotify_evidence_record(raw_record)
        if record is None:
            current_invalid += 1
            continue
        current_groups.setdefault(record["recordKey"], {})[
            spotify_evidence_fingerprint(record)
        ] = record

    for record_key in current_seen:
        by_key.pop(record_key, None)
    current_ambiguous = 0
    for record_key, versions in current_groups.items():
        if len(versions) != 1:
            current_ambiguous += 1
            continue
        by_key[record_key] = next(iter(versions.values()))

    records = [by_key[key] for key in sorted(by_key)]
    atomic_write_json(
        assert_private_path(cumulative_path, "spotify_evidence"),
        {"schemaVersion": 1, "updatedAt": utc_now(), "records": records},
    )
    return {
        "records": len(records),
        "accepted": sum(record.get("disposition") == "accepted" for record in records),
        "review": sum(record.get("disposition") == "review" for record in records),
        "currentAccepted": sum(
            len(versions) == 1
            and next(iter(versions.values())).get("disposition") == "accepted"
            for versions in current_groups.values()
        ),
        "currentReview": sum(
            len(versions) == 1
            and next(iter(versions.values())).get("disposition") == "review"
            for versions in current_groups.values()
        ),
        "currentInvalid": current_invalid,
        "currentAmbiguous": current_ambiguous,
    }


def completed_pipeline_fingerprints(path: Path) -> dict[str, str]:
    if not path.is_file():
        return {}
    try:
        connection = sqlite3.connect(f"file:{path.resolve().as_posix()}?mode=ro", uri=True)
        rows = connection.execute(
            "SELECT candidate_id, manifest_fingerprint FROM pipeline_items WHERE status = 'published'"
        ).fetchall()
        tables = {
            str(row[0])
            for row in connection.execute("SELECT name FROM sqlite_master WHERE type = 'table'").fetchall()
        }
        base_rows = (
            connection.execute(
                "SELECT candidate_id, base_fingerprint FROM published_manifest_bases"
            ).fetchall()
            if "published_manifest_bases" in tables
            else []
        )
    except sqlite3.Error as error:
        raise SyncError("pipeline_state_invalid") from error
    finally:
        with contextlib.suppress(UnboundLocalError):
            connection.close()
    result = {str(candidate_id): str(fingerprint) for candidate_id, fingerprint in rows}
    result.update({str(candidate_id): str(fingerprint) for candidate_id, fingerprint in base_rows})
    return result


def bootstrap_full_ingestion_state(
    target_path: Path,
    *,
    search_root: Path,
) -> dict[str, int]:
    """Reuse only full WAV inspections bound to the same candidate fingerprint."""

    target_path = assert_private_path(target_path, "ingestion_state")
    search_root = assert_private_path(search_root, "ingestion_state_search_root")
    counts = {
        "sourceFiles": 0,
        "fullRows": 0,
        "matchingFingerprint": 0,
        "merged": 0,
        "alreadyPresent": 0,
        "refused": 0,
        "incompatibleSources": 0,
    }
    if not target_path.is_file():
        raise SyncError("ingestion_state_missing")
    target = sqlite3.connect(target_path)
    target.row_factory = sqlite3.Row
    try:
        target_rows = {
            str(row["candidate_id"]): row
            for row in target.execute(
                """SELECT candidate_id, fingerprint, inspection_status,
                inspection_mode, sha256 FROM candidates"""
            ).fetchall()
        }
        sources = sorted(search_root.rglob("ingestion-state.sqlite3")) if search_root.is_dir() else []
        for source_path in sources:
            if source_path.resolve() == target_path.resolve():
                continue
            counts["sourceFiles"] += 1
            try:
                source = sqlite3.connect(f"file:{source_path.resolve().as_posix()}?mode=ro", uri=True)
                source.row_factory = sqlite3.Row
                columns = {str(row[1]) for row in source.execute("PRAGMA table_info(candidates)")}
                required = {
                    "candidate_id",
                    "fingerprint",
                    "payload_json",
                    "status",
                    "reasons_json",
                    "inspection_status",
                    "inspection_mode",
                    "content_type",
                    "content_length",
                    "wav_json",
                    "sha256",
                    "error",
                }
                if not required.issubset(columns):
                    counts["incompatibleSources"] += 1
                    source.close()
                    continue
                rows = source.execute(
                    """SELECT * FROM candidates
                    WHERE inspection_status='complete' AND inspection_mode='full'"""
                ).fetchall()
                source.close()
            except sqlite3.Error:
                counts["incompatibleSources"] += 1
                continue
            counts["fullRows"] += len(rows)
            for row in rows:
                candidate_id = str(row["candidate_id"])
                current = target_rows.get(candidate_id)
                sha256 = str(row["sha256"] or "")
                if (
                    current is None
                    or str(current["fingerprint"]) != str(row["fingerprint"])
                    or not SHA256_PATTERN.fullmatch(sha256)
                    or not row["wav_json"]
                    or row["error"]
                ):
                    counts["refused"] += 1
                    continue
                counts["matchingFingerprint"] += 1
                if (
                    current["inspection_status"] == "complete"
                    and current["inspection_mode"] == "full"
                    and current["sha256"] == sha256
                ):
                    counts["alreadyPresent"] += 1
                    continue
                target.execute(
                    """UPDATE candidates SET
                    payload_json=?, status=?, reasons_json=?,
                    inspection_status='complete', inspection_mode='full',
                    content_type=?, content_length=?, wav_json=?, sha256=?,
                    error=NULL, updated_at=?
                    WHERE candidate_id=? AND fingerprint=?""",
                    (
                        row["payload_json"],
                        row["status"],
                        row["reasons_json"],
                        row["content_type"],
                        row["content_length"],
                        row["wav_json"],
                        sha256,
                        utc_now(),
                        candidate_id,
                        row["fingerprint"],
                    ),
                )
                target.commit()
                counts["merged"] += 1
                target_rows[candidate_id] = target.execute(
                    """SELECT candidate_id, fingerprint, inspection_status,
                    inspection_mode, sha256 FROM candidates WHERE candidate_id=?""",
                    (candidate_id,),
                ).fetchone()
    finally:
        target.close()
    return counts


def bootstrap_published_pipeline_state(
    exact_records: Sequence[Mapping[str, Any]],
    target_path: Path,
    *,
    search_root: Path,
) -> dict[str, int]:
    """Merge only already-published rows whose current manifest is identical.

    Historical per-batch SQLite files are private checkpoints, not publication
    evidence for changed rows. A row is copied only when it is published, both
    original acknowledgements are present, and its stored fingerprint equals
    the fingerprint recomputed from the current exact manifest.
    """

    target_path = assert_private_path(target_path, "pipeline_state")
    search_root = assert_private_path(search_root, "pipeline_state_search_root")
    current_base = {
        str(record.get("candidate_id") or ""): process.canonical_fingerprint(record)
        for record in exact_records
    }
    counts = {
        "sourceFiles": 0,
        "publishedRows": 0,
        "matchingFingerprint": 0,
        "merged": 0,
        "alreadyPresent": 0,
        "refused": 0,
        "incompatibleSources": 0,
        "evidenceInvalidSources": 0,
    }
    target = process.open_pipeline_state(target_path)
    target.row_factory = sqlite3.Row
    try:
        target.execute(
            """CREATE TABLE IF NOT EXISTS published_manifest_bases (
            candidate_id TEXT PRIMARY KEY,
            base_fingerprint TEXT NOT NULL,
            source_manifest_fingerprint TEXT NOT NULL,
            verified_at TEXT NOT NULL
            )"""
        )
        target.commit()
        target_columns = [str(row[1]) for row in target.execute("PRAGMA table_info(pipeline_items)")]
        required = {
            "candidate_id",
            "manifest_fingerprint",
            "batch_key",
            "status",
            "rights_cleared_ack",
            "human_made_cleared_ack",
            "created_at",
            "updated_at",
        }
        sources = sorted(search_root.rglob("pipeline-state.sqlite3")) if search_root.is_dir() else []
        for source_path in sources:
            if source_path.resolve() == target_path.resolve():
                continue
            counts["sourceFiles"] += 1
            try:
                source = sqlite3.connect(f"file:{source_path.resolve().as_posix()}?mode=ro", uri=True)
                source.row_factory = sqlite3.Row
                source_columns = [str(row[1]) for row in source.execute("PRAGMA table_info(pipeline_items)")]
                if not required.issubset(source_columns) or not set(target_columns).issubset(source_columns):
                    counts["incompatibleSources"] += 1
                    source.close()
                    continue
                rows = source.execute("SELECT * FROM pipeline_items WHERE status = 'published'").fetchall()
                source.close()
            except sqlite3.Error:
                counts["incompatibleSources"] += 1
                continue
            counts["publishedRows"] += len(rows)
            source_base: dict[str, str] = {}
            source_attached: dict[str, str] = {}
            exact_path = source_path.parent / "exact.jsonl"
            enrichment_path = source_path.parent / "spotify-enrichment" / "enriched-tracks.json"
            if exact_path.is_file() and enrichment_path.is_file():
                try:
                    source_records = read_jsonl(exact_path)
                    source_base = {
                        str(record.get("candidate_id") or ""): process.canonical_fingerprint(record)
                        for record in source_records
                    }
                    attached_records = json.loads(json.dumps(source_records))
                    process.attach_verified_spotify_evidence(attached_records, enrichment_path)
                    source_attached = {
                        str(record.get("candidate_id") or ""): process.canonical_fingerprint(record)
                        for record in attached_records
                    }
                except Exception:
                    counts["evidenceInvalidSources"] += 1
                    source_base = {}
                    source_attached = {}
            for row in rows:
                candidate_id = str(row["candidate_id"])
                fingerprint = str(row["manifest_fingerprint"])
                direct_match = current_base.get(candidate_id) == fingerprint
                reconstructed_match = (
                    current_base.get(candidate_id) == source_base.get(candidate_id)
                    and source_attached.get(candidate_id) == fingerprint
                )
                if (
                    not (direct_match or reconstructed_match)
                    or not bool(row["rights_cleared_ack"])
                    or not bool(row["human_made_cleared_ack"])
                ):
                    counts["refused"] += 1
                    continue
                counts["matchingFingerprint"] += 1
                existing = target.execute(
                    "SELECT status, manifest_fingerprint FROM pipeline_items WHERE candidate_id = ?",
                    (candidate_id,),
                ).fetchone()
                target.execute(
                    """INSERT INTO published_manifest_bases (
                    candidate_id, base_fingerprint, source_manifest_fingerprint, verified_at
                    ) VALUES (?, ?, ?, ?)
                    ON CONFLICT(candidate_id) DO UPDATE SET
                      base_fingerprint=excluded.base_fingerprint,
                      source_manifest_fingerprint=excluded.source_manifest_fingerprint,
                      verified_at=excluded.verified_at""",
                    (candidate_id, current_base[candidate_id], fingerprint, utc_now()),
                )
                if existing and existing["status"] == "published" and existing["manifest_fingerprint"] == fingerprint:
                    target.commit()
                    counts["alreadyPresent"] += 1
                    continue
                placeholders = ", ".join("?" for _ in target_columns)
                columns_sql = ", ".join(target_columns)
                target.execute(
                    f"INSERT OR REPLACE INTO pipeline_items ({columns_sql}) VALUES ({placeholders})",  # noqa: S608
                    tuple(row[column] for column in target_columns),
                )
                target.commit()
                counts["merged"] += 1
    finally:
        target.close()
    return counts


def record_published_manifest_bases(
    records: Sequence[Mapping[str, Any]], pipeline_state: Path
) -> dict[str, int]:
    connection = process.open_pipeline_state(pipeline_state)
    connection.row_factory = sqlite3.Row
    counts = {"eligible": len(records), "recorded": 0, "notPublished": 0}
    try:
        connection.execute(
            """CREATE TABLE IF NOT EXISTS published_manifest_bases (
            candidate_id TEXT PRIMARY KEY,
            base_fingerprint TEXT NOT NULL,
            source_manifest_fingerprint TEXT NOT NULL,
            verified_at TEXT NOT NULL
            )"""
        )
        for record in records:
            candidate_id = str(record.get("candidate_id") or "")
            row = connection.execute(
                """SELECT status, manifest_fingerprint FROM pipeline_items
                WHERE candidate_id = ?""",
                (candidate_id,),
            ).fetchone()
            if row is None or row["status"] != "published":
                counts["notPublished"] += 1
                continue
            connection.execute(
                """INSERT INTO published_manifest_bases (
                candidate_id, base_fingerprint, source_manifest_fingerprint, verified_at
                ) VALUES (?, ?, ?, ?)
                ON CONFLICT(candidate_id) DO UPDATE SET
                  base_fingerprint=excluded.base_fingerprint,
                  source_manifest_fingerprint=excluded.source_manifest_fingerprint,
                  verified_at=excluded.verified_at""",
                (
                    candidate_id,
                    process.canonical_fingerprint(record),
                    str(row["manifest_fingerprint"]),
                    utc_now(),
                ),
            )
            connection.commit()
            counts["recorded"] += 1
    finally:
        connection.close()
    return counts


def select_publication_batch(
    exact_records: Sequence[Mapping[str, Any]], pipeline_state: Path, limit: int
) -> list[dict[str, Any]]:
    published = completed_pipeline_fingerprints(pipeline_state)
    selected: list[dict[str, Any]] = []
    for record in exact_records:
        process.validate_exact_record(record)
        candidate_id = str(record.get("candidate_id") or "")
        if published.get(candidate_id) == process.canonical_fingerprint(record):
            continue
        selected.append(dict(record))
        if len(selected) == limit:
            break
    return selected


def parse_timestamp(value: object, label: str) -> dt.datetime:
    raw = str(value or "").strip()
    try:
        parsed = dt.datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError as error:
        raise SyncError(f"{label}_invalid") from error
    if parsed.tzinfo is None:
        raise SyncError(f"{label}_invalid")
    return parsed.astimezone(dt.timezone.utc)


def validate_evidence(path: Path | None, kind: str, selection_sha256: str, selection_count: int) -> None:
    if path is None or not path.is_file():
        raise SyncError(f"{kind}_evidence_missing")
    assert_private_path(path, f"{kind}_evidence")
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise SyncError(f"{kind}_evidence_invalid") from error
    if (
        not isinstance(payload, dict)
        or payload.get("schemaVersion") != 1
        or payload.get("kind") != kind
        or payload.get("approved") is not True
        or payload.get("selectionSha256") != selection_sha256
        or payload.get("selectionCount") != selection_count
        or not str(payload.get("reviewer") or "").strip()
    ):
        raise SyncError(f"{kind}_evidence_invalid")
    parse_timestamp(payload.get("reviewedAt"), f"{kind}_reviewed_at")
    if payload.get("expiresAt") and parse_timestamp(payload["expiresAt"], f"{kind}_expires_at") <= dt.datetime.now(dt.timezone.utc):
        raise SyncError(f"{kind}_evidence_expired")


def compact_child_summary(step: str, documents: Sequence[object]) -> object:
    dictionaries = [document for document in documents if isinstance(document, dict)]
    if not dictionaries:
        return {"documents": 0}
    if step == "ingest":
        plan = next((item for item in dictionaries if "planned_status" in item), {})
        result = next((item for item in dictionaries if "manifest" in item), {})
        return {
            "tracks": plan.get("tracks", 0),
            "releaseAudioGroups": plan.get("release_audio_groups", 0),
            "candidates": plan.get("candidates", 0),
            "plannedStatus": plan.get("planned_status", {}),
            "inspection": result.get("inspection", {}),
            "manifest": result.get("manifest", {}),
        }
    if step == "spotify":
        item = dictionaries[-1]
        return {
            "records": item.get("records", {}),
            "retrieval": item.get("retrieval", {}),
            "validation": item.get("validation", {}),
            "reviewReasons": item.get("reviewReasons", {}),
        }
    if step == "drive_sync":
        item = dictionaries[-1]
        summary: dict[str, Any] = {}
        for key in (
            "seedReleases",
            "rootFolders",
            "pendingReleases",
            "pendingItems",
            "inventoryItems",
            "audioFiles",
            "artworkFiles",
            "rootNew",
            "selected",
            "scanned",
            "errors",
        ):
            value = item.get(key)
            if isinstance(value, int) and not isinstance(value, bool) and value >= 0:
                summary[key] = value
        if isinstance(item.get("complete"), bool):
            summary["complete"] = item["complete"]
        if isinstance(item.get("resumable"), bool):
            summary["resumable"] = item["resumable"]
        categorical = {
            "mode": {"plan", "apply"},
            "status": {"ok", "partial", "failed", "interrupted"},
        }
        for key, values in categorical.items():
            if item.get(key) in values:
                summary[key] = item[key]
        error = item.get("error")
        if isinstance(error, str) and re.fullmatch(r"[a-z0-9_]{1,100}", error):
            summary["error"] = error
        return summary
    item = dictionaries[-1]
    allowed = {key: item[key] for key in ("mode", "step", "enrichment", "matchedCandidates", "merge", "manifest", "exactRecords", "selected", "spotifyEnrichment", "pipelineState", "counts") if key in item}
    return allowed


def build_ingest_command(
    config: Mapping[str, Any], inventory: Path, *, apply: bool, inspect_full: bool = False
) -> list[str]:
    command = [
        sys.executable,
        str(AUDIT_DIRECTORY / "ingest_catalog.py"),
        "--workbook",
        str(config["workbook"]),
        "--output-dir",
        str(config["work_directory"]),
    ]
    if config.get("orchard"):
        command.extend(["--orchard", str(config["orchard"])])
    if inventory.is_file() or apply:
        command.extend(["--drive-inventory", str(inventory)])
    if apply:
        command.append("--apply")
        if inspect_full:
            command.extend(
                [
                "--inspect",
                "full",
                "--batch-size",
                str(config["inspection_batch"]),
                "--release-batch-size",
                str(config["release_batch"]),
                "--max-inspection-seconds",
                str(config["maximum_run_minutes"] * 60),
                "--allow-network",
                ]
            )
    else:
        command.append("--dry-run")
    return command


def build_process_catalog_command(
    *,
    exact_manifest: Path,
    pipeline_state: Path,
    spotify_enrichment: Path,
    ffmpeg_executable: Path,
    apply: bool,
) -> list[str]:
    command = [
        sys.executable,
        str(AUDIT_DIRECTORY / "process_catalog.py"),
        "--exact-manifest",
        str(exact_manifest),
        "--pipeline-state",
        str(pipeline_state),
        "--spotify-enrichment",
        str(spotify_enrichment),
        "--ffmpeg",
        str(ffmpeg_executable),
    ]
    if apply:
        command.extend(["--apply", "--rights-cleared", "--human-made-cleared"])
    else:
        command.append("--dry-run")
    return command


def execute(arguments: argparse.Namespace) -> dict[str, Any]:
    config = load_config(arguments.config)
    work_directory: Path = config["work_directory"]
    inventory = config["inventory_directory"] / "drive-inventory.json"
    manifest = work_directory / "manifest.jsonl"
    exact_manifest = work_directory / "exact.jsonl"
    ingestion_state = work_directory / "ingestion-state.sqlite3"
    pipeline_state = work_directory / "pipeline-state.sqlite3"
    continuation_state_path = work_directory / "continuation-state.json"
    spotify_input = work_directory / "spotify-input.jsonl"
    spotify_output = work_directory / "spotify-enrichment"
    spotify_current = spotify_output / "enriched-tracks.json"
    spotify_cumulative = work_directory / "spotify-evidence.json"
    publication_selection = work_directory / "publication-selection.jsonl"

    report: dict[str, Any] = {
        "schemaVersion": 1,
        "generatedAt": utc_now(),
        "mode": arguments.mode,
        "status": "running",
        "resumable": True,
    }

    if arguments.mode == "plan":
        ingest_documents = run_step("ingest", build_ingest_command(config, inventory, apply=False))
        report["catalog"] = compact_child_summary("ingest", ingest_documents)
        exact_records = read_jsonl(exact_manifest)
        selected = select_publication_batch(exact_records, pipeline_state, config["publication_batch"])
        selection_text = "".join(json.dumps(record, ensure_ascii=False, sort_keys=True) + "\n" for record in selected)
        report["publication"] = {
            "selected": len(selected),
            "selectionSha256": hashlib.sha256(selection_text.encode("utf-8")).hexdigest(),
            "action": "dry_run",
        }
        report["status"] = "ok"
        return report

    if not arguments.allow_network:
        raise SyncError("allow_network_required")
    work_directory.mkdir(parents=True, exist_ok=True)
    report["workbookRefresh"] = refresh_workbook(
        config["workbook_source_url"], config["workbook"]
    )
    drive_documents = run_step(
        "drive_sync",
        build_drive_sync_command(config),
        timeout=900,
    )
    report["driveSync"] = compact_child_summary("drive_sync", drive_documents)
    report["inventory"] = drive_inventory_summary(inventory)

    seed_documents = run_step(
        "ingest",
        build_ingest_command(config, inventory, apply=True, inspect_full=False),
        timeout=900,
    )
    report["catalogSeed"] = compact_child_summary("ingest", seed_documents)
    report["ingestionStateBootstrap"] = bootstrap_full_ingestion_state(
        ingestion_state,
        search_root=AUDIT_DIRECTORY / "private",
    )
    ingest_documents = run_step(
        "ingest",
        build_ingest_command(config, inventory, apply=True, inspect_full=True),
        timeout=config["maximum_run_minutes"] * 60 + 900,
    )
    report["catalog"] = compact_child_summary("ingest", ingest_documents)

    manifest_records = read_jsonl(manifest)
    report["spotify"] = {
        "historicalEvidence": bootstrap_cumulative_spotify(
            spotify_cumulative,
            search_root=AUDIT_DIRECTORY / "private",
            allowed_record_keys=(record.get("candidate_id", "") for record in manifest_records),
        )
    }
    continuation_state = load_continuation_state(continuation_state_path)
    spotify_records = select_spotify_batch(manifest_records, continuation_state, config["spotify_batch"])
    report["spotify"]["selected"] = len(spotify_records)
    if spotify_records:
        write_jsonl(spotify_input, spotify_records)
        node = resolve_node_executable()
        spotify_documents = run_step(
            "spotify",
            [
                node,
                str(AUDIT_DIRECTORY / "enrich-spotify-metadata.mjs"),
                "--input",
                str(spotify_input),
                "--output-dir",
                str(spotify_output),
                "--public-report",
                str(work_directory / "spotify-summary.json"),
                "--concurrency",
                "2",
                "--min-interval-ms",
                "500",
            ],
        )
        report["spotify"]["enrichment"] = compact_child_summary("spotify", spotify_documents)
        merge_documents = run_step(
            "merge_spotify",
            [
                sys.executable,
                str(AUDIT_DIRECTORY / "process_catalog.py"),
                "--step",
                "merge_spotify_metadata",
                "--ingestion-state",
                str(ingestion_state),
                "--spotify-enrichment",
                str(spotify_current),
                "--apply",
            ],
        )
        report["spotify"]["merge"] = compact_child_summary("merge", merge_documents)
        report["spotify"]["cumulativeEvidence"] = merge_cumulative_spotify(spotify_current, spotify_cumulative)
        update_spotify_attempts(continuation_state, spotify_records)
        atomic_write_json(continuation_state_path, continuation_state)

    exact_records = read_jsonl(exact_manifest)
    report["publishedStateBootstrap"] = bootstrap_published_pipeline_state(
        exact_records,
        pipeline_state,
        search_root=AUDIT_DIRECTORY / "private",
    )
    selected = select_publication_batch(exact_records, pipeline_state, config["publication_batch"])
    selection_sha256 = write_jsonl(publication_selection, selected)
    report["publication"] = {
        "selected": len(selected),
        "selectionSha256": selection_sha256,
        "action": "apply" if arguments.mode == "publish" else "dry_run",
    }
    if not selected:
        report["status"] = "ok"
        return report
    if not spotify_cumulative.is_file():
        raise SyncError("spotify_evidence_missing")
    ffmpeg_executable = resolve_ffmpeg_executable(config.get("ffmpeg_executable"))

    dry_documents = run_step(
        "publication_dry_run",
        build_process_catalog_command(
            exact_manifest=publication_selection,
            pipeline_state=pipeline_state,
            spotify_enrichment=spotify_cumulative,
            ffmpeg_executable=ffmpeg_executable,
            apply=False,
        ),
    )
    report["publication"]["plan"] = compact_child_summary("process", dry_documents)
    if arguments.mode == "continue":
        report["publication"]["evidenceRequired"] = {
            "rightsClearance": True,
            "humanMadeEditorialReview": True,
        }
        report["status"] = "review_required"
        return report

    validate_evidence(config["rights_evidence"], "rights_clearance", selection_sha256, len(selected))
    validate_evidence(config["human_evidence"], "human_made_editorial_review", selection_sha256, len(selected))
    apply_documents = run_step(
        "publication_apply",
        build_process_catalog_command(
            exact_manifest=publication_selection,
            pipeline_state=pipeline_state,
            spotify_enrichment=spotify_cumulative,
            ffmpeg_executable=ffmpeg_executable,
            apply=True,
        ),
    )
    report["publication"]["result"] = compact_child_summary("process", apply_documents)
    report["publication"]["publishedManifestBases"] = record_published_manifest_bases(
        selected, pipeline_state
    )
    report["status"] = "ok"
    return report


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.ArgumentDefaultsHelpFormatter)
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG, help="Ignored private JSON configuration.")
    parser.add_argument("--mode", choices=("plan", "continue", "publish"), default="plan")
    parser.add_argument("--allow-network", action="store_true", help="Required for continue/publish network reads and writes.")
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    arguments = build_parser().parse_args(argv)
    report_path: Path | None = None
    try:
        arguments.config = assert_private_path(arguments.config, "config")
        with contextlib.suppress(Exception):
            raw = json.loads(arguments.config.read_text(encoding="utf-8"))
            if isinstance(raw, dict) and raw.get("workDirectory"):
                report_path = resolve_config_path(raw["workDirectory"], base=REPOSITORY_ROOT, label="work_directory") / "last-run.json"
        report = execute(arguments)
        if report_path and arguments.mode != "plan":
            atomic_write_json(report_path, report)
        print(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True))
        return 0 if report.get("status") in {"ok", "review_required"} else 1
    except KeyboardInterrupt:
        report = {"schemaVersion": 1, "generatedAt": utc_now(), "status": "interrupted", "resumable": True}
        if report_path:
            atomic_write_json(report_path, report)
        print(json.dumps(report, indent=2, sort_keys=True))
        return 130
    except SyncError as error:
        report = {
            "schemaVersion": 1,
            "generatedAt": utc_now(),
            "status": "failed",
            "error": error.code,
            "resumable": True,
        }
        if report_path:
            atomic_write_json(report_path, report)
        print(json.dumps(report, indent=2, sort_keys=True))
        return 1
    except Exception as error:  # redact all unforeseen provider/path details
        report = {
            "schemaVersion": 1,
            "generatedAt": utc_now(),
            "status": "failed",
            "error": re.sub(r"[^a-z0-9_]+", "_", type(error).__name__.casefold()).strip("_") or "sync_failed",
            "resumable": True,
        }
        if report_path:
            atomic_write_json(report_path, report)
        print(json.dumps(report, indent=2, sort_keys=True))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

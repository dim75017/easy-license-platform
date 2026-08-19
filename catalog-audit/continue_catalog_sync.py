#!/usr/bin/env python3
"""Continue or globally drain the private Drive catalogue pipeline.

This is an orchestration layer around ``ingest_catalog.py``,
``enrich-spotify-metadata.mjs`` and ``process_catalog.py``.  It keeps every
row-level artefact below an ignored private directory and emits aggregate JSON
only.  Publication is impossible unless two explicit, selection-bound evidence
files are present, or are derived from a valid catalogue-owner attestation
scoped to the configured sources, and the operator deliberately chooses
``--mode publish``.

``--mode drain`` is the separately sealed catalogue-owner lane: it treats the
configured Sheet + Drive roots as authoritative, skips Spotify and redundant
WAV preinspection, then processes every deterministic row sequentially to a
resumable terminal checkpoint.
"""

from __future__ import annotations

import argparse
import contextlib
import ctypes
import datetime as dt
import errno
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
MAX_INSPECTION_BATCH = 50
MAX_SPOTIFY_BATCH = 50
MAX_PUBLICATION_BATCH = 25
MAX_RELEASE_BATCH = 10
MAX_RUN_MINUTES = 60
MAX_INVENTORY_RELEASE_BATCH = 50
DIRECT_INVENTORY_RELEASE_BATCH = 100
MAX_WORKBOOK_BYTES = 50 * 1024 * 1024
MAX_ATTESTATION_BYTES = 64 * 1024
DRIVE_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{10,200}$")
CATALOGUE_SOURCE_HOST = "lofi-records.netlify.app"
OWNER_ATTESTATION_CLAIMS = (
    "catalogueAlreadyReleased",
    "rightsToPublishFullLengthListeningCopies",
    "rightsToOfferLicensedDownloads",
    "humanMadeNoGenerativeAI",
)
PUBLICATION_SECRET_ENVIRONMENT_KEYS = (
    "CATALOG_PIPELINE_TOKEN",
    "OAI_SITES_AUTHORIZATION",
)
MAX_PRIVATE_SECRET_LENGTH = 64 * 1024
SYNC_LOCK_FILENAME = ".catalog-sync.lock"
DIRECT_BATCH_KEY = "symbiome-catalog-owner-drain-v1"
BELOW_NORMAL_PRIORITY_CLASS = 0x00004000
LOW_RESOURCE_NICE_INCREMENT = 10
LOW_RESOURCE_THREAD_ENVIRONMENT_KEYS = (
    "OMP_NUM_THREADS",
    "MKL_NUM_THREADS",
    "OPENBLAS_NUM_THREADS",
    "NUMEXPR_NUM_THREADS",
    "VECLIB_MAXIMUM_THREADS",
)


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


def _lock_contention(error: OSError) -> bool:
    contention_errnos = {errno.EACCES, errno.EAGAIN}
    if hasattr(errno, "EDEADLK"):
        contention_errnos.add(errno.EDEADLK)
    return error.errno in contention_errnos or getattr(error, "winerror", None) in {32, 33}


@contextlib.contextmanager
def exclusive_sync_lock(work_directory: Path) -> Iterable[None]:
    """Hold one crash-safe, non-blocking catalogue sync lock.

    The file contains no process metadata. The operating system owns the
    actual lock, so closing the handle or terminating the process releases it;
    the harmless one-byte file may remain between runs.
    """

    lock_path = assert_private_path(
        assert_private_path(work_directory, "work_directory") / SYNC_LOCK_FILENAME,
        "sync_lock",
    )
    try:
        lock_path.parent.mkdir(parents=True, exist_ok=True)
        stream = lock_path.open("a+b", buffering=0)
    except OSError as error:
        raise SyncError("sync_lock_unavailable") from error

    acquired = False
    try:
        try:
            stream.seek(0, os.SEEK_END)
            if stream.tell() == 0:
                stream.write(b"\0")
                os.fsync(stream.fileno())
            stream.seek(0)
            if os.name == "nt":
                import msvcrt

                msvcrt.locking(stream.fileno(), msvcrt.LK_NBLCK, 1)
            elif os.name == "posix":
                import fcntl

                fcntl.flock(stream.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
            else:
                raise SyncError("sync_lock_unsupported")
        except SyncError:
            raise
        except OSError as error:
            if _lock_contention(error):
                raise SyncError("sync_already_running") from error
            raise SyncError("sync_lock_unavailable") from error

        acquired = True
        yield
    finally:
        if acquired:
            with contextlib.suppress(OSError, ImportError):
                stream.seek(0)
                if os.name == "nt":
                    import msvcrt

                    msvcrt.locking(stream.fileno(), msvcrt.LK_UNLCK, 1)
                elif os.name == "posix":
                    import fcntl

                    fcntl.flock(stream.fileno(), fcntl.LOCK_UN)
        stream.close()


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


def validate_private_secret(value: object, label: str) -> str:
    if (
        not isinstance(value, str)
        or value != value.strip()
        or len(value) < 16
        or len(value) > MAX_PRIVATE_SECRET_LENGTH
        or re.search(r"[\x00-\x1f\x7f]", value)
    ):
        raise SyncError(f"{label}_invalid")
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
    catalogue_source_url = str(payload.get("catalogueSourceUrl") or "").strip() or None
    if catalogue_source_url is not None:
        catalogue_source_url = canonical_catalogue_source_url(catalogue_source_url)
    if payload.get("catalogOwnerAttestation") and catalogue_source_url is None:
        raise SyncError("catalogue_source_url_missing")
    pipeline_token = (
        validate_private_secret(payload.get("pipelineToken"), "pipeline_token")
        if "pipelineToken" in payload
        else None
    )
    sites_authorization = (
        validate_private_secret(payload.get("sitesAuthorization"), "sites_authorization")
        if "sitesAuthorization" in payload
        else None
    )
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
        "pipeline_token": pipeline_token,
        "sites_authorization": sites_authorization,
        "catalogue_source_url": catalogue_source_url,
        "catalog_owner_attestation": resolve_config_path(
            payload["catalogOwnerAttestation"],
            base=base,
            label="catalog_owner_attestation",
        )
        if payload.get("catalogOwnerAttestation")
        else None,
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


def canonical_catalogue_source_url(value: object) -> str:
    """Return the single approved catalogue UI scope, without credentials."""

    try:
        parsed = urllib.parse.urlparse(str(value or "").strip())
        port = parsed.port
    except ValueError as error:
        raise SyncError("catalogue_source_url_invalid") from error
    if (
        parsed.scheme != "https"
        or parsed.hostname != CATALOGUE_SOURCE_HOST
        or port not in (None, 443)
        or parsed.username is not None
        or parsed.password is not None
        or parsed.query
        or (parsed.path.rstrip("/") or "/") != "/"
        or parsed.fragment.rstrip("/") not in {"catalog", "/catalog"}
    ):
        raise SyncError("catalogue_source_url_invalid")
    return f"https://{CATALOGUE_SOURCE_HOST}/#/catalog"


def drive_source_folder_id(path: Path) -> str:
    """Read only the stable Drive root used to scope a durable attestation."""

    path = assert_private_path(path, "drive_seed")
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise SyncError("drive_seed_scope_invalid") from error
    source_folder_id = str(payload.get("sourceFolderId") or "").strip() if isinstance(payload, dict) else ""
    if (
        not isinstance(payload, dict)
        or payload.get("schemaVersion") != 1
        or DRIVE_ID_PATTERN.fullmatch(source_folder_id) is None
    ):
        raise SyncError("drive_seed_scope_invalid")
    return source_folder_id


def catalogue_scope_descriptor(config: Mapping[str, Any]) -> dict[str, str]:
    """Build the private, stable source identity covered by an owner attestation."""

    catalogue_source_url = config.get("catalogue_source_url")
    if not catalogue_source_url:
        raise SyncError("catalogue_source_url_missing")
    return {
        "catalogueSourceUrl": canonical_catalogue_source_url(catalogue_source_url),
        "workbookSourceUrl": google_sheet_export_url(str(config.get("workbook_source_url") or "")),
        "driveSourceFolderId": drive_source_folder_id(Path(config["drive_seed"])),
    }


def canonical_payload_sha256(payload: Mapping[str, Any]) -> str:
    serialized = json.dumps(payload, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


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


def apply_low_resource_priority(
    *,
    platform_name: str | None = None,
    windows_api_factory: Any | None = None,
    nice_function: Any | None = None,
) -> bool:
    """Lower this wrapper's scheduling priority without ever blocking a run."""

    platform_name = platform_name or os.name
    try:
        if platform_name == "nt":
            factory = windows_api_factory or getattr(ctypes, "WinDLL", None)
            if factory is None:
                return False
            kernel32 = factory("kernel32", use_last_error=True)
            process = kernel32.GetCurrentProcess()
            return bool(kernel32.SetPriorityClass(process, BELOW_NORMAL_PRIORITY_CLASS))
        if platform_name == "posix":
            (nice_function or os.nice)(LOW_RESOURCE_NICE_INCREMENT)
            return True
    except Exception:
        return False
    return False


def low_resource_child_environment(environment: Mapping[str, str]) -> dict[str, str]:
    """Cap numerical runtimes at one thread while preserving an existing cap."""

    child_environment = dict(environment)
    for key in LOW_RESOURCE_THREAD_ENVIRONMENT_KEYS:
        current = child_environment.get(key)
        if isinstance(current, str):
            with contextlib.suppress(ValueError):
                if int(current.strip()) == 1:
                    continue
        child_environment[key] = "1"
    return child_environment


def sanitized_child_environment(environment: Mapping[str, str] | None = None) -> dict[str, str]:
    child_environment = dict(environment if environment is not None else os.environ)
    for key in PUBLICATION_SECRET_ENVIRONMENT_KEYS:
        child_environment.pop(key, None)
    return low_resource_child_environment(child_environment)


def publication_apply_environment(
    config: Mapping[str, Any],
    *,
    environment: Mapping[str, str] | None = None,
) -> dict[str, str]:
    source_environment = environment if environment is not None else os.environ
    pipeline_token = config.get("pipeline_token") or source_environment.get("CATALOG_PIPELINE_TOKEN")
    sites_authorization = config.get("sites_authorization") or source_environment.get("OAI_SITES_AUTHORIZATION")
    if pipeline_token is None or sites_authorization is None:
        raise SyncError("publication_credentials_missing")
    child_environment = sanitized_child_environment(source_environment)
    child_environment["CATALOG_PIPELINE_TOKEN"] = validate_private_secret(
        pipeline_token, "pipeline_token"
    )
    child_environment["OAI_SITES_AUTHORIZATION"] = validate_private_secret(
        sites_authorization, "sites_authorization"
    )
    return child_environment


def run_step_result(
    step: str,
    command: Sequence[str],
    *,
    timeout: int | None = 7_200,
    environment: Mapping[str, str] | None = None,
    accepted_return_codes: Sequence[int] = (0,),
) -> tuple[list[object], int]:
    allowed_return_codes = frozenset(accepted_return_codes)
    if allowed_return_codes != {0} and not (
        step == "publication_apply" and allowed_return_codes == {0, 2}
    ):
        raise SyncError("subprocess_return_code_policy_invalid")
    child_environment = (
        low_resource_child_environment(environment)
        if environment is not None
        else sanitized_child_environment()
    )
    sensitive_values = [
        child_environment[key]
        for key in PUBLICATION_SECRET_ENVIRONMENT_KEYS
        if child_environment.get(key)
    ]
    if any(secret in str(argument) for secret in sensitive_values for argument in command):
        raise SyncError(f"{step}_command_contains_sensitive_value")
    try:
        result = subprocess.run(
            list(command),
            cwd=REPOSITORY_ROOT,
            env=child_environment,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as error:
        raise SyncError(f"{step}_execution_failed") from error
    stdout = result.stdout or ""
    stderr = result.stderr or ""
    if any(secret in stdout or secret in stderr for secret in sensitive_values):
        raise SyncError(f"{step}_sensitive_output_blocked")
    if result.returncode not in allowed_return_codes:
        raise SyncError(f"{step}_failed")
    return parse_json_documents(stdout), int(result.returncode)


def run_step(
    step: str,
    command: Sequence[str],
    *,
    timeout: int | None = 7_200,
    environment: Mapping[str, str] | None = None,
) -> list[object]:
    documents, _return_code = run_step_result(
        step,
        command,
        timeout=timeout,
        environment=environment,
    )
    return documents


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


def build_drive_sync_command(
    config: Mapping[str, Any], *, release_limit: int | None = None
) -> list[str]:
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
        str(release_limit or config["inventory_release_batch"]),
        "--resume",
    ]


def drain_drive_inventory(config: Mapping[str, Any]) -> dict[str, Any]:
    """Drain the resumable release inventory inside one top-level invocation.

    The crawler itself is deliberately bounded to 100 sequential folders. We
    keep invoking that same checkpointed worker until the inventory is complete
    or a whole pass makes no aggregate progress, which represents unreachable
    folders rather than an arbitrary batch boundary.
    """

    previous_signature: tuple[int, int, int] | None = None
    latest: dict[str, Any] = {}
    passes = 0
    while True:
        documents = run_step(
            "drive_sync",
            build_drive_sync_command(
                config,
                release_limit=DIRECT_INVENTORY_RELEASE_BATCH,
            ),
            timeout=1800,
        )
        compact = compact_child_summary("drive_sync", documents)
        if not isinstance(compact, dict):
            raise SyncError("drive_sync_summary_invalid")
        latest = compact
        passes += 1
        pending = compact.get("pendingReleases")
        inventory_items = compact.get("inventoryItems")
        errors = compact.get("errors")
        if not all(isinstance(value, int) and not isinstance(value, bool) and value >= 0 for value in (pending, inventory_items, errors)):
            raise SyncError("drive_sync_summary_invalid")
        if compact.get("complete") is True or pending == 0:
            break
        signature = (pending, inventory_items, errors)
        if signature == previous_signature:
            latest = {**latest, "stalled": True}
            break
        previous_signature = signature
    return {**latest, "passes": passes}


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


def select_unpublished_direct_records(
    records: Sequence[Mapping[str, Any]],
    pipeline_state: Path,
) -> list[dict[str, Any]]:
    """Skip only owner-source rows with an identical published base fingerprint."""

    published = completed_pipeline_fingerprints(pipeline_state)
    selected: list[dict[str, Any]] = []
    for record in records:
        candidate_id = str(record.get("candidate_id") or "")
        fingerprint = process.canonical_fingerprint(record)
        if published.get(candidate_id) == fingerprint:
            continue
        selected.append(dict(record))
    return selected


def publication_pipeline_rows(path: Path) -> dict[str, dict[str, Any]]:
    """Return only aggregate retry metadata needed to rotate exact failures."""

    if not path.is_file():
        return {}
    try:
        connection = sqlite3.connect(f"file:{path.resolve().as_posix()}?mode=ro", uri=True)
        columns = {
            str(row[1])
            for row in connection.execute("PRAGMA table_info(pipeline_items)").fetchall()
        }
        required = {"candidate_id", "manifest_fingerprint", "status"}
        if not required.issubset(columns):
            raise SyncError("pipeline_state_invalid")
        attempts_sql = "attempts" if "attempts" in columns else "0"
        updated_at_sql = "updated_at" if "updated_at" in columns else "''"
        rows = connection.execute(
            f"SELECT candidate_id, manifest_fingerprint, status, "  # noqa: S608
            f"{attempts_sql} AS attempts, {updated_at_sql} AS updated_at FROM pipeline_items"
        ).fetchall()
    except SyncError:
        raise
    except sqlite3.Error as error:
        raise SyncError("pipeline_state_invalid") from error
    finally:
        with contextlib.suppress(UnboundLocalError):
            connection.close()
    result: dict[str, dict[str, Any]] = {}
    for candidate_id, fingerprint, status, attempts, updated_at in rows:
        try:
            attempt_count = max(0, int(attempts or 0))
        except (TypeError, ValueError):
            attempt_count = 0
        result[str(candidate_id)] = {
            "manifestFingerprint": str(fingerprint or ""),
            "status": str(status or ""),
            "attempts": attempt_count,
            "updatedAt": str(updated_at or ""),
        }
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
    exact_records: Sequence[Mapping[str, Any]],
    pipeline_state: Path,
    limit: int,
    *,
    spotify_enrichment: Path | None = None,
) -> list[dict[str, Any]]:
    published = completed_pipeline_fingerprints(pipeline_state)
    pipeline_rows = publication_pipeline_rows(pipeline_state)
    fresh: list[tuple[int, dict[str, Any]]] = []
    retry: list[tuple[int, str, int, dict[str, Any]]] = []
    for index, record in enumerate(exact_records):
        process.validate_exact_record(record)
        candidate_id = str(record.get("candidate_id") or "")
        fingerprint = process.canonical_fingerprint(record)
        if published.get(candidate_id) == fingerprint:
            continue
        copied = dict(record)
        state = pipeline_rows.get(candidate_id)
        if state is None or state.get("status") == "published":
            fresh.append((index, copied))
            continue
        state_fingerprint = str(state.get("manifestFingerprint") or "")
        matches_retry = state_fingerprint == fingerprint
        if (
            not matches_retry
            and spotify_enrichment is not None
            and spotify_enrichment.is_file()
        ):
            attached = json.loads(json.dumps([record]))
            try:
                process.attach_verified_spotify_evidence(attached, spotify_enrichment)
            except process.PipelineError:
                attached = []
            if attached:
                matches_retry = (
                    process.canonical_fingerprint(attached[0]) == state_fingerprint
                )
        if not matches_retry:
            fresh.append((index, copied))
            continue
        retry.append(
            (
                int(state.get("attempts") or 0),
                str(state.get("updatedAt") or ""),
                index,
                copied,
            )
        )
    ordered = [record for _index, record in fresh]
    ordered.extend(record for _attempts, _updated_at, _index, record in sorted(retry))
    return ordered[:limit]


def parse_timestamp(value: object, label: str) -> dt.datetime:
    raw = str(value or "").strip()
    try:
        parsed = dt.datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError as error:
        raise SyncError(f"{label}_invalid") from error
    if parsed.tzinfo is None:
        raise SyncError(f"{label}_invalid")
    return parsed.astimezone(dt.timezone.utc)


def validate_evidence(
    path: Path | None,
    kind: str,
    selection_sha256: str,
    selection_count: int,
) -> dict[str, Any]:
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
    return payload


def validate_catalog_owner_attestation(
    path: Path | None,
    config: Mapping[str, Any],
) -> dict[str, str | None]:
    """Validate a private owner approval against all configured catalogue roots.

    The scope uses stable source identities, not a snapshot hash, so newly
    released rows under the same catalogue, workbook and Drive root remain
    covered. Any source switch closes the gate.
    """

    if path is None or not path.is_file():
        raise SyncError("catalog_owner_attestation_missing")
    path = assert_private_path(path, "catalog_owner_attestation")
    try:
        if path.stat().st_size > MAX_ATTESTATION_BYTES:
            raise SyncError("catalog_owner_attestation_invalid")
        payload = json.loads(path.read_text(encoding="utf-8"))
    except SyncError:
        raise
    except (OSError, json.JSONDecodeError) as error:
        raise SyncError("catalog_owner_attestation_invalid") from error

    claims = payload.get("claims") if isinstance(payload, dict) else None
    scope = payload.get("scope") if isinstance(payload, dict) else None
    if (
        not isinstance(payload, dict)
        or payload.get("schemaVersion") != 1
        or payload.get("kind") != "catalog_owner_attestation"
        or payload.get("approved") is not True
        or payload.get("reviewerRole") != "catalogue_owner"
        or not str(payload.get("reviewer") or "").strip()
        or not isinstance(claims, dict)
        or any(claims.get(claim) is not True for claim in OWNER_ATTESTATION_CLAIMS)
        or not isinstance(scope, dict)
    ):
        raise SyncError("catalog_owner_attestation_invalid")

    expected_scope = catalogue_scope_descriptor(config)
    try:
        attested_scope = {
            "catalogueSourceUrl": canonical_catalogue_source_url(scope.get("catalogueSourceUrl")),
            "workbookSourceUrl": google_sheet_export_url(str(scope.get("workbookSourceUrl") or "")),
            "driveSourceFolderId": str(scope.get("driveSourceFolderId") or "").strip(),
        }
    except SyncError as error:
        raise SyncError("catalog_owner_attestation_scope_invalid") from error
    if (
        DRIVE_ID_PATTERN.fullmatch(attested_scope["driveSourceFolderId"]) is None
        or attested_scope != expected_scope
    ):
        raise SyncError("catalog_owner_attestation_scope_invalid")

    reviewed_at = parse_timestamp(payload.get("reviewedAt"), "catalog_owner_attestation_reviewed_at")
    now = dt.datetime.now(dt.timezone.utc)
    if reviewed_at > now + dt.timedelta(minutes=5):
        raise SyncError("catalog_owner_attestation_reviewed_at_invalid")
    expires_at: str | None = None
    if payload.get("expiresAt"):
        parsed_expiry = parse_timestamp(payload["expiresAt"], "catalog_owner_attestation_expires_at")
        if parsed_expiry <= now:
            raise SyncError("catalog_owner_attestation_expired")
        expires_at = str(payload["expiresAt"])

    return {
        "reviewer": str(payload["reviewer"]).strip(),
        "reviewedAt": str(payload["reviewedAt"]),
        "expiresAt": expires_at,
        "attestationSha256": canonical_payload_sha256(payload),
        "catalogueScopeSha256": canonical_payload_sha256(expected_scope),
    }


def derive_selection_evidence(
    config: Mapping[str, Any],
    selection_sha256: str,
    selection_count: int,
) -> dict[str, bool | str]:
    """Materialize auditable, selection-bound approvals from the owner scope."""

    if SHA256_PATTERN.fullmatch(selection_sha256) is None or selection_count < 1:
        raise SyncError("publication_selection_invalid")
    owner_path = config.get("catalog_owner_attestation")
    rights_path = config.get("rights_evidence")
    human_path = config.get("human_evidence")
    if not isinstance(owner_path, Path):
        raise SyncError("catalog_owner_attestation_missing")
    if not isinstance(rights_path, Path) or not isinstance(human_path, Path):
        raise SyncError("selection_evidence_paths_missing")
    resolved_paths = {
        assert_private_path(owner_path, "catalog_owner_attestation"),
        assert_private_path(rights_path, "rights_clearance_evidence"),
        assert_private_path(human_path, "human_made_editorial_review_evidence"),
    }
    if len(resolved_paths) != 3:
        raise SyncError("selection_evidence_paths_invalid")

    owner = validate_catalog_owner_attestation(owner_path, config)
    common: dict[str, Any] = {
        "schemaVersion": 1,
        "approved": True,
        "selectionSha256": selection_sha256,
        "selectionCount": selection_count,
        "reviewer": owner["reviewer"],
        "reviewedAt": owner["reviewedAt"],
        "derivedAt": utc_now(),
        "derivedFrom": "catalog_owner_attestation",
        "sourceAttestationSha256": owner["attestationSha256"],
        "catalogueScopeSha256": owner["catalogueScopeSha256"],
    }
    if owner["expiresAt"]:
        common["expiresAt"] = owner["expiresAt"]
    atomic_write_json(rights_path, {**common, "kind": "rights_clearance"})
    atomic_write_json(human_path, {**common, "kind": "human_made_editorial_review"})

    validate_evidence(rights_path, "rights_clearance", selection_sha256, selection_count)
    validate_evidence(human_path, "human_made_editorial_review", selection_sha256, selection_count)
    return {"source": "catalog_owner_attestation", "selectionEvidenceDerived": True}


def authorize_publication(
    config: Mapping[str, Any],
    selection_sha256: str,
    selection_count: int,
) -> dict[str, bool | str]:
    """Use exact manual evidence first, then a configured owner attestation."""

    if SHA256_PATTERN.fullmatch(selection_sha256) is None or selection_count < 1:
        raise SyncError("publication_selection_invalid")
    try:
        rights = validate_evidence(
            config.get("rights_evidence"),
            "rights_clearance",
            selection_sha256,
            selection_count,
        )
        human = validate_evidence(
            config.get("human_evidence"),
            "human_made_editorial_review",
            selection_sha256,
            selection_count,
        )
        derived = [
            payload.get("derivedFrom") == "catalog_owner_attestation"
            for payload in (rights, human)
        ]
        if any(derived):
            if not all(derived):
                raise SyncError("catalog_owner_attestation_evidence_invalid")
            owner = validate_catalog_owner_attestation(config.get("catalog_owner_attestation"), config)
            if any(
                payload.get("sourceAttestationSha256") != owner["attestationSha256"]
                or payload.get("catalogueScopeSha256") != owner["catalogueScopeSha256"]
                for payload in (rights, human)
            ):
                raise SyncError("catalog_owner_attestation_evidence_invalid")
            return {"source": "catalog_owner_attestation", "selectionEvidenceDerived": False}
        return {"source": "selection_evidence", "selectionEvidenceDerived": False}
    except SyncError:
        if config.get("catalog_owner_attestation") is None:
            raise
    return derive_selection_evidence(config, selection_sha256, selection_count)


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
    allowed = {
        key: item[key]
        for key in (
            "mode",
            "step",
            "verificationMode",
            "enrichment",
            "matchedCandidates",
            "merge",
            "manifest",
            "exactRecords",
            "directRecords",
            "selected",
            "spotifyEnrichment",
            "pipelineState",
            "counts",
        )
        if key in item
    }
    return allowed


def publication_apply_summary(
    documents: Sequence[object], return_code: int
) -> tuple[dict[str, Any], bool]:
    summary = compact_child_summary("process", documents)
    if not isinstance(summary, dict) or return_code not in {0, 2}:
        raise SyncError("publication_apply_summary_invalid")
    raw_counts = summary.get("counts")
    count_keys = (
        "selected",
        "published",
        "already_published",
        "promotion_blocked",
        "failed",
    )
    if not isinstance(raw_counts, dict):
        raise SyncError("publication_apply_summary_invalid")
    counts: dict[str, int] = {}
    for key in count_keys:
        value = raw_counts.get(key)
        if not isinstance(value, int) or isinstance(value, bool) or value < 0:
            raise SyncError("publication_apply_summary_invalid")
        counts[key] = value
    completed = sum(counts[key] for key in count_keys if key != "selected")
    if completed != counts["selected"]:
        raise SyncError("publication_apply_summary_invalid")
    partial = counts["failed"] > 0 or counts["promotion_blocked"] > 0
    if (return_code == 2) != partial:
        raise SyncError("publication_apply_summary_invalid")
    sanitized = dict(summary)
    sanitized["counts"] = counts
    return sanitized, partial


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
    spotify_enrichment: Path | None,
    ffmpeg_executable: Path,
    apply: bool,
    verification_mode: str = "spotify",
    owner_attestation_sha256: str | None = None,
    catalogue_scope_sha256: str | None = None,
    selection_sha256: str | None = None,
) -> list[str]:
    command = [
        sys.executable,
        str(AUDIT_DIRECTORY / "process_catalog.py"),
        "--exact-manifest",
        str(exact_manifest),
        "--pipeline-state",
        str(pipeline_state),
        "--verification-mode",
        verification_mode,
        "--ffmpeg",
        str(ffmpeg_executable),
    ]
    if verification_mode == "spotify":
        if spotify_enrichment is None:
            raise SyncError("spotify_evidence_missing")
        command.extend(["--spotify-enrichment", str(spotify_enrichment)])
    elif verification_mode == "catalog_owner_direct":
        evidence = (
            owner_attestation_sha256,
            catalogue_scope_sha256,
            selection_sha256,
        )
        if any(value is None or SHA256_PATTERN.fullmatch(value) is None for value in evidence):
            raise SyncError("catalog_owner_evidence_invalid")
        command.extend(
            [
                "--batch-key",
                DIRECT_BATCH_KEY,
                "--owner-attestation-sha256",
                str(owner_attestation_sha256),
                "--catalogue-scope-sha256",
                str(catalogue_scope_sha256),
                "--selection-sha256",
                str(selection_sha256),
            ]
        )
    else:
        raise SyncError("verification_mode_invalid")
    if apply:
        command.extend(["--apply", "--rights-cleared", "--human-made-cleared"])
    else:
        command.append("--dry-run")
    return command


def execute_catalog_owner_drain(
    config: Mapping[str, Any],
    report: dict[str, Any],
) -> dict[str, Any]:
    """Publish every deterministic, technically readable owner-source row."""

    work_directory: Path = config["work_directory"]
    inventory = config["inventory_directory"] / "drive-inventory.json"
    manifest = work_directory / "manifest.jsonl"
    direct_manifest = work_directory / "catalog-owner-direct.jsonl"
    direct_selection = work_directory / "catalog-owner-direct-selection.jsonl"
    pipeline_state = work_directory / "pipeline-state.sqlite3"

    report["workbookRefresh"] = refresh_workbook(
        config["workbook_source_url"], config["workbook"]
    )
    report["driveSync"] = drain_drive_inventory(config)
    report["inventory"] = drive_inventory_summary(inventory)

    seed_documents = run_step(
        "ingest",
        build_ingest_command(config, inventory, apply=True, inspect_full=False),
        timeout=1800,
    )
    report["catalog"] = compact_child_summary("ingest", seed_documents)
    all_records = read_jsonl(manifest)
    direct_records = read_jsonl(direct_manifest)
    if any(not ingest.direct_publication_eligible(record) for record in direct_records):
        raise SyncError("catalog_owner_direct_manifest_invalid")
    selected_records = select_unpublished_direct_records(
        direct_records,
        pipeline_state,
    )
    selection_sha256 = write_jsonl(direct_selection, selected_records)
    report["directSource"] = {
        "candidates": len(all_records),
        "eligible": len(direct_records),
        "excluded": max(0, len(all_records) - len(direct_records)),
        "alreadyPublished": len(direct_records) - len(selected_records),
    }
    report["publication"] = {
        "selected": len(selected_records),
        "action": "apply",
        "verificationMode": "catalog_owner_direct",
    }
    inventory_complete = report["inventory"].get("complete") is True
    if not selected_records:
        report["status"] = "ok" if inventory_complete else "partial"
        return report

    owner = validate_catalog_owner_attestation(
        config.get("catalog_owner_attestation"), config
    )
    report["publication"]["authorization"] = {
        "source": "catalog_owner_attestation",
        "scopeBound": True,
    }
    ffmpeg_executable = resolve_ffmpeg_executable(config.get("ffmpeg_executable"))
    command_options = {
        "exact_manifest": direct_selection,
        "pipeline_state": pipeline_state,
        "spotify_enrichment": None,
        "ffmpeg_executable": ffmpeg_executable,
        "verification_mode": "catalog_owner_direct",
        "owner_attestation_sha256": str(owner["attestationSha256"]),
        "catalogue_scope_sha256": str(owner["catalogueScopeSha256"]),
        "selection_sha256": selection_sha256,
    }
    dry_documents = run_step(
        "publication_dry_run",
        build_process_catalog_command(**command_options, apply=False),
    )
    report["publication"]["plan"] = compact_child_summary(
        "process", dry_documents
    )
    apply_documents, apply_return_code = run_step_result(
        "publication_apply",
        build_process_catalog_command(**command_options, apply=True),
        environment=publication_apply_environment(config),
        accepted_return_codes=(0, 2),
        timeout=None,
    )
    apply_summary, process_partial = publication_apply_summary(
        apply_documents, apply_return_code
    )
    report["publication"]["result"] = apply_summary
    report["publication"]["publishedManifestBases"] = (
        record_published_manifest_bases(selected_records, pipeline_state)
    )
    report["status"] = (
        "partial" if process_partial or not inventory_complete else "ok"
    )
    return report


def execute(
    arguments: argparse.Namespace,
    *,
    config: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    if config is None:
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
        selected = select_publication_batch(
            exact_records,
            pipeline_state,
            config["publication_batch"],
            spotify_enrichment=spotify_cumulative,
        )
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
    if arguments.mode == "drain":
        return execute_catalog_owner_drain(config, report)
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
    selected = select_publication_batch(
        exact_records,
        pipeline_state,
        config["publication_batch"],
        spotify_enrichment=spotify_cumulative,
    )
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
        if config.get("catalog_owner_attestation") is not None:
            report["publication"]["authorization"] = authorize_publication(
                config, selection_sha256, len(selected)
            )
            report["status"] = "publish_ready"
            return report
        report["publication"]["evidenceRequired"] = {
            "rightsClearance": True,
            "humanMadeEditorialReview": True,
        }
        report["status"] = "review_required"
        return report

    report["publication"]["authorization"] = authorize_publication(
        config, selection_sha256, len(selected)
    )
    apply_documents, apply_return_code = run_step_result(
        "publication_apply",
        build_process_catalog_command(
            exact_manifest=publication_selection,
            pipeline_state=pipeline_state,
            spotify_enrichment=spotify_cumulative,
            ffmpeg_executable=ffmpeg_executable,
            apply=True,
        ),
        environment=publication_apply_environment(config),
        accepted_return_codes=(0, 2),
    )
    apply_summary, partial = publication_apply_summary(apply_documents, apply_return_code)
    report["publication"]["result"] = apply_summary
    report["publication"]["publishedManifestBases"] = record_published_manifest_bases(
        selected, pipeline_state
    )
    report["status"] = "partial" if partial else "ok"
    return report


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.ArgumentDefaultsHelpFormatter)
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG, help="Ignored private JSON configuration.")
    parser.add_argument(
        "--mode",
        choices=("plan", "continue", "publish", "drain"),
        default="plan",
    )
    parser.add_argument("--allow-network", action="store_true", help="Required for continue/publish network reads and writes.")
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    apply_low_resource_priority()
    arguments = build_parser().parse_args(argv)
    report_path: Path | None = None
    lock_attempted = False
    lock_acquired = False
    try:
        arguments.config = assert_private_path(arguments.config, "config")
        with contextlib.suppress(Exception):
            raw = json.loads(arguments.config.read_text(encoding="utf-8"))
            if isinstance(raw, dict) and raw.get("workDirectory"):
                report_path = resolve_config_path(raw["workDirectory"], base=REPOSITORY_ROOT, label="work_directory") / "last-run.json"
        config = load_config(arguments.config)
        report_path = config["work_directory"] / "last-run.json"
        lock_attempted = True
        with exclusive_sync_lock(config["work_directory"]):
            lock_acquired = True
            report = execute(arguments, config=config)
            if report_path and arguments.mode != "plan":
                atomic_write_json(report_path, report)
        print(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True))
        return 0 if report.get("status") in {"ok", "partial", "review_required", "publish_ready"} else 1
    except KeyboardInterrupt:
        report = {"schemaVersion": 1, "generatedAt": utc_now(), "status": "interrupted", "resumable": True}
        if report_path and (not lock_attempted or lock_acquired):
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
        if report_path and (not lock_attempted or lock_acquired):
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
        if report_path and (not lock_attempted or lock_acquired):
            atomic_write_json(report_path, report)
        print(json.dumps(report, indent=2, sort_keys=True))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

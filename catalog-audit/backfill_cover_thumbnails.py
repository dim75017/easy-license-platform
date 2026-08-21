#!/usr/bin/env python3
"""Backfill lightweight published-cover thumbnails without exposing catalogue rows."""

from __future__ import annotations

import argparse
import ctypes
import hashlib
import json
import os
import subprocess
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

DEFAULT_API_BASE_URL = "https://easy-license.dsomoguy.chatgpt.site"
MAX_SOURCE_BYTES = 20 * 1024 * 1024
MAX_THUMBNAIL_BYTES = 512 * 1024
PAGE_SIZE = 100


class BackfillError(RuntimeError):
    pass


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", required=True, type=Path)
    parser.add_argument("--api-base-url", default=DEFAULT_API_BASE_URL)
    parser.add_argument("--limit", type=int)
    parser.add_argument("--timeout", type=float, default=180.0)
    arguments = parser.parse_args()

    set_below_normal_priority()
    config = load_config(arguments.config)
    ffmpeg = required_executable(config.get("ffmpegExecutable"))
    pipeline_token = required_secret(config.get("pipelineToken"), "pipeline token")
    sites_authorization = optional_secret(config.get("sitesAuthorization"))
    base_url = arguments.api_base_url.rstrip("/")
    releases = published_releases(base_url, sites_authorization, arguments.timeout)
    if arguments.limit is not None:
        if arguments.limit < 1:
            raise BackfillError("limit_invalid")
        releases = releases[: arguments.limit]

    counts = {"selected": len(releases), "created": 0, "existing": 0, "failed": 0}
    with tempfile.TemporaryDirectory(prefix="symbiome-cover-thumbnails-") as temporary:
        temporary_root = Path(temporary)
        for release_id, cover_path in releases:
            try:
                source = temporary_root / "source"
                thumbnail = temporary_root / "thumbnail.webp"
                source.unlink(missing_ok=True)
                thumbnail.unlink(missing_ok=True)
                downloaded = download_if_missing(
                    base_url,
                    cover_path,
                    sites_authorization,
                    source,
                    arguments.timeout,
                )
                if not downloaded:
                    counts["existing"] += 1
                    continue
                encode_thumbnail(ffmpeg, source, thumbnail)
                upload_thumbnail(
                    base_url,
                    release_id,
                    pipeline_token,
                    sites_authorization,
                    thumbnail,
                    arguments.timeout,
                )
                counts["created"] += 1
            except (BackfillError, OSError, subprocess.SubprocessError, urllib.error.URLError):
                counts["failed"] += 1

    print(json.dumps(counts, sort_keys=True, separators=(",", ":")))
    return 0 if counts["failed"] == 0 else 2


def load_config(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise BackfillError("config_invalid") from error
    if not isinstance(value, dict):
        raise BackfillError("config_invalid")
    return value


def required_secret(value: object, label: str) -> str:
    secret = value.strip() if isinstance(value, str) else ""
    if len(secret) < 32 or any(character in secret for character in "\r\n"):
        raise BackfillError(f"{label.replace(' ', '_')}_invalid")
    return secret


def optional_secret(value: object) -> str | None:
    if value is None:
        return None
    return required_secret(value, "sites authorization")


def required_executable(value: object) -> Path:
    executable = Path(value) if isinstance(value, str) and value.strip() else None
    if executable is None or not executable.is_file():
        raise BackfillError("ffmpeg_executable_missing")
    return executable.resolve()


def set_below_normal_priority() -> None:
    if os.name != "nt":
        with suppress_os_error():
            os.nice(5)
        return
    below_normal_priority_class = 0x00004000
    kernel32 = ctypes.windll.kernel32
    kernel32.SetPriorityClass(kernel32.GetCurrentProcess(), below_normal_priority_class)


class suppress_os_error:
    def __enter__(self) -> None:
        return None

    def __exit__(self, exception_type: object, exception: object, traceback: object) -> bool:
        return isinstance(exception, OSError)


def public_headers(sites_authorization: str | None) -> dict[str, str]:
    headers = {
        "Accept": "application/json,image/webp,image/*;q=0.8",
        "User-Agent": "SymbiomeCoverThumbnailBackfill/1.0",
    }
    if sites_authorization:
        headers["OAI-Sites-Authorization"] = sites_authorization
    return headers


def published_releases(
    base_url: str,
    sites_authorization: str | None,
    timeout: float,
) -> list[tuple[int, str]]:
    releases: dict[int, str] = {}
    page = 1
    while True:
        query = urllib.parse.urlencode({
            "page": page,
            "pageSize": PAGE_SIZE,
            "onePerRelease": "true",
            "requireCover": "true",
        })
        request = urllib.request.Request(
            f"{base_url}/api/catalog/tracks?{query}",
            headers=public_headers(sites_authorization),
        )
        payload = json.loads(request_bytes(request, timeout, 4 * 1024 * 1024).decode("utf-8"))
        tracks = payload.get("tracks") if isinstance(payload, dict) else None
        pagination = payload.get("pagination") if isinstance(payload, dict) else None
        if not isinstance(tracks, list) or not isinstance(pagination, dict):
            raise BackfillError("catalog_response_invalid")
        for track in tracks:
            release = track.get("release") if isinstance(track, dict) else None
            release_id = release.get("id") if isinstance(release, dict) else None
            cover_path = release.get("coverUrl") if isinstance(release, dict) else None
            if (
                isinstance(release_id, int)
                and release_id > 0
                and isinstance(cover_path, str)
                and cover_path == f"/api/catalog/releases/{release_id}/cover"
            ):
                releases[release_id] = cover_path
        if pagination.get("hasNextPage") is not True:
            break
        next_page = pagination.get("nextPage")
        if not isinstance(next_page, int) or next_page != page + 1:
            raise BackfillError("catalog_pagination_invalid")
        page = next_page
    return sorted(releases.items())


def download_if_missing(
    base_url: str,
    cover_path: str,
    sites_authorization: str | None,
    destination: Path,
    timeout: float,
) -> bool:
    request = urllib.request.Request(
        f"{base_url}{cover_path}?variant=thumbnail",
        headers=public_headers(sites_authorization),
    )
    with open_request(request, timeout) as response:
        variant = str(response.headers.get("X-Cover-Variant") or "").strip().lower()
        if variant == "thumbnail":
            return False
        if variant != "original-fallback":
            raise BackfillError("cover_variant_header_invalid")
        size = 0
        prefix = bytearray()
        with destination.open("xb") as output:
            while True:
                chunk = response.read(1024 * 1024)
                if not chunk:
                    break
                if len(prefix) < 16:
                    prefix.extend(chunk[: 16 - len(prefix)])
                size += len(chunk)
                if size > MAX_SOURCE_BYTES:
                    raise BackfillError("cover_source_too_large")
                output.write(chunk)
        if size < 16 or bytes(prefix).lstrip().lower().startswith((b"<html", b"<!doctype")):
            raise BackfillError("cover_source_invalid")
    return True


def encode_thumbnail(ffmpeg: Path, source: Path, destination: Path) -> None:
    command = [
        str(ffmpeg),
        "-hide_banner",
        "-nostdin",
        "-loglevel",
        "error",
        "-threads",
        "1",
        "-i",
        str(source),
        "-vf",
        "scale=512:512:flags=lanczos",
        "-frames:v",
        "1",
        "-c:v",
        "libwebp",
        "-quality",
        "74",
        "-compression_level",
        "4",
        "-threads",
        "1",
        "-y",
        str(destination),
    ]
    completed = subprocess.run(
        command,
        check=False,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        creationflags=0x08000000 if os.name == "nt" else 0,
    )
    if completed.returncode != 0 or not destination.is_file():
        raise BackfillError("cover_thumbnail_encode_failed")
    payload = destination.read_bytes()
    if (
        len(payload) < 16
        or len(payload) > MAX_THUMBNAIL_BYTES
        or payload[:4] != b"RIFF"
        or payload[8:12] != b"WEBP"
    ):
        raise BackfillError("cover_thumbnail_output_invalid")


def upload_thumbnail(
    base_url: str,
    release_id: int,
    pipeline_token: str,
    sites_authorization: str | None,
    thumbnail: Path,
    timeout: float,
) -> None:
    payload = thumbnail.read_bytes()
    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {pipeline_token}",
        "Content-Type": "image/webp",
        "X-Content-Sha256": hashlib.sha256(payload).hexdigest(),
        "User-Agent": "SymbiomeCoverThumbnailBackfill/1.0",
    }
    if sites_authorization:
        headers["OAI-Sites-Authorization"] = sites_authorization
    request = urllib.request.Request(
        f"{base_url}/api/catalog/pipeline/releases/{release_id}/thumbnail",
        data=payload,
        headers=headers,
        method="PUT",
    )
    response = json.loads(request_bytes(request, timeout, 1024 * 1024).decode("utf-8"))
    if not isinstance(response, dict) or response.get("stored") is not True:
        raise BackfillError("cover_thumbnail_upload_invalid")


def request_bytes(request: urllib.request.Request, timeout: float, limit: int) -> bytes:
    with open_request(request, timeout) as response:
        payload = response.read(limit + 1)
    if len(payload) > limit:
        raise BackfillError("http_response_too_large")
    return payload


def open_request(request: urllib.request.Request, timeout: float):
    last_error: Exception | None = None
    for attempt in range(3):
        try:
            return urllib.request.urlopen(request, timeout=timeout)
        except urllib.error.HTTPError as error:
            last_error = error
            if error.code not in {429, 500, 502, 503, 504}:
                raise BackfillError("http_request_failed") from error
        except urllib.error.URLError as error:
            last_error = error
        if attempt < 2:
            time.sleep(2**attempt)
    raise BackfillError("http_request_failed") from last_error


if __name__ == "__main__":
    raise SystemExit(main())

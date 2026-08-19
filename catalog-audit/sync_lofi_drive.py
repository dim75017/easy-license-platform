#!/usr/bin/env python3
"""Build a resumable, private Drive inventory for the Symbiome catalogue.

The script reads folder listings only. It never downloads audio or artwork.
Row-level output is restricted to ``catalog-audit/private``; stdout contains
aggregate counters only so the command is safe to use from a recurring job.
"""

from __future__ import annotations

import argparse
import contextlib
import datetime as dt
import hashlib
import html
from html.parser import HTMLParser
import json
import os
from pathlib import Path
import re
import sqlite3
import sys
import tempfile
import time
from typing import Any, Iterable, Mapping, Sequence
import urllib.error
import urllib.parse
import urllib.request


REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
PRIVATE_ROOT = (REPOSITORY_ROOT / "catalog-audit" / "private").resolve()
DRIVE_ID = re.compile(r"[A-Za-z0-9_-]{10,200}")
FOLDER_MIME = "application/vnd.google-apps.folder"
WAV_MIMES = {"audio/wav", "audio/x-wav", "audio/wave", "audio/vnd.wave"}
IMAGE_MIMES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_HTML_BYTES = 8 * 1024 * 1024
MAX_FOLDER_DEPTH = 5
MAX_FOLDER_ITEMS = 5_000
USER_AGENT = "SymbiomeDriveCatalogueSync/1.0"
IVD_PATTERN = re.compile(r"window\['_DRIVE_ivd'\]\s*=\s*'((?:\\.|[^'])*)'")


class SyncError(RuntimeError):
    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


def utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()


def priority_timestamp(*values: object, fallback: str) -> str:
    """Return a UTC-sortable timestamp for Drive's display date tokens."""

    for value in values:
        text = str(value or "").strip()
        if not text:
            continue
        candidates = [text]
        date_match = re.search(r"[A-Za-z]+\s+\d{1,2},\s+\d{4}", text)
        if date_match and date_match.group(0) != text:
            candidates.append(date_match.group(0))
        for candidate in candidates:
            try:
                parsed = dt.datetime.fromisoformat(candidate.replace("Z", "+00:00"))
            except ValueError:
                parsed = None
            if parsed is None:
                for pattern in ("%b %d, %Y", "%B %d, %Y", "%d %b %Y", "%d %B %Y"):
                    try:
                        parsed = dt.datetime.strptime(candidate, pattern)
                        break
                    except ValueError:
                        continue
            if parsed is not None:
                if parsed.tzinfo is None:
                    parsed = parsed.replace(tzinfo=dt.timezone.utc)
                return parsed.astimezone(dt.timezone.utc).replace(microsecond=0).isoformat()
    return fallback


def validate_drive_id(value: object) -> str:
    text = str(value or "").strip()
    if not DRIVE_ID.fullmatch(text):
        raise SyncError("drive_id_invalid")
    return text


def private_path(value: Path, label: str) -> Path:
    resolved = value.resolve()
    try:
        resolved.relative_to(PRIVATE_ROOT)
    except ValueError as error:
        raise SyncError(f"{label}_outside_private_root") from error
    return resolved


def atomic_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    handle, temporary = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(handle, "w", encoding="utf-8", newline="\n") as stream:
            stream.write(text)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        with contextlib.suppress(OSError):
            os.unlink(temporary)


def atomic_json(path: Path, value: object) -> None:
    atomic_text(path, json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n")


def fetch_html(url: str, *, attempts: int = 4, minimum_delay: float = 0.25) -> str:
    request = urllib.request.Request(
        url,
        headers={"Accept": "text/html,application/xhtml+xml", "User-Agent": USER_AGENT},
    )
    for attempt in range(attempts):
        try:
            payload = bytearray()
            with urllib.request.urlopen(request, timeout=60) as response:
                while True:
                    chunk = response.read(256 * 1024)
                    if not chunk:
                        break
                    payload.extend(chunk)
                    if len(payload) > MAX_HTML_BYTES:
                        raise SyncError("listing_too_large")
            time.sleep(minimum_delay)
            return bytes(payload).decode("utf-8", errors="replace")
        except SyncError:
            raise
        except urllib.error.HTTPError as error:
            if error.code not in {429, 500, 502, 503, 504}:
                raise SyncError(f"http_{error.code}") from error
            last_code = f"http_{error.code}"
        except (OSError, urllib.error.URLError) as error:
            last_code = "transport_error"
        if attempt + 1 < attempts:
            time.sleep(min(8.0, 0.5 * (2**attempt)))
    raise SyncError(last_code)


def decode_javascript_string(value: str) -> str:
    output: list[str] = []
    index = 0
    simple = {"b": "\b", "f": "\f", "n": "\n", "r": "\r", "t": "\t", "/": "/", "\\": "\\", "'": "'", '"': '"'}
    while index < len(value):
        character = value[index]
        if character != "\\":
            output.append(character)
            index += 1
            continue
        index += 1
        if index >= len(value):
            raise SyncError("listing_escape_invalid")
        escape = value[index]
        index += 1
        if escape == "x":
            digits = value[index:index + 2]
            if len(digits) != 2 or not re.fullmatch(r"[0-9A-Fa-f]{2}", digits):
                raise SyncError("listing_escape_invalid")
            output.append(chr(int(digits, 16)))
            index += 2
        elif escape == "u":
            digits = value[index:index + 4]
            if len(digits) != 4 or not re.fullmatch(r"[0-9A-Fa-f]{4}", digits):
                raise SyncError("listing_escape_invalid")
            output.append(chr(int(digits, 16)))
            index += 4
        else:
            output.append(simple.get(escape, escape))
    return "".join(output)


def looks_like_drive_row(value: object) -> bool:
    return (
        isinstance(value, list)
        and len(value) > 3
        and isinstance(value[0], str)
        and DRIVE_ID.fullmatch(value[0]) is not None
        and isinstance(value[2], str)
        and isinstance(value[3], str)
    )


def iter_drive_rows(value: object) -> Iterable[list[Any]]:
    if looks_like_drive_row(value):
        yield value  # type: ignore[misc]
        return
    if isinstance(value, list):
        for item in value:
            yield from iter_drive_rows(item)


def millis_iso(value: object) -> str:
    if not isinstance(value, (int, float)) or value <= 0:
        return ""
    try:
        return dt.datetime.fromtimestamp(value / 1000, tz=dt.timezone.utc).replace(microsecond=0).isoformat()
    except (OverflowError, OSError, ValueError):
        return ""


def parse_folder_listing(document: str) -> list[dict[str, Any]]:
    match = IVD_PATTERN.search(document)
    if not match:
        raise SyncError("listing_payload_missing")
    try:
        payload = json.loads(decode_javascript_string(match.group(1)))
    except (json.JSONDecodeError, UnicodeError) as error:
        raise SyncError("listing_payload_invalid") from error
    rows: list[dict[str, Any]] = []
    seen: set[str] = set()
    for item in iter_drive_rows(payload):
        item_id = validate_drive_id(item[0])
        if item_id in seen:
            continue
        seen.add(item_id)
        size = item[13] if len(item) > 13 and isinstance(item[13], (int, float, str)) else ""
        rows.append(
            {
                "id": item_id,
                "name": html.unescape(str(item[2])).strip(),
                "mimeType": str(item[3]).strip(),
                "createdTime": millis_iso(item[9] if len(item) > 9 else None),
                "modifiedTime": millis_iso(item[10] if len(item) > 10 else None),
                "size": str(int(size)) if isinstance(size, (int, float)) else str(size or ""),
            }
        )
    if not rows and "_DRIVE_ivd" not in document:
        raise SyncError("listing_unavailable")
    return rows


class EmbeddedFolderParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.entries: list[dict[str, str]] = []
        self._depth = 0
        self._entry: dict[str, str] | None = None
        self._entry_depth = 0
        self._capture = ""
        self._capture_depth = -1

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = {key: value or "" for key, value in attrs}
        classes = set(attributes.get("class", "").split())
        if self._entry is None and tag == "div" and "flip-entry" in classes:
            self._entry = {"id": "", "title": "", "updatedAt": ""}
            self._entry_depth = self._depth
        if self._entry is not None:
            if tag == "a":
                href = attributes.get("href", "")
                match = re.search(r"/drive/folders/([A-Za-z0-9_-]{10,200})", href)
                if match:
                    self._entry["id"] = match.group(1)
            if "flip-entry-title" in classes:
                self._capture = "title"
                self._capture_depth = self._depth
                if attributes.get("title"):
                    self._entry["title"] = attributes["title"].strip()
            elif "flip-entry-last-modified" in classes:
                self._capture = "updatedAt"
                self._capture_depth = self._depth
        if tag not in {"meta", "link", "img", "br", "hr", "input"}:
            self._depth += 1

    def handle_data(self, data: str) -> None:
        if self._entry is not None and self._capture and data.strip():
            self._entry[self._capture] = (self._entry.get(self._capture, "") + " " + data.strip()).strip()

    def handle_endtag(self, tag: str) -> None:
        if tag not in {"meta", "link", "img", "br", "hr", "input"}:
            self._depth = max(0, self._depth - 1)
        if self._capture and self._depth <= self._capture_depth:
            self._capture = ""
            self._capture_depth = -1
        if self._entry is not None and self._depth <= self._entry_depth:
            if self._entry.get("id") and self._entry.get("title"):
                self.entries.append(self._entry)
            self._entry = None
            self._capture = ""


def parse_embedded_root(document: str) -> list[dict[str, str]]:
    parser = EmbeddedFolderParser()
    parser.feed(document)
    deduped: dict[str, dict[str, str]] = {}
    for entry in parser.entries:
        item_id = validate_drive_id(entry["id"])
        previous = deduped.get(item_id, {})
        deduped[item_id] = {
            "id": item_id,
            "title": entry["title"].strip() or previous.get("title", ""),
            "updatedAt": entry.get("updatedAt", "") or previous.get("updatedAt", ""),
        }
    if not deduped:
        raise SyncError("root_listing_unavailable")
    return list(deduped.values())


def load_seed(path: Path) -> tuple[str, list[dict[str, str]]]:
    path = private_path(path, "seed")
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise SyncError("seed_invalid") from error
    if not isinstance(payload, dict) or payload.get("schemaVersion") != 1:
        raise SyncError("seed_invalid")
    root = validate_drive_id(payload.get("sourceFolderId"))
    raw = payload.get("releaseFolders")
    if not isinstance(raw, list):
        raise SyncError("seed_invalid")
    releases: list[dict[str, str]] = []
    for row in raw:
        if not isinstance(row, dict):
            continue
        releases.append(
            {
                "id": validate_drive_id(row.get("id")),
                "title": str(row.get("title") or "").strip(),
                "createdAt": str(row.get("createdAt") or ""),
                "updatedAt": str(row.get("updatedAt") or ""),
            }
        )
    return root, releases


def open_state(path: Path) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path)
    connection.row_factory = sqlite3.Row
    connection.executescript(
        """
        PRAGMA journal_mode=DELETE;
        CREATE TABLE IF NOT EXISTS releases (
          folder_id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          seed_created_at TEXT NOT NULL DEFAULT '',
          seed_updated_at TEXT NOT NULL DEFAULT '',
          root_present INTEGER NOT NULL DEFAULT 1,
          scan_status TEXT NOT NULL DEFAULT 'pending',
          inventory_fingerprint TEXT,
          change_type TEXT NOT NULL DEFAULT 'new',
          delivery_state TEXT NOT NULL DEFAULT 'pending',
          item_count INTEGER NOT NULL DEFAULT 0,
          audio_count INTEGER NOT NULL DEFAULT 0,
          artwork_count INTEGER NOT NULL DEFAULT 0,
          folder_count INTEGER NOT NULL DEFAULT 0,
          last_error_code TEXT,
          last_scanned_at TEXT,
          priority_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS items (
          folder_id TEXT NOT NULL,
          item_id TEXT NOT NULL,
          name TEXT NOT NULL,
          mime_type TEXT NOT NULL,
          size_bytes TEXT NOT NULL DEFAULT '',
          created_time TEXT NOT NULL DEFAULT '',
          modified_time TEXT NOT NULL DEFAULT '',
          parent_id TEXT NOT NULL,
          path TEXT NOT NULL,
          depth INTEGER NOT NULL,
          kind TEXT NOT NULL,
          PRIMARY KEY(folder_id, item_id)
        );
        CREATE INDEX IF NOT EXISTS items_folder_idx ON items(folder_id, path);
        """
    )
    columns = {row[1] for row in connection.execute("PRAGMA table_info(releases)").fetchall()}
    if "priority_at" not in columns:
        connection.execute("ALTER TABLE releases ADD COLUMN priority_at TEXT NOT NULL DEFAULT ''")
        connection.execute("UPDATE releases SET priority_at=COALESCE(NULLIF(updated_at,''),?)", (utc_now(),))
        connection.commit()
    return connection


def root_listing_matches_expected(
    seed: Sequence[Mapping[str, str]],
    live: Sequence[Mapping[str, str]],
    *,
    known_active_ids: Iterable[str] = (),
) -> bool:
    expected_ids = {str(row.get("id") or "") for row in seed}
    expected_ids.update(str(item_id) for item_id in known_active_ids if item_id)
    observed_ids = {str(row.get("id") or "") for row in live}
    return bool(expected_ids) and observed_ids == expected_ids


def upsert_release_roots(
    connection: sqlite3.Connection,
    seed: Sequence[Mapping[str, str]],
    live: Sequence[Mapping[str, str]],
    *,
    root_snapshot_complete: bool = False,
) -> int:
    now = utc_now()
    merged: dict[str, dict[str, str]] = {row["id"]: dict(row) for row in seed}
    for row in live:
        existing = merged.get(row["id"], {})
        merged[row["id"]] = {
            "id": row["id"],
            "title": row.get("title") or existing.get("title", ""),
            "createdAt": existing.get("createdAt", now),
            # The embedded view exposes a display timestamp. It is still a
            # useful opaque change token once stored, and is never parsed.
            "updatedAt": row.get("updatedAt") or existing.get("updatedAt", ""),
        }
    # The embedded Drive listing can be a partial/virtualized window. Absence is
    # authoritative only after the observed ID set exactly matches the expected
    # snapshot; otherwise preserve every previously known release.
    if root_snapshot_complete:
        connection.execute("UPDATE releases SET root_present=0, updated_at=?", (now,))
    new_count = 0
    for folder_id, row in merged.items():
        existing = connection.execute("SELECT seed_updated_at, scan_status FROM releases WHERE folder_id=?", (folder_id,)).fetchone()
        source_updated = str(row.get("updatedAt") or "")
        priority_at = priority_timestamp(source_updated, row.get("createdAt"), fallback=now)
        if existing is None:
            new_count += 1
            connection.execute(
                "INSERT INTO releases(folder_id,title,seed_created_at,seed_updated_at,root_present,scan_status,change_type,delivery_state,priority_at,updated_at) VALUES(?,?,?,?,1,'pending','new','pending',?,?)",
                (folder_id, str(row.get("title") or "").strip(), str(row.get("createdAt") or ""), source_updated, priority_at, now),
            )
        else:
            changed = bool(source_updated and source_updated != str(existing["seed_updated_at"] or ""))
            connection.execute(
                """UPDATE releases SET title=?, seed_created_at=COALESCE(NULLIF(?,''),seed_created_at),
                   seed_updated_at=COALESCE(NULLIF(?,''),seed_updated_at), root_present=1,
                   scan_status=CASE WHEN ? THEN 'pending' ELSE scan_status END,
                   change_type=CASE WHEN ? THEN 'changed' ELSE change_type END,
                   delivery_state=CASE WHEN ? THEN 'pending' ELSE delivery_state END,
                   priority_at=CASE WHEN ? THEN ? ELSE priority_at END,
                   updated_at=CASE WHEN ? THEN ? ELSE updated_at END WHERE folder_id=?""",
                (str(row.get("title") or "").strip(), str(row.get("createdAt") or ""), source_updated, changed, changed, changed, changed, priority_at, changed, now, folder_id),
            )
    connection.commit()
    return new_count


def classify_item(name: str, mime_type: str) -> str:
    lowered = name.casefold()
    if mime_type == FOLDER_MIME:
        return "folder"
    if mime_type.casefold() in WAV_MIMES or lowered.endswith((".wav", ".wave")):
        return "audio"
    if mime_type.casefold() in IMAGE_MIMES or lowered.endswith((".jpg", ".jpeg", ".png", ".webp", ".gif")):
        return "artwork"
    return "other"


def crawl_release(folder_id: str) -> list[dict[str, Any]]:
    queue: list[tuple[str, tuple[str, ...], int]] = [(folder_id, (), 0)]
    seen_folders: set[str] = set()
    result: list[dict[str, Any]] = []
    while queue:
        parent_id, path_parts, depth = queue.pop(0)
        if parent_id in seen_folders:
            continue
        if depth > MAX_FOLDER_DEPTH:
            raise SyncError("folder_depth_exceeded")
        seen_folders.add(parent_id)
        encoded = urllib.parse.quote(parent_id, safe="")
        children = parse_folder_listing(fetch_html(f"https://drive.google.com/drive/folders/{encoded}?hl=en"))
        for child in children:
            name = child["name"]
            kind = classify_item(name, child["mimeType"])
            path = "/".join((*path_parts, name))
            row = {
                **child,
                "parents": [parent_id],
                "parent_id": parent_id,
                "path": path,
                "release_folder_id": folder_id,
                "depth": depth,
                "kind": kind,
            }
            result.append(row)
            if len(result) > MAX_FOLDER_ITEMS:
                raise SyncError("folder_item_limit_exceeded")
            if kind == "folder":
                queue.append((child["id"], (*path_parts, name), depth + 1))
    return result


def fingerprint_items(items: Sequence[Mapping[str, Any]]) -> str:
    canonical = [
        {key: item.get(key, "") for key in ("id", "name", "mimeType", "size", "modifiedTime", "parent_id", "path", "kind")}
        for item in sorted(items, key=lambda row: (str(row.get("path", "")).casefold(), str(row.get("id", ""))))
    ]
    return hashlib.sha256(json.dumps(canonical, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest()


def save_release(connection: sqlite3.Connection, folder_id: str, items: Sequence[Mapping[str, Any]]) -> None:
    now = utc_now()
    fingerprint = fingerprint_items(items)
    previous = connection.execute("SELECT inventory_fingerprint, change_type FROM releases WHERE folder_id=?", (folder_id,)).fetchone()
    change_type = "new" if not previous or not previous["inventory_fingerprint"] else ("changed" if previous["inventory_fingerprint"] != fingerprint else str(previous["change_type"]))
    connection.execute("DELETE FROM items WHERE folder_id=?", (folder_id,))
    for item in items:
        connection.execute(
            """INSERT INTO items(folder_id,item_id,name,mime_type,size_bytes,created_time,modified_time,parent_id,path,depth,kind)
               VALUES(?,?,?,?,?,?,?,?,?,?,?)""",
            (folder_id, item["id"], item["name"], item["mimeType"], item.get("size", ""), item.get("createdTime", ""), item.get("modifiedTime", ""), item["parent_id"], item["path"], item["depth"], item["kind"]),
        )
    counts = {kind: sum(item.get("kind") == kind for item in items) for kind in ("audio", "artwork", "folder")}
    connection.execute(
        """UPDATE releases SET scan_status='complete', inventory_fingerprint=?, change_type=?,
           delivery_state=CASE WHEN inventory_fingerprint IS NULL OR inventory_fingerprint != ? THEN 'pending' ELSE delivery_state END,
           item_count=?,audio_count=?,artwork_count=?,folder_count=?,last_error_code=NULL,last_scanned_at=?,updated_at=?
           WHERE folder_id=?""",
        (fingerprint, change_type, fingerprint, len(items), counts["audio"], counts["artwork"], counts["folder"], now, now, folder_id),
    )
    connection.commit()


def save_failure(connection: sqlite3.Connection, folder_id: str, code: str) -> None:
    connection.execute(
        "UPDATE releases SET scan_status='error',last_error_code=?,last_scanned_at=?,updated_at=? WHERE folder_id=?",
        (code, utc_now(), utc_now(), folder_id),
    )
    connection.commit()


def selected_releases(connection: sqlite3.Connection, limit: int) -> list[str]:
    rows = connection.execute(
        """SELECT folder_id FROM releases WHERE root_present=1 AND scan_status IN ('pending','error')
           ORDER BY CASE scan_status WHEN 'pending' THEN 0 ELSE 1 END,
                    priority_at DESC,
                    COALESCE(last_scanned_at,'') ASC, folder_id ASC LIMIT ?""",
        (limit,),
    ).fetchall()
    return [str(row["folder_id"]) for row in rows]


def export_outputs(connection: sqlite3.Connection, output: Path, *, root_complete: bool) -> dict[str, int | bool]:
    releases = connection.execute("SELECT * FROM releases WHERE root_present=1 ORDER BY COALESCE(NULLIF(seed_updated_at,''),seed_created_at) DESC, folder_id").fetchall()
    items = connection.execute(
        """SELECT i.* FROM items i JOIN releases r ON r.folder_id=i.folder_id
           WHERE r.root_present=1 AND r.scan_status='complete' ORDER BY i.path COLLATE NOCASE, i.item_id"""
    ).fetchall()
    files: list[dict[str, Any]] = []
    for row in items:
        files.append({
            "id": row["item_id"], "name": row["name"], "mimeType": row["mime_type"],
            "size": row["size_bytes"], "createdTime": row["created_time"], "modifiedTime": row["modified_time"],
            "parents": [row["parent_id"]], "path": row["path"], "release_folder_id": row["folder_id"],
        })
    pending = sum(row["scan_status"] != "complete" for row in releases)
    complete = bool(root_complete and pending == 0)
    atomic_json(output / "drive-inventory.json", {"schemaVersion": 1, "generatedAt": utc_now(), "complete": complete, "files": files})
    # A successfully written inventory is the delivery boundary for this
    # component. The downstream wrapper always re-reads the full inventory, so
    # marking complete releases delivered here remains safely resumable even if
    # a later ingestion step fails.
    connection.execute(
        "UPDATE releases SET delivery_state='delivered' WHERE root_present=1 AND scan_status='complete' AND delivery_state='pending'"
    )
    connection.commit()
    releases = connection.execute(
        "SELECT * FROM releases WHERE root_present=1 ORDER BY COALESCE(NULLIF(seed_updated_at,''),seed_created_at) DESC, folder_id"
    ).fetchall()
    backlog = "".join(
        json.dumps({
            "releaseKey": hashlib.sha256(str(row["folder_id"]).encode()).hexdigest()[:24],
            "changeType": row["change_type"], "scanStatus": row["scan_status"], "deliveryState": row["delivery_state"],
            "itemCount": row["item_count"], "audioCount": row["audio_count"], "artworkCount": row["artwork_count"],
        }, sort_keys=True) + "\n"
        for row in releases if row["scan_status"] != "complete" or row["delivery_state"] == "pending"
    )
    atomic_text(output / "backlog.jsonl", backlog)
    return {
        "rootFolders": len(releases), "pendingReleases": pending, "pendingItems": sum(int(row["item_count"]) for row in releases if row["delivery_state"] == "pending"),
        "inventoryItems": len(files), "audioFiles": sum(row["kind"] == "audio" for row in items),
        "artworkFiles": sum(row["kind"] == "artwork" for row in items), "complete": complete,
    }


def execute(arguments: argparse.Namespace) -> dict[str, Any]:
    seed_path = private_path(arguments.seed, "seed")
    output = private_path(arguments.output_dir, "output")
    root_id, seed = load_seed(seed_path)
    report: dict[str, Any] = {"schemaVersion": 1, "generatedAt": utc_now(), "mode": "apply" if arguments.apply else "plan", "seedReleases": len(seed)}
    if not arguments.apply:
        report.update({"selected": min(arguments.max_releases, len(seed)), "status": "ok"})
        return report
    if not arguments.allow_network:
        raise SyncError("allow_network_required")
    output.mkdir(parents=True, exist_ok=True)
    connection = open_state(output / "sync-state.sqlite3")
    known_active_ids = {
        str(row["folder_id"])
        for row in connection.execute("SELECT folder_id FROM releases WHERE root_present=1").fetchall()
    }
    expected_ids = {row["id"] for row in seed} | known_active_ids
    root_complete = False
    live: list[dict[str, str]] = []
    try:
        encoded = urllib.parse.quote(root_id, safe="")
        live = parse_embedded_root(fetch_html(f"https://drive.google.com/embeddedfolderview?id={encoded}&hl=en#list"))
        root_complete = root_listing_matches_expected(seed, live, known_active_ids=known_active_ids)
    except SyncError as error:
        connection.close()
        report.update(
            {
                "rootListing": {
                    "status": "error",
                    "error": error.code,
                    "expectedFolders": len(expected_ids),
                    "observedFolders": 0,
                },
                "selected": 0,
                "scanned": 0,
                "errors": 1,
                "status": "failed",
                "error": "root_listing_failed",
                "resumable": True,
            }
        )
        atomic_json(output / "summary.json", report)
        return report
    report["rootListing"] = {
        "status": "complete" if root_complete else "partial",
        "expectedFolders": len(expected_ids),
        "observedFolders": len({row["id"] for row in live}),
        "matchesExpected": root_complete,
    }
    try:
        root_new = upsert_release_roots(connection, seed, live, root_snapshot_complete=root_complete)
        selected = selected_releases(connection, arguments.max_releases)
        scanned = 0
        errors = 0
        for folder_id in selected:
            try:
                save_release(connection, folder_id, crawl_release(folder_id))
                scanned += 1
            except SyncError as error:
                save_failure(connection, folder_id, error.code)
                errors += 1
        aggregate = export_outputs(connection, output, root_complete=root_complete)
    finally:
        connection.close()
    report.update(aggregate)
    report.update({"rootNew": root_new, "selected": len(selected), "scanned": scanned, "errors": errors, "status": "ok" if errors == 0 and root_complete else "partial"})
    atomic_json(output / "summary.json", report)
    return report


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--seed", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--max-releases", type=int, default=25)
    parser.add_argument("--resume", action="store_true", help="Resume is implicit; retained for an explicit recurring CLI.")
    parser.add_argument("--allow-network", action="store_true")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--apply", action="store_true")
    mode.add_argument("--dry-run", action="store_true")
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    arguments = build_parser().parse_args(argv)
    if arguments.max_releases < 1 or arguments.max_releases > 100:
        raise SyncError("max_releases_out_of_bounds")
    try:
        report = execute(arguments)
        print(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True))
        return 0 if report.get("status") in {"ok", "partial"} else 1
    except SyncError as error:
        print(json.dumps({"schemaVersion": 1, "generatedAt": utc_now(), "status": "failed", "error": error.code, "resumable": True}, indent=2, sort_keys=True))
        return 1
    except KeyboardInterrupt:
        print(json.dumps({"schemaVersion": 1, "generatedAt": utc_now(), "status": "interrupted", "resumable": True}, indent=2, sort_keys=True))
        return 130
    except Exception:
        print(json.dumps({"schemaVersion": 1, "generatedAt": utc_now(), "status": "failed", "error": "unexpected_failure", "resumable": True}, indent=2, sort_keys=True))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

import datetime as dt
import hashlib
import io
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest

from continue_catalog_sync_loader import sync


def exact_record(candidate_id="b" * 28):
    return {
        "candidate_id": candidate_id,
        "status": "exact",
        "reasons": [],
        "audio_match_kind": "exact_title",
        "audio_match_score": 100,
        "spotify_id": "1" * 22,
        "spotify_duration_seconds": 120.0,
        "spotify_match_kind": "exact",
        "track": {
            "source_row": 1,
            "release": "Release",
            "upc": "12345678",
            "title": "Track",
            "artists": ["Artist"],
            "duration_seconds": 120.0,
            "isrc": "USABC1200001",
            "genre": "Lofi",
            "subgenre": "",
        },
        "audio": {
            "file_id": "1" + "D" * 24,
            "name": "Track.wav",
            "folder_id": "",
            "folder_path": "",
            "mime_type": "audio/wav",
            "size_bytes": 100,
            "modified_time": "",
        },
        "cover": {"file_id": "1" + "C" * 24, "is_square": True, "quality": "3000 x 3000", "upc": "12345678"},
        "inspection": {
            "status": "complete",
            "mode": "full",
            "content_type": "audio/wav",
            "content_length": 100,
            "sha256": "a" * 64,
            "error": None,
            "wav": {
                "container": "RIFF",
                "codec": "PCM",
                "channels": 2,
                "sample_rate": 48000,
                "bits_per_sample": 16,
                "byte_rate": 192000,
                "data_size": 23040000,
                "duration_seconds": 120.0,
            },
        },
    }


def spotify_evidence_record(
    candidate_id="b" * 28,
    *,
    disposition="accepted",
    title="Track",
):
    accepted = disposition == "accepted"
    return {
        "recordKey": candidate_id,
        "inputIndex": 0,
        "spotifyId": "1" * 22,
        "local": {
            "title": "Track",
            "artists": ["Artist"],
            "releaseTitle": "Release",
            "upc": "12345678",
            "sourceSha256": "a" * 64,
            "audioInspectionComplete": True,
        },
        "spotify": {
            "title": title,
            "artists": ["Artist"],
            "durationMs": 120000,
            "sources": {"oembed": "ok", "embed": "ok"},
        },
        "cache": "miss",
        "disposition": disposition,
        "reasons": [] if accepted else ["manual_review"],
        "checks": {
            "title": {"status": "exact" if accepted else "review"},
            "artists": {"status": "exact" if accepted else "review"},
            "duration": {"status": "match" if accepted else "review"},
        },
        "artworkRecommendation": "owned",
    }


class InventoryTests(unittest.TestCase):
    def test_public_inventory_summary_never_returns_rows_or_ids(self):
        with tempfile.TemporaryDirectory() as directory:
            destination = Path(directory) / "inventory.json"
            private_id = "A" * 20
            destination.write_text(
                json.dumps(
                    {
                        "schemaVersion": 1,
                        "complete": False,
                        "files": [
                            {"id": private_id, "name": "Private track.wav", "mimeType": "audio/wav"},
                            {"id": "B" * 20, "name": "Private folder", "mimeType": "application/vnd.google-apps.folder"},
                        ],
                    }
                ),
                encoding="utf-8",
            )
            summary = sync.drive_inventory_summary(destination)
            self.assertEqual(summary["wavFiles"], 1)
            self.assertEqual(summary["items"], 2)
            self.assertFalse(summary["complete"])
            serialized_summary = json.dumps(summary)
            self.assertNotIn(private_id, serialized_summary)
            self.assertNotIn("Private track", serialized_summary)

    def test_drive_sync_command_uses_private_seed_and_resumable_public_scraper(self):
        with tempfile.TemporaryDirectory() as directory:
            temporary = Path(directory)
            (temporary / "sync_lofi_drive.py").write_text("# fixture\n", encoding="utf-8")
            original = sync.AUDIT_DIRECTORY
            sync.AUDIT_DIRECTORY = temporary
            try:
                command = sync.build_drive_sync_command(
                    {
                        "drive_seed": temporary / "seed.json",
                        "inventory_directory": temporary / "output",
                        "inventory_release_batch": 25,
                    }
                )
            finally:
                sync.AUDIT_DIRECTORY = original
        self.assertIn("--resume", command)
        self.assertIn("--max-releases", command)
        self.assertNotIn("--token", command)
        self.assertNotIn("--api-key", command)

    def test_drive_summary_keeps_real_aggregate_fields_and_drops_private_rows(self):
        summary = sync.compact_child_summary(
            "drive_sync",
            [
                {
                    "schemaVersion": 1,
                    "mode": "apply",
                    "status": "partial",
                    "seedReleases": 743,
                    "rootFolders": 744,
                    "pendingReleases": 719,
                    "pendingItems": 12,
                    "inventoryItems": 90,
                    "audioFiles": 60,
                    "artworkFiles": 30,
                    "complete": False,
                    "rootNew": 1,
                    "selected": 25,
                    "scanned": 24,
                    "errors": 1,
                    "privateTitle": "Never expose this",
                    "folderId": "A" * 20,
                }
            ],
        )
        self.assertEqual(
            summary,
            {
                "seedReleases": 743,
                "rootFolders": 744,
                "pendingReleases": 719,
                "pendingItems": 12,
                "inventoryItems": 90,
                "audioFiles": 60,
                "artworkFiles": 30,
                "rootNew": 1,
                "selected": 25,
                "scanned": 24,
                "errors": 1,
                "complete": False,
                "mode": "apply",
                "status": "partial",
            },
        )
        self.assertNotIn("Never expose", json.dumps(summary))
        self.assertNotIn("A" * 20, json.dumps(summary))

    def test_node_resolution_finds_sibling_codex_runtime_when_path_is_empty(self):
        with tempfile.TemporaryDirectory() as directory:
            dependencies = Path(directory) / "dependencies"
            python = dependencies / "python" / "python.exe"
            node = dependencies / "node" / "bin" / "node.exe"
            python.parent.mkdir(parents=True)
            node.parent.mkdir(parents=True)
            python.write_bytes(b"")
            node.write_bytes(b"")
            resolved = sync.resolve_node_executable(
                environment={},
                which=lambda _name: None,
                python_executable=python,
            )
        self.assertEqual(resolved, str(node.resolve()))

    def test_node_resolution_honors_valid_override_and_rejects_injection(self):
        with tempfile.TemporaryDirectory() as directory:
            node = Path(directory) / "node.exe"
            node.write_bytes(b"")
            self.assertEqual(
                sync.resolve_node_executable(
                    environment={"SYMBIOME_NODE_EXECUTABLE": str(node)},
                    which=lambda _name: None,
                ),
                str(node.resolve()),
            )
        with self.assertRaisesRegex(sync.SyncError, "node_executable_invalid"):
            sync.resolve_node_executable(
                environment={"SYMBIOME_NODE_EXECUTABLE": "node\nmalicious"},
                which=lambda _name: None,
            )

    def test_google_sheet_refresh_is_host_allowlisted_and_xlsx_validated(self):
        import openpyxl

        identifier = "S" * 20
        export = sync.google_sheet_export_url(
            f"https://docs.google.com/spreadsheets/d/{identifier}/edit?usp=sharing"
        )
        self.assertEqual(
            export,
            f"https://docs.google.com/spreadsheets/d/{identifier}/export?format=xlsx",
        )
        with self.assertRaisesRegex(sync.SyncError, "workbook_source_url_invalid"):
            sync.google_sheet_export_url("https://example.com/private.xlsx")

        workbook = openpyxl.Workbook()
        workbook.active.title = "Publishing catalogue"
        workbook.create_sheet("Cover Album")
        workbook.create_sheet("Identity Info")
        payload = io.BytesIO()
        workbook.save(payload)
        workbook.close()

        class Response(io.BytesIO):
            def __enter__(self):
                return self

            def __exit__(self, *_args):
                self.close()

        with tempfile.TemporaryDirectory() as directory:
            destination = Path(directory) / "all-data.xlsx"
            result = sync.refresh_workbook(
                f"https://docs.google.com/spreadsheets/d/{identifier}/edit",
                destination,
                opener=lambda *_args, **_kwargs: Response(payload.getvalue()),
            )
            self.assertTrue(result["changed"])
            self.assertTrue(destination.is_file())


class FfmpegTests(unittest.TestCase):
    def test_private_config_accepts_optional_existing_ffmpeg_and_rejects_missing_file(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            workbook = root / "all-data.xlsx"
            seed = root / "seed.json"
            ffmpeg = root / "ffmpeg.exe"
            config_path = root / "config.json"
            workbook.write_bytes(b"fixture")
            seed.write_text("{}", encoding="utf-8")
            ffmpeg.write_bytes(b"fixture")
            payload = {
                "schemaVersion": 1,
                "workDirectory": str(root / "work"),
                "workbook": str(workbook),
                "workbookSourceUrl": "https://docs.google.com/spreadsheets/d/" + "S" * 20,
                "driveSeed": str(seed),
                "driveInventoryDirectory": str(root / "inventory"),
                "ffmpegExecutable": str(ffmpeg),
            }
            config_path.write_text(json.dumps(payload), encoding="utf-8")
            config = sync.load_config(config_path)
            self.assertEqual(config["ffmpeg_executable"], ffmpeg.resolve())

            payload["ffmpegExecutable"] = str(root / "missing-ffmpeg.exe")
            config_path.write_text(json.dumps(payload), encoding="utf-8")
            with self.assertRaisesRegex(sync.SyncError, "ffmpeg_executable_missing"):
                sync.load_config(config_path)

    def test_ffmpeg_resolution_supports_override_imageio_and_path_then_fails_closed(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            override = root / "override.exe"
            imageio = root / "imageio.exe"
            path_ffmpeg = root / "path.exe"
            for executable in (override, imageio, path_ffmpeg):
                executable.write_bytes(b"fixture")

            self.assertEqual(
                sync.resolve_ffmpeg_executable(
                    None,
                    environment={"SYMBIOME_FFMPEG_EXECUTABLE": str(override)},
                    which=lambda _name: None,
                    imageio_getter=lambda: None,
                ),
                override.resolve(),
            )
            self.assertEqual(
                sync.resolve_ffmpeg_executable(
                    None,
                    environment={},
                    which=lambda _name: None,
                    imageio_getter=lambda: str(imageio),
                ),
                imageio.resolve(),
            )
            self.assertEqual(
                sync.resolve_ffmpeg_executable(
                    None,
                    environment={},
                    which=lambda name: str(path_ffmpeg) if name == "ffmpeg" else None,
                    imageio_getter=lambda: None,
                ),
                path_ffmpeg.resolve(),
            )
            with self.assertRaisesRegex(sync.SyncError, "ffmpeg_missing"):
                sync.resolve_ffmpeg_executable(
                    None,
                    environment={},
                    which=lambda _name: None,
                    imageio_getter=lambda: None,
                )
            with self.assertRaisesRegex(sync.SyncError, "ffmpeg_executable_invalid"):
                sync.resolve_ffmpeg_executable(
                    None,
                    environment={"SYMBIOME_FFMPEG_EXECUTABLE": "ffmpeg\nmalicious"},
                    which=lambda _name: None,
                    imageio_getter=lambda: None,
                )

    def test_process_commands_always_receive_ffmpeg_without_leaking_it_to_summary(self):
        private_ffmpeg = Path("private") / "ffmpeg.exe"
        common = {
            "exact_manifest": Path("private") / "selection.jsonl",
            "pipeline_state": Path("private") / "pipeline.sqlite3",
            "spotify_enrichment": Path("private") / "spotify.json",
            "ffmpeg_executable": private_ffmpeg,
        }
        dry_run = sync.build_process_catalog_command(**common, apply=False)
        apply = sync.build_process_catalog_command(**common, apply=True)
        for command in (dry_run, apply):
            self.assertIn("--ffmpeg", command)
            self.assertEqual(command[command.index("--ffmpeg") + 1], str(private_ffmpeg))
        self.assertIn("--dry-run", dry_run)
        self.assertNotIn("--rights-cleared", dry_run)
        self.assertIn("--apply", apply)
        self.assertIn("--rights-cleared", apply)
        summary = sync.compact_child_summary(
            "process",
            [{"mode": "dry-run", "selected": 3, "ffmpeg": str(private_ffmpeg)}],
        )
        self.assertNotIn("ffmpeg", summary)
        self.assertNotIn(str(private_ffmpeg), json.dumps(summary))


class SelectionTests(unittest.TestCase):
    def test_spotify_selection_requires_full_hash_and_rotates_by_attempt_count(self):
        first = exact_record("b" * 28)
        second = exact_record("c" * 28)
        first["spotify_duration_seconds"] = None
        second["spotify_duration_seconds"] = None
        state = {"spotifyAttempts": {first["candidate_id"]: {"count": 2, "lastAttemptAt": "now"}}}
        selected = sync.select_spotify_batch([first, second], state, 1)
        self.assertEqual(selected[0]["candidate_id"], second["candidate_id"])
        second["inspection"]["mode"] = "range"
        selected = sync.select_spotify_batch([first, second], state, 2)
        self.assertEqual([item["candidate_id"] for item in selected], [first["candidate_id"]])

    def test_publication_skips_only_identical_completed_fingerprint(self):
        record = exact_record()
        with tempfile.TemporaryDirectory() as directory:
            state_path = Path(directory) / "pipeline.sqlite3"
            connection = sqlite3.connect(state_path)
            connection.execute("CREATE TABLE pipeline_items (candidate_id TEXT, manifest_fingerprint TEXT, status TEXT)")
            connection.execute(
                "INSERT INTO pipeline_items VALUES (?, ?, 'published')",
                (record["candidate_id"], sync.process.canonical_fingerprint(record)),
            )
            connection.commit()
            connection.close()
            self.assertEqual(sync.select_publication_batch([record], state_path, 1), [])
            changed = json.loads(json.dumps(record))
            changed["track"]["genre"] = "Ambient"
            self.assertEqual(len(sync.select_publication_batch([changed], state_path, 1)), 1)

    def test_bootstrap_merges_only_published_rows_with_current_fingerprint_and_acks(self):
        matching = exact_record("b" * 28)
        changed = exact_record("c" * 28)
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source_path = root / "batch-old" / "pipeline-state.sqlite3"
            target_path = root / "unified" / "pipeline-state.sqlite3"
            source = sync.process.open_pipeline_state(source_path)
            now = dt.datetime.now(dt.timezone.utc).isoformat()
            for record in (matching, changed):
                source.execute(
                    """INSERT INTO pipeline_items (
                    candidate_id, manifest_fingerprint, batch_key, status,
                    rights_cleared_ack, human_made_cleared_ack, created_at, updated_at
                    ) VALUES (?, ?, ?, 'published', 1, 1, ?, ?)""",
                    (
                        record["candidate_id"],
                        sync.process.canonical_fingerprint(record),
                        sync.process.DEFAULT_BATCH_KEY,
                        now,
                        now,
                    ),
                )
            source.commit()
            source.close()
            changed["track"]["genre"] = "Changed after publication"
            counts = sync.bootstrap_published_pipeline_state(
                [matching, changed], target_path, search_root=root
            )
            self.assertEqual(counts["merged"], 1)
            self.assertEqual(counts["refused"], 1)
            target = sqlite3.connect(target_path)
            rows = target.execute("SELECT candidate_id FROM pipeline_items").fetchall()
            target.close()
            self.assertEqual(rows, [(matching["candidate_id"],)])

    def test_ingestion_bootstrap_reuses_only_full_inspection_with_same_fingerprint(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            target_path = root / "unified" / "ingestion-state.sqlite3"
            source_path = root / "batch-old" / "ingestion-state.sqlite3"
            target = sync.ingest.open_state(target_path)
            source = sync.ingest.open_state(source_path)
            payload = json.dumps({"track": {}, "audio": {}})
            target.execute(
                """INSERT INTO candidates (
                candidate_id, fingerprint, payload_json, status, reasons_json, updated_at
                ) VALUES ('matching', 'same', ?, 'review', '[]', 'now')""",
                (payload,),
            )
            target.execute(
                """INSERT INTO candidates (
                candidate_id, fingerprint, payload_json, status, reasons_json, updated_at
                ) VALUES ('changed', 'new', ?, 'review', '[]', 'now')""",
                (payload,),
            )
            wav = json.dumps(
                {
                    "container": "RIFF",
                    "codec": "PCM",
                    "channels": 2,
                    "sample_rate": 48000,
                    "bits_per_sample": 16,
                    "byte_rate": 192000,
                    "data_size": 23040000,
                    "duration_seconds": 120,
                }
            )
            for candidate_id in ("matching", "changed"):
                source.execute(
                    """INSERT INTO candidates (
                    candidate_id, fingerprint, payload_json, status, reasons_json,
                    inspection_status, inspection_mode, wav_json, sha256, updated_at
                    ) VALUES (?, 'same', ?, 'exact', '[]', 'complete', 'full', ?, ?, 'now')""",
                    (candidate_id, payload, wav, "a" * 64),
                )
            target.commit()
            source.commit()
            target.close()
            source.close()
            counts = sync.bootstrap_full_ingestion_state(target_path, search_root=root)
            self.assertEqual(counts["merged"], 1)
            self.assertEqual(counts["refused"], 1)
            target = sqlite3.connect(target_path)
            rows = dict(target.execute("SELECT candidate_id, inspection_status FROM candidates"))
            target.close()
            self.assertEqual(rows, {"matching": "complete", "changed": "pending"})


class EvidenceTests(unittest.TestCase):
    def test_spotify_history_bootstrap_keeps_only_current_unambiguous_structured_rows(self):
        accepted_key = "b" * 28
        review_key = "c" * 28
        ambiguous_key = "d" * 28
        stale_key = "e" * 28
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            first = root / "batch-one" / "spotify-enrichment" / "enriched-tracks.json"
            second = root / "batch-two" / "spotify-enrichment" / "enriched-tracks.json"
            malformed = root / "batch-bad" / "spotify-enrichment" / "enriched-tracks.json"
            cumulative = root / "unified" / "spotify-evidence.json"
            first.parent.mkdir(parents=True)
            second.parent.mkdir(parents=True)
            malformed.parent.mkdir(parents=True)
            accepted = spotify_evidence_record(accepted_key)
            duplicate = json.loads(json.dumps(accepted))
            duplicate["inputIndex"] = 99
            duplicate["cache"] = "hit"
            first.write_text(
                json.dumps(
                    {
                        "records": [
                            accepted,
                            spotify_evidence_record(review_key, disposition="review"),
                            spotify_evidence_record(ambiguous_key, title="First title"),
                            spotify_evidence_record(stale_key),
                            spotify_evidence_record("not-a-candidate"),
                        ]
                    }
                ),
                encoding="utf-8",
            )
            second.write_text(
                json.dumps(
                    {
                        "records": [
                            duplicate,
                            spotify_evidence_record(ambiguous_key, title="Second title"),
                        ]
                    }
                ),
                encoding="utf-8",
            )
            malformed.write_text("not json", encoding="utf-8")

            counts = sync.bootstrap_cumulative_spotify(
                cumulative,
                search_root=root,
                allowed_record_keys={accepted_key, review_key, ambiguous_key},
            )
            payload = json.loads(cumulative.read_text(encoding="utf-8"))

        self.assertEqual(counts["records"], 2)
        self.assertEqual(counts["accepted"], 1)
        self.assertEqual(counts["review"], 1)
        self.assertEqual(counts["duplicates"], 1)
        self.assertEqual(counts["ambiguous"], 1)
        self.assertEqual(counts["staleRecords"], 1)
        self.assertEqual(counts["invalidRecords"], 1)
        self.assertEqual(counts["invalidSources"], 1)
        self.assertEqual(
            {record["recordKey"] for record in payload["records"]},
            {accepted_key, review_key},
        )
        self.assertNotIn("cache", payload["records"][0])
        self.assertNotIn("inputIndex", payload["records"][0])
        self.assertNotIn(accepted_key, json.dumps(counts))

    def test_current_spotify_batch_overrides_history_and_invalidates_newer_failures(self):
        replaced_key = "b" * 28
        unavailable_key = "c" * 28
        ambiguous_key = "d" * 28
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            cumulative = root / "spotify-evidence.json"
            current = root / "spotify-enrichment" / "enriched-tracks.json"
            current.parent.mkdir(parents=True)
            cumulative.write_text(
                json.dumps(
                    {
                        "records": [
                            spotify_evidence_record(replaced_key, title="Old title"),
                            spotify_evidence_record(unavailable_key),
                        ]
                    }
                ),
                encoding="utf-8",
            )
            unavailable = spotify_evidence_record(unavailable_key)
            unavailable["disposition"] = "unavailable"
            unavailable["spotify"] = None
            first_conflict = spotify_evidence_record(ambiguous_key, title="First")
            second_conflict = spotify_evidence_record(ambiguous_key, title="Second")
            current.write_text(
                json.dumps(
                    {
                        "records": [
                            spotify_evidence_record(replaced_key, title="Current title"),
                            unavailable,
                            first_conflict,
                            second_conflict,
                        ]
                    }
                ),
                encoding="utf-8",
            )

            counts = sync.merge_cumulative_spotify(current, cumulative)
            payload = json.loads(cumulative.read_text(encoding="utf-8"))

        self.assertEqual(counts["records"], 1)
        self.assertEqual(counts["accepted"], 1)
        self.assertEqual(counts["currentInvalid"], 1)
        self.assertEqual(counts["currentAmbiguous"], 1)
        self.assertEqual(payload["records"][0]["spotify"]["title"], "Current title")

    def test_three_historical_acceptances_survive_process_revalidation(self):
        records = [exact_record(character * 28) for character in ("b", "c", "d")]
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "old" / "spotify-enrichment" / "enriched-tracks.json"
            cumulative = root / "unified" / "spotify-evidence.json"
            source.parent.mkdir(parents=True)
            source.write_text(
                json.dumps(
                    {
                        "records": [
                            spotify_evidence_record(record["candidate_id"])
                            for record in records
                        ]
                    }
                ),
                encoding="utf-8",
            )
            counts = sync.bootstrap_cumulative_spotify(
                cumulative,
                search_root=root,
                allowed_record_keys=(record["candidate_id"] for record in records),
            )
            copied = json.loads(json.dumps(records))
            attached = sync.process.attach_verified_spotify_evidence(copied, cumulative)

        self.assertEqual(counts["accepted"], 3)
        self.assertEqual(attached["attached"], 3)

    def test_evidence_is_explicit_and_bound_to_the_selection_hash(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "rights.json"
            selection_hash = hashlib.sha256(b"selection").hexdigest()
            path.write_text(
                json.dumps(
                    {
                        "schemaVersion": 1,
                        "kind": "rights_clearance",
                        "approved": True,
                        "selectionSha256": selection_hash,
                        "selectionCount": 3,
                        "reviewer": "Catalogue team",
                        "reviewedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
                    }
                ),
                encoding="utf-8",
            )
            sync.validate_evidence(path, "rights_clearance", selection_hash, 3)
            with self.assertRaisesRegex(sync.SyncError, "rights_clearance_evidence_invalid"):
                sync.validate_evidence(path, "rights_clearance", "0" * 64, 3)

    def test_publish_command_never_gets_attestations_from_configuration(self):
        config = {
            "workbook": Path("private.xlsx"),
            "orchard": Path("orchard.xlsx"),
            "work_directory": Path("private"),
            "inspection_batch": 5,
            "release_batch": 2,
            "maximum_run_minutes": 45,
        }
        command = sync.build_ingest_command(
            config, Path("inventory.json"), apply=True, inspect_full=True
        )
        self.assertIn("--inspect", command)
        self.assertIn("full", command)
        self.assertIn("--release-batch-size", command)
        self.assertIn("--max-inspection-seconds", command)
        self.assertNotIn("--rights-cleared", command)
        self.assertNotIn("--human-made-cleared", command)


if __name__ == "__main__":
    unittest.main()

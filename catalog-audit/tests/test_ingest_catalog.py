import dataclasses
import io
import json
from pathlib import Path
import sqlite3
import struct
import tempfile
import unittest
import wave

from types import SimpleNamespace

from catalog_audit_loader import ingest


class DriveParsingTests(unittest.TestCase):
    def test_extracts_ids_even_when_sheet_display_inserts_spaces(self):
        file_id = "1" + "AbCdEfGhIjKlMnOpQrStUvWxYz"
        value = "https://drive.google.com/file/d/" + file_id[:9] + " " + file_id[9:] + "/view?usp=drivesdk"
        self.assertEqual(ingest.extract_drive_id(value, folder=False), file_id)

    def test_parses_multiline_audio_list_without_leaking_urls(self):
        first_id = "1" + "A" * 20
        second_id = "2" + "B" * 20
        base = "https://drive.google.com/file/d/"
        value = f"Artist - One.wav : {base}{first_id}/view\nTwo.wav : {base}{second_id}/view"
        entries = ingest.parse_audio_entries(value)
        self.assertEqual([entry.name for entry in entries], ["Artist - One.wav", "Two.wav"])
        self.assertEqual(len({entry.file_id for entry in entries}), 2)

    def test_reads_hyperlink_formula_display_text(self):
        cell = SimpleNamespace(
            value='=HYPERLINK("https://drive.google.com/drive/folders/private", "Growing Older")',
            hyperlink=None,
        )
        self.assertEqual(ingest.cell_display_text(cell), "Growing Older")

    def test_accepts_only_real_spotify_ids_from_identity_info(self):
        spotify_id = "A" * 22
        self.assertEqual(ingest.extract_spotify_id(spotify_id), spotify_id)
        self.assertEqual(ingest.extract_spotify_id("12345678.0"), "")

    def test_curated_orchard_row_wins_over_identity_fallback(self):
        primary = ingest.OrchardTrack("123", "Release", "Track", "Artist", "A" * 22, 120, True)
        fallback = ingest.OrchardTrack("123", "Release", "Track", "Artist", "", 120, True)
        self.assertEqual(ingest.merge_orchard_rows([primary], [fallback]), [primary])

    def test_drive_inventory_metadata_replaces_workbook_metadata_for_same_file_id(self):
        file_id = "1" + "D" * 20
        workbook_audio = ingest.DriveAudio(
            file_id=file_id,
            name="Artist - Track.wav",
            folder_id="workbook-folder",
            size_bytes=100,
            modified_time="2026-01-01T00:00:00Z",
        )
        inventory_audio = ingest.DriveAudio(
            file_id=file_id,
            name="Artist - Track.wav",
            folder_id="wav-folder",
            folder_path="WAV",
            mime_type="audio/wav",
            size_bytes=200,
            modified_time="2026-08-19T10:00:00Z",
        )
        release = ingest.ReleaseAudio("123", "Release", "release-folder", (workbook_audio,))
        merged = ingest.merge_drive_discovery(
            [release],
            {"release-folder": [inventory_audio]},
            {},
            object(),
            discover=False,
        )
        self.assertEqual(merged[0].files, (inventory_audio,))

    def test_only_complete_inventory_can_remove_a_workbook_audio_reference(self):
        workbook_audio = ingest.DriveAudio(file_id="1" + "D" * 20, name="Artist - Track.wav")
        release = ingest.ReleaseAudio("123", "Release", "release-folder", (workbook_audio,))
        partial = ingest.merge_drive_discovery(
            [release], {}, {}, object(), discover=False, inventory_complete=False
        )
        complete = ingest.merge_drive_discovery(
            [release], {}, {}, object(), discover=False, inventory_complete=True
        )
        self.assertEqual(partial[0].files, (workbook_audio,))
        self.assertEqual(complete[0].files, ())


class WavInspectionTests(unittest.TestCase):
    def test_reads_pcm_duration_from_prefix(self):
        stream = io.BytesIO()
        with wave.open(stream, "wb") as handle:
            handle.setnchannels(2)
            handle.setsampwidth(2)
            handle.setframerate(48_000)
            handle.writeframes(b"\x00\x00\x00\x00" * 48_000)
        info = ingest.parse_wav_prefix(stream.getvalue())
        self.assertEqual(info.codec, "PCM")
        self.assertEqual(info.channels, 2)
        self.assertEqual(info.sample_rate, 48_000)
        self.assertAlmostEqual(info.duration_seconds, 1.0, places=4)

    def test_rejects_non_wave(self):
        with self.assertRaisesRegex(ValueError, "not a RIFF"):
            ingest.parse_wav_prefix(b"not a wav file" + b"\x00" * 32)


class MatchingTests(unittest.TestCase):
    def setUp(self):
        self.track = ingest.Track(
            source_row=4,
            release="Time",
            upc="5054283576979",
            title="Time",
            artists=("Voyage",),
            duration_seconds=304,
            isrc="GBKQU1829151",
            genre="Synthwave",
            subgenre="",
        )

    def test_artist_prefix_is_exact_title_match(self):
        audio = ingest.DriveAudio(file_id="1" + "A" * 20, name="Voyage - Time.wav")
        score, kind = ingest.filename_match_score(audio, self.track)
        self.assertEqual((score, kind), (100.0, "exact_title"))

    def test_version_mismatch_is_detected(self):
        self.assertTrue(ingest.incompatible_version("Voyage - Time (Instrumental).wav", "Time"))
        self.assertFalse(ingest.incompatible_version("Voyage - Time.wav", "Time"))


class SpotifyMetadataMergeTests(unittest.TestCase):
    def test_verified_duration_reclassifies_a_fully_inspected_candidate(self):
        connection = sqlite3.connect(":memory:")
        connection.row_factory = sqlite3.Row
        connection.execute(
            """CREATE TABLE candidates (
            candidate_id TEXT PRIMARY KEY, payload_json TEXT, status TEXT,
            reasons_json TEXT, wav_json TEXT, sha256 TEXT, error TEXT,
            updated_at TEXT
            )"""
        )
        payload = {
            "spotify_id": "1" * 22,
            "spotify_duration_seconds": None,
            "track": {"duration_seconds": 120},
        }
        wav = {
            "container": "RIFF", "codec": "PCM", "channels": 2,
            "sample_rate": 48000, "bits_per_sample": 24,
            "byte_rate": 288000, "data_size": 34560000,
            "duration_seconds": 120,
        }
        connection.execute(
            "INSERT INTO candidates VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (
                "candidate", json.dumps(payload), "review",
                json.dumps(["spotify_duration_missing"]), json.dumps(wav),
                "a" * 64, "", "now",
            ),
        )
        result = ingest.apply_spotify_metadata(
            connection,
            {"1" * 22: {"duration_ms": 120000}},
        )
        row = connection.execute("SELECT status, reasons_json FROM candidates").fetchone()
        self.assertEqual(result["updated"], 1)
        self.assertEqual(row["status"], "exact")
        self.assertEqual(json.loads(row["reasons_json"]), [])

    def test_unchanged_inventory_refresh_preserves_verified_spotify_duration_and_exact_status(self):
        track = ingest.Track(
            source_row=1,
            release="Release",
            upc="12345678",
            title="Track",
            artists=("Artist",),
            duration_seconds=120,
            isrc="USABC1200001",
            genre="Lofi",
            subgenre="",
        )
        audio = ingest.DriveAudio(file_id="1" + "D" * 20, name="Artist - Track.wav")
        cover = ingest.Cover(upc="12345678", file_id="1" + "C" * 20, quality="3000 x 3000", is_square=True)
        candidate = ingest.Candidate(
            candidate_id="b" * 28,
            track=track,
            audio=audio,
            audio_match_score=100,
            audio_match_kind="exact_title",
            spotify_id="1" * 22,
            spotify_duration_seconds=None,
            spotify_match_kind="exact",
            cover=cover,
            status="review",
            reasons=["spotify_duration_missing", "audio_inspection_pending", "sha256_pending"],
            fingerprint=ingest.candidate_fingerprint(track, audio, "1" * 22, cover),
        )
        with tempfile.TemporaryDirectory() as directory:
            connection = ingest.open_state(Path(directory) / "state.sqlite3")
            ingest.upsert_candidates(connection, [candidate])
            wav = ingest.WavInfo("RIFF", "PCM", 2, 48000, 16, 192000, 23040000, 120)
            connection.execute(
                """UPDATE candidates SET inspection_status='complete', inspection_mode='full',
                wav_json=?, sha256=? WHERE candidate_id=?""",
                (json.dumps(wav.__dict__), "a" * 64, candidate.candidate_id),
            )
            connection.commit()
            ingest.apply_spotify_metadata(connection, {"1" * 22: {"duration_ms": 120000}})
            ingest.upsert_candidates(connection, [candidate])
            row = connection.execute(
                "SELECT payload_json, status, reasons_json FROM candidates WHERE candidate_id=?",
                (candidate.candidate_id,),
            ).fetchone()
            connection.close()
        self.assertEqual(json.loads(row["payload_json"])["spotify_duration_seconds"], 120)
        self.assertEqual(row["status"], "exact")
        self.assertEqual(json.loads(row["reasons_json"]), [])

    def test_changed_drive_size_and_mtime_invalidate_old_checksum_for_same_file_id(self):
        track = ingest.Track(
            source_row=1,
            release="Release",
            upc="12345678",
            title="Track",
            artists=("Artist",),
            duration_seconds=120,
            isrc="USABC1200001",
            genre="Lofi",
            subgenre="",
        )
        old_audio = ingest.DriveAudio(
            file_id="1" + "D" * 20,
            name="Artist - Track.wav",
            size_bytes=100,
            modified_time="2026-01-01T00:00:00Z",
        )
        current_audio = dataclasses.replace(
            old_audio,
            size_bytes=200,
            modified_time="2026-08-19T10:00:00Z",
        )
        cover = ingest.Cover("12345678", "1" + "C" * 20, "3000 x 3000", True)

        def candidate(audio):
            return ingest.Candidate(
                candidate_id="b" * 28,
                track=track,
                audio=audio,
                audio_match_score=100,
                audio_match_kind="exact_title",
                spotify_id="1" * 22,
                spotify_duration_seconds=120,
                spotify_match_kind="exact",
                cover=cover,
                status="review",
                reasons=["audio_inspection_pending", "sha256_pending"],
                fingerprint=ingest.candidate_fingerprint(track, audio, "1" * 22, cover),
            )

        old_candidate = candidate(old_audio)
        current_candidate = candidate(current_audio)
        self.assertNotEqual(old_candidate.fingerprint, current_candidate.fingerprint)
        with tempfile.TemporaryDirectory() as directory:
            connection = ingest.open_state(Path(directory) / "state.sqlite3")
            ingest.upsert_candidates(connection, [old_candidate])
            connection.execute(
                """UPDATE candidates SET inspection_status='complete', inspection_mode='full',
                content_length=100, wav_json=?, sha256=? WHERE candidate_id=?""",
                (
                    json.dumps(
                        ingest.WavInfo("RIFF", "PCM", 2, 48000, 16, 192000, 23040000, 120).__dict__
                    ),
                    "a" * 64,
                    old_candidate.candidate_id,
                ),
            )
            connection.commit()
            ingest.upsert_candidates(connection, [current_candidate])
            row = connection.execute(
                """SELECT fingerprint, payload_json, inspection_status, inspection_mode,
                content_length, wav_json, sha256 FROM candidates WHERE candidate_id=?""",
                (current_candidate.candidate_id,),
            ).fetchone()
            connection.close()

        self.assertEqual(row["fingerprint"], current_candidate.fingerprint)
        self.assertEqual(json.loads(row["payload_json"])["audio"]["size_bytes"], 200)
        self.assertEqual(row["inspection_status"], "pending")
        self.assertIsNone(row["inspection_mode"])
        self.assertIsNone(row["content_length"])
        self.assertIsNone(row["wav_json"])
        self.assertIsNone(row["sha256"])


class StateTests(unittest.TestCase):
    def test_state_uses_single_process_delete_journal(self):
        with tempfile.TemporaryDirectory() as directory:
            connection = ingest.open_state(Path(directory) / "state.sqlite3")
            try:
                self.assertEqual(connection.execute("PRAGMA journal_mode").fetchone()[0], "delete")
            finally:
                connection.close()


class InspectionBatchTests(unittest.TestCase):
    def test_full_inspection_is_bounded_by_release_and_reports_backlog(self):
        stream = io.BytesIO()
        with wave.open(stream, "wb") as handle:
            handle.setnchannels(2)
            handle.setsampwidth(2)
            handle.setframerate(48_000)
            handle.writeframes(b"\x00\x00\x00\x00" * 48_000)
        prefix = stream.getvalue()

        class Drive:
            def hash_full_file(self, _file_id):
                return "a" * 64, prefix, {"content-type": "audio/wav"}, len(prefix)

        connection = sqlite3.connect(":memory:")
        connection.row_factory = sqlite3.Row
        connection.execute(
            """CREATE TABLE candidates (
            candidate_id TEXT PRIMARY KEY, fingerprint TEXT, payload_json TEXT,
            status TEXT, reasons_json TEXT, inspection_status TEXT,
            inspection_mode TEXT, content_type TEXT, content_length INTEGER,
            wav_json TEXT, sha256 TEXT, error TEXT, updated_at TEXT
            )"""
        )
        for index, release in enumerate(("A", "B", "C")):
            payload = {
                "track": {"release": release, "duration_seconds": 1},
                "audio": {"file_id": str(index + 1) * 20},
                "spotify_duration_seconds": 1,
            }
            connection.execute(
                "INSERT INTO candidates VALUES (?, '', ?, 'review', '[]', 'pending', NULL, NULL, NULL, NULL, NULL, NULL, '')",
                (str(index), json.dumps(payload)),
            )
        connection.commit()
        result = ingest.inspect_pending(
            connection,
            Drive(),
            mode="full",
            batch_size=3,
            force=False,
            release_batch_size=1,
            maximum_seconds=60,
        )
        self.assertEqual(result["selected"], 1)
        self.assertEqual(result["releases"], 1)
        self.assertEqual(result["remaining"], 2)
        self.assertEqual(result["remainingReleases"], 2)

    def test_failed_rows_do_not_starve_the_initial_pending_backlog(self):
        connection = sqlite3.connect(":memory:")
        connection.row_factory = sqlite3.Row
        connection.execute(
            """CREATE TABLE candidates (
            candidate_id TEXT PRIMARY KEY, payload_json TEXT, inspection_status TEXT,
            inspection_mode TEXT, sha256 TEXT
            )"""
        )
        failed = {"track": {"upc": "111"}, "audio": {"file_id": "1" * 20}}
        pending = {"track": {"upc": "222"}, "audio": {"file_id": "2" * 20}}
        connection.execute("INSERT INTO candidates VALUES ('0', ?, 'failed', 'full', NULL)", (json.dumps(failed),))
        connection.execute("INSERT INTO candidates VALUES ('1', ?, 'pending', NULL, NULL)", (json.dumps(pending),))
        rows = connection.execute(
            """SELECT candidate_id FROM candidates
            ORDER BY CASE inspection_status
              WHEN 'pending' THEN 0 WHEN 'complete' THEN 1 WHEN 'failed' THEN 2 ELSE 1
            END, candidate_id"""
        ).fetchall()
        connection.close()
        self.assertEqual([row["candidate_id"] for row in rows], ["1", "0"])


class SnapshotLifecycleTests(unittest.TestCase):
    def test_complete_snapshot_quarantines_rows_that_disappeared(self):
        with tempfile.TemporaryDirectory() as directory:
            connection = ingest.open_state(Path(directory) / "state.sqlite3")
            payload = {"track": None, "audio": None}
            for candidate_id in ("present", "removed"):
                connection.execute(
                    """INSERT INTO candidates (
                    candidate_id, fingerprint, payload_json, status, reasons_json, updated_at
                    ) VALUES (?, 'fingerprint', ?, 'exact', '[]', 'now')""",
                    (candidate_id, json.dumps(payload)),
                )
            connection.commit()
            count = ingest.quarantine_stale_candidates(connection, {"present"})
            rows = {
                row["candidate_id"]: (row["status"], json.loads(row["reasons_json"]))
                for row in connection.execute("SELECT candidate_id, status, reasons_json FROM candidates")
            }
            connection.close()
        self.assertEqual(count, 1)
        self.assertEqual(rows["present"], ("exact", []))
        self.assertEqual(rows["removed"], ("quarantine", ["source_snapshot_missing"]))

    def test_only_explicitly_complete_json_inventory_can_remove_rows(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "inventory.json"
            path.write_text(json.dumps({"complete": False, "files": []}), encoding="utf-8")
            self.assertFalse(ingest.drive_inventory_is_complete(path))
            path.write_text(json.dumps({"complete": True, "files": []}), encoding="utf-8")
            self.assertTrue(ingest.drive_inventory_is_complete(path))


if __name__ == "__main__":
    unittest.main()

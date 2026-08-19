import io
import json
import sqlite3
import struct
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


if __name__ == "__main__":
    unittest.main()

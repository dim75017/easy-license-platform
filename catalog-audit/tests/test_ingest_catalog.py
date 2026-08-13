import io
import struct
import unittest
import wave

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


if __name__ == "__main__":
    unittest.main()

import contextlib
import hashlib
import io
import json
import math
from pathlib import Path
import struct
import tempfile
import unittest
from unittest import mock
import urllib.parse
import wave

from process_catalog_loader import process


def exact_record():
    source_sha = "a" * 64
    return {
        "candidate_id": "b" * 28,
        "status": "exact",
        "reasons": [],
        "audio_match_kind": "exact_title",
        "audio_match_score": 100,
        "spotify_id": "1" * 22,
        "spotify_duration_seconds": 120.0,
        "spotify_match_kind": "exact",
        "track": {
            "source_row": 42,
            "release": "Test Release",
            "upc": "12345678",
            "title": "Test Track",
            "artists": ["Test Artist"],
            "duration_seconds": 120.0,
            "isrc": "USABC1200001",
            "genre": "Lofi",
            "subgenre": "",
        },
        "audio": {
            "file_id": "1" + "D" * 24,
            "name": "Test Artist - Test Track.wav",
            "folder_id": "",
            "folder_path": "",
            "mime_type": "audio/wav",
            "size_bytes": None,
            "modified_time": "",
        },
        "cover": {
            "file_id": "1" + "C" * 24,
            "is_square": True,
            "quality": "3000 x 3000",
            "upc": "12345678",
        },
        "inspection": {
            "status": "complete",
            "mode": "full",
            "content_type": "audio/wav",
            "content_length": 100,
            "sha256": source_sha,
            "error": None,
            "wav": {
                "container": "RIFF",
                "codec": "PCM",
                "channels": 2,
                "sample_rate": 48_000,
                "bits_per_sample": 16,
                "byte_rate": 192_000,
                "data_size": 23_040_000,
                "duration_seconds": 120.0,
            },
        },
    }


def accepted_enrichment(record=None):
    record = record or exact_record()
    return {
        "recordKey": record["candidate_id"],
        "spotifyId": record["spotify_id"],
        "disposition": "accepted",
        "local": {
            "title": record["track"]["title"],
            "artists": record["track"]["artists"],
            "audioInspectionComplete": True,
            "sourceSha256": record["inspection"]["sha256"],
            "upc": record["track"]["upc"],
            "releaseTitle": record["track"]["release"],
        },
        "spotify": {
            "title": record["track"]["title"],
            "artists": record["track"]["artists"],
            "durationMs": round(record["spotify_duration_seconds"] * 1000),
            "sources": {"oembed": "ok", "embed": "ok"},
        },
        "checks": {
            "title": {"status": "exact"},
            "artists": {"status": "exact"},
            "duration": {"status": "match"},
        },
    }


def attach_evidence(record=None):
    record = record or exact_record()
    record["_spotify_evidence"] = {
        "track_id": record["spotify_id"],
        "title": record["track"]["title"],
        "artists": record["track"]["artists"],
        "duration_ms": round(record["spotify_duration_seconds"] * 1000),
        "album_title": record["track"]["release"],
        "cover_source_url": None,
    }
    return record


def write_sine_wav(path, seconds=1.0, sample_rate=16_000):
    frame_count = round(seconds * sample_rate)
    with wave.open(str(path), "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(sample_rate)
        frames = bytearray()
        for index in range(frame_count):
            value = round(math.sin(index * 2 * math.pi * 440 / sample_rate) * 20_000)
            frames.extend(struct.pack("<h", value))
        handle.writeframes(frames)


class FakeResponse:
    def __init__(self, body=b"{}", status=200, headers=None):
        self._body = io.BytesIO(body)
        self.status = status
        self.headers = headers or {"content-type": "application/json"}

    def read(self, size=-1):
        return self._body.read(size)

    def getcode(self):
        return self.status

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False


class ManifestTests(unittest.TestCase):
    def test_accepts_complete_exact_evidence(self):
        process.validate_exact_record(exact_record())

    def test_refuses_review_rows_and_missing_full_hash(self):
        review = exact_record()
        review["status"] = "review"
        with self.assertRaisesRegex(process.PipelineError, "non_exact_record_refused"):
            process.validate_exact_record(review)

        missing_hash = exact_record()
        missing_hash["inspection"]["sha256"] = None
        with self.assertRaisesRegex(process.PipelineError, "full_source_inspection_missing"):
            process.validate_exact_record(missing_hash)

    def test_manifest_loader_rejects_duplicate_candidates(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "exact.jsonl"
            line = json.dumps(exact_record())
            path.write_text(f"{line}\n{line}\n", encoding="utf-8")
            with self.assertRaisesRegex(process.PipelineError, "duplicate_candidate"):
                process.load_exact_manifest(path)

    def test_official_enrichment_must_match_candidate_spotify_and_full_wav(self):
        record = exact_record()
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "enriched-tracks.json"
            path.write_text(json.dumps({"records": [accepted_enrichment(record)]}), encoding="utf-8")
            counts = process.attach_verified_spotify_evidence([record], path)
            self.assertEqual(counts["attached"], 1)
            self.assertEqual(record["_spotify_evidence"]["title"], "Test Track")

            mismatch = exact_record()
            evidence = accepted_enrichment(mismatch)
            evidence["local"]["sourceSha256"] = "f" * 64
            path.write_text(json.dumps({"records": [evidence]}), encoding="utf-8")
            with self.assertRaisesRegex(process.PipelineError, "accepted_spotify_enrichment_mismatch"):
                process.attach_verified_spotify_evidence([mismatch], path)


class StateTests(unittest.TestCase):
    def test_state_uses_single_process_delete_journal(self):
        with tempfile.TemporaryDirectory() as temporary:
            connection = process.open_pipeline_state(Path(temporary) / "pipeline.sqlite3")
            try:
                self.assertEqual(connection.execute("PRAGMA journal_mode").fetchone()[0], "delete")
            finally:
                connection.close()

    def test_promotion_success_accepts_the_backend_response_contract(self):
        self.assertTrue(
            process.promotion_succeeded(
                {
                    "trackStatus": "published",
                    "releaseStatus": "published",
                    "ingestStatus": "imported",
                }
            )
        )
        self.assertFalse(process.promotion_succeeded({"trackStatus": "ready"}))

    def test_default_batch_key_stays_stable_as_manifest_grows(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "exact.jsonl"
            path.write_text("first", encoding="utf-8")
            first = process.derive_batch_key(path, None)
            path.write_text("first\nsecond", encoding="utf-8")
            second = process.derive_batch_key(path, None)
        self.assertEqual(first, process.DEFAULT_BATCH_KEY)
        self.assertEqual(second, first)

    def test_state_is_resumable_and_rights_ack_is_part_of_checkpoint(self):
        with tempfile.TemporaryDirectory() as temporary:
            state_path = Path(temporary) / "pipeline.sqlite3"
            connection = process.open_pipeline_state(state_path)
            try:
                row = process.ensure_state_row(connection, exact_record(), "batch:test", True, True)
                self.assertEqual(row["status"], "planned")
                self.assertEqual(row["rights_cleared_ack"], 1)
                self.assertEqual(row["human_made_cleared_ack"], 1)
                process.update_state(
                    connection,
                    row["candidate_id"],
                    status="published",
                    metadata_uploaded=1,
                    master_uploaded=1,
                    cover_uploaded=1,
                )
                same = process.ensure_state_row(connection, exact_record(), "batch:test", True, True)
                self.assertEqual(same["status"], "published")
                reset = process.ensure_state_row(connection, exact_record(), "batch:test", False, False)
                self.assertEqual(reset["status"], "planned")
                self.assertEqual(reset["metadata_uploaded"], 0)
                self.assertEqual(reset["master_uploaded"], 0)
                self.assertEqual(reset["cover_uploaded"], 0)
                self.assertEqual(reset["human_made_cleared_ack"], 0)
            finally:
                connection.close()


class AudioTests(unittest.TestCase):
    def assert_ffmpeg_command_is_single_threaded(self, command):
        self.assertEqual(command.count("-filter_threads"), 1)
        self.assertEqual(command[command.index("-filter_threads") + 1], "1")
        self.assertEqual(command.count("-filter_complex_threads"), 1)
        self.assertEqual(command[command.index("-filter_complex_threads") + 1], "1")
        thread_options = [
            index for index, argument in enumerate(command) if argument == "-threads"
        ]
        self.assertEqual(len(thread_options), 2)
        self.assertTrue(all(command[index + 1] == "1" for index in thread_options))
        input_index = command.index("-i")
        self.assertLess(thread_options[0], input_index)
        self.assertGreater(thread_options[1], input_index)

    def test_pcm_peak_handles_signed_16_bit_samples(self):
        fragment = struct.pack("<hhhh", 0, -32768, 12, 30_000)
        self.assertEqual(process.pcm_peak(fragment), 32768)

    def test_all_audio_ffmpeg_commands_force_single_thread_processing(self):
        completed = process.subprocess.CompletedProcess(
            args=[], returncode=0, stdout=b"out_time_us=1000000\n", stderr=b""
        )

        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            source = directory / "source.wav"
            destination = directory / "stream.mp3"
            source.write_bytes(b"fixture")
            destination.write_bytes(b"fixture")

            with mock.patch.object(process.subprocess, "run", return_value=completed) as runner:
                process.transcode_mp3(Path("ffmpeg"), source, destination)
                transcode_command = runner.call_args.args[0]
            self.assert_ffmpeg_command_is_single_threaded(transcode_command)

            with mock.patch.object(process.subprocess, "run", return_value=completed) as runner:
                self.assertEqual(process.probe_audio_duration(Path("ffmpeg"), destination), 1_000)
                probe_command = runner.call_args.args[0]
            self.assert_ffmpeg_command_is_single_threaded(probe_command)

            pcm = b"\x00\x00" * process.PEAK_SAMPLE_RATE
            fake_process = mock.Mock()
            fake_process.stdout = io.BytesIO(pcm)
            fake_process.stderr = io.BytesIO()
            fake_process.wait.return_value = 0
            with mock.patch.object(process.subprocess, "Popen", return_value=fake_process) as popen:
                peaks = process.generate_peaks(Path("ffmpeg"), source, duration_ms=1_000)
                peaks_command = popen.call_args.args[0]
            self.assertEqual(len(peaks), process.PEAK_BIN_COUNT)
            self.assert_ffmpeg_command_is_single_threaded(peaks_command)

    def test_imageio_ffmpeg_builds_full_mp3_and_512_peaks(self):
        try:
            executable = process.resolve_ffmpeg(None)
            process.validate_ffmpeg(executable)
        except process.PipelineError as error:
            self.skipTest(error.code)

        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            source = directory / "source.wav"
            mp3 = directory / "stream.mp3"
            peaks_path = directory / "peaks.json"
            write_sine_wav(source, seconds=1.0)
            process.transcode_mp3(executable, source, mp3)
            duration_ms = process.probe_audio_duration(executable, mp3)
            peaks = process.generate_peaks(executable, source, duration_ms=1_000)
            process.write_peaks_json(peaks_path, peaks, 1_000)

            self.assertTrue(mp3.stat().st_size > 0)
            self.assertLessEqual(abs(duration_ms - 1_000), 200)
            self.assertEqual(len(peaks), 512)
            self.assertGreater(max(peaks), 0.5)
            payload = json.loads(peaks_path.read_text(encoding="utf-8"))
            self.assertEqual(payload["bins"], 512)
            self.assertEqual(len(payload["peaks"]), 512)

    def test_cover_inspection_requires_known_signature_and_square_geometry(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "cover.png"
            path.write_bytes(
                b"\x89PNG\r\n\x1a\n"
                + b"\x00\x00\x00\x0dIHDR"
                + (3000).to_bytes(4, "big")
                + (3000).to_bytes(4, "big")
                + b"\x08\x02\x00\x00\x00"
            )
            self.assertEqual(process.inspect_cover_artwork(path), ("image/png", 3000, 3000))
            contents = bytearray(path.read_bytes())
            contents[20:24] = (2000).to_bytes(4, "big")
            path.write_bytes(contents)
            with self.assertRaisesRegex(process.PipelineError, "cover_artwork_not_square"):
                process.inspect_cover_artwork(path)


class DriveDownloadTests(unittest.TestCase):
    def test_download_streams_and_verifies_sha_without_exposing_source(self):
        payload = b"RIFF" + b"\x00" * 64
        expected_sha = hashlib.sha256(payload).hexdigest()
        requests = []

        def opener(request, timeout):
            requests.append((request, timeout))
            return FakeResponse(payload, headers={"content-type": "audio/wav"})

        with tempfile.TemporaryDirectory() as temporary:
            destination = Path(temporary) / "source.wav"
            downloader = process.DriveDownloader(opener=opener, sleeper=lambda _delay: None)
            actual_sha, size = downloader.download(
                "1" + "A" * 24,
                destination,
                expected_sha256=expected_sha,
                expected_size=len(payload),
            )
        self.assertEqual(actual_sha, expected_sha)
        self.assertEqual(size, len(payload))
        self.assertEqual(len(requests), 1)

    def test_download_refuses_html_confirmation_page(self):
        def opener(_request, timeout):
            return FakeResponse(b"<html>sign in</html>", headers={"content-type": "text/html"})

        with tempfile.TemporaryDirectory() as temporary:
            downloader = process.DriveDownloader(opener=opener, sleeper=lambda _delay: None)
            with self.assertRaisesRegex(process.PipelineError, "drive_source_not_audio"):
                downloader.download(
                    "1" + "A" * 24,
                    Path(temporary) / "source.wav",
                    expected_sha256="0" * 64,
                    expected_size=None,
                )


class ApiTests(unittest.TestCase):
    def test_asset_upload_uses_bounded_bytes_and_both_bearer_headers(self):
        requests = []

        def opener(request, timeout):
            requests.append((request, timeout))
            return FakeResponse(b'{"asset":{"status":"available"}}')

        client = process.CatalogApiClient(
            "https://catalog.example.test",
            "pipeline-secret",
            "sites-secret",
            opener=opener,
            sleeper=lambda _delay: None,
        )
        with tempfile.TemporaryDirectory() as temporary:
            asset = Path(temporary) / "stream.mp3"
            asset.write_bytes(b"mp3-bytes")
            digest = hashlib.sha256(asset.read_bytes()).hexdigest()
            client.upload_asset(
                asset,
                track_id=12,
                batch_key="batch:test",
                source_key="b" * 28,
                kind="streaming_copy",
                content_type="audio/mpeg",
                sha256=digest,
                duration_ms=120_000,
                source_sha256="a" * 64,
            )

        request, _timeout = requests[0]
        headers = {key.lower(): value for key, value in request.header_items()}
        self.assertEqual(request.method, "PUT")
        self.assertEqual(request.data, b"mp3-bytes")
        self.assertEqual(headers["authorization"], "Bearer pipeline-secret")
        self.assertEqual(headers["oai-sites-authorization"], "Bearer sites-secret")
        self.assertEqual(headers["x-content-sha256"], digest)
        self.assertEqual(headers["x-source-sha256"], "a" * 64)
        query = urllib.parse.parse_qs(urllib.parse.urlsplit(request.full_url).query)
        self.assertEqual(query["kind"], ["streaming_copy"])

    def test_cover_upload_omits_duration_and_source_master_uses_drive_route(self):
        requests = []

        def opener(request, timeout):
            requests.append((request, timeout))
            if request.full_url.endswith("/api/catalog/ingest/asset"):
                return FakeResponse(b'{"asset":{"status":"available"}}', status=201)
            return FakeResponse(b'{"asset":{"status":"available"}}', status=201)

        client = process.CatalogApiClient(
            "https://catalog.example.test",
            "pipeline-secret",
            "sites-secret",
            opener=opener,
            sleeper=lambda _delay: None,
        )
        client.ingest_source_master(
            track_id=12,
            batch_key="batch:test",
            source_key="b" * 28,
            drive_file_id="1" + "A" * 24,
            source_file_name="master.wav",
            expected_byte_size=100,
            expected_sha256="a" * 64,
            duration_ms=120_000,
        )
        master_payload = json.loads(requests[0][0].data)
        self.assertEqual(master_payload["trackId"], "12")
        self.assertEqual(master_payload["assetKind"], "source_master")
        self.assertEqual(master_payload["expectedSha256"], "a" * 64)

        with tempfile.TemporaryDirectory() as temporary:
            cover = Path(temporary) / "cover.bin"
            cover.write_bytes(b"\xff\xd8\xffcover")
            digest = hashlib.sha256(cover.read_bytes()).hexdigest()
            client.upload_asset(
                cover,
                track_id=12,
                batch_key="batch:test",
                source_key="b" * 28,
                kind="cover_artwork",
                content_type="image/jpeg",
                sha256=digest,
                duration_ms=None,
            )
        cover_headers = {key.lower(): value for key, value in requests[1][0].header_items()}
        self.assertNotIn("x-duration-ms", cover_headers)
        self.assertNotIn("x-source-sha256", cover_headers)
        self.assertEqual(cover_headers["content-type"], "image/jpeg")

    def test_metadata_requires_explicit_rights_ack_and_verified_orchard_evidence(self):
        pending = process.metadata_item("b" * 28, attach_evidence(), "a" * 64, 120_000, False, False)
        cleared = process.metadata_item("b" * 28, attach_evidence(), "a" * 64, 120_000, True, True)
        self.assertEqual(pending["rightsStatus"], "pending")
        self.assertEqual(pending["aiReviewStatus"], "pending")
        self.assertEqual(cleared["rightsStatus"], "cleared")
        self.assertEqual(cleared["aiReviewStatus"], "cleared")
        self.assertEqual(cleared["spotify"]["status"], "verified")
        self.assertEqual(cleared["spotify"]["method"], "orchard_uri")
        self.assertIsNone(cleared["spotify"]["albumId"])
        self.assertEqual(cleared["spotify"]["albumTitle"], "Test Release")
        with self.assertRaisesRegex(process.PipelineError, "accepted_spotify_enrichment_missing"):
            process.metadata_item("b" * 28, exact_record(), "a" * 64, 120_000, True, True)


class SpotifyMergeTests(unittest.TestCase):
    def test_only_accepted_unambiguous_durations_are_mergeable(self):
        accepted = accepted_enrichment()
        review = {
            "spotifyId": "2" * 22,
            "disposition": "review",
            "spotify": {"durationMs": 121_000},
        }
        duplicate = {
            "spotifyId": "1" * 22,
            "disposition": "accepted",
            "spotify": {"durationMs": 120_500},
        }
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "enriched-tracks.json"
            path.write_text(json.dumps({"records": [accepted, review, duplicate]}), encoding="utf-8")
            metadata, counts = process.load_spotify_enrichment(path)
        self.assertEqual(metadata, {})
        self.assertEqual(counts["accepted"], 2)
        self.assertEqual(counts["ambiguous"], 1)


class CliSafetyTests(unittest.TestCase):
    def test_dry_run_is_aggregate_only_and_needs_no_clearance(self):
        record = exact_record()
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            exact_path = directory / "exact.jsonl"
            enrichment_path = directory / "enriched-tracks.json"
            exact_path.write_text(json.dumps(record) + "\n", encoding="utf-8")
            enrichment_path.write_text(
                json.dumps({"records": [accepted_enrichment(record)]}),
                encoding="utf-8",
            )
            output = io.StringIO()
            with contextlib.redirect_stdout(output):
                status = process.main(
                    [
                        "--exact-manifest",
                        str(exact_path),
                        "--spotify-enrichment",
                        str(enrichment_path),
                        "--pipeline-state",
                        str(directory / "pipeline.sqlite3"),
                        "--limit",
                        "1",
                    ]
                )
        rendered = output.getvalue()
        self.assertEqual(status, 0)
        self.assertNotIn(record["candidate_id"], rendered)
        self.assertNotIn(record["spotify_id"], rendered)
        self.assertNotIn(record["audio"]["file_id"], rendered)
        self.assertFalse(json.loads(rendered)["rightsClearanceAcknowledged"])
        self.assertFalse(json.loads(rendered)["humanMadeClearanceAcknowledged"])

    def test_apply_requires_both_clearances_before_credentials_or_network(self):
        record = exact_record()
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            exact_path = directory / "exact.jsonl"
            enrichment_path = directory / "enriched-tracks.json"
            exact_path.write_text(json.dumps(record) + "\n", encoding="utf-8")
            enrichment_path.write_text(
                json.dumps({"records": [accepted_enrichment(record)]}),
                encoding="utf-8",
            )
            with self.assertRaisesRegex(process.PipelineError, "rights_clearance_ack_required"):
                process.main(
                    [
                        "--exact-manifest",
                        str(exact_path),
                        "--spotify-enrichment",
                        str(enrichment_path),
                        "--pipeline-state",
                        str(directory / "pipeline.sqlite3"),
                        "--apply",
                    ]
                )
            with self.assertRaisesRegex(process.PipelineError, "human_made_clearance_ack_required"):
                process.main(
                    [
                        "--exact-manifest",
                        str(exact_path),
                        "--spotify-enrichment",
                        str(enrichment_path),
                        "--pipeline-state",
                        str(directory / "pipeline.sqlite3"),
                        "--apply",
                        "--rights-cleared",
                    ]
                )


if __name__ == "__main__":
    unittest.main()

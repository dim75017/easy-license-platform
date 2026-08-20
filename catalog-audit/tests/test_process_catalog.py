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


def direct_record():
    record = exact_record()
    record["status"] = "review"
    record["reasons"] = [
        "audio_inspection_pending",
        "sha256_pending",
        "spotify_duration_missing",
        "spotify_id_missing",
    ]
    record["spotify_id"] = ""
    record["spotify_duration_seconds"] = None
    record["spotify_match_kind"] = "missing"
    record["cover"]["is_square"] = False
    record["inspection"] = {
        "status": "pending",
        "mode": None,
        "content_type": None,
        "content_length": None,
        "sha256": None,
        "error": None,
        "wav": None,
    }
    return record


def direct_mp3_record():
    record = direct_record()
    record["audio_match_kind"] = "central_unique_artist_title"
    record["audio"]["name"] = "Test Artist - Test Track.mp3"
    record["audio"]["mime_type"] = "audio/mpeg"
    record["audio"]["source_format"] = "mp3"
    record["audio"]["source_mime_type"] = "audio/mpeg"
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

    def test_owner_direct_accepts_deterministic_row_without_spotify_or_prescan(self):
        record = direct_record()
        process.validate_direct_record(record)
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "direct.jsonl"
            path.write_text(json.dumps(record) + "\n", encoding="utf-8")
            loaded = process.load_direct_manifest(path)
        self.assertEqual(len(loaded), 1)

    def test_owner_direct_accepts_only_strictly_pinned_mp3_sources(self):
        record = direct_mp3_record()
        process.validate_direct_record(record)
        weak = direct_mp3_record()
        weak["audio_match_kind"] = "exact_title"
        with self.assertRaisesRegex(process.PipelineError, "direct_record_not_deterministic"):
            process.validate_direct_record(weak)

        mismatched = direct_mp3_record()
        mismatched["audio"]["mime_type"] = "audio/wav"
        with self.assertRaisesRegex(process.PipelineError, "direct_record_not_deterministic"):
            process.validate_direct_record(mismatched)

    def test_owner_direct_rejects_ambiguous_or_reused_audio(self):
        ambiguous = direct_record()
        ambiguous["reasons"].append("audio_match_ambiguous")
        with self.assertRaisesRegex(process.PipelineError, "direct_record_not_deterministic"):
            process.validate_direct_record(ambiguous)

        first = direct_record()
        second = direct_record()
        second["candidate_id"] = "c" * 28
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "direct.jsonl"
            path.write_text(
                json.dumps(first) + "\n" + json.dumps(second) + "\n",
                encoding="utf-8",
            )
            with self.assertRaisesRegex(process.PipelineError, "direct_manifest_duplicate_audio"):
                process.load_direct_manifest(path)


class StateTests(unittest.TestCase):
    def test_state_uses_single_process_delete_journal(self):
        with tempfile.TemporaryDirectory() as temporary:
            connection = process.open_pipeline_state(Path(temporary) / "pipeline.sqlite3")
            try:
                self.assertEqual(connection.execute("PRAGMA journal_mode").fetchone()[0], "delete")
                columns = {
                    row[1]
                    for row in connection.execute("PRAGMA table_info(pipeline_items)")
                }
                self.assertTrue({"source_mime_type", "source_format"}.issubset(columns))
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

    def test_owner_direct_resume_skips_an_already_published_checkpoint(self):
        record = direct_record()
        with tempfile.TemporaryDirectory() as temporary:
            connection = process.open_pipeline_state(Path(temporary) / "pipeline.sqlite3")
            try:
                row = process.ensure_state_row(
                    connection,
                    record,
                    process.DIRECT_BATCH_KEY,
                    True,
                    True,
                )
                process.update_state(connection, row["candidate_id"], status="published")
                downloader = mock.Mock()
                api = mock.Mock()
                outcome = process.process_record(
                    connection,
                    record,
                    process.DIRECT_BATCH_KEY,
                    downloader,
                    api,
                    Path("ffmpeg"),
                    rights_cleared=True,
                    human_made_cleared=True,
                    verification_mode="catalog_owner_direct",
                    owner_evidence={
                        "ownerAttestationSha256": "1" * 64,
                        "catalogueScopeSha256": "2" * 64,
                        "selectionSha256": "3" * 64,
                    },
                )
            finally:
                connection.close()
        self.assertEqual(outcome, "already_published")
        downloader.download.assert_not_called()
        api.ingest_metadata.assert_not_called()

    def test_cover_only_resume_uses_release_gate_without_reprocessing_audio(self):
        record = direct_record()
        with tempfile.TemporaryDirectory() as temporary:
            connection = process.open_pipeline_state(Path(temporary) / "pipeline.sqlite3")
            try:
                row = process.ensure_state_row(
                    connection,
                    record,
                    process.DIRECT_BATCH_KEY,
                    True,
                    True,
                )
                process.update_state(
                    connection,
                    row["candidate_id"],
                    status="assets_uploaded",
                    ingest_id=11,
                    track_id=12,
                    source_sha256="a" * 64,
                    measured_duration_ms=120_000,
                    metadata_uploaded=1,
                    master_uploaded=1,
                    streaming_uploaded=1,
                    peaks_uploaded=1,
                )
                downloader = mock.Mock()
                api = mock.Mock()
                api.promote.return_value = {"trackStatus": "published"}
                outcome = process.process_record(
                    connection,
                    record,
                    process.DIRECT_BATCH_KEY,
                    downloader,
                    api,
                    Path("ffmpeg"),
                    rights_cleared=True,
                    human_made_cleared=True,
                    verification_mode="catalog_owner_direct",
                    owner_evidence={
                        "ownerAttestationSha256": "1" * 64,
                        "catalogueScopeSha256": "2" * 64,
                        "selectionSha256": "3" * 64,
                    },
                )
                completed = connection.execute(
                    "SELECT status, cover_uploaded FROM pipeline_items WHERE candidate_id = ?",
                    (row["candidate_id"],),
                ).fetchone()
            finally:
                connection.close()
        self.assertEqual(outcome, "published")
        self.assertEqual((completed["status"], completed["cover_uploaded"]), ("published", 1))
        downloader.download.assert_not_called()
        api.ingest_metadata.assert_not_called()
        api.ingest_source_master.assert_not_called()
        api.upload_asset.assert_not_called()

    def test_partial_retry_generates_only_the_missing_derivative(self):
        record = direct_record()
        source_bytes = b"source-checkpoint-bytes"
        source_sha256 = hashlib.sha256(source_bytes).hexdigest()
        with tempfile.TemporaryDirectory() as temporary:
            connection = process.open_pipeline_state(Path(temporary) / "pipeline.sqlite3")
            try:
                row = process.ensure_state_row(
                    connection,
                    record,
                    process.DIRECT_BATCH_KEY,
                    True,
                    True,
                )
                process.update_state(
                    connection,
                    row["candidate_id"],
                    status="streaming_uploaded",
                    ingest_id=11,
                    track_id=12,
                    source_sha256=source_sha256,
                    source_byte_size=len(source_bytes),
                    measured_duration_ms=120_000,
                    metadata_uploaded=1,
                    master_uploaded=1,
                    streaming_uploaded=1,
                    cover_uploaded=1,
                )
                downloader = mock.Mock()

                def download(_file_id, destination, **_kwargs):
                    destination.write_bytes(source_bytes)
                    return source_sha256, len(source_bytes)

                downloader.download.side_effect = download
                api = mock.Mock()
                api.promote.return_value = {"trackStatus": "published"}
                with (
                    mock.patch.object(process, "transcode_mp3") as transcode,
                    mock.patch.object(process, "generate_peaks", return_value=[0.5] * process.PEAK_BIN_COUNT) as peaks,
                ):
                    outcome = process.process_record(
                        connection,
                        record,
                        process.DIRECT_BATCH_KEY,
                        downloader,
                        api,
                        Path("ffmpeg"),
                        rights_cleared=True,
                        human_made_cleared=True,
                        verification_mode="catalog_owner_direct",
                        owner_evidence={
                            "ownerAttestationSha256": "1" * 64,
                            "catalogueScopeSha256": "2" * 64,
                            "selectionSha256": "3" * 64,
                        },
                    )
            finally:
                connection.close()
        self.assertEqual(outcome, "published")
        transcode.assert_not_called()
        peaks.assert_called_once()
        self.assertEqual(api.upload_asset.call_count, 1)
        self.assertEqual(api.upload_asset.call_args.kwargs["kind"], "waveform_peaks")

    def test_missing_release_cover_falls_back_to_cover_only_transfer(self):
        record = direct_record()
        cover_bytes = (
            b"\x89PNG\r\n\x1a\n"
            + b"\x00\x00\x00\x0dIHDR"
            + (3000).to_bytes(4, "big")
            + (3000).to_bytes(4, "big")
            + b"\x08\x02\x00\x00\x00"
        )
        with tempfile.TemporaryDirectory() as temporary:
            connection = process.open_pipeline_state(Path(temporary) / "pipeline.sqlite3")
            try:
                row = process.ensure_state_row(
                    connection,
                    record,
                    process.DIRECT_BATCH_KEY,
                    True,
                    True,
                )
                process.update_state(
                    connection,
                    row["candidate_id"],
                    status="assets_uploaded",
                    ingest_id=11,
                    track_id=12,
                    source_sha256="a" * 64,
                    measured_duration_ms=120_000,
                    metadata_uploaded=1,
                    master_uploaded=1,
                    streaming_uploaded=1,
                    peaks_uploaded=1,
                )
                downloader = mock.Mock()

                def download(file_id, destination, **_kwargs):
                    self.assertEqual(file_id, record["cover"]["file_id"])
                    destination.write_bytes(cover_bytes)
                    return hashlib.sha256(cover_bytes).hexdigest(), len(cover_bytes)

                downloader.download.side_effect = download
                api = mock.Mock()
                api.promote.side_effect = [
                    {"trackStatus": "ready"},
                    {"trackStatus": "published"},
                ]
                outcome = process.process_record(
                    connection,
                    record,
                    process.DIRECT_BATCH_KEY,
                    downloader,
                    api,
                    Path("ffmpeg"),
                    rights_cleared=True,
                    human_made_cleared=True,
                    verification_mode="catalog_owner_direct",
                    owner_evidence={
                        "ownerAttestationSha256": "1" * 64,
                        "catalogueScopeSha256": "2" * 64,
                        "selectionSha256": "3" * 64,
                    },
                )
            finally:
                connection.close()
        self.assertEqual(outcome, "published")
        downloader.download.assert_called_once()
        api.upload_asset.assert_called_once()
        self.assertEqual(api.upload_asset.call_args.kwargs["kind"], "cover_artwork")


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

    def test_owner_direct_mp3_requires_signature_and_complete_decode(self):
        with tempfile.TemporaryDirectory() as temporary:
            source = Path(temporary) / "source.mp3"
            source.write_bytes(b"ID3" + b"\x00" * 100)
            with mock.patch.object(process, "probe_audio_duration", return_value=123_000) as probe:
                duration = process.inspect_downloaded_mp3(
                    source,
                    Path("ffmpeg"),
                    verification_mode="catalog_owner_direct",
                )
            self.assertEqual(duration, 123_000)
            probe.assert_called_once_with(Path("ffmpeg"), source)

            source.write_bytes(b"not-an-mp3")
            with self.assertRaisesRegex(process.PipelineError, "source_mp3_signature_invalid"):
                process.inspect_downloaded_mp3(
                    source,
                    Path("ffmpeg"),
                    verification_mode="catalog_owner_direct",
                )

    def test_mp3_decode_failure_stays_fail_closed(self):
        with tempfile.TemporaryDirectory() as temporary:
            source = Path(temporary) / "source.mp3"
            source.write_bytes(b"\xff\xfb" + b"\x00" * 100)
            with (
                mock.patch.object(
                    process,
                    "probe_audio_duration",
                    side_effect=process.PipelineError("ffmpeg_duration_probe_failed"),
                ),
                self.assertRaisesRegex(process.PipelineError, "source_mp3_decode_failed"),
            ):
                process.inspect_downloaded_mp3(
                    source,
                    Path("ffmpeg"),
                    verification_mode="catalog_owner_direct",
                )

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

    def test_owner_direct_uses_measured_wav_duration_as_catalogue_truth(self):
        record = direct_record()
        with tempfile.TemporaryDirectory() as temporary:
            source = Path(temporary) / "source.wav"
            write_sine_wav(source, seconds=1.0, sample_rate=8_000)
            record["track"]["duration_seconds"] = None
            _wav, duration_ms = process.inspect_downloaded_wav(
                source,
                record,
                verification_mode="catalog_owner_direct",
            )
            self.assertEqual(duration_ms, 1_000)

            with self.assertRaisesRegex(process.PipelineError, "source_wav_too_short"):
                process.inspect_downloaded_wav(
                    source,
                    record,
                    verification_mode="spotify",
                )

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

    def test_heavy_or_non_square_cover_is_optimized_to_bounded_square_jpeg(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            source = directory / "cover.png"
            destination = directory / "cover.jpg"
            source.write_bytes(
                b"\x89PNG\r\n\x1a\n"
                + b"\x00\x00\x00\x0dIHDR"
                + (3000).to_bytes(4, "big")
                + (2000).to_bytes(4, "big")
                + b"\x08\x02\x00\x00\x00"
            )

            def run(command, **_kwargs):
                destination.write_bytes(
                    b"\xff\xd8\xff\xc0\x00\x07\x08"
                    + process.COVER_OUTPUT_SIZE.to_bytes(2, "big")
                    + process.COVER_OUTPUT_SIZE.to_bytes(2, "big")
                )
                return process.subprocess.CompletedProcess(command, 0, b"", b"")

            with mock.patch.object(process.subprocess, "run", side_effect=run) as runner:
                prepared, content_type, width, height = process.prepare_cover_artwork(
                    Path("ffmpeg"), source, destination
                )
            command = runner.call_args.args[0]
        self.assertEqual(prepared, destination)
        self.assertEqual((content_type, width, height), ("image/jpeg", 3000, 3000))
        self.assertEqual(command[command.index("-filter_threads") + 1], "1")
        self.assertEqual(command[command.index("-threads") + 1], "1")
        self.assertIn("crop=3000:3000", command[command.index("-vf") + 1])

    def test_cover_cache_downloads_and_validates_a_shared_release_cover_once(self):
        cover_bytes = (
            b"\x89PNG\r\n\x1a\n"
            + b"\x00\x00\x00\x0dIHDR"
            + (3000).to_bytes(4, "big")
            + (3000).to_bytes(4, "big")
            + b"\x08\x02\x00\x00\x00"
        )
        downloader = mock.Mock()

        def download(_file_id, destination, **_kwargs):
            destination.write_bytes(cover_bytes)
            return hashlib.sha256(cover_bytes).hexdigest(), len(cover_bytes)

        downloader.download.side_effect = download
        with tempfile.TemporaryDirectory() as temporary:
            cache = process.CoverArtifactCache(Path(temporary))
            first = cache.prepare("1" + "C" * 24, downloader, Path("ffmpeg"))
            second = cache.prepare("1" + "C" * 24, downloader, Path("ffmpeg"))
            self.assertTrue(first[0].is_file())
            self.assertEqual(first, second)
            self.assertEqual(first[1], "image/png")
            self.assertEqual(first[2], hashlib.sha256(cover_bytes).hexdigest())
        downloader.download.assert_called_once()


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
            source_mime_type="audio/wav",
        )
        master_payload = json.loads(requests[0][0].data)
        self.assertEqual(master_payload["trackId"], "12")
        self.assertEqual(master_payload["assetKind"], "source_master")
        self.assertEqual(master_payload["expectedSha256"], "a" * 64)
        self.assertEqual(master_payload["expectedContentType"], "audio/wav")

        requests.clear()
        client.ingest_source_master(
            track_id=13,
            batch_key=process.DIRECT_BATCH_KEY,
            source_key="c" * 28,
            drive_file_id="1" + "B" * 24,
            source_file_name="strict-source.mp3",
            expected_byte_size=200,
            expected_sha256="b" * 64,
            duration_ms=121_000,
            source_mime_type="audio/mpeg",
        )
        mp3_payload = json.loads(requests[0][0].data)
        self.assertEqual(mp3_payload["expectedContentType"], "audio/mpeg")

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

    def test_owner_direct_metadata_uses_local_source_and_sealed_master_evidence(self):
        evidence = {
            "ownerAttestationSha256": "1" * 64,
            "catalogueScopeSha256": "2" * 64,
            "selectionSha256": "3" * 64,
        }
        item = process.metadata_item(
            "b" * 28,
            direct_record(),
            "a" * 64,
            120_000,
            True,
            True,
            verification_mode="catalog_owner_direct",
            owner_evidence=evidence,
        )
        self.assertEqual(item["title"], "Test Track")
        self.assertEqual(item["verificationMode"], "catalog_owner_direct")
        self.assertIsNone(item["spotify"])
        self.assertTrue(item["catalogOwnerEvidence"]["masterReadComplete"])
        self.assertEqual(item["catalogOwnerEvidence"]["masterInspectionSha256"], "a" * 64)

    def test_promote_emits_explicit_owner_direct_verification_mode(self):
        requests = []

        def opener(request, timeout):
            requests.append((request, timeout))
            return FakeResponse(b'{"trackStatus":"published"}')

        client = process.CatalogApiClient(
            "https://catalog.example.test",
            "pipeline-secret",
            "sites-secret",
            opener=opener,
            sleeper=lambda _delay: None,
        )
        client.promote(
            track_id=12,
            batch_key=process.DIRECT_BATCH_KEY,
            source_key="b" * 28,
            source_sha256="a" * 64,
            measured_duration_ms=120_000,
            verification_mode="catalog_owner_direct",
        )
        payload = json.loads(requests[0][0].data)
        self.assertEqual(payload["verificationMode"], "catalog_owner_direct")
        self.assertEqual(payload["sourceMimeType"], "audio/wav")
        self.assertEqual(payload["sourceFormat"], "wav")


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

    def test_owner_direct_dry_run_needs_no_spotify_file_or_full_prescan(self):
        record = direct_record()
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            manifest = directory / "direct.jsonl"
            manifest.write_text(json.dumps(record) + "\n", encoding="utf-8")
            output = io.StringIO()
            with contextlib.redirect_stdout(output):
                status = process.main(
                    [
                        "--exact-manifest",
                        str(manifest),
                        "--pipeline-state",
                        str(directory / "pipeline.sqlite3"),
                        "--verification-mode",
                        "catalog_owner_direct",
                        "--batch-key",
                        process.DIRECT_BATCH_KEY,
                        "--owner-attestation-sha256",
                        "1" * 64,
                        "--catalogue-scope-sha256",
                        "2" * 64,
                        "--selection-sha256",
                        "3" * 64,
                    ]
                )
        summary = json.loads(output.getvalue())
        self.assertEqual(status, 0)
        self.assertEqual(summary["verificationMode"], "catalog_owner_direct")
        self.assertEqual(summary["directRecords"], 1)
        self.assertNotIn("spotifyEnrichment", summary)


if __name__ == "__main__":
    unittest.main()

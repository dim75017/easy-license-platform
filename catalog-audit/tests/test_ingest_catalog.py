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

    def test_missing_cover_uses_only_a_deterministic_owned_release_artwork(self):
        root_id = "1" + "R" * 20
        art_folder_id = "1" + "F" * 20
        cover_id = "1" + "C" * 20
        release = ingest.ReleaseAudio("12345678", "Release", root_id, ())
        children = {
            root_id: [
                {
                    "id": art_folder_id,
                    "name": "Artwork",
                    "mimeType": ingest.DRIVE_FOLDER_MIME,
                }
            ],
            art_folder_id: [
                {
                    "id": cover_id,
                    "name": "Release cover.png",
                    "mimeType": "image/png",
                }
            ],
        }
        merged = ingest.merge_drive_cover_fallbacks({}, [release], children)
        self.assertEqual(merged["12345678"].file_id, cover_id)
        self.assertFalse(merged["12345678"].is_square)

        ambiguous = {
            root_id: [
                {"id": "1" + "A" * 20, "name": "one.png", "mimeType": "image/png"},
                {"id": "1" + "B" * 20, "name": "two.png", "mimeType": "image/png"},
            ]
        }
        self.assertNotIn(
            "12345678",
            ingest.merge_drive_cover_fallbacks({}, [release], ambiguous),
        )


class CentralDriveMappingTests(unittest.TestCase):
    @staticmethod
    def track(
        row: int,
        title: str,
        *,
        release: str = "Release",
        upc: str = "12345678",
        isrc: str = "",
        artist: str = "Artist",
    ):
        return ingest.Track(row, release, upc, title, (artist,), 120, isrc, "Lofi", "")

    def test_release_scope_strict_isrc_pins_valid_wav_and_mp3(self):
        tracks = [
            self.track(2, "First", release="One", upc="11111111", isrc="FR-ABC-26-12345"),
            self.track(3, "Second", release="Two", upc="22222222", isrc="US-XYZ-26-54321"),
        ]
        wav = ingest.DriveAudio("1" + "a" * 20, "FR-ABC-26-12345_master.wav", mime_type="audio/wav")
        mp3 = ingest.DriveAudio("1" + "b" * 20, "USXYZ2654321 final.mp3", mime_type="audio/mpeg")
        releases = [
            ingest.ReleaseAudio("11111111", "One", "1" + "r" * 20, (wav,)),
            ingest.ReleaseAudio("22222222", "Two", "1" + "s" * 20, (mp3,)),
        ]
        baseline = ingest.build_candidates(tracks, releases, {}, [])

        pins, summary = ingest.build_release_isrc_audio_pins(tracks, baseline, releases)
        result = ingest.apply_release_isrc_audio_pins(baseline, pins)

        self.assertEqual(summary["pinned"], 2)
        self.assertEqual(summary["pinnedWav"], 1)
        self.assertEqual(summary["pinnedMp3"], 1)
        self.assertEqual({pin.match_kind for pin in pins.values()}, {"release_unique_isrc"})
        self.assertEqual({candidate.track.source_row for candidate in result if candidate.track and candidate.audio}, {2, 3})
        self.assertFalse(any(candidate.track is None for candidate in result))

    def test_release_scope_isrc_rejects_repeated_source_isrc(self):
        tracks = [
            self.track(2, "First", release="One", upc="11111111", isrc="FR-ABC-26-12345"),
            self.track(3, "Second", release="Two", upc="22222222", isrc="FR-ABC-26-12345"),
        ]
        audio = ingest.DriveAudio("1" + "c" * 20, "FRABC2612345.wav")
        releases = [ingest.ReleaseAudio("11111111", "One", "", (audio,))]
        baseline = ingest.build_candidates(tracks, releases, {}, [])
        pins, summary = ingest.build_release_isrc_audio_pins(tracks, baseline, releases)
        self.assertEqual(pins, {})
        self.assertEqual(summary["duplicateIsrc"], 1)

    def test_release_scope_isrc_rejects_file_with_multiple_claim_tokens(self):
        tracks = [
            self.track(2, "First", isrc="FR-ABC-26-12345"),
            self.track(3, "Second", isrc="US-XYZ-26-54321"),
        ]
        audio = ingest.DriveAudio("1" + "d" * 20, "FRABC2612345_USXYZ2654321.wav")
        releases = [ingest.ReleaseAudio("12345678", "Release", "", (audio,))]
        baseline = ingest.build_candidates(tracks, releases, {}, [])
        pins, summary = ingest.build_release_isrc_audio_pins(tracks, baseline, releases)
        self.assertEqual(pins, {})
        self.assertEqual(summary["multiClaimFiles"], 1)

    def test_release_scope_isrc_rejects_multiple_files_for_one_row(self):
        track = self.track(2, "First", isrc="FR-ABC-26-12345")
        files = (
            ingest.DriveAudio("1" + "e" * 20, "FRABC2612345.wav"),
            ingest.DriveAudio("1" + "f" * 20, "FR-ABC-26-12345.mp3", mime_type="audio/mpeg"),
        )
        releases = [ingest.ReleaseAudio(track.upc, track.release, "", files)]
        baseline = ingest.build_candidates([track], releases, {}, [])
        pins, summary = ingest.build_release_isrc_audio_pins([track], baseline, releases)
        self.assertEqual(pins, {})
        self.assertEqual(summary["ambiguousTracks"], 1)

    def test_release_scope_isrc_never_replaces_baseline_and_is_idempotent(self):
        mapped = self.track(2, "First", release="One", upc="11111111", isrc="FR-ABC-26-12345")
        missing = self.track(3, "Second", release="Two", upc="22222222", isrc="US-XYZ-26-54321")
        existing = ingest.DriveAudio("1" + "g" * 20, "First.wav")
        replacement = ingest.DriveAudio("1" + "h" * 20, "FRABC2612345.wav")
        addition = ingest.DriveAudio("1" + "i" * 20, "USXYZ2654321.wav")
        releases = [
            ingest.ReleaseAudio(mapped.upc, mapped.release, "", (existing, replacement)),
            ingest.ReleaseAudio(missing.upc, missing.release, "", (addition,)),
        ]
        baseline = ingest.build_candidates([mapped, missing], releases, {}, [])
        pins, summary = ingest.build_release_isrc_audio_pins([mapped, missing], baseline, releases)
        once = ingest.apply_release_isrc_audio_pins(baseline, pins)
        twice = ingest.apply_release_isrc_audio_pins(once, pins)
        mapped_after = next(candidate for candidate in once if candidate.track and candidate.track.source_row == 2)
        self.assertEqual(mapped_after.audio, existing)
        self.assertEqual(set(pins), {3})
        self.assertGreaterEqual(summary["alreadyMapped"], 1)
        self.assertEqual(once, twice)

    def test_release_scope_isrc_requires_consistent_audio_descriptor(self):
        track = self.track(2, "First", isrc="FR-ABC-26-12345")
        renamed = ingest.DriveAudio("1" + "j" * 20, "FRABC2612345.mp3", mime_type="audio/wav")
        releases = [ingest.ReleaseAudio(track.upc, track.release, "", (renamed,))]
        baseline = ingest.build_candidates([track], releases, {}, [])
        pins, summary = ingest.build_release_isrc_audio_pins([track], baseline, releases)
        self.assertEqual(pins, {})
        self.assertEqual(summary["unsupported"], 1)

    def test_unique_flat_filename_fills_only_one_missing_track(self):
        tracks = [self.track(2, "Quiet Morning"), self.track(3, "Night Walk")]
        audio = ingest.DriveAudio("1" + "A" * 20, "Artist - Quiet Morning.wav")
        merged, summary = ingest.merge_central_audio_mappings(tracks, [], [audio])
        self.assertEqual(summary["mapped"], 1)
        self.assertEqual([item.file_id for group in merged for item in group.files], [audio.file_id])

    def test_duplicate_title_and_duplicate_file_claims_remain_ambiguous(self):
        duplicate_title = [
            self.track(2, "Home", release="One", upc="11111111"),
            self.track(3, "Home", release="Two", upc="22222222"),
        ]
        audio = ingest.DriveAudio("1" + "A" * 20, "Home.wav")
        merged, summary = ingest.merge_central_audio_mappings(duplicate_title, [], [audio])
        self.assertEqual(merged, [])
        self.assertEqual(summary["ambiguousFiles"], 1)

        track = self.track(4, "Unique")
        files = [
            ingest.DriveAudio("1" + "B" * 20, "Unique.wav"),
            ingest.DriveAudio("1" + "C" * 20, "Artist - Unique.wav"),
        ]
        merged, summary = ingest.merge_central_audio_mappings([track], [], files)
        self.assertEqual(merged, [])
        self.assertEqual(summary["ambiguousTracks"], 1)

    def test_unique_isrc_can_bind_a_central_wav_without_spotify(self):
        track = self.track(2, "Different Display Name", isrc="FR-ABC-26-12345")
        audio = ingest.DriveAudio("1" + "D" * 20, "FRABC2612345_master.wav")
        merged, summary = ingest.merge_central_audio_mappings([track], [], [audio])
        self.assertEqual(summary["mapped"], 1)
        self.assertEqual(merged[-1].files, (audio,))

    def test_existing_deterministic_audio_is_never_replaced_by_central_snapshot(self):
        track = self.track(2, "Quiet Morning")
        existing = ingest.DriveAudio("1" + "E" * 20, "Quiet Morning.wav")
        central = ingest.DriveAudio("1" + "F" * 20, "Artist - Quiet Morning.wav")
        release = ingest.ReleaseAudio(track.upc, track.release, "1" + "R" * 20, (existing,))
        merged, summary = ingest.merge_central_audio_mappings([track], [release], [central])
        self.assertEqual(merged, [release])
        self.assertEqual(summary["mapped"], 0)

    def test_existing_match_cannot_be_subtracted_into_a_false_unique_match(self):
        existing_track = self.track(
            2,
            "Existing",
            release="One",
            upc="11111111",
            isrc="FR-ABC-26-12345",
        )
        missing_track = self.track(3, "Home", release="Two", upc="22222222")
        existing_audio = ingest.DriveAudio("1" + "J" * 20, "Existing.wav")
        release = ingest.ReleaseAudio(
            existing_track.upc,
            existing_track.release,
            "1" + "R" * 20,
            (existing_audio,),
        )
        conflicting = ingest.DriveAudio(
            "1" + "K" * 20,
            "FRABC2612345 X 22222222 Home.wav",
        )

        merged, summary = ingest.merge_central_audio_mappings(
            [existing_track, missing_track],
            [release],
            [conflicting],
        )

        self.assertEqual(merged, [release])
        self.assertEqual(summary["mapped"], 0)
        self.assertEqual(summary["ambiguousFiles"], 1)

    @staticmethod
    def direct_rows(candidates):
        return {
            candidate.track.source_row
            for candidate in candidates
            if candidate.track is not None
            and ingest.direct_publication_eligible(
                {
                    **ingest.candidate_payload(candidate),
                    "status": candidate.status,
                    "reasons": candidate.reasons,
                }
            )
        }

    def test_row_pins_are_monotone_and_idempotent(self):
        existing_track = self.track(2, "Quiet Morning")
        missing_track = self.track(3, "Night Walk")
        existing_audio = ingest.DriveAudio("1" + "L" * 20, "Quiet Morning.wav")
        release = ingest.ReleaseAudio(
            existing_track.upc,
            existing_track.release,
            "1" + "R" * 20,
            (existing_audio,),
        )
        cover = ingest.Cover(existing_track.upc, "1" + "C" * 20, "owned", True)
        baseline = ingest.build_candidates(
            [existing_track, missing_track], [release], {existing_track.upc: cover}, []
        )
        new_audio = ingest.DriveAudio("1" + "M" * 20, "Artist - Night Walk.wav")

        pins, summary = ingest.build_central_audio_pins(
            [existing_track, missing_track], baseline, [new_audio]
        )
        result = ingest.apply_central_audio_pins(baseline, pins)
        repeated = ingest.apply_central_audio_pins(result, pins)

        self.assertEqual(summary["pinned"], 1)
        self.assertEqual(result, repeated)
        self.assertTrue(self.direct_rows(baseline).issubset(self.direct_rows(result)))
        self.assertEqual(self.direct_rows(result), {2, 3})
        self.assertEqual(result[0], baseline[0])
        self.assertEqual(result[1].audio, new_audio)

    def test_row_pins_never_resolve_a_baseline_ambiguity(self):
        track = self.track(2, "Home", isrc="FR-ABC-26-12345")
        release = ingest.ReleaseAudio(
            track.upc,
            track.release,
            "1" + "R" * 20,
            (
                ingest.DriveAudio("1" + "N" * 20, "Home.wav"),
                ingest.DriveAudio("1" + "O" * 20, "Artist - Home.wav"),
            ),
        )
        baseline = ingest.build_candidates([track], [release], {}, [])
        central = ingest.DriveAudio("1" + "P" * 20, "FRABC2612345.wav")

        pins, summary = ingest.build_central_audio_pins([track], baseline, [central])
        result = ingest.apply_central_audio_pins(baseline, pins)

        self.assertEqual(pins, {})
        self.assertEqual(summary["pinned"], 0)
        self.assertEqual(result, baseline)
        self.assertIn("audio_match_ambiguous", result[0].reasons)

    def test_row_pins_do_not_subtract_an_existing_claim_to_create_uniqueness(self):
        existing_track = self.track(
            2,
            "Existing",
            release="One",
            upc="11111111",
            isrc="FR-ABC-26-12345",
        )
        missing_track = self.track(3, "Home", release="Two", upc="22222222")
        existing_audio = ingest.DriveAudio("1" + "W" * 20, "Existing.wav")
        release = ingest.ReleaseAudio(
            existing_track.upc,
            existing_track.release,
            "1" + "R" * 20,
            (existing_audio,),
        )
        baseline = ingest.build_candidates(
            [existing_track, missing_track], [release], {}, []
        )
        conflicting = ingest.DriveAudio(
            "1" + "X" * 20,
            "FRABC2612345 22222222 Home.wav",
        )

        pins, summary = ingest.build_central_audio_pins(
            [existing_track, missing_track], baseline, [conflicting]
        )

        self.assertEqual(pins, {})
        self.assertEqual(summary["pinned"], 0)
        self.assertIsNone(baseline[1].audio)

    def test_row_pins_fail_closed_for_duplicate_titles_and_multiple_files(self):
        duplicate_tracks = [
            self.track(2, "Home", release="One", upc="11111111"),
            self.track(3, "Home", release="Two", upc="22222222"),
        ]
        duplicate_baseline = ingest.build_candidates(duplicate_tracks, [], {}, [])
        pins, _summary = ingest.build_central_audio_pins(
            duplicate_tracks,
            duplicate_baseline,
            [ingest.DriveAudio("1" + "Q" * 20, "Home.wav")],
        )
        self.assertEqual(pins, {})

        track = self.track(4, "Unique")
        baseline = ingest.build_candidates([track], [], {}, [])
        pins, summary = ingest.build_central_audio_pins(
            [track],
            baseline,
            [
                ingest.DriveAudio("1" + "S" * 20, "Unique.wav"),
                ingest.DriveAudio("1" + "T" * 20, "Artist - Unique.wav"),
            ],
        )
        self.assertEqual(pins, {})
        self.assertEqual(summary["ambiguousTracks"], 1)

    def test_row_pin_uses_unique_isrc_then_exact_upc_title(self):
        isrc_track = self.track(
            2, "First", release="One", upc="11111111", isrc="FR-ABC-26-12345"
        )
        upc_track = self.track(3, "Second", release="Two", upc="22222222")
        tracks = [isrc_track, upc_track]
        baseline = ingest.build_candidates(tracks, [], {}, [])
        files = [
            ingest.DriveAudio("1" + "U" * 20, "FRABC2612345.wav"),
            ingest.DriveAudio("1" + "V" * 20, "22222222 Artist - Second.wav"),
        ]

        pins, summary = ingest.build_central_audio_pins(tracks, baseline, files)

        self.assertEqual(summary["pinned"], 2)
        self.assertEqual(pins[2].match_kind, "central_unique_isrc")
        self.assertEqual(pins[3].match_kind, "central_unique_upc_title")

    def test_central_mp3_requires_injective_exact_composite_and_counts_rules(self):
        artist_track = self.track(2, "Night Walk", release="One", upc="11111111")
        release_track = self.track(
            3,
            "Quiet Rain",
            release="Blue Hours",
            upc="22222222",
            artist="Other",
        )
        tracks = [artist_track, release_track]
        baseline = ingest.build_candidates(tracks, [], {}, [])
        files = [
            ingest.DriveAudio(
                "1" + "Y" * 20,
                "Artist - Night Walk.mp3",
                mime_type="audio/mpeg",
            ),
            ingest.DriveAudio(
                "1" + "Z" * 20,
                "Blue Hours - Quiet Rain.mp3",
                mime_type="audio/mp3",
            ),
        ]

        pins, summary = ingest.build_central_audio_pins(tracks, baseline, files)

        self.assertEqual(summary["pinnedMp3"], 2)
        self.assertEqual(summary["pinnedWav"], 0)
        self.assertEqual(summary["pinnedByRule"]["central_unique_artist_title"], 1)
        self.assertEqual(summary["pinnedByRule"]["central_unique_release_title"], 1)
        self.assertEqual(
            summary["pinnedByRule"]["central_globally_unique_exact_title"], 0
        )
        self.assertEqual(pins[2].match_kind, "central_unique_artist_title")
        self.assertEqual(pins[3].match_kind, "central_unique_release_title")

    def test_central_mp3_rejects_title_only_fuzzy_and_multiple_claims(self):
        track = self.track(2, "Night Walk")
        baseline = ingest.build_candidates([track], [], {}, [])
        files = [
            ingest.DriveAudio("1" + "2" * 20, "Night Walk.mp3"),
            ingest.DriveAudio("1" + "3" * 20, "Artist - Night Walk Final.mp3"),
        ]
        pins, summary = ingest.build_central_audio_pins([track], baseline, files)
        self.assertEqual(pins, {})
        self.assertEqual(summary["pinnedMp3"], 0)
        self.assertEqual(summary["rejected"], 2)

        exact_files = [
            ingest.DriveAudio("1" + "4" * 20, "Artist - Night Walk.mp3"),
            ingest.DriveAudio("1" + "5" * 20, "Night Walk - Artist.mp3"),
        ]
        pins, summary = ingest.build_central_audio_pins(
            [track], baseline, exact_files
        )
        self.assertEqual(pins, {})
        self.assertEqual(summary["ambiguousTracks"], 1)

    def test_central_exact_rules_must_agree_and_mime_cannot_conflict(self):
        isrc_track = self.track(2, "First", isrc="FR-ABC-26-12345")
        composite_track = self.track(3, "Second", artist="Other")
        baseline = ingest.build_candidates([isrc_track, composite_track], [], {}, [])
        contradictory = ingest.DriveAudio(
            "1" + "6" * 20,
            "FRABC2612345 Other Second.mp3",
            mime_type="audio/mpeg",
        )
        renamed = ingest.DriveAudio(
            "1" + "7" * 20,
            "Artist - First.mp3",
            mime_type="audio/wav",
        )

        pins, summary = ingest.build_central_audio_pins(
            [isrc_track, composite_track], baseline, [contradictory, renamed]
        )
        self.assertEqual(pins, {})
        self.assertEqual(summary["conflicts"], 1)
        self.assertEqual(summary["unsupported"], 1)

    def test_central_wav_composite_counter_is_separate_from_mp3(self):
        track = self.track(2, "Night Walk")
        baseline = ingest.build_candidates([track], [], {}, [])
        audio = ingest.DriveAudio("1" + "8" * 20, "Artist - Night Walk.wav")
        pins, summary = ingest.build_central_audio_pins([track], baseline, [audio])
        self.assertEqual(len(pins), 1)
        self.assertEqual(summary["pinnedWav"], 1)
        self.assertEqual(summary["pinnedMp3"], 0)
        self.assertEqual(summary["pinnedByRule"]["central_unique_artist_title"], 1)

    def test_central_inventory_accepts_only_supported_wav_and_mp3_sources(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "central.json"
            path.write_text(
                json.dumps(
                    {
                        "complete": True,
                        "files": [
                            {
                                "id": "1" + "9" * 20,
                                "name": "Artist - One.wav",
                                "mimeType": "audio/wav",
                                "central_kind": "audio",
                            },
                            {
                                "id": "1" + "0" * 20,
                                "name": "Artist - Two.mp3",
                                "mimeType": "audio/mpeg",
                                "central_kind": "audio",
                            },
                            {
                                "id": "1" + "A" * 20,
                                "name": "notes.txt",
                                "mimeType": "text/plain",
                                "central_kind": "audio",
                            },
                        ],
                    }
                ),
                encoding="utf-8",
            )
            audio, artwork, complete = ingest.load_central_drive_inventory(path)
        self.assertEqual({item.name for item in audio}, {"Artist - One.wav", "Artist - Two.mp3"})
        self.assertEqual(artwork, [])
        self.assertTrue(complete)

    def test_cover_prefers_one_approved_central_artwork_and_fails_closed_on_ties(self):
        track = self.track(2, "Quiet Morning", release="Blue Hours", upc="12345678")
        ordinary = {
            "id": "1" + "G" * 20,
            "name": "12345678.jpg",
            "mimeType": "image/jpeg",
            "path": "Artwork/12345678.jpg",
        }
        approved = {
            "id": "1" + "H" * 20,
            "name": "12345678.jpg",
            "mimeType": "image/jpeg",
            "path": "Artwork les bon/12345678.jpg",
        }
        merged, summary = ingest.merge_central_cover_mappings({}, [track], [ordinary, approved])
        self.assertEqual(summary["mapped"], 1)
        self.assertEqual(merged[track.upc].file_id, approved["id"])

        tied = dict(approved, id="1" + "I" * 20)
        merged, summary = ingest.merge_central_cover_mappings({}, [track], [approved, tied])
        self.assertNotIn(track.upc, merged)
        self.assertEqual(summary["ambiguous"], 1)

    def test_partial_central_snapshot_cannot_authorize_stale_quarantine(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            drive_inventory = root / "drive.json"
            central_inventory = root / "central.json"
            drive_inventory.write_text('{"complete": true, "files": []}', encoding="utf-8")
            central_inventory.write_text('{"complete": false, "files": []}', encoding="utf-8")

            self.assertFalse(
                ingest.source_inventories_are_complete(
                    drive_inventory,
                    central_inventory,
                    central_complete=False,
                )
            )
            self.assertTrue(
                ingest.source_inventories_are_complete(
                    drive_inventory,
                    central_inventory,
                    central_complete=True,
                )
            )
            self.assertTrue(
                ingest.source_inventories_are_complete(
                    drive_inventory,
                    None,
                    central_complete=False,
                )
            )


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

    def test_owner_direct_eligibility_ignores_spotify_and_prescan_only(self):
        record = {
            "candidate_id": "b" * 28,
            "status": "review",
            "reasons": ["spotify_id_missing", "spotify_duration_missing", "audio_inspection_pending", "sha256_pending"],
            "audio_match_score": 100,
            "audio_match_kind": "exact_title",
            "track": {
                "source_row": 4,
                "title": "Time",
                "release": "Time",
                "artists": ["Voyage"],
            },
            "audio": {"file_id": "1" + "A" * 20, "name": "Voyage - Time.wav"},
            "cover": {"file_id": "1" + "C" * 20, "is_square": False},
        }
        self.assertTrue(ingest.direct_publication_eligible(record))
        record["reasons"].append("audio_match_ambiguous")
        self.assertFalse(ingest.direct_publication_eligible(record))

    def test_owner_direct_allows_missing_artwork_but_rejects_invalid_artwork(self):
        record = {
            "candidate_id": "b" * 28,
            "status": "review",
            "reasons": ["cover_missing"],
            "audio_match_score": 100,
            "audio_match_kind": "exact_title",
            "track": {
                "source_row": 4,
                "title": "Time",
                "release": "Time",
                "artists": ["Voyage"],
            },
            "audio": {"file_id": "1" + "A" * 20, "name": "Voyage - Time.wav"},
            "cover": None,
        }
        self.assertTrue(ingest.direct_publication_eligible(record))
        record["cover"] = {"file_id": "not-a-drive-id"}
        self.assertFalse(ingest.direct_publication_eligible(record))

    def test_owner_direct_treats_source_filename_and_sheet_duration_as_authoritative(self):
        base = {
            "candidate_id": "b" * 28,
            "status": "quarantine",
            "reasons": [],
            "audio_match_score": 100,
            "audio_match_kind": "exact_title",
            "track": {"source_row": 4, "duration_seconds": 120},
            "audio": {"file_id": "1" + "A" * 20, "name": "Voyage - Time.wav"},
            "cover": {"file_id": "1" + "C" * 20},
        }
        for reason in (
            "audio_version_mismatch",
            "suspicious_audio_filename",
            "expected_duration_missing",
            "expected_duration_under_30s",
        ):
            with self.subTest(reason=reason):
                record = {**base, "reasons": [reason]}
                self.assertTrue(ingest.direct_publication_eligible(record))


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

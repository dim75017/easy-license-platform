import json
import io
from pathlib import Path
import tempfile
import unittest
from unittest import mock

from sync_lofi_drive_loader import sync


class DriveListingParserTests(unittest.TestCase):
    def test_decodes_drive_javascript_payload(self):
        item = ["ABCDEFGHIJKLMNO", None, "Song.wav", "audio/wav", None, None, None, None, None, 1_700_000_000_000, 1_700_000_100_000, None, None, 1234]
        encoded = json.dumps([[item]], separators=(",", ":")).replace("[", r"\x5b").replace("]", r"\x5d").replace('"', r"\x22")
        rows = sync.parse_folder_listing(f"<script>window['_DRIVE_ivd'] = '{encoded}'</script>")
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["name"], "Song.wav")
        self.assertEqual(rows[0]["mimeType"], "audio/wav")
        self.assertEqual(rows[0]["size"], "1234")

    def test_embedded_root_is_deduplicated(self):
        document = """
        <div class="flip-entry"><a href="/drive/folders/ABCDEFGHIJKLMNO">
          <div class="flip-entry-title" title="Release One"></div>
          <div class="flip-entry-last-modified">Aug 19, 2026</div></a></div>
        <div class="flip-entry"><a href="/drive/folders/ABCDEFGHIJKLMNO">
          <div class="flip-entry-title">Release One</div></a></div>
        """
        rows = sync.parse_embedded_root(document)
        self.assertEqual(rows, [{"id": "ABCDEFGHIJKLMNO", "title": "Release One", "updatedAt": "Aug 19, 2026"}])


class SyncStateTests(unittest.TestCase):
    def test_initial_seed_becomes_a_real_pending_backlog(self):
        with tempfile.TemporaryDirectory() as temporary:
            connection = sync.open_state(Path(temporary) / "state.sqlite3")
            try:
                rows = [
                    {"id": "ABCDEFGHIJKLMNO", "title": "Older", "createdAt": "2025-01-01", "updatedAt": "2025-01-01"},
                    {"id": "PQRSTUVWXYZabcd", "title": "Newer", "createdAt": "2026-01-01", "updatedAt": "2026-01-01"},
                ]
                self.assertEqual(sync.upsert_release_roots(connection, rows, []), 2)
                self.assertEqual(sync.selected_releases(connection, 25), ["PQRSTUVWXYZabcd", "ABCDEFGHIJKLMNO"])
                pending = connection.execute("SELECT COUNT(*) FROM releases WHERE scan_status='pending'").fetchone()[0]
                self.assertEqual(pending, 2)
            finally:
                connection.close()

    def test_new_live_release_is_prioritized_over_old_backlog(self):
        with tempfile.TemporaryDirectory() as temporary:
            connection = sync.open_state(Path(temporary) / "state.sqlite3")
            try:
                old = [{"id": "ABCDEFGHIJKLMNO", "title": "Old", "createdAt": "2020", "updatedAt": "2020"}]
                sync.upsert_release_roots(connection, old, [])
                connection.execute("UPDATE releases SET priority_at='2020-01-01T00:00:00+00:00'")
                connection.commit()
                live = [{"id": "PQRSTUVWXYZabcd", "title": "New", "updatedAt": "Today"}]
                sync.upsert_release_roots(connection, old, live)
                self.assertEqual(sync.selected_releases(connection, 1), ["PQRSTUVWXYZabcd"])
            finally:
                connection.close()

    def test_partial_root_window_does_not_deactivate_known_releases(self):
        with tempfile.TemporaryDirectory() as temporary:
            connection = sync.open_state(Path(temporary) / "state.sqlite3")
            try:
                seed = [
                    {"id": "ABCDEFGHIJKLMNO", "title": "One", "createdAt": "", "updatedAt": "2025-01-01"},
                    {"id": "PQRSTUVWXYZabcd", "title": "Two", "createdAt": "", "updatedAt": "2025-01-02"},
                ]
                discovered = [{"id": "qrstuvwxyzABCDE", "title": "Three", "updatedAt": "Aug 19, 2026"}]
                sync.upsert_release_roots(connection, seed, discovered, root_snapshot_complete=False)
                sync.upsert_release_roots(connection, seed, seed[:1], root_snapshot_complete=False)
                active = connection.execute(
                    "SELECT folder_id FROM releases WHERE root_present=1 ORDER BY folder_id"
                ).fetchall()
                self.assertEqual({row[0] for row in active}, {row["id"] for row in seed} | {discovered[0]["id"]})
            finally:
                connection.close()

    def test_root_completeness_requires_exact_id_set(self):
        seed = [
            {"id": "ABCDEFGHIJKLMNO"},
            {"id": "PQRSTUVWXYZabcd"},
        ]
        same_ids_different_order = [
            {"id": "PQRSTUVWXYZabcd"},
            {"id": "ABCDEFGHIJKLMNO"},
        ]
        same_count_wrong_id = [
            {"id": "ABCDEFGHIJKLMNO"},
            {"id": "qrstuvwxyzABCDE"},
        ]
        self.assertTrue(sync.root_listing_matches_expected(seed, same_ids_different_order))
        self.assertFalse(sync.root_listing_matches_expected(seed, same_count_wrong_id))

    def test_seed_equal_window_cannot_hide_a_previously_discovered_release(self):
        with tempfile.TemporaryDirectory() as temporary:
            connection = sync.open_state(Path(temporary) / "state.sqlite3")
            try:
                seed = [{"id": "ABCDEFGHIJKLMNO", "title": "Seed", "createdAt": "", "updatedAt": "2025-01-01"}]
                new_release = {"id": "PQRSTUVWXYZabcd", "title": "New", "updatedAt": "Aug 19, 2026"}
                first_live_window = [*seed, new_release]
                first_complete = sync.root_listing_matches_expected(seed, first_live_window)
                self.assertFalse(first_complete)
                sync.upsert_release_roots(
                    connection, seed, first_live_window, root_snapshot_complete=first_complete
                )

                known_active_ids = {
                    row[0]
                    for row in connection.execute(
                        "SELECT folder_id FROM releases WHERE root_present=1"
                    ).fetchall()
                }
                later_seed_only_window = list(seed)
                later_complete = sync.root_listing_matches_expected(
                    seed, later_seed_only_window, known_active_ids=known_active_ids
                )
                self.assertFalse(later_complete)
                sync.upsert_release_roots(
                    connection, seed, later_seed_only_window, root_snapshot_complete=later_complete
                )
                self.assertEqual(
                    connection.execute(
                        "SELECT root_present FROM releases WHERE folder_id=?", (new_release["id"],)
                    ).fetchone()[0],
                    1,
                )
            finally:
                connection.close()

    def test_inventory_export_is_private_and_ingest_compatible(self):
        with tempfile.TemporaryDirectory(dir=sync.PRIVATE_ROOT) as temporary:
            output = Path(temporary)
            connection = sync.open_state(output / "state.sqlite3")
            try:
                release = [{"id": "ABCDEFGHIJKLMNO", "title": "Release", "createdAt": "", "updatedAt": ""}]
                sync.upsert_release_roots(connection, release, [])
                sync.save_release(connection, "ABCDEFGHIJKLMNO", [{
                    "id": "PQRSTUVWXYZabcd", "name": "123_ABC.wav", "mimeType": "audio/wav", "size": "99",
                    "createdTime": "", "modifiedTime": "", "parent_id": "ABCDEFGHIJKLMNO", "path": "Music/123_ABC.wav",
                    "release_folder_id": "ABCDEFGHIJKLMNO", "depth": 1, "kind": "audio",
                }])
                summary = sync.export_outputs(connection, output, root_complete=True)
                delivery_state = connection.execute(
                    "SELECT delivery_state FROM releases WHERE folder_id='ABCDEFGHIJKLMNO'"
                ).fetchone()[0]
            finally:
                connection.close()
            payload = json.loads((output / "drive-inventory.json").read_text(encoding="utf-8"))
            self.assertTrue(payload["complete"])
            self.assertEqual(payload["files"][0]["release_folder_id"], "ABCDEFGHIJKLMNO")
            self.assertEqual(summary["audioFiles"], 1)
            self.assertEqual(summary["pendingItems"], 0)
            self.assertEqual(delivery_state, "delivered")
            self.assertEqual((output / "backlog.jsonl").read_text(encoding="utf-8"), "")


class ExecuteFailureTests(unittest.TestCase):
    def test_root_listing_failure_is_observable_and_returns_nonzero(self):
        with tempfile.TemporaryDirectory(dir=sync.PRIVATE_ROOT) as temporary:
            root = Path(temporary)
            seed = root / "seed.json"
            output = root / "output"
            seed.write_text(json.dumps({
                "schemaVersion": 1,
                "sourceFolderId": "ABCDEFGHIJKLMNO",
                "releaseFolders": [{
                    "id": "PQRSTUVWXYZabcd", "title": "Release", "createdAt": "", "updatedAt": "2026-08-19"
                }],
            }), encoding="utf-8")
            with mock.patch.object(sync, "fetch_html", side_effect=sync.SyncError("transport_error")):
                with mock.patch("sys.stdout", new=io.StringIO()):
                    exit_code = sync.main([
                        "--seed", str(seed), "--output-dir", str(output), "--apply", "--allow-network"
                    ])
            self.assertEqual(exit_code, 1)
            summary = json.loads((output / "summary.json").read_text(encoding="utf-8"))
            self.assertEqual(summary["status"], "failed")
            self.assertEqual(summary["error"], "root_listing_failed")
            self.assertEqual(summary["rootListing"]["error"], "transport_error")


if __name__ == "__main__":
    unittest.main()

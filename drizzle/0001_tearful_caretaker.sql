CREATE TABLE `artists` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`normalized_name` text NOT NULL,
	`spotify_artist_id` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "artists_status_check" CHECK("artists"."status" IN ('active', 'hidden', 'archived')),
	CONSTRAINT "artists_name_length_check" CHECK(length("artists"."name") BETWEEN 1 AND 300),
	CONSTRAINT "artists_normalized_name_length_check" CHECK(length("artists"."normalized_name") BETWEEN 1 AND 300),
	CONSTRAINT "artists_spotify_id_length_check" CHECK("artists"."spotify_artist_id" IS NULL OR length("artists"."spotify_artist_id") BETWEEN 1 AND 64)
);
--> statement-breakpoint
CREATE INDEX `idx_artists_normalized_name` ON `artists` (`normalized_name`);--> statement-breakpoint
CREATE INDEX `idx_artists_status_name` ON `artists` (`status`,`normalized_name`);--> statement-breakpoint
CREATE INDEX `idx_artists_spotify_artist_id` ON `artists` (`spotify_artist_id`);--> statement-breakpoint
CREATE TABLE `ingest_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`batch_key` text NOT NULL,
	`source_key` text NOT NULL,
	`source_row_number` integer,
	`source_file_name` text NOT NULL,
	`source_sha256` text,
	`declared_title` text,
	`declared_artist` text,
	`declared_duration_ms` integer,
	`measured_duration_ms` integer,
	`track_id` integer,
	`asset_id` integer,
	`status` text DEFAULT 'discovered' NOT NULL,
	`failure_code` text,
	`review_note` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`track_id`) REFERENCES `tracks`(`id`) ON UPDATE cascade ON DELETE set null,
	FOREIGN KEY (`asset_id`) REFERENCES `track_assets`(`id`) ON UPDATE cascade ON DELETE set null,
	CONSTRAINT "ingest_items_status_check" CHECK("ingest_items"."status" IN ('discovered', 'inspecting', 'matching', 'needs_review', 'ready', 'imported', 'quarantined', 'skipped', 'failed')),
	CONSTRAINT "ingest_items_batch_key_length_check" CHECK(length("ingest_items"."batch_key") BETWEEN 1 AND 160),
	CONSTRAINT "ingest_items_source_key_length_check" CHECK(length("ingest_items"."source_key") BETWEEN 1 AND 160),
	CONSTRAINT "ingest_items_source_row_number_check" CHECK("ingest_items"."source_row_number" IS NULL OR "ingest_items"."source_row_number" >= 1),
	CONSTRAINT "ingest_items_source_file_name_length_check" CHECK(length("ingest_items"."source_file_name") BETWEEN 1 AND 1000),
	CONSTRAINT "ingest_items_source_sha256_check" CHECK("ingest_items"."source_sha256" IS NULL OR length("ingest_items"."source_sha256") = 64),
	CONSTRAINT "ingest_items_declared_title_length_check" CHECK("ingest_items"."declared_title" IS NULL OR length("ingest_items"."declared_title") BETWEEN 1 AND 500),
	CONSTRAINT "ingest_items_declared_artist_length_check" CHECK("ingest_items"."declared_artist" IS NULL OR length("ingest_items"."declared_artist") BETWEEN 1 AND 1000),
	CONSTRAINT "ingest_items_declared_duration_ms_check" CHECK("ingest_items"."declared_duration_ms" IS NULL OR "ingest_items"."declared_duration_ms" BETWEEN 1 AND 86400000),
	CONSTRAINT "ingest_items_measured_duration_ms_check" CHECK("ingest_items"."measured_duration_ms" IS NULL OR "ingest_items"."measured_duration_ms" BETWEEN 1 AND 86400000),
	CONSTRAINT "ingest_items_failure_code_length_check" CHECK("ingest_items"."failure_code" IS NULL OR length("ingest_items"."failure_code") BETWEEN 1 AND 120),
	CONSTRAINT "ingest_items_review_note_length_check" CHECK("ingest_items"."review_note" IS NULL OR length("ingest_items"."review_note") BETWEEN 1 AND 4000)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_ingest_items_batch_source` ON `ingest_items` (`batch_key`,`source_key`);--> statement-breakpoint
CREATE INDEX `idx_ingest_items_status_updated_at` ON `ingest_items` (`status`,`updated_at`);--> statement-breakpoint
CREATE INDEX `idx_ingest_items_track_id` ON `ingest_items` (`track_id`);--> statement-breakpoint
CREATE INDEX `idx_ingest_items_source_sha256` ON `ingest_items` (`source_sha256`);--> statement-breakpoint
CREATE TABLE `releases` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`primary_artist_id` integer NOT NULL,
	`title` text NOT NULL,
	`normalized_title` text NOT NULL,
	`artist_credit` text NOT NULL,
	`type` text DEFAULT 'other' NOT NULL,
	`upc` text,
	`release_date` text,
	`spotify_album_id` text,
	`cover_source_url` text,
	`cover_storage_key` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`primary_artist_id`) REFERENCES `artists`(`id`) ON UPDATE cascade ON DELETE restrict,
	CONSTRAINT "releases_type_check" CHECK("releases"."type" IN ('single', 'ep', 'album', 'compilation', 'other')),
	CONSTRAINT "releases_status_check" CHECK("releases"."status" IN ('draft', 'needs_review', 'ready', 'published', 'hidden', 'archived')),
	CONSTRAINT "releases_title_length_check" CHECK(length("releases"."title") BETWEEN 1 AND 500),
	CONSTRAINT "releases_normalized_title_length_check" CHECK(length("releases"."normalized_title") BETWEEN 1 AND 500),
	CONSTRAINT "releases_artist_credit_length_check" CHECK(length("releases"."artist_credit") BETWEEN 1 AND 1000),
	CONSTRAINT "releases_upc_length_check" CHECK("releases"."upc" IS NULL OR length("releases"."upc") BETWEEN 8 AND 14),
	CONSTRAINT "releases_release_date_length_check" CHECK("releases"."release_date" IS NULL OR length("releases"."release_date") IN (4, 7, 10)),
	CONSTRAINT "releases_spotify_album_id_length_check" CHECK("releases"."spotify_album_id" IS NULL OR length("releases"."spotify_album_id") BETWEEN 1 AND 64),
	CONSTRAINT "releases_cover_source_url_length_check" CHECK("releases"."cover_source_url" IS NULL OR length("releases"."cover_source_url") BETWEEN 1 AND 2048),
	CONSTRAINT "releases_cover_storage_key_length_check" CHECK("releases"."cover_storage_key" IS NULL OR length("releases"."cover_storage_key") BETWEEN 1 AND 1000)
);
--> statement-breakpoint
CREATE INDEX `idx_releases_artist_status` ON `releases` (`primary_artist_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_releases_normalized_title` ON `releases` (`normalized_title`);--> statement-breakpoint
CREATE INDEX `idx_releases_upc` ON `releases` (`upc`);--> statement-breakpoint
CREATE INDEX `idx_releases_spotify_album_id` ON `releases` (`spotify_album_id`);--> statement-breakpoint
CREATE TABLE `spotify_matches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`track_id` integer NOT NULL,
	`spotify_track_id` text NOT NULL,
	`spotify_album_id` text,
	`spotify_title` text,
	`spotify_artist_credit` text,
	`spotify_album_title` text,
	`spotify_isrc` text,
	`spotify_duration_ms` integer,
	`duration_delta_ms` integer,
	`cover_source_url` text,
	`method` text NOT NULL,
	`score` integer NOT NULL,
	`status` text DEFAULT 'candidate' NOT NULL,
	`checked_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`reviewed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`track_id`) REFERENCES `tracks`(`id`) ON UPDATE cascade ON DELETE restrict,
	CONSTRAINT "spotify_matches_method_check" CHECK("spotify_matches"."method" IN ('distributor_uri', 'orchard_uri', 'isrc', 'exact_metadata', 'metadata_duration', 'manual')),
	CONSTRAINT "spotify_matches_status_check" CHECK("spotify_matches"."status" IN ('candidate', 'verified', 'rejected', 'stale')),
	CONSTRAINT "spotify_matches_verified_shape_check" CHECK("spotify_matches"."status" != 'verified' OR (
        "spotify_matches"."spotify_album_id" IS NOT NULL
        AND "spotify_matches"."spotify_title" IS NOT NULL
        AND "spotify_matches"."spotify_artist_credit" IS NOT NULL
        AND "spotify_matches"."spotify_album_title" IS NOT NULL
        AND "spotify_matches"."spotify_duration_ms" IS NOT NULL
        AND "spotify_matches"."duration_delta_ms" IS NOT NULL
      )),
	CONSTRAINT "spotify_matches_track_id_length_check" CHECK(length("spotify_matches"."spotify_track_id") BETWEEN 1 AND 64),
	CONSTRAINT "spotify_matches_album_id_length_check" CHECK("spotify_matches"."spotify_album_id" IS NULL OR length("spotify_matches"."spotify_album_id") BETWEEN 1 AND 64),
	CONSTRAINT "spotify_matches_title_length_check" CHECK("spotify_matches"."spotify_title" IS NULL OR length("spotify_matches"."spotify_title") BETWEEN 1 AND 500),
	CONSTRAINT "spotify_matches_artist_credit_length_check" CHECK("spotify_matches"."spotify_artist_credit" IS NULL OR length("spotify_matches"."spotify_artist_credit") BETWEEN 1 AND 1000),
	CONSTRAINT "spotify_matches_album_title_length_check" CHECK("spotify_matches"."spotify_album_title" IS NULL OR length("spotify_matches"."spotify_album_title") BETWEEN 1 AND 500),
	CONSTRAINT "spotify_matches_isrc_length_check" CHECK("spotify_matches"."spotify_isrc" IS NULL OR length("spotify_matches"."spotify_isrc") = 12),
	CONSTRAINT "spotify_matches_duration_ms_check" CHECK("spotify_matches"."spotify_duration_ms" IS NULL OR "spotify_matches"."spotify_duration_ms" BETWEEN 1 AND 86400000),
	CONSTRAINT "spotify_matches_duration_delta_ms_check" CHECK("spotify_matches"."duration_delta_ms" IS NULL OR "spotify_matches"."duration_delta_ms" BETWEEN 0 AND 86400000),
	CONSTRAINT "spotify_matches_cover_source_url_length_check" CHECK("spotify_matches"."cover_source_url" IS NULL OR length("spotify_matches"."cover_source_url") BETWEEN 1 AND 2048),
	CONSTRAINT "spotify_matches_score_check" CHECK("spotify_matches"."score" BETWEEN 0 AND 10000)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_spotify_matches_track_candidate` ON `spotify_matches` (`track_id`,`spotify_track_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_spotify_matches_verified_track` ON `spotify_matches` (`track_id`) WHERE "spotify_matches"."status" = 'verified';--> statement-breakpoint
CREATE INDEX `idx_spotify_matches_track_status_score` ON `spotify_matches` (`track_id`,`status`,`score`);--> statement-breakpoint
CREATE INDEX `idx_spotify_matches_spotify_track_id` ON `spotify_matches` (`spotify_track_id`);--> statement-breakpoint
CREATE TABLE `track_assets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`track_id` integer NOT NULL,
	`kind` text NOT NULL,
	`storage_key` text NOT NULL,
	`mime_type` text NOT NULL,
	`byte_size` integer,
	`duration_ms` integer,
	`sha256` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`track_id`) REFERENCES `tracks`(`id`) ON UPDATE cascade ON DELETE restrict,
	CONSTRAINT "track_assets_kind_check" CHECK("track_assets"."kind" IN ('source_master', 'streaming_copy', 'download_copy', 'waveform_peaks')),
	CONSTRAINT "track_assets_status_check" CHECK("track_assets"."status" IN ('pending', 'available', 'quarantined', 'failed', 'deleted')),
	CONSTRAINT "track_assets_storage_key_length_check" CHECK(length("track_assets"."storage_key") BETWEEN 1 AND 1000),
	CONSTRAINT "track_assets_mime_type_length_check" CHECK(length("track_assets"."mime_type") BETWEEN 1 AND 120),
	CONSTRAINT "track_assets_byte_size_check" CHECK("track_assets"."byte_size" IS NULL OR "track_assets"."byte_size" >= 1),
	CONSTRAINT "track_assets_duration_ms_check" CHECK("track_assets"."duration_ms" IS NULL OR "track_assets"."duration_ms" BETWEEN 1 AND 86400000),
	CONSTRAINT "track_assets_sha256_check" CHECK("track_assets"."sha256" IS NULL OR length("track_assets"."sha256") = 64)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_track_assets_storage_key` ON `track_assets` (`storage_key`);--> statement-breakpoint
CREATE INDEX `idx_track_assets_track_kind_status` ON `track_assets` (`track_id`,`kind`,`status`);--> statement-breakpoint
CREATE INDEX `idx_track_assets_sha256` ON `track_assets` (`sha256`);--> statement-breakpoint
CREATE TABLE `tracks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`release_id` integer NOT NULL,
	`primary_artist_id` integer NOT NULL,
	`title` text NOT NULL,
	`normalized_title` text NOT NULL,
	`artist_credit` text NOT NULL,
	`version_label` text,
	`isrc` text,
	`disc_number` integer DEFAULT 1 NOT NULL,
	`track_number` integer,
	`duration_ms` integer,
	`genre` text,
	`mood` text,
	`theme` text,
	`rights_status` text DEFAULT 'pending' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`published_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`release_id`) REFERENCES `releases`(`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`primary_artist_id`) REFERENCES `artists`(`id`) ON UPDATE cascade ON DELETE restrict,
	CONSTRAINT "tracks_status_check" CHECK("tracks"."status" IN ('draft', 'needs_review', 'ready', 'published', 'hidden', 'archived')),
	CONSTRAINT "tracks_rights_status_check" CHECK("tracks"."rights_status" IN ('pending', 'cleared', 'restricted')),
	CONSTRAINT "tracks_publish_rights_check" CHECK("tracks"."status" != 'published' OR "tracks"."rights_status" = 'cleared'),
	CONSTRAINT "tracks_title_length_check" CHECK(length("tracks"."title") BETWEEN 1 AND 500),
	CONSTRAINT "tracks_normalized_title_length_check" CHECK(length("tracks"."normalized_title") BETWEEN 1 AND 500),
	CONSTRAINT "tracks_artist_credit_length_check" CHECK(length("tracks"."artist_credit") BETWEEN 1 AND 1000),
	CONSTRAINT "tracks_version_label_length_check" CHECK("tracks"."version_label" IS NULL OR length("tracks"."version_label") BETWEEN 1 AND 300),
	CONSTRAINT "tracks_isrc_length_check" CHECK("tracks"."isrc" IS NULL OR length("tracks"."isrc") = 12),
	CONSTRAINT "tracks_disc_number_check" CHECK("tracks"."disc_number" >= 1),
	CONSTRAINT "tracks_track_number_check" CHECK("tracks"."track_number" IS NULL OR "tracks"."track_number" >= 1),
	CONSTRAINT "tracks_duration_ms_check" CHECK("tracks"."duration_ms" IS NULL OR "tracks"."duration_ms" BETWEEN 1 AND 86400000),
	CONSTRAINT "tracks_genre_length_check" CHECK("tracks"."genre" IS NULL OR length("tracks"."genre") BETWEEN 1 AND 120),
	CONSTRAINT "tracks_mood_length_check" CHECK("tracks"."mood" IS NULL OR length("tracks"."mood") BETWEEN 1 AND 120),
	CONSTRAINT "tracks_theme_length_check" CHECK("tracks"."theme" IS NULL OR length("tracks"."theme") BETWEEN 1 AND 120)
);
--> statement-breakpoint
CREATE INDEX `idx_tracks_release_position` ON `tracks` (`release_id`,`disc_number`,`track_number`);--> statement-breakpoint
CREATE INDEX `idx_tracks_release_status` ON `tracks` (`release_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_tracks_artist_status` ON `tracks` (`primary_artist_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_tracks_rights_status` ON `tracks` (`rights_status`,`status`);--> statement-breakpoint
CREATE INDEX `idx_tracks_isrc` ON `tracks` (`isrc`);--> statement-breakpoint
CREATE INDEX `idx_tracks_normalized_title` ON `tracks` (`normalized_title`);--> statement-breakpoint
CREATE INDEX `idx_tracks_status_genre` ON `tracks` (`status`,`genre`);--> statement-breakpoint
CREATE INDEX `idx_tracks_status_mood` ON `tracks` (`status`,`mood`);--> statement-breakpoint
CREATE INDEX `idx_tracks_status_theme` ON `tracks` (`status`,`theme`);
--> statement-breakpoint
PRAGMA optimize;

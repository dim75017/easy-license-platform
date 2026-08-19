PRAGMA defer_foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_spotify_matches` (
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
	CONSTRAINT "spotify_matches_method_check" CHECK("__new_spotify_matches"."method" IN ('distributor_uri', 'orchard_uri', 'isrc', 'exact_metadata', 'metadata_duration', 'manual')),
	CONSTRAINT "spotify_matches_status_check" CHECK("__new_spotify_matches"."status" IN ('candidate', 'verified', 'rejected', 'stale')),
	CONSTRAINT "spotify_matches_verified_shape_check" CHECK("__new_spotify_matches"."status" != 'verified' OR (
        ("__new_spotify_matches"."spotify_album_id" IS NOT NULL OR "__new_spotify_matches"."method" = 'orchard_uri')
        AND "__new_spotify_matches"."spotify_title" IS NOT NULL
        AND "__new_spotify_matches"."spotify_artist_credit" IS NOT NULL
        AND "__new_spotify_matches"."spotify_album_title" IS NOT NULL
        AND "__new_spotify_matches"."spotify_duration_ms" IS NOT NULL
        AND "__new_spotify_matches"."duration_delta_ms" IS NOT NULL
      )),
	CONSTRAINT "spotify_matches_track_id_length_check" CHECK(length("__new_spotify_matches"."spotify_track_id") BETWEEN 1 AND 64),
	CONSTRAINT "spotify_matches_album_id_length_check" CHECK("__new_spotify_matches"."spotify_album_id" IS NULL OR length("__new_spotify_matches"."spotify_album_id") BETWEEN 1 AND 64),
	CONSTRAINT "spotify_matches_title_length_check" CHECK("__new_spotify_matches"."spotify_title" IS NULL OR length("__new_spotify_matches"."spotify_title") BETWEEN 1 AND 500),
	CONSTRAINT "spotify_matches_artist_credit_length_check" CHECK("__new_spotify_matches"."spotify_artist_credit" IS NULL OR length("__new_spotify_matches"."spotify_artist_credit") BETWEEN 1 AND 1000),
	CONSTRAINT "spotify_matches_album_title_length_check" CHECK("__new_spotify_matches"."spotify_album_title" IS NULL OR length("__new_spotify_matches"."spotify_album_title") BETWEEN 1 AND 500),
	CONSTRAINT "spotify_matches_isrc_length_check" CHECK("__new_spotify_matches"."spotify_isrc" IS NULL OR length("__new_spotify_matches"."spotify_isrc") = 12),
	CONSTRAINT "spotify_matches_duration_ms_check" CHECK("__new_spotify_matches"."spotify_duration_ms" IS NULL OR "__new_spotify_matches"."spotify_duration_ms" BETWEEN 1 AND 86400000),
	CONSTRAINT "spotify_matches_duration_delta_ms_check" CHECK("__new_spotify_matches"."duration_delta_ms" IS NULL OR "__new_spotify_matches"."duration_delta_ms" BETWEEN 0 AND 86400000),
	CONSTRAINT "spotify_matches_cover_source_url_length_check" CHECK("__new_spotify_matches"."cover_source_url" IS NULL OR length("__new_spotify_matches"."cover_source_url") BETWEEN 1 AND 2048),
	CONSTRAINT "spotify_matches_score_check" CHECK("__new_spotify_matches"."score" BETWEEN 0 AND 10000)
);--> statement-breakpoint
INSERT INTO `__new_spotify_matches` (
	`id`, `track_id`, `spotify_track_id`, `spotify_album_id`, `spotify_title`,
	`spotify_artist_credit`, `spotify_album_title`, `spotify_isrc`,
	`spotify_duration_ms`, `duration_delta_ms`, `cover_source_url`, `method`,
	`score`, `status`, `checked_at`, `reviewed_at`, `created_at`, `updated_at`
) SELECT
	`id`, `track_id`, `spotify_track_id`, `spotify_album_id`, `spotify_title`,
	`spotify_artist_credit`, `spotify_album_title`, `spotify_isrc`,
	`spotify_duration_ms`, `duration_delta_ms`, `cover_source_url`, `method`,
	`score`, `status`, `checked_at`, `reviewed_at`, `created_at`, `updated_at`
FROM `spotify_matches`;--> statement-breakpoint
DROP TABLE `spotify_matches`;--> statement-breakpoint
ALTER TABLE `__new_spotify_matches` RENAME TO `spotify_matches`;--> statement-breakpoint
CREATE UNIQUE INDEX `uq_spotify_matches_track_candidate` ON `spotify_matches` (`track_id`,`spotify_track_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_spotify_matches_verified_track` ON `spotify_matches` (`track_id`) WHERE "spotify_matches"."status" = 'verified';--> statement-breakpoint
CREATE INDEX `idx_spotify_matches_track_status_score` ON `spotify_matches` (`track_id`,`status`,`score`);--> statement-breakpoint
CREATE INDEX `idx_spotify_matches_spotify_track_id` ON `spotify_matches` (`spotify_track_id`);--> statement-breakpoint
PRAGMA defer_foreign_keys=OFF;

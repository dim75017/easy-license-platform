PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_ingest_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`batch_key` text NOT NULL,
	`source_key` text NOT NULL,
	`source_row_number` integer,
	`source_file_name` text NOT NULL,
	`source_sha256` text,
	`verification_mode` text,
	`owner_attestation_sha256` text,
	`catalogue_scope_sha256` text,
	`selection_sha256` text,
	`master_inspection_sha256` text,
	`master_read_complete` integer,
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
	CONSTRAINT "ingest_items_status_check" CHECK("__new_ingest_items"."status" IN ('discovered', 'inspecting', 'matching', 'needs_review', 'ready', 'imported', 'quarantined', 'skipped', 'failed')),
	CONSTRAINT "ingest_items_batch_key_length_check" CHECK(length("__new_ingest_items"."batch_key") BETWEEN 1 AND 160),
	CONSTRAINT "ingest_items_source_key_length_check" CHECK(length("__new_ingest_items"."source_key") BETWEEN 1 AND 160),
	CONSTRAINT "ingest_items_source_row_number_check" CHECK("__new_ingest_items"."source_row_number" IS NULL OR "__new_ingest_items"."source_row_number" >= 1),
	CONSTRAINT "ingest_items_source_file_name_length_check" CHECK(length("__new_ingest_items"."source_file_name") BETWEEN 1 AND 1000),
	CONSTRAINT "ingest_items_source_sha256_check" CHECK("__new_ingest_items"."source_sha256" IS NULL OR length("__new_ingest_items"."source_sha256") = 64),
	CONSTRAINT "ingest_items_verification_mode_check" CHECK("__new_ingest_items"."verification_mode" IS NULL OR "__new_ingest_items"."verification_mode" = 'catalog_owner_direct'),
	CONSTRAINT "ingest_items_owner_attestation_sha256_check" CHECK("__new_ingest_items"."owner_attestation_sha256" IS NULL OR length("__new_ingest_items"."owner_attestation_sha256") = 64),
	CONSTRAINT "ingest_items_catalogue_scope_sha256_check" CHECK("__new_ingest_items"."catalogue_scope_sha256" IS NULL OR length("__new_ingest_items"."catalogue_scope_sha256") = 64),
	CONSTRAINT "ingest_items_selection_sha256_check" CHECK("__new_ingest_items"."selection_sha256" IS NULL OR length("__new_ingest_items"."selection_sha256") = 64),
	CONSTRAINT "ingest_items_master_inspection_sha256_check" CHECK("__new_ingest_items"."master_inspection_sha256" IS NULL OR length("__new_ingest_items"."master_inspection_sha256") = 64),
	CONSTRAINT "ingest_items_owner_direct_evidence_shape_check" CHECK((
        "__new_ingest_items"."verification_mode" IS NULL
        AND "__new_ingest_items"."owner_attestation_sha256" IS NULL
        AND "__new_ingest_items"."catalogue_scope_sha256" IS NULL
        AND "__new_ingest_items"."selection_sha256" IS NULL
        AND "__new_ingest_items"."master_inspection_sha256" IS NULL
        AND "__new_ingest_items"."master_read_complete" IS NULL
      ) OR (
        "__new_ingest_items"."verification_mode" = 'catalog_owner_direct'
        AND "__new_ingest_items"."owner_attestation_sha256" IS NOT NULL
        AND "__new_ingest_items"."catalogue_scope_sha256" IS NOT NULL
        AND "__new_ingest_items"."selection_sha256" IS NOT NULL
        AND "__new_ingest_items"."master_inspection_sha256" = "__new_ingest_items"."source_sha256"
        AND "__new_ingest_items"."master_read_complete" = 1
        AND "__new_ingest_items"."source_row_number" IS NOT NULL
        AND "__new_ingest_items"."source_sha256" IS NOT NULL
        AND "__new_ingest_items"."declared_duration_ms" IS NOT NULL
      )),
	CONSTRAINT "ingest_items_declared_title_length_check" CHECK("__new_ingest_items"."declared_title" IS NULL OR length("__new_ingest_items"."declared_title") BETWEEN 1 AND 500),
	CONSTRAINT "ingest_items_declared_artist_length_check" CHECK("__new_ingest_items"."declared_artist" IS NULL OR length("__new_ingest_items"."declared_artist") BETWEEN 1 AND 1000),
	CONSTRAINT "ingest_items_declared_duration_ms_check" CHECK("__new_ingest_items"."declared_duration_ms" IS NULL OR "__new_ingest_items"."declared_duration_ms" BETWEEN 1 AND 86400000),
	CONSTRAINT "ingest_items_measured_duration_ms_check" CHECK("__new_ingest_items"."measured_duration_ms" IS NULL OR "__new_ingest_items"."measured_duration_ms" BETWEEN 1 AND 86400000),
	CONSTRAINT "ingest_items_failure_code_length_check" CHECK("__new_ingest_items"."failure_code" IS NULL OR length("__new_ingest_items"."failure_code") BETWEEN 1 AND 120),
	CONSTRAINT "ingest_items_review_note_length_check" CHECK("__new_ingest_items"."review_note" IS NULL OR length("__new_ingest_items"."review_note") BETWEEN 1 AND 4000)
);
--> statement-breakpoint
INSERT INTO `__new_ingest_items`("id", "batch_key", "source_key", "source_row_number", "source_file_name", "source_sha256", "verification_mode", "owner_attestation_sha256", "catalogue_scope_sha256", "selection_sha256", "master_inspection_sha256", "master_read_complete", "declared_title", "declared_artist", "declared_duration_ms", "measured_duration_ms", "track_id", "asset_id", "status", "failure_code", "review_note", "created_at", "updated_at") SELECT "id", "batch_key", "source_key", "source_row_number", "source_file_name", "source_sha256", NULL, NULL, NULL, NULL, NULL, NULL, "declared_title", "declared_artist", "declared_duration_ms", "measured_duration_ms", "track_id", "asset_id", "status", "failure_code", "review_note", "created_at", "updated_at" FROM `ingest_items`;--> statement-breakpoint
DROP TABLE `ingest_items`;--> statement-breakpoint
ALTER TABLE `__new_ingest_items` RENAME TO `ingest_items`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `uq_ingest_items_batch_source` ON `ingest_items` (`batch_key`,`source_key`);--> statement-breakpoint
CREATE INDEX `idx_ingest_items_status_updated_at` ON `ingest_items` (`status`,`updated_at`);--> statement-breakpoint
CREATE INDEX `idx_ingest_items_track_id` ON `ingest_items` (`track_id`);--> statement-breakpoint
CREATE INDEX `idx_ingest_items_source_sha256` ON `ingest_items` (`source_sha256`);--> statement-breakpoint
CREATE INDEX `idx_ingest_items_verification_mode` ON `ingest_items` (`verification_mode`);

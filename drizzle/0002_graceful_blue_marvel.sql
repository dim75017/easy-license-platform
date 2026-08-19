CREATE TABLE `user_profiles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`external_user_id` text NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`company` text,
	`plan_preference` text NOT NULL,
	`primary_platform` text NOT NULL,
	`marketing_opt_in` integer DEFAULT false NOT NULL,
	`policies_acknowledged_at` text NOT NULL,
	`onboarding_completed_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "user_profiles_external_user_id_length_check" CHECK(length("user_profiles"."external_user_id") BETWEEN 1 AND 256),
	CONSTRAINT "user_profiles_email_length_check" CHECK(length("user_profiles"."email") BETWEEN 3 AND 254),
	CONSTRAINT "user_profiles_display_name_length_check" CHECK(length("user_profiles"."display_name") BETWEEN 1 AND 120),
	CONSTRAINT "user_profiles_company_length_check" CHECK("user_profiles"."company" IS NULL OR length("user_profiles"."company") BETWEEN 1 AND 160),
	CONSTRAINT "user_profiles_plan_check" CHECK("user_profiles"."plan_preference" IN ('creator', 'pro')),
	CONSTRAINT "user_profiles_platform_check" CHECK("user_profiles"."primary_platform" IN ('youtube', 'twitch', 'podcast', 'instagram', 'tiktok', 'other'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_user_profiles_external_user_id` ON `user_profiles` (`external_user_id`);--> statement-breakpoint
CREATE INDEX `idx_user_profiles_email` ON `user_profiles` (`email`);
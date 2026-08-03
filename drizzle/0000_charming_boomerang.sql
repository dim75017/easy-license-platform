CREATE TABLE `leads` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`company` text NOT NULL,
	`project` text,
	`use_case` text,
	`budget` text,
	`timeline` text,
	`status` text DEFAULT 'new' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "leads_type_check" CHECK("leads"."type" IN ('sync', 'retail_waitlist')),
	CONSTRAINT "leads_status_check" CHECK("leads"."status" IN ('new', 'contacted', 'qualified', 'closed', 'archived')),
	CONSTRAINT "leads_email_length_check" CHECK(length("leads"."email") BETWEEN 3 AND 254),
	CONSTRAINT "leads_name_length_check" CHECK(length("leads"."name") BETWEEN 1 AND 120),
	CONSTRAINT "leads_company_length_check" CHECK(length("leads"."company") BETWEEN 1 AND 160),
	CONSTRAINT "leads_project_length_check" CHECK("leads"."project" IS NULL OR length("leads"."project") BETWEEN 1 AND 4000),
	CONSTRAINT "leads_use_case_length_check" CHECK("leads"."use_case" IS NULL OR length("leads"."use_case") BETWEEN 1 AND 4000),
	CONSTRAINT "leads_budget_length_check" CHECK("leads"."budget" IS NULL OR length("leads"."budget") BETWEEN 1 AND 120),
	CONSTRAINT "leads_timeline_length_check" CHECK("leads"."timeline" IS NULL OR length("leads"."timeline") BETWEEN 1 AND 120),
	CONSTRAINT "leads_request_shape_check" CHECK((
        ("leads"."type" = 'sync' AND "leads"."project" IS NOT NULL AND "leads"."use_case" IS NULL)
        OR
        ("leads"."type" = 'retail_waitlist' AND "leads"."use_case" IS NOT NULL AND "leads"."project" IS NULL)
      ))
);
--> statement-breakpoint
CREATE INDEX `idx_leads_created_at_id` ON `leads` (`created_at`,`id`);
--> statement-breakpoint
PRAGMA optimize;

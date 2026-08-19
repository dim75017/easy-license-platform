ALTER TABLE `tracks`
ADD COLUMN `ai_review_status` text DEFAULT 'pending' NOT NULL
CHECK (`ai_review_status` IN ('pending', 'cleared', 'rejected'));--> statement-breakpoint
UPDATE `tracks`
SET `status` = 'needs_review',
    `published_at` = NULL,
    `updated_at` = CURRENT_TIMESTAMP
WHERE `status` = 'published'
  AND `ai_review_status` != 'cleared';--> statement-breakpoint
CREATE TRIGGER `tracks_publish_ai_review_insert_guard`
BEFORE INSERT ON `tracks`
FOR EACH ROW
WHEN NEW.`status` = 'published' AND NEW.`ai_review_status` != 'cleared'
BEGIN
  SELECT RAISE(ABORT, 'tracks_publish_ai_review_check');
END;--> statement-breakpoint
CREATE TRIGGER `tracks_publish_ai_review_update_guard`
BEFORE UPDATE OF `status`, `ai_review_status` ON `tracks`
FOR EACH ROW
WHEN NEW.`status` = 'published' AND NEW.`ai_review_status` != 'cleared'
BEGIN
  SELECT RAISE(ABORT, 'tracks_publish_ai_review_check');
END;

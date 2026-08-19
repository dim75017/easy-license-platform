ALTER TABLE `track_assets`
ADD COLUMN `derived_from_sha256` text
CHECK (`derived_from_sha256` IS NULL OR length(`derived_from_sha256`) = 64);

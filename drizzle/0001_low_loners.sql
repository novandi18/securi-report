ALTER TABLE `reports` ADD `audit_date` date;--> statement-breakpoint
ALTER TABLE `reports` DROP COLUMN `audit_date_start`;--> statement-breakpoint
ALTER TABLE `reports` DROP COLUMN `audit_date_end`;
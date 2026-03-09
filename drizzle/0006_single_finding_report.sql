ALTER TABLE `reports` ADD `client_code` varchar(10);--> statement-breakpoint
ALTER TABLE `reports` ADD `service_affected` varchar(50);--> statement-breakpoint
ALTER TABLE `reports` ADD `finding_sequence` int;--> statement-breakpoint
ALTER TABLE `reports` ADD `issue_reference_number` varchar(100);--> statement-breakpoint
ALTER TABLE `reports` ADD `severity` enum('Critical','High','Medium','Low','Info') DEFAULT 'Info';--> statement-breakpoint
ALTER TABLE `reports` ADD `location` text;--> statement-breakpoint
ALTER TABLE `reports` ADD `description` longtext;--> statement-breakpoint
ALTER TABLE `reports` ADD `poc_text` longtext;--> statement-breakpoint
ALTER TABLE `reports` ADD `references_list` text;--> statement-breakpoint
ALTER TABLE `reports` ADD `cvss_score` varchar(10);--> statement-breakpoint
ALTER TABLE `reports` ADD `recommendation` longtext;--> statement-breakpoint
ALTER TABLE `reports` DROP COLUMN `executive_summary`;--> statement-breakpoint
ALTER TABLE `reports` DROP COLUMN `methodology`;--> statement-breakpoint
ALTER TABLE `reports` DROP COLUMN `references_framework`;--> statement-breakpoint
ALTER TABLE `reports` DROP COLUMN `recommendation_summary`;

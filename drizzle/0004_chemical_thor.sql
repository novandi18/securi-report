ALTER TABLE `custom_report_templates` ADD `markdown_content` longtext;--> statement-breakpoint
ALTER TABLE `reports` DROP COLUMN `is_master`;--> statement-breakpoint
ALTER TABLE `reports` DROP COLUMN `parent_report_id`;
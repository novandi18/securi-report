CREATE TABLE `custom_report_templates` (
	`id` int NOT NULL DEFAULT 1,
	`file_name` varchar(255) NOT NULL,
	`extracted_text` longtext NOT NULL,
	`file_size_kb` int,
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `custom_report_templates_id` PRIMARY KEY(`id`)
);

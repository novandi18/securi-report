CREATE TABLE `admin_notifications` (
	`id` char(36) NOT NULL DEFAULT (UUID()),
	`user_id` char(36),
	`type` enum('password_reset_request','user_created','user_login_first','general') NOT NULL,
	`title` varchar(255) NOT NULL,
	`message` text,
	`is_read` boolean DEFAULT false,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `admin_notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `app_settings` (
	`id` int NOT NULL DEFAULT 1,
	`company_name` varchar(255) DEFAULT 'Securi Report',
	`company_logo` varchar(512),
	`report_id_prefix` varchar(50) DEFAULT 'PEN-DOC-',
	`latex_engine` enum('pdflatex','xelatex') DEFAULT 'pdflatex',
	`title_page_color` varchar(7) DEFAULT '#1E3A5F',
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `app_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` char(36) NOT NULL DEFAULT (UUID()),
	`user_id` char(36),
	`action` varchar(255) NOT NULL,
	`ip_address` varchar(45),
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` char(36) NOT NULL DEFAULT (UUID()),
	`name` varchar(255) NOT NULL,
	`email` varchar(100),
	`description` text,
	`logo_url` varchar(255),
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `customers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cwe_entries` (
	`id` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	CONSTRAINT `cwe_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `deliverables` (
	`id` char(36) NOT NULL DEFAULT (UUID()),
	`report_id` char(36) NOT NULL,
	`format` enum('PDF','HTML') NOT NULL,
	`file_url` varchar(500) NOT NULL,
	`generated_by` char(36),
	`generated_at` timestamp DEFAULT (now()),
	CONSTRAINT `deliverables_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `finding_templates` (
	`id` char(36) NOT NULL DEFAULT (UUID()),
	`title` varchar(255) NOT NULL,
	`severity` enum('Critical','High','Medium','Low','Info','None') DEFAULT 'Info',
	`cvss_score` decimal(3,1) DEFAULT '0.0',
	`cvss_vector` varchar(100) DEFAULT 'CVSS:4.0/AV:A/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:H/SC:N/SI:N/SA:N',
	`description` longtext,
	`impact` text,
	`recommendation` longtext,
	`references_link` text,
	`cwe_id` int,
	`owasp_id` int,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `finding_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `owasp_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(50) NOT NULL,
	`title` varchar(255) NOT NULL,
	`version` varchar(10) NOT NULL,
	CONSTRAINT `owasp_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `report_attachments` (
	`id` char(36) NOT NULL DEFAULT (UUID()),
	`report_id` char(36) NOT NULL,
	`file_url` varchar(500) NOT NULL,
	`file_name` varchar(255) NOT NULL,
	`file_size` int NOT NULL,
	`mime_type` varchar(100) NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `report_attachments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`id` char(36) NOT NULL DEFAULT (UUID()),
	`customer_id` char(36) NOT NULL,
	`report_id_custom` varchar(100),
	`title` varchar(255) NOT NULL,
	`executive_summary` longtext,
	`scope` longtext,
	`methodology` text,
	`references_framework` text,
	`cvss_vector` varchar(150) DEFAULT 'CVSS:4.0/AV:A/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:H/SC:N/SI:N/SA:N',
	`impact` longtext,
	`recommendation_summary` longtext,
	`audit_date_start` date,
	`audit_date_end` date,
	`status` enum('Open','Closed','Draft') DEFAULT 'Draft',
	`is_master` boolean DEFAULT false,
	`parent_report_id` char(36),
	`created_by` char(36),
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `reports_id` PRIMARY KEY(`id`),
	CONSTRAINT `reports_report_id_custom_unique` UNIQUE(`report_id_custom`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` char(36) NOT NULL DEFAULT (UUID()),
	`username` varchar(50) NOT NULL,
	`full_name` varchar(100),
	`email` varchar(100) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`role` enum('administrator','editor','viewer') DEFAULT 'viewer',
	`avatar_url` varchar(500),
	`two_factor_enabled` boolean DEFAULT false,
	`two_factor_secret` varchar(255),
	`backup_codes` text,
	`preferred_language` enum('en','id') DEFAULT 'en',
	`must_change_password` boolean DEFAULT false,
	`reset_request_pending` boolean DEFAULT false,
	`last_login` datetime,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_username_unique` UNIQUE(`username`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
ALTER TABLE `admin_notifications` ADD CONSTRAINT `admin_notifications_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `deliverables` ADD CONSTRAINT `deliverables_report_id_reports_id_fk` FOREIGN KEY (`report_id`) REFERENCES `reports`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `deliverables` ADD CONSTRAINT `deliverables_generated_by_users_id_fk` FOREIGN KEY (`generated_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `finding_templates` ADD CONSTRAINT `finding_templates_cwe_id_cwe_entries_id_fk` FOREIGN KEY (`cwe_id`) REFERENCES `cwe_entries`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `finding_templates` ADD CONSTRAINT `finding_templates_owasp_id_owasp_entries_id_fk` FOREIGN KEY (`owasp_id`) REFERENCES `owasp_entries`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `report_attachments` ADD CONSTRAINT `report_attachments_report_id_reports_id_fk` FOREIGN KEY (`report_id`) REFERENCES `reports`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reports` ADD CONSTRAINT `reports_customer_id_customers_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reports` ADD CONSTRAINT `reports_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;
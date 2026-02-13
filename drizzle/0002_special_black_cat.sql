CREATE TABLE `notifications` (
	`id` char(36) NOT NULL DEFAULT (UUID()),
	`recipient_id` char(36) NOT NULL,
	`actor_id` char(36),
	`category` enum('collaboration','security','engagement','system') NOT NULL DEFAULT 'system',
	`type` enum('contribution_submitted','report_merged','report_released','brute_force_detected','2fa_state_change','unauthorized_access','sla_alert','customer_assigned','pdf_generated','pdf_failed','backup_reminder','password_reset_request','general') NOT NULL,
	`title` varchar(255) NOT NULL,
	`message` text,
	`action_url` varchar(500),
	`is_read` boolean DEFAULT false,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
DROP TABLE `admin_notifications`;--> statement-breakpoint
ALTER TABLE `deliverables` ADD `sha256_hash` varchar(64);--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_recipient_id_users_id_fk` FOREIGN KEY (`recipient_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_actor_id_users_id_fk` FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;
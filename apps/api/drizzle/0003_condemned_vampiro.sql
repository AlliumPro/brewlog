CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`display_name` text,
	`token_version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
DROP INDEX `recipes_name_unique`;--> statement-breakpoint
ALTER TABLE `recipes` ADD `user_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `recipes_user_name_idx` ON `recipes` (`user_id`,`name`);--> statement-breakpoint
ALTER TABLE `brews` ADD `user_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `brews_user_brewed_at_idx` ON `brews` (`user_id`,`brewed_at`);
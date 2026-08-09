CREATE TABLE `profile` (
	`id` text PRIMARY KEY NOT NULL,
	`display_name` text,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `recipes` ADD `is_favorite` integer DEFAULT false NOT NULL;
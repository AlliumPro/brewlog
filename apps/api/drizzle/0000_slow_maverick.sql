CREATE TABLE `brews` (
	`id` text PRIMARY KEY NOT NULL,
	`method` text NOT NULL,
	`method_other` text,
	`bean_name` text NOT NULL,
	`roaster` text,
	`roast_date` text,
	`grind_size` text NOT NULL,
	`dose_grams` real NOT NULL,
	`water_ml` real NOT NULL,
	`water_temp_c` real NOT NULL,
	`brew_time_seconds` integer NOT NULL,
	`notes` text,
	`rating` integer NOT NULL,
	`photo_path` text,
	`brewed_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `brews_brewed_at_idx` ON `brews` (`brewed_at`);--> statement-breakpoint
CREATE INDEX `brews_method_idx` ON `brews` (`method`);--> statement-breakpoint
CREATE INDEX `brews_bean_name_idx` ON `brews` (`bean_name`);--> statement-breakpoint
CREATE TABLE `recipes` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`method` text NOT NULL,
	`method_other` text,
	`bean_name` text,
	`roaster` text,
	`grind_size` text,
	`dose_grams` real,
	`water_ml` real,
	`water_temp_c` real,
	`brew_time_seconds` integer,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recipes_name_unique` ON `recipes` (`name`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `sessions_expires_at_idx` ON `sessions` (`expires_at`);
CREATE TABLE `activities` (
	`id` integer PRIMARY KEY NOT NULL,
	`athlete_id` integer NOT NULL,
	`name` text NOT NULL,
	`sport_type` text NOT NULL,
	`type` text,
	`start_date` integer NOT NULL,
	`start_date_local` integer NOT NULL,
	`timezone` text,
	`utc_offset` integer,
	`distance_m` real NOT NULL,
	`moving_time_s` integer NOT NULL,
	`elapsed_time_s` integer NOT NULL,
	`total_elevation_gain_m` real DEFAULT 0 NOT NULL,
	`elev_high_m` real,
	`elev_low_m` real,
	`gear_id` text,
	`trainer` integer DEFAULT 0 NOT NULL,
	`commute` integer DEFAULT 0 NOT NULL,
	`manual` integer DEFAULT 0 NOT NULL,
	`private` integer DEFAULT 0 NOT NULL,
	`average_speed` real,
	`max_speed` real,
	`average_watts` real,
	`weighted_average_watts` integer,
	`max_watts` integer,
	`kilojoules` real,
	`device_watts` integer,
	`average_cadence` real,
	`has_heartrate` integer DEFAULT 0 NOT NULL,
	`average_heartrate` real,
	`max_heartrate` real,
	`suffer_score` integer,
	`calories` real,
	`summary_polyline` text,
	`start_lat` real,
	`start_lng` real,
	`end_lat` real,
	`end_lng` real,
	`detail_fetched_at` integer,
	`raw_summary_json` text,
	`raw_detail_json` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`athlete_id`) REFERENCES `athletes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`gear_id`) REFERENCES `gear`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_activities_start_date` ON `activities` (`start_date`);--> statement-breakpoint
CREATE INDEX `idx_activities_gear` ON `activities` (`gear_id`);--> statement-breakpoint
CREATE INDEX `idx_activities_sport_date` ON `activities` (`sport_type`,`start_date`);--> statement-breakpoint
CREATE INDEX `idx_activities_needs_detail` ON `activities` (`detail_fetched_at`) WHERE "activities"."detail_fetched_at" IS NULL;--> statement-breakpoint
CREATE TABLE `athletes` (
	`id` integer PRIMARY KEY NOT NULL,
	`username` text,
	`firstname` text,
	`lastname` text,
	`ftp` integer,
	`weight_kg` real,
	`measurement` text DEFAULT 'imperial' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `gear` (
	`id` text PRIMARY KEY NOT NULL,
	`athlete_id` integer NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`brand` text,
	`model` text,
	`frame_type` integer,
	`primary_flag` integer DEFAULT 0 NOT NULL,
	`retired` integer DEFAULT 0 NOT NULL,
	`distance_m` real,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`athlete_id`) REFERENCES `athletes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_gear_kind` ON `gear` (`kind`);--> statement-breakpoint
CREATE TABLE `sync_state` (
	`id` integer PRIMARY KEY NOT NULL,
	`last_after_epoch` integer,
	`last_synced_at` integer,
	`last_full_backfill_at` integer,
	`rate_limit_15min_used` integer,
	`rate_limit_15min_limit` integer,
	`rate_limit_daily_used` integer,
	`rate_limit_daily_limit` integer,
	`rate_limit_observed_at` integer,
	`last_error` text,
	`last_error_at` integer
);

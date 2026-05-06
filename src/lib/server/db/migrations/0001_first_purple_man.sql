CREATE TABLE `activity_streams` (
	`activity_id` integer NOT NULL,
	`type` text NOT NULL,
	`data_json` text NOT NULL,
	`resolution` text NOT NULL,
	`original_size` integer NOT NULL,
	`fetched_at` integer NOT NULL,
	PRIMARY KEY(`activity_id`, `type`),
	FOREIGN KEY (`activity_id`) REFERENCES `activities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_streams_activity` ON `activity_streams` (`activity_id`);
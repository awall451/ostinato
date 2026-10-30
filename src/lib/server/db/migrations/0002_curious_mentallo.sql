CREATE TABLE `component_installs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`component_id` integer NOT NULL,
	`gear_id` text NOT NULL,
	`installed_at` integer NOT NULL,
	`removed_at` integer,
	FOREIGN KEY (`component_id`) REFERENCES `components`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`gear_id`) REFERENCES `gear`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_installs_component` ON `component_installs` (`component_id`);--> statement-breakpoint
CREATE INDEX `idx_installs_gear` ON `component_installs` (`gear_id`);--> statement-breakpoint
CREATE TABLE `components` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`athlete_id` integer NOT NULL,
	`kind` text NOT NULL,
	`brand` text,
	`model` text,
	`notes` text,
	`purchase_price_cents` integer,
	`purchased_at` integer,
	`starting_distance_m` real DEFAULT 0 NOT NULL,
	`wear_limit_m` real,
	`count_trainer` integer DEFAULT 1 NOT NULL,
	`retired` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`athlete_id`) REFERENCES `athletes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_components_athlete` ON `components` (`athlete_id`);
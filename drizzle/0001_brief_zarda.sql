CREATE TABLE `configuration_history` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`item_id` text NOT NULL,
	`snapshot` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `configuration_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `configuration_items` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`version` text DEFAULT '' NOT NULL,
	`purpose` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`url` text DEFAULT '' NOT NULL,
	`state` text DEFAULT 'active' NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`request_key` text,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `configuration_request` ON `configuration_items` (`owner`,`request_key`);
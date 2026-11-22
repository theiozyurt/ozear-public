ALTER TABLE `configuration_items` ADD `request_hash` text;--> statement-breakpoint
ALTER TABLE `issues` ADD `request_hash` text;--> statement-breakpoint
ALTER TABLE `projects` ADD `request_hash` text;
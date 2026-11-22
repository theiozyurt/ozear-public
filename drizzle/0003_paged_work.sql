ALTER TABLE `issues` ADD `search_text` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` ADD `repository_url` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` ADD `local_path` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `worklogs` ADD `request_hash` text;--> statement-breakpoint
ALTER TABLE `worklogs` ADD `kind` text DEFAULT 'note' NOT NULL;
--> statement-breakpoint
UPDATE issues SET search_text = lower(replace(replace(replace(replace(replace(replace(replace(replace(title || ' ' || description, 'İ', 'i'), 'I', 'i'), 'ı', 'i'), 'Ş', 'ş'), 'Ğ', 'ğ'), 'Ü', 'ü'), 'Ö', 'ö'), 'Ç', 'ç'));

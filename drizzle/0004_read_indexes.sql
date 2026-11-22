CREATE INDEX `configuration_history_owner_item_created` ON `configuration_history` (`owner`,`item_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `configuration_owner_project` ON `configuration_items` (`owner`,`project_id`);--> statement-breakpoint
CREATE INDEX `issues_owner_project_updated` ON `issues` (`owner`,`project_id`,`updated_at`,`id`);--> statement-breakpoint
CREATE INDEX `issues_owner_updated` ON `issues` (`owner`,`updated_at`,`id`);--> statement-breakpoint
CREATE INDEX `worklogs_owner_issue_created` ON `worklogs` (`owner`,`issue_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `worklogs_owner_created` ON `worklogs` (`owner`,`created_at`,`id`);
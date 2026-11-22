CREATE TABLE `projects` (
  `id` text PRIMARY KEY NOT NULL,
  `owner` text NOT NULL,
  `name` text NOT NULL,
  `description` text NOT NULL DEFAULT '',
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `issues` (
  `id` integer PRIMARY KEY AUTOINCREMENT,
  `owner` text NOT NULL,
  `project_id` text NOT NULL,
  `title` text NOT NULL,
  `description` text NOT NULL DEFAULT '',
  `status` text NOT NULL DEFAULT 'backlog',
  `priority` text NOT NULL DEFAULT 'normal',
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  `request_key` text,
  FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `worklogs` (
  `id` text PRIMARY KEY NOT NULL,
  `owner` text NOT NULL,
  `issue_id` integer NOT NULL,
  `summary` text NOT NULL,
  `learning` text NOT NULL DEFAULT '{}',
  `source` text NOT NULL DEFAULT 'web',
  `created_at` text NOT NULL,
  `request_key` text,
  FOREIGN KEY (`issue_id`) REFERENCES `issues`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `issue_request` ON `issues` (`owner`,`request_key`);
--> statement-breakpoint
CREATE UNIQUE INDEX `worklog_request` ON `worklogs` (`owner`,`request_key`);

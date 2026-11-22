import {
  sqliteTable,
  text,
  integer,
  uniqueIndex,
  index,
} from "drizzle-orm/sqlite-core";
export const projects = sqliteTable("projects", {
  repositoryUrl: text("repository_url").notNull().default(""),
  localPath: text("local_path").notNull().default(""),
  requestHash: text("request_hash"),
  id: text("id").primaryKey(),
  owner: text("owner").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  createdAt: text("created_at").notNull(),
});
export const issues = sqliteTable(
  "issues",
  {
    searchText: text("search_text").notNull().default(""),
    requestHash: text("request_hash"),
    id: integer("id").primaryKey({ autoIncrement: true }),
    owner: text("owner").notNull(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    status: text("status").notNull().default("backlog"),
    priority: text("priority").notNull().default("normal"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    requestKey: text("request_key"),
  },
  (t) => [
    uniqueIndex("issue_request").on(t.owner, t.requestKey),
    index("issues_owner_project_updated").on(
      t.owner,
      t.projectId,
      t.updatedAt,
      t.id,
    ),
    index("issues_owner_updated").on(t.owner, t.updatedAt, t.id),
  ],
);
export const worklogs = sqliteTable(
  "worklogs",
  {
    searchText: text("search_text").notNull().default(""),
    requestHash: text("request_hash"),
    kind: text("kind").notNull().default("note"),
    id: text("id").primaryKey(),
    owner: text("owner").notNull(),
    issueId: integer("issue_id")
      .notNull()
      .references(() => issues.id),
    summary: text("summary").notNull(),
    learning: text("learning").notNull().default("{}"),
    source: text("source").notNull().default("web"),
    createdAt: text("created_at").notNull(),
    requestKey: text("request_key"),
  },
  (t) => [
    uniqueIndex("worklog_request").on(t.owner, t.requestKey),
    index("worklogs_owner_issue_created").on(
      t.owner,
      t.issueId,
      t.createdAt,
      t.id,
    ),
    index("worklogs_owner_created").on(t.owner, t.createdAt, t.id),
  ],
);

export const configurationItems = sqliteTable(
  "configuration_items",
  {
    requestHash: text("request_hash"),
    id: text("id").primaryKey(),
    owner: text("owner").notNull(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id),
    name: text("name").notNull(),
    category: text("category").notNull(),
    version: text("version").notNull().default(""),
    purpose: text("purpose").notNull().default(""),
    notes: text("notes").notNull().default(""),
    url: text("url").notNull().default(""),
    state: text("state").notNull().default("active"),
    revision: integer("revision").notNull().default(1),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    requestKey: text("request_key"),
  },
  (t) => [
    uniqueIndex("configuration_request").on(t.owner, t.requestKey),
    index("configuration_owner_project").on(t.owner, t.projectId),
  ],
);
export const configurationHistory = sqliteTable(
  "configuration_history",
  {
    id: text("id").primaryKey(),
    owner: text("owner").notNull(),
    itemId: text("item_id")
      .notNull()
      .references(() => configurationItems.id),
    snapshot: text("snapshot").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    index("configuration_history_owner_item_created").on(
      t.owner,
      t.itemId,
      t.createdAt,
    ),
  ],
);

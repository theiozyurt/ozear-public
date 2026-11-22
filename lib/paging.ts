import { sql, type SQL } from "drizzle-orm";
import type { AnySQLiteColumn } from "drizzle-orm/sqlite-core";
import { DomainError } from "./domain-error";
export type Source = "web" | "mcp" | "mcp:claude" | "mcp:gemini";
export function cursorWhere(
  cursor: string,
  time: AnySQLiteColumn,
  id: AnySQLiteColumn,
): SQL {
  try {
    const a = JSON.parse(atob(cursor));
    if (
      !Array.isArray(a) ||
      a.length !== 2 ||
      typeof a[0] !== "string" ||
      !["number", "string"].includes(typeof a[1])
    )
      throw Error();
    return sql`(${time} < ${a[0]} OR (${time} = ${a[0]} AND ${id} < ${a[1]}))`;
  } catch {
    throw new DomainError("Geçersiz sayfa işaretçisi.");
  }
}
export function pageResult<T extends { id: string | number }>(
  rows: T[],
  limit: number,
  time: keyof T,
) {
  const page = rows.slice(0, limit),
    last = page.at(-1);
  return {
    rows: page,
    nextCursor:
      rows.length > limit && last
        ? btoa(JSON.stringify([last[time], last.id]))
        : null,
  };
}
export function stripInternal(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripInternal);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(
          ([key]) =>
            !["owner", "requestKey", "requestHash", "searchText"].includes(key),
        )
        .map(([key, v]) => [key, stripInternal(v)]),
    );
  return value;
}

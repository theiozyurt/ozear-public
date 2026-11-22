ALTER TABLE `worklogs` ADD `search_text` text DEFAULT '' NOT NULL;
--> statement-breakpoint
WITH readable AS (
  SELECT id, summary, CASE WHEN json_valid(learning) THEN learning ELSE '{}' END AS data
  FROM worklogs
),
combined AS (
  SELECT id, summary || ' ' ||
    coalesce(json_extract(data, '$.flow'), '') || ' ' ||
    coalesce(json_extract(data, '$.reason'), '') || ' ' ||
    coalesce(json_extract(data, '$.verification'), '') || ' ' ||
    coalesce(json_extract(data, '$.question'), '') || ' ' ||
    coalesce((SELECT group_concat(
      coalesce(json_extract(file.value, '$.path'), '') || ' ' ||
      coalesce(json_extract(file.value, '$.explanation'), ''), ' '
    ) FROM json_each(data, '$.files') AS file WHERE file.type = 'object'), '') AS body
  FROM readable
)
UPDATE worklogs
SET search_text = (
  SELECT lower(replace(replace(replace(replace(replace(replace(replace(replace(body,
    'İ', 'i'), 'I', 'i'), 'ı', 'i'), 'Ş', 'ş'), 'Ğ', 'ğ'), 'Ü', 'ü'), 'Ö', 'ö'), 'Ç', 'ç'))
  FROM combined WHERE combined.id = worklogs.id
);

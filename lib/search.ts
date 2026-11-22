export function foldForSearch(value: string): string {
  return value.toLocaleLowerCase("tr").replace(/ı/g, "i");
}

export function worklogSearchText(summary: string, learning: {
  files?: { path: string; explanation: string }[];
  flow?: string;
  reason?: string;
  verification?: string;
  question?: string;
}): string {
  return foldForSearch([
    summary,
    learning.flow,
    learning.reason,
    learning.verification,
    learning.question,
    ...(learning.files ?? []).flatMap(({ path, explanation }) => [path, explanation]),
  ].join(" "));
}

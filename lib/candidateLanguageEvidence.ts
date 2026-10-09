/** The existing database stores languages in text[]. Keep structured evidence
 * as JSON per entry, while continuing to accept plain legacy language names. */
export function candidateLanguageRecords(
  value: unknown,
): Array<{ language: string; proficiency: string }> {
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      value = [value];
    }
  }
  if (!Array.isArray(value)) return [];
  const scalar = (input: unknown): string => {
    for (
      let depth = 0;
      input && typeof input === "object" && depth < 3;
      depth++
    )
      input = (input as { value?: unknown }).value;
    return typeof input === "string" ? input.replace(/\s+/g, " ").trim() : "";
  };
  return value.flatMap((entry) => {
    if (typeof entry === "string") {
      try {
        entry = JSON.parse(entry);
      } catch {
        /* Legacy plain string. */
      }
    }
    const language =
      typeof entry === "string"
        ? scalar(entry)
        : scalar(entry?.language ?? entry?.name);
    const proficiency =
      typeof entry === "object" && entry
        ? scalar(entry.proficiency ?? entry.level)
        : "";
    return language && language !== "[object Object]"
      ? [{ language, proficiency }]
      : [];
  });
}

export function candidateLanguagesForStorage(value: unknown): string[] {
  return candidateLanguageRecords(value).map((entry) =>
    entry.proficiency ? JSON.stringify(entry) : entry.language,
  );
}

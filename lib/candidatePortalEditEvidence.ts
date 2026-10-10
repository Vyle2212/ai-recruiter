import { careerDateIsCurrent } from "./careerDateEvidence";
import { careerMonthIndex } from "./candidateCareerExperience";
export const candidateMonths = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
export function candidateDateParts(value: unknown) {
  const source = String(
    value && typeof value === "object" && "value" in value
      ? (value.value ?? "")
      : (value ?? ""),
  ).trim();
  if (careerDateIsCurrent(source)) return { year: "Current", month: "Current" };
  if (/^\d{4}$/.test(source)) return { year: source, month: "" };
  const index = careerMonthIndex(source);
  return index === null
    ? { year: "", month: "" }
    : {
        year: String(Math.floor(index / 12)),
        month: String((index % 12) + 1).padStart(2, "0"),
      };
}
export function contactHeaderPhone(text: string) {
  const header = text
    .split(
      /(?:^|\n)\s*(?:PROFILE SUMMARY|PROFESSIONAL SUMMARY|PROFESSIONAL EXPERIENCE|WORK EXPERIENCE|EDUCATION)\b/i,
    )[0]
    .split(/\r?\n/)
    .slice(0, 12)
    .join("\n");
  const matches = [...header.matchAll(/\+\d[\d ()\-.]{6,25}\d/g)].map(
    (match) => "+" + match[0].replace(/\D/g, ""),
  );
  const valid = [
    ...new Set(matches.filter((number) => /^\+[1-9]\d{6,14}$/.test(number))),
  ];
  if (valid.length === 1) return valid[0];
  if (valid.length) return undefined;
  const local = header
    .match(
      /(?:phone|mobile|tel(?:ephone)?|contact number)\s*[:.]\s*([\d ()\-.]{7,25})/i,
    )?.[1]
    ?.trim();
  return local && local.replace(/\D/g, "").length >= 7 ? local : undefined;
}
export const candidateProjectTypes = [
  "Implementation",
  "Rollout",
  "Support",
  "AMS",
  "Migration",
  "Upgrade",
  "Integration",
  "Assessment / Design",
  "Enhancement",
];
export function sapProjectTypeEvidence(text: string) {
  const kinds: string[] = [];
  if (/\bimplementations?\b/i.test(text)) kinds.push("Implementation");
  if (/\broll[ -]?outs?\b/i.test(text)) kinds.push("Rollout");
  if (/\bAMS\b|application management services/i.test(text)) kinds.push("AMS");
  else if (/\bsupport\b|hypercare/i.test(text)) kinds.push("Support");
  if (/\bmigration\b/i.test(text)) kinds.push("Migration");
  if (/\bupgrades?\b/i.test(text)) kinds.push("Upgrade");
  if (/\bintegrations?\b/i.test(text)) kinds.push("Integration");
  if (/assessment|design phase|blueprint/i.test(text))
    kinds.push("Assessment / Design");
  if (/\benhancements?\b/i.test(text)) kinds.push("Enhancement");
  return kinds.join(", ");
}
export function candidateLanguageLevels(language: string) {
  const base = ["Native", "Fluent", "Advanced", "Intermediate", "Basic"];
  const cefr = [
    "CEFR A1",
    "CEFR A2",
    "CEFR B1",
    "CEFR B2",
    "CEFR C1",
    "CEFR C2",
  ];
  if (/japanese|日本語|tiếng nhật/i.test(language))
    return [...base, ...[5, 4, 3, 2, 1].map((n) => `JLPT N${n}`), ...cefr];
  if (/mandarin|chinese|中文|tiếng trung/i.test(language))
    return [...base, ...Array.from({ length: 9 }, (_, i) => `HSK ${i + 1}`)];
  if (/korean|한국어|tiếng hàn/i.test(language))
    return [...base, ...Array.from({ length: 6 }, (_, i) => `TOPIK ${i + 1}`)];
  if (/english/i.test(language))
    return [
      ...base,
      ...cefr,
      ...Array.from({ length: 19 }, (_, i) => `IELTS ${i / 2}`),
    ];
  return [...base, ...cefr];
}

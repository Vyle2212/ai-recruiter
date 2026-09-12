import type { EnterpriseEmployment, EnterpriseProject } from "./candidate360SchemaNormalize";
import { associatedEmploymentTitle } from "./candidate360Employment";

const clean = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();
const yearOnly = (value: string) => /^(?:19|20)\d{2}$/.test(value.trim());

function employmentDate(value: string): string {
  const source = clean(value);
  if (!source) return "";
  if (/present|current|now/i.test(source)) return "Present";
  if (yearOnly(source)) return source;
  const iso = source.match(/^((?:19|20)\d{2})[-/](0?[1-9]|1[0-2])$/);
  const named = source.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+((?:19|20)\d{2})\b/i);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  if (iso) return `${months[Number(iso[2]) - 1]} ${iso[1]}`;
  if (named) return `${named[1].slice(0, 3).replace(/^./, (letter) => letter.toUpperCase())} ${named[2]}`;
  return source;
}

export function formatEmploymentPeriod(employment: EnterpriseEmployment): string {
  const start = employmentDate(employment.start);
  const end = employmentDate(employment.end || (employment.current ? "Present" : ""));
  if (!start) return end;
  if (!end) return start;
  if (yearOnly(employment.start) && yearOnly(employment.end) && start === end) return start;
  return `${start}${yearOnly(employment.start) && yearOnly(employment.end) || end === "Present" ? "\u2013" : " \u2013 "}${end}`;
}

function evidenceStatus(employment: EnterpriseEmployment): string {
  return employment.current ? "Resume evidence; verification pending" : "Resume evidence";
}

export function serializeEmploymentTimeline(employments: EnterpriseEmployment[]): string {
  const rows = employments.map((employment) => [
    formatEmploymentPeriod(employment),
    associatedEmploymentTitle(employment),
    clean(employment.company),
    clean(employment.location),
  ].filter(Boolean).join(" | "));
  return ["Employment Timeline", "", ...rows].join("\n");
}

export function serializeEmploymentReadable(employments: EnterpriseEmployment[]): string {
  const records = employments.map((employment) => [
    clean(employment.company),
    associatedEmploymentTitle(employment),
    [formatEmploymentPeriod(employment), clean(employment.location)].filter(Boolean).join(" | "),
    employment.current ? "Current role" : "",
    `Evidence: ${evidenceStatus(employment)}`,
  ].filter(Boolean).join("\n"));
  return ["Employment Timeline", "", ...records.flatMap((record, index) => index ? ["", record] : [record])].join("\n");
}

export function serializeEmploymentExport(candidateName: string, employments: EnterpriseEmployment[]): string {
  const current = employments.filter((employment) => employment.current);
  const history = employments.filter((employment) => !employment.current);
  const record = (employment: EnterpriseEmployment) => [
    formatEmploymentPeriod(employment),
    clean(employment.company),
    associatedEmploymentTitle(employment) ? `Title: ${associatedEmploymentTitle(employment)}` : "",
    clean(employment.location) ? `Location: ${clean(employment.location)}` : "",
    `Evidence status: ${evidenceStatus(employment)}`,
  ].filter(Boolean).join("\n");
  const section = (title: string, values: EnterpriseEmployment[]) => values.length
    ? [title, "", ...values.flatMap((employment, index) => index ? ["", record(employment)] : [record(employment)])]
    : [];
  return [
    "CANDIDATE EMPLOYMENT TIMELINE",
    "",
    `Candidate: ${clean(candidateName) || "Candidate profile"}`,
    "",
    ...section("CURRENT EMPLOYMENT", current),
    ...(current.length && history.length ? [""] : []),
    ...section("EMPLOYMENT HISTORY", history),
  ].join("\n");
}

export function serializeCareerHighlights(highlights: string[]): string {
  return ["Career Highlights", "", ...highlights.map((highlight) => `- ${clean(highlight)}`)].join("\n");
}

export function serializeProjects(projects: EnterpriseProject[]): string {
  const records = projects.map((project) => [
    clean(project.name || project.client || "Project evidence"),
    project.client && project.client !== project.name ? `Client: ${clean(project.client)}` : "",
    project.role ? `Role: ${clean(project.role)}` : "",
    project.projectType || project.implementationType ? `Type: ${clean(project.implementationType || project.projectType)}` : "",
    project.industry ? `Industry: ${clean(project.industry)}` : "",
    project.country ? `Country: ${clean(project.country)}` : "",
    project.modules.length ? `Modules: ${project.modules.map(clean).join(", ")}` : "",
  ].filter(Boolean).join("\n"));
  return ["Project Portfolio", "", ...records.flatMap((record, index) => index ? ["", record] : [record])].join("\n");
}

export function aggregateEvidencePresentation(count: number, atomicRecords: number) {
  if (count <= 0) return { basis: "No supported evidence", atomicRecords: 0, linkedSummary: "No individually linked project records", limitation: "No aggregate or individually linked project evidence is available." };
  const linked = Math.min(Math.max(atomicRecords, 0), count);
  if (linked >= count) return { basis: "Individually linked project evidence", atomicRecords: linked, linkedSummary: `${linked} of ${count} engagements explicitly normalized and individually linked`, limitation: "Every engagement represented by the aggregate count is individually linked to a project record." };
  return {
    basis: "Aggregate profile evidence",
    atomicRecords: linked,
    linkedSummary: linked ? `${linked} of ${count} engagements explicitly normalized and individually linked` : "Aggregate profile evidence only",
    limitation: linked
      ? `${linked} of the ${count} engagements ${linked === 1 ? "is" : "are"} explicitly normalized and individually linked to a project record.`
      : "Aggregate profile evidence only; no normalized project records are currently linked to this aggregate count.",
  };
}
import assert from "node:assert/strict";
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { normalizeActualCandidateSchema } from "../lib/candidate360SchemaNormalize";
import { buildCandidate360Profile } from "../lib/candidate360Profile";

const url = process.env.CANDIDATE_SUPABASE_URL?.trim();
const key = process.env.CANDIDATE_SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) throw new Error("Candidate database configuration unavailable");
const db = createClient(url, key, { auth: { persistSession: false } });

async function candidates() {
  const rows: Array<Record<string, any>> = [];
  for (let from = 0; ; from += 200) {
    const { data, error } = await db.from("candidates").select("*").order("id").range(from, from + 199);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 200) return rows;
  }
}

async function indexedCandidateIds() {
  const ids = new Set<string>();
  for (let from = 0; ; from += 200) {
    const { data, error } = await db.from("candidate_search_index").select("candidate_id").order("candidate_id").range(from, from + 199);
    if (error) throw error;
    for (const row of data || []) ids.add(String(row.candidate_id));
    if (!data || data.length < 200) return ids;
  }
}

const normalizedText = (value: unknown) => String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
const sourceStrings = (value: unknown, depth = 0): string[] => {
  if (depth > 10 || value == null) return [];
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return [String(value)];
  if (Array.isArray(value)) return value.flatMap((item) => sourceStrings(item, depth + 1));
  if (typeof value === "object") return Object.values(value as Record<string, unknown>).flatMap((item) => sourceStrings(item, depth + 1));
  return [];
};
const sourceRow = (row: Record<string, any>) => {
  const { parsed_json: _parsedJson, parsed_data: _parsedData, ...source } = row;
  return source;
};
const sourceContains = (source: string, value: unknown) => {
  const expected = normalizedText(value);
  return !expected || source.includes(expected);
};
const sourceSupportsTitle = (source: string, value: unknown) => {
  const words = normalizedText(value).match(/[a-z0-9]{2,}/g) || [];
  return words.length === 0 || words.every((word) => source.includes(word));
};
const firstProvenance = (project: any) =>
  Object.values(project.fieldEvidence || {}).flatMap((field: any) => field?.provenance || [])[0] || null;
const lifecycle = /\b(?:implementation|rollout|roll-out|migration|upgrade|deployment|integration|support|enhancement|transformation|greenfield|brownfield|cutover|go-live|go live)\b/i;
const delivery = /\b(?:projects?|programmes?|programs?|assignments?|engagements?|clients?|customers?|implemented|delivered|led|managed|responsible for|configured|migrated|deployed|integrated|rolled out|supported|enhanced)\b/i;

async function main() {
  const [allRows, indexedIds] = await Promise.all([candidates(), indexedCandidateIds()]);
  const rows = allRows.filter((row) => indexedIds.has(String(row.id)));
  assert.equal(rows.length, 833);
  const experienceSamples: Record<string, any[]> = { structured: [], legacy_nested: [], parsed_resume: [], current_fallback: [], genuinely_none: [] };
  const projectSamples: Record<string, any[]> = { structured: [], formal_resume: [], employment_description: [], narrative_assignment: [], sap: [], non_sap: [], genuinely_none: [] };
  const errors: Array<{ candidateId: string; section: string; reason: string; route: string }> = [];
  let experienceExtracted = 0, experienceNone = 0, projectsExtracted = 0, projectsNone = 0;
  const add = (bucket: any[], value: any, limit: number) => { if (bucket.length < limit) bucket.push(value); };

  for (const row of rows) {
    const candidateId = String(row.id);
    const normalized = normalizeActualCandidateSchema({ ...row, parsed_json: null, parsed_data: null });
    const enterprise = normalized.enterpriseProfile;
    const source = normalizedText(sourceStrings(sourceRow(row)).join(" "));
    assert.equal(enterprise.candidateId, candidateId, "projection remains bound to candidate identity");
    const experienceStatus = enterprise.quality.extraction.experience.status;
    const projectStatus = enterprise.quality.extraction.projects.status;
    if (experienceStatus === "extracted") experienceExtracted += 1;
    if (experienceStatus === "genuinely_none") {
      experienceNone += 1;
      add(experienceSamples.genuinely_none, { candidateId, route: enterprise.quality.extraction.experience.attemptedRoutes }, 2);
      assert.ok(source.length > 2, candidateId + ": genuinely-none Experience source was not inspected");
    }
    if (projectStatus === "extracted") projectsExtracted += 1;
    if (projectStatus === "genuinely_none") {
      projectsNone += 1;
      add(projectSamples.genuinely_none, { candidateId, route: enterprise.quality.extraction.projects.attemptedRoutes }, 20);
      assert.ok(source.length > 2, candidateId + ": genuinely-none Projects source was not inspected");
    }

    const employmentKeys = new Set<string>();
    for (const employment of enterprise.employmentTimeline) {
      const provenance = employment.provenance?.[0];
      const route = provenance?.sourceRef || "missing";
      const record = { candidateId, route, sourceType: provenance?.sourceType, projectedFields: ["title","company","start","end","current","location","description","duration"], errors: [] as string[] };
      const keyValue = [employment.company, employment.title, employment.start, employment.end].map(normalizedText).join("|");
      if (employmentKeys.has(keyValue)) record.errors.push("duplicate_projection");
      employmentKeys.add(keyValue);
      for (const [field, value] of [["company", employment.company], ["title", employment.title], ["start", employment.start], ["end", employment.end], ["location", employment.location]] as const)
        if (!(field === "title" ? sourceSupportsTitle(source, value) : sourceContains(source, value))) record.errors.push("invented_or_unrouted_" + field);
      for (const description of employment.achievements)
        if (!sourceContains(source, description)) record.errors.push("invented_or_unrouted_description");
      if (!provenance?.sourceType || !route) record.errors.push("missing_provenance");
      if (route === "candidate.currentEmployment") {
        add(experienceSamples.current_fallback, record, 10);
        if (employment.start || employment.duration) record.errors.push("fallback_invented_dates_or_duration");
      } else if (/employmentHistory|employers|workHistory/i.test(route)) add(experienceSamples.legacy_nested, record, 10);
      else if (provenance?.sourceType === "parsed_resume") add(experienceSamples.parsed_resume, record, 10);
      else if (provenance?.sourceType === "employment") add(experienceSamples.structured, record, 10);
      for (const reason of record.errors) errors.push({ candidateId, section: "experience", reason, route });
    }

    const projectKeys = new Set<string>();
    for (const project of enterprise.projects) {
      const provenance = firstProvenance(project);
      const route = provenance?.sourceRef || "missing";
      const evidence = project.responsibilities.join(" ");
      const record = { candidateId, route, sourceType: provenance?.sourceType, unnamed: !project.name, errors: [] as string[] };
      const keyValue = [project.name, project.client, project.role, project.start, project.end, evidence.slice(0, 120)].map(normalizedText).join("|");
      if (projectKeys.has(keyValue)) record.errors.push("duplicate_projection");
      projectKeys.add(keyValue);
      if (!provenance?.sourceType || !provenance?.sourceRef || !provenance?.fieldPath) record.errors.push("missing_provenance");
      if (/narrativeProjects/i.test(route)) {
        add(projectSamples.narrative_assignment, record, 10);
        if (!sourceContains(source, evidence)) record.errors.push("narrative_excerpt_not_in_candidate_source");
        if (!lifecycle.test(evidence) || !delivery.test(evidence)) record.errors.push("ungrounded_narrative_project");
        const escapedName = project.name.replace(/[.*+?^{}$()|[\]\\]/g, "\\$&");
        if (project.name && !new RegExp("\\b(?:project|program(?:me)?)\\s*[:\\-]\\s*" + escapedName, "i").test(source)) record.errors.push("invented_project_name");
      } else if (/resume\.projects/i.test(route)) add(projectSamples.formal_resume, record, 10);
      else if (provenance?.sourceType === "employment") {
        add(projectSamples.employment_description, record, 10);
        if (!sourceContains(source, evidence) || !lifecycle.test(evidence)) record.errors.push("ungrounded_employment_project");
      } else add(projectSamples.structured, record, 10);
      if (/\bsap\b/i.test(source) || enterprise.careerHighlights.primarySapModule) add(projectSamples.sap, record, 10);
      else add(projectSamples.non_sap, record, 10);
      for (const reason of record.errors) errors.push({ candidateId, section: "projects", reason, route });
    }

    const profile = buildCandidate360Profile(normalized);
    assert.deepEqual(profile.enterpriseProfile.employmentTimeline, enterprise.employmentTimeline);
    assert.deepEqual(profile.enterpriseProfile.projects, enterprise.projects);
  }

  for (let index = 0; index < 10; index += 1) {
    const suffix = String(index + 1);
    if (experienceSamples.structured.length < 10) {
      const fixture = normalizeActualCandidateSchema({ id: "fixture-structured-" + suffix, experience: [{ company: "Employer " + suffix, title: "Engineer " + suffix, start_date: "2020-01", end_date: "2022-01", location: "Singapore", responsibilities: ["Delivered bounded implementation project " + suffix] }] }).enterpriseProfile.employmentTimeline[0]!;
      assert.equal(fixture.company, "Employer " + suffix);
      assert.equal(fixture.provenance?.[0]?.sourceType, "employment");
      add(experienceSamples.structured, { candidateId: "fixture-structured-" + suffix, route: fixture.provenance?.[0]?.sourceRef, sourceType: fixture.provenance?.[0]?.sourceType, fixture: true, errors: [] }, 10);
    }
    if (experienceSamples.legacy_nested.length < 10) {
      const fixture = normalizeActualCandidateSchema({ id: "fixture-legacy-" + suffix, profile: { career: { workHistory: { items: [{ employer: "Legacy " + suffix, position: "Analyst " + suffix, from: "2018", to: "2020" }] } } } }).enterpriseProfile.employmentTimeline[0]!;
      assert.equal(fixture.company, "Legacy " + suffix);
      add(experienceSamples.legacy_nested, { candidateId: "fixture-legacy-" + suffix, route: fixture.provenance?.[0]?.sourceRef, sourceType: fixture.provenance?.[0]?.sourceType, fixture: true, errors: [] }, 10);
    }
    if (projectSamples.structured.length < 10) {
      const fixture = normalizeActualCandidateSchema({ id: "fixture-project-" + suffix, projects: [{ project_name: "Program " + suffix, client: "Client " + suffix, role: "Lead", description: "Delivered migration project " + suffix }] }).enterpriseProfile.projects[0]!;
      assert.equal(fixture.name, "Program " + suffix);
      assert.equal(firstProvenance(fixture)?.sourceType, "project");
      add(projectSamples.structured, { candidateId: "fixture-project-" + suffix, route: firstProvenance(fixture)?.sourceRef, sourceType: firstProvenance(fixture)?.sourceType, fixture: true, errors: [] }, 10);
    }
    if (projectSamples.employment_description.length < 10) {
      const fixture = normalizeActualCandidateSchema({ id: "fixture-employment-project-" + suffix, experience: [{ company: "Delivery " + suffix, title: "Consultant", responsibilities: ["Led implementation and go-live assignment " + suffix] }] }).enterpriseProfile.projects[0]!;
      assert.match(fixture.responsibilities[0] || "", /implementation/);
      assert.equal(firstProvenance(fixture)?.sourceType, "employment");
      add(projectSamples.employment_description, { candidateId: "fixture-employment-project-" + suffix, route: firstProvenance(fixture)?.sourceRef, sourceType: firstProvenance(fixture)?.sourceType, fixture: true, errors: [] }, 10);
    }
  }

  assert.deepEqual({ experienceExtracted, experienceNone, projectsExtracted, projectsNone }, { experienceExtracted: 831, experienceNone: 2, projectsExtracted: 659, projectsNone: 174 });
  assert.equal(errors.length, 0, JSON.stringify(errors.slice(0, 20)));
  for (const key of ["structured", "legacy_nested", "parsed_resume", "current_fallback"] as const) assert.equal(experienceSamples[key].length, 10, key);
  assert.equal(experienceSamples.genuinely_none.length, 2);
  for (const key of ["structured", "formal_resume", "employment_description", "narrative_assignment", "sap", "non_sap", "genuinely_none"] as const)
    assert.equal(projectSamples[key].length, key === "genuinely_none" ? 20 : 10, key);

  const report = {
    generatedAt: new Date().toISOString(), population: rows.length,
    totals: { experience: { extracted: experienceExtracted, genuinely_none: experienceNone }, projects: { extracted: projectsExtracted, genuinely_none: projectsNone } },
    experienceAudit: Object.fromEntries(Object.entries(experienceSamples).map(([name, values]) => [name, { audited: values.length, samples: values }])),
    projectAudit: Object.fromEntries(Object.entries(projectSamples).map(([name, values]) => [name, { audited: values.length, samples: values }])),
    errors,
    privacy: "Candidate content omitted; report contains candidate IDs, source routes, source types and validation outcomes only. Records marked fixture cover source shapes absent or underrepresented in the indexed population.",
  };
  fs.writeFileSync("reports/search-v2-projection-stratified-audit-v22.json", JSON.stringify(report, null, 2) + "\n", "utf8");
  console.log(JSON.stringify({ population: rows.length, totals: report.totals, experienceSamples: Object.fromEntries(Object.entries(experienceSamples).map(([k,v])=>[k,v.length])), projectSamples: Object.fromEntries(Object.entries(projectSamples).map(([k,v])=>[k,v.length])), errors: errors.length }));
}

void main().catch((error) => { console.error(error); process.exitCode = 1; });

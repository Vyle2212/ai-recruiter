import fs from "node:fs";
import { normalizeActualCandidateSchema } from "../lib/candidate360SchemaNormalize";
import { auditSourceText } from "../lib/profileSourceAuditEvidence";

// Read-only local screening. Outputs aggregate counts only, never source text,
// filenames, candidate IDs or contact details. Categories prioritize review;
// they do not adjudicate which organization is the employer.
const inputIndex = process.argv.indexOf("--input");
if (inputIndex < 0 || !process.argv[inputIndex + 1])
  throw new Error("--input is required");
const input = JSON.parse(fs.readFileSync(process.argv[inputIndex + 1], "utf8"));
const samples = Array.isArray(input) ? input : input.samples;
if (!Array.isArray(samples))
  throw new Error("Expected an array or { samples: [...] }");
const categories: Record<string, number> = {};
let extracted = 0;
for (const sample of samples) {
  const source = sample.source || sample;
  if (
    normalizeActualCandidateSchema(source).enterpriseProfile.employmentTimeline
      .length
  ) {
    extracted++;
    continue;
  }
  const text = auditSourceText(source).split(
    /\b(?:references|referrals)\b/i,
  )[0];
  let category: string;
  if (text.length < 250) category = "short-or-missing-source";
  else if (
    /\b(?:Date\s+Company Name\s+Role|From\s+To\s+Company|Name of Company\s+Scope|Period\s+Position\s+(?:Company|Experience)|Organization\s+Designation|Year\s+Name of Employer)\b/i.test(
      text,
    )
  )
    category = "headed-table-needs-layout-review";
  else if (/\b(?:Employer|Company Name|Organi[sz]ation)\s*:/i.test(text))
    category = "explicit-employer-label-needs-field-review";
  else if (
    /\b(?:employment history|career history|working experiences?|work experience|professional experience)\s*:?\s*.{0,220}\b(?:19|20)\d{2}/i.test(
      text,
    )
  )
    category = "near-heading-date-needs-boundary-review";
  else if (/\b(?:projects?|clients?|customers?)\b/i.test(text))
    category = "project-or-client-heavy-needs-employment-evidence";
  else category = "other-narrative-or-layout-review";
  categories[category] = (categories[category] || 0) + 1;
}
console.log(
  JSON.stringify(
    {
      scope: "LOCAL_INPUT_ONLY",
      declaredPopulation: input.population ?? null,
      examined: samples.length,
      withEmployment: extracted,
      unresolved: samples.length - extracted,
      classification: "heuristic review queues, not adjudicated causes",
      categories,
    },
    null,
    2,
  ),
);

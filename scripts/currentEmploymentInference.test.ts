import assert from "node:assert/strict";
import {
  normalizeActualCandidateSchema,
  resolveCurrentEmployer,
  type EnterpriseEmployment,
} from "../lib/candidate360SchemaNormalize";
import { extractFullCandidateProfile } from "../lib/fullCandidateExtractionEngine";

const historical = {
  company: "Historical Consulting",
  title: "SAP MM Consultant",
  start: "2020-01",
  end: "2022-12",
  current: false,
} as EnterpriseEmployment;
assert.equal(resolveCurrentEmployer([], [historical]), "");
assert.equal(
  resolveCurrentEmployer(
    [{ current_company: "Active Consulting" }],
    [historical],
  ),
  "Active Consulting",
);
assert.equal(
  resolveCurrentEmployer(
    [],
    [{ ...historical, end: "Present", current: true }],
  ),
  "Historical Consulting",
);
assert.equal(
  resolveCurrentEmployer([], [{ ...historical, end: "Presently 2022" }]),
  "",
);

const historicalOnly = normalizeActualCandidateSchema({
  id: "historical-only",
  name: "Synthetic Candidate",
  experience: [
    {
      company: "Historical Consulting",
      title: "SAP MM Consultant",
      start_date: "2020-01",
      end_date: "2022-12",
    },
  ],
}).enterpriseProfile;
assert.equal(historicalOnly.identity.currentCompany, "");
assert.equal(historicalOnly.identity.currentTitle, "");
assert.equal(historicalOnly.employmentTimeline.length, 1);

const datedResume = (end: string) =>
  extractFullCandidateProfile({
    id: `synthetic-${end}`,
    name: "Jane Doe",
    raw_text: `Jane Doe\nEmail: jane@example.invalid\nSAP MM Consultant\nWORK EXPERIENCE\nExample Consulting | SAP MM Consultant | Jan 2020 - ${end}\nSAP MM implementation support procurement configuration.`,
  });
assert.equal(datedResume("Dec 2022").extractedCurrentCompany, "Not disclosed");
assert.equal(
  datedResume("Present").extractedCurrentCompany,
  "Example Consulting",
);

console.log("Current employment inference tests passed");

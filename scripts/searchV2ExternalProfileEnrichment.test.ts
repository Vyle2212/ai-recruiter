import assert from "node:assert/strict";
import fs from "node:fs";
import { buildExternalCanonicalProfileOverview } from "../lib/candidateProfileOverview";
import {
  externalTalentAnalysisCapability,
  hasSufficientExternalTalentEvidence,
} from "../lib/externalTalentAnalysisCapability";
import { parseExternalProfileImport } from "../lib/externalProfileImport";

const disabled = externalTalentAnalysisCapability({});
assert.equal(disabled.enabled, false);
assert.equal(disabled.reason, "mode_disabled");

const missingProvider = externalTalentAnalysisCapability({
  EXTERNAL_TALENT_CLAUDE_MODE: "on_demand",
});
assert.equal(missingProvider.enabled, false);
assert.equal(missingProvider.reason, "provider_not_configured");

const ready = externalTalentAnalysisCapability({
  EXTERNAL_TALENT_CLAUDE_MODE: "on_demand",
  ANTHROPIC_API_KEY: "test-key",
});
assert.equal(ready.enabled, true);
assert.equal(ready.reason, "ready");
assert.equal(
  hasSufficientExternalTalentEvidence(
    [
      { excerpt: "SAP FICO consultant at a verified employer." },
      { excerpt: "Delivered a full-cycle S/4HANA implementation." },
    ],
    ready,
  ),
  true,
);
assert.equal(
  hasSufficientExternalTalentEvidence([{ excerpt: "SAP FICO" }], ready),
  false,
);

const preview = parseExternalProfileImport({
  candidateId: "external-123",
  fileName: "candidate-linkedin.pdf",
  sourceKind: "candidate_provided_linkedin_pdf",
  importedAt: "2026-09-12T00:00:00.000Z",
  text: `
About
SAP finance consultant focused on S/4HANA delivery.
Experience
Senior SAP FICO Consultant
Verified Consulting Sdn Bhd
January 2022 - Present
Projects
S/4HANA finance transformation for a regional manufacturer
Education
Bachelor of Accounting, University of Malaya
Licenses & Certifications
SAP Certified Application Associate - Financial Accounting
Skills
SAP FICO, S/4HANA, General Ledger, Accounts Payable
`,
});
assert.equal(preview.candidateId, "external-123");
assert.equal(preview.source.providedByCandidate, true);
assert.equal(preview.sections.experience.length, 3);
assert.deepEqual(preview.sections.skills, [
  "SAP FICO",
  "S/4HANA",
  "General Ledger",
  "Accounts Payable",
]);
assert.equal(preview.completenessPercent, 100);
assert.equal(preview.warnings.length, 0);

const narrativeOnly = parseExternalProfileImport({
  candidateId: "external-456",
  fileName: "profile.txt",
  sourceKind: "candidate_cv",
  text: "Senior consultant with more than 20 years of experience.",
});
assert.equal(narrativeOnly.sections.experience.length, 0);
assert.equal(narrativeOnly.extractedSectionCount, 0);
assert.ok(narrativeOnly.warnings[0].includes("No supported profile section"));

const overview = buildExternalCanonicalProfileOverview({
  candidateId: "external-123",
  candidateName: "External Candidate",
  profileTitle: "Senior SAP FICO Consultant",
  currentEmployer: "Verified Consulting Sdn Bhd",
  location: "Kuala Lumpur, Malaysia",
  totalExperienceYears: 12,
  professionalSummary: preview.sections.overview.join(" "),
  employmentEvidence: preview.sections.experience,
  projectEvidence: preview.sections.projects,
  educationEvidence: preview.sections.education,
  certificationEvidence: preview.sections.certifications,
  skills: preview.sections.skills,
  evidenceConfidencePercent: 68,
  profileCompletenessPercent: preview.completenessPercent,
});
assert.equal(overview.career.currentEmployment?.employer, "Verified Consulting Sdn Bhd");
assert.equal(overview.career.employmentCount, 3);
assert.equal(overview.career.projectCount, 1);
assert.equal(overview.education.count, 1);
assert.equal(overview.certifications.count, 1);
assert.equal(overview.skills.totalCount, 4);
assert.equal(overview.profileQuality.profileCompletenessPercent, 100);

const analysisRoute = fs.readFileSync(
  "app/api/recruiter/search-v2/external-analysis/route.ts",
  "utf8",
);
assert.match(analysisRoute, /export async function GET/);
assert.match(analysisRoute, /authorizeRecruiterJobsRead/);
assert.match(analysisRoute, /insufficient_evidence/);
assert.match(analysisRoute, /private, no-store/);

const drawer = fs.readFileSync(
  "app/recruiter/talent-search/v2/CandidateDetailsDrawer.tsx",
  "utf8",
);
assert.doesNotMatch(drawer, /Import candidate-provided profile/);
assert.doesNotMatch(drawer, />\s*Import profile\s*</);
assert.match(drawer, /AI Match unavailable/);
assert.match(drawer, /Only information returned/);
assert.match(drawer, /ExternalEvidenceList/);
assert.doesNotMatch(
  drawer,
  /if \(overview && availableTabs\.includes\(initialTab\)\) setTab\(initialTab\)/,
  "External profile rerenders must not reset a recruiter-selected tab to Overview",
);

const results = fs.readFileSync(
  "app/recruiter/talent-search/v2/CandidateSearchV2Client.tsx",
  "utf8",
);
assert.match(results, /Preliminary match/);
assert.match(results, /Profile completeness/);
assert.match(results, /external profiles sampled/);
assert.match(results, /not an exhaustive list/);

console.log("Search V2 external profile enrichment tests passed");

import fs from "node:fs";
import assert from "node:assert/strict";
import {
  analyzeReExtractionReviewItems,
  suspiciousReExtractionCompanyReason,
  suspiciousReExtractionNameReason,
} from "../lib/reExtractionReviewAnalysis";

function baseItem(overrides: Record<string, any> = {}) {
  return {
    candidateId: "candidate-1",
    currentSearchable: false,
    couldBecomeSearchableAfterReExtraction: true,
    newlyRecoverable: true,
    current: { displayName: "Candidate profile pending validation" },
    suggested: {
      displayName: "Jane Fruelda",
      currentTitle: "SAP FICO Consultant",
      currentCompany: "Osram Opto Semiconductors Malaysia SDN BHD",
      city: "Kuala Lumpur",
      country: "Malaysia",
      email: "jane@example.com",
      phone: "",
      sapModules: ["FICO"],
      sapSkills: ["S/4HANA", "data migration"],
      sapProjectTypes: ["implementation"],
    },
    confidence: { name: 92, title: 88, modules: 88, location: 82, contact: 92 },
    evidence: { name: { source: "resume_header", text: "Jane Fruelda" }, title: { source: "experience_title", text: "SAP FICO Consultant" } },
    recoveredFields: ["displayName", "currentTitle", "sapModules", "sapSkills", "city"],
    whyBlockedAfterReExtraction: [],
    ...overrides,
  };
}

assert.equal(Boolean(suspiciousReExtractionNameReason("Name Charlie A.J")), true, "Name Charlie A.J is suspicious name");
assert.equal(Boolean(suspiciousReExtractionNameReason("Cha Hui Fung-ep Pm")), true, "Cha Hui Fung-ep Pm is suspicious name");
assert.equal(Boolean(suspiciousReExtractionCompanyReason("Michael Kors ORGANISATION Capgemini Pvt. Ltd")), true, "ORGANISATION combined company is suspicious");
assert.equal(Boolean(suspiciousReExtractionCompanyReason("HANA system solutions")), true, "HANA system solutions is suspicious company");
assert.equal(Boolean(suspiciousReExtractionCompanyReason("s East Zone DELAWARE MANAGED SERVICES")), true, "s East Zone company is suspicious");
assert.equal(Boolean(suspiciousReExtractionCompanyReason("Implemented solutions")), true, "Implemented solutions is suspicious company");
assert.equal(Boolean(suspiciousReExtractionCompanyReason("Jul 2024 to Jun 2025")), true, "date text is suspicious company");
assert.equal(suspiciousReExtractionCompanyReason("Osram Opto Semiconductors Malaysia SDN BHD"), "", "clean Osram company is accepted");
assert.equal(suspiciousReExtractionCompanyReason("DXC Technologies"), "", "clean DXC Technologies company is accepted");

const suspiciousName = analyzeReExtractionReviewItems([baseItem({ suggested: { ...baseItem().suggested, displayName: "Name Charlie A.J" } })]).items[0];
assert.equal(suspiciousName.classification === "safe_recovery_candidate", false, "newlyRecoverable with suspicious name is not safe recovery");
assert.equal(suspiciousName.classification, "needs_parser_refinement", "newlyRecoverable suspicious name needs parser refinement");

const cleanRecovery = analyzeReExtractionReviewItems([baseItem()]).items[0];
assert.equal(cleanRecovery.classification, "safe_recovery_candidate", "clean newly recoverable record is safe recovery candidate");

const blockedIdentity = analyzeReExtractionReviewItems([baseItem({
  candidateId: "blocked-identity",
  couldBecomeSearchableAfterReExtraction: false,
  newlyRecoverable: false,
  suggested: { ...baseItem().suggested, displayName: "Candidate profile pending validation" },
  whyBlockedAfterReExtraction: ["invalid_or_placeholder_name"],
})]).items[0];
assert.equal(blockedIdentity.classification, "still_blocked_identity", "still blocked placeholder name is identity block");

const source = fs.readFileSync(new URL("./exportReExtractionAnalysis.ts", import.meta.url), "utf8") + fs.readFileSync(new URL("./analyzeReExtractionReview.ts", import.meta.url), "utf8");
assert.equal(source.includes(".update("), false, "no DB update behavior");
assert.equal(source.includes(".insert("), false, "no DB insert behavior");
assert.equal(source.includes(".delete("), false, "no DB delete behavior");

console.log("Re-extraction review analysis tests passed");
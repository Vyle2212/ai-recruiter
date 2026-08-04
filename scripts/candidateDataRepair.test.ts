import fs from "node:fs";
import assert from "node:assert/strict";
import { auditCandidateDataRepair, buildCandidateDataRepairSuggestion, cleanSuggestedCandidateName, detectSapModules } from "../lib/candidateDataRepair";

const repairable = {
  id: "repairable-1",
  name: "Candidate profile pending validation",
  current_title: "Professional Objective",
  current_company: "over 10 years consulting experience",
  primary_module: "UNKNOWN",
  email: "",
  phone: "",
  location: "",
  profile_quality_score: 82,
  raw_text: "Full Name: Aina Rahman Gender Female Email aina.rahman@example.com Mobile +60 12 345 6789 WORK EXPERIENCE Jan 2021 - Present Accenture Malaysia SAP FI/CO Consultant Kuala Lumpur Malaysia Skills SAP FI SAP CO MM",
};

const weakEmailOnly = {
  id: "weak-email",
  name: "Profile Under Review",
  current_title: "SAP Consultant",
  current_company: "Not disclosed",
  primary_module: "UNKNOWN",
  email: "john.smith@example.com",
  raw_text: "SAP MM consultant profile. No explicit candidate name in header.",
};

const unsafeCompany = {
  id: "unsafe-company",
  name: "Lee Wah Ken",
  current_title: "SAP MM Consultant",
  current_company: "PP & MM module",
  primary_module: "MM",
  email: "lee@example.com",
  location: "Malaysia",
  raw_text: "Lee Wah Ken SAP MM Consultant PP & MM module",
};

const placeholderWithModuleOnly = {
  id: "module-only",
  name: "Candidate profile pending validation",
  current_title: "SAP Consultant",
  current_company: "Not disclosed",
  primary_module: "UNKNOWN",
  email: "",
  location: "Malaysia",
  raw_text: "SAP FICO SAP MM implementation support profile without trusted identity.",
};

const lowTitleConfidence = {
  id: "low-title-confidence",
  name: "Candidate profile pending validation",
  current_title: "Professional Objective",
  current_company: "Accenture Malaysia",
  primary_module: "UNKNOWN",
  email: "",
  location: "Malaysia",
  raw_text: "Full Name: Nur Aisyah Rahman Gender Female SAP FICO implementation support experience at Accenture Malaysia.",
};

const strongSafe = {
  id: "strong-safe",
  name: "Candidate profile pending validation",
  current_title: "SAP FICO Consultant",
  current_company: "over 10 years consulting experience",
  primary_module: "UNKNOWN",
  years: 8,
  email: "",
  phone: "",
  location: "Malaysia",
  raw_text: "Full Name: Ravi Kumar Gender Male WORK EXPERIENCE Jan 2021 - Present Accenture Malaysia SAP FICO Consultant Skills SAP FICO",
};

assert.equal(cleanSuggestedCandidateName("Muhammad Wasim Qureshi Sr"), "Muhammad Wasim Qureshi", "trailing seniority suffix should be removed from suggested names");

const suggestion = buildCandidateDataRepairSuggestion(repairable);
assert.equal(suggestion.candidateId, "repairable-1", "repair suggestion should include candidateId");
assert.equal(suggestion.suggested.displayName, "Aina Rahman", "strong resume header name should be suggested");
assert.equal(suggestion.confidence.displayName >= 90, true, "resume header name should carry high confidence");
assert.equal(suggestion.suggested.module, "FICO", "FI/CO, SAP FI, and SAP CO should normalize to FICO");
assert.equal(suggestion.suggested.email, "aina.rahman@example.com", "email should be recovered from contact evidence");
assert.equal(suggestion.suggested.phone.includes("60"), true, "phone should be recovered from contact evidence");
assert.equal(suggestion.suggested.company, "Accenture Malaysia", "latest experience company should be preferred");
assert.equal(suggestion.suggested.location, "Malaysia", "location should be recovered from resume text");
assert.notEqual(suggestion.action, "insufficient_evidence", "strong repair evidence should produce an actionable dry-run suggestion");
assert.equal(suggestion.confidence.displayName >= 92, true, "safe name evidence should meet the strict name confidence threshold");

const weak = buildCandidateDataRepairSuggestion(weakEmailOnly);
assert.notEqual(weak.action, "safe_to_apply_later", "email local-part alone must not be safe_to_apply_later");
assert.equal(weak.confidence.displayName < 92, true, "name confidence below 92 must not be safe_to_apply_later");

const moduleOnly = buildCandidateDataRepairSuggestion(placeholderWithModuleOnly);
assert.notEqual(moduleOnly.action, "safe_to_apply_later", "safe_to_apply_later must be false if name remains placeholder");

const lowTitle = buildCandidateDataRepairSuggestion(lowTitleConfidence);
assert.equal(lowTitle.confidence.title, 68, "module-only title repair should carry low confidence");
assert.notEqual(lowTitle.action, "safe_to_apply_later", "safe_to_apply_later must be false if title confidence is 68 and title is repaired");

const safe = buildCandidateDataRepairSuggestion(strongSafe);
assert.equal(safe.action, "safe_to_apply_later", "safe_to_apply_later should require strong name plus strong module/company/title evidence");
assert.equal(safe.confidence.title, 100, "safe fixture should keep a strong existing title field");
assert.equal(safe.overallConfidence >= 90, true, "safe_to_apply_later should have overall confidence >= 90");

const companySuggestion = buildCandidateDataRepairSuggestion(unsafeCompany);
assert.equal(companySuggestion.suggested.company, "Not disclosed", "unsafe company fragments should be converted to Not disclosed suggestions");

const modules = detectSapModules({ raw_text: "SAP FI SAP CO SAP CPI SAP PI/PO SAP SuccessFactors SAP IS-U SAP BW/4HANA" });
assert.equal(modules.includes("FICO"), true, "FI/CO variants should normalize to FICO");
assert.equal(modules.includes("CPI"), true, "CPI should be detected");
assert.equal(modules.includes("PI/PO"), true, "PI/PO should be detected");
assert.equal(modules.includes("SuccessFactors"), true, "SuccessFactors should be detected");
assert.equal(modules.includes("IS-U"), true, "IS-U should be detected");
assert.equal(modules.includes("BW/4HANA"), true, "BW/4HANA should be detected");

const audit = auditCandidateDataRepair([repairable, weakEmailOnly, unsafeCompany]);
assert.equal(audit.totalValidationQueueCandidates >= 2, true, "repair audit should inspect validation queue candidates only");
assert.equal(audit.suggestions.length, audit.totalValidationQueueCandidates, "repair audit suggestions should match validation queue candidate count");
assert.equal(audit.safeToApplyLater + audit.needsRecruiterReview + audit.insufficientEvidence, audit.totalValidationQueueCandidates, "action counts should sum to validation queue candidates");
assert.equal(typeof audit.safeToApplyLaterWithNameRepair, "number", "repair audit should summarize safe suggestions with name repair");
assert.equal(typeof audit.safeToApplyLaterWithoutNameRepair, "number", "repair audit should summarize safe suggestions without name repair");
assert.equal(typeof audit.needsRecruiterReviewNameStillInvalid, "number", "repair audit should summarize review suggestions where name remains invalid");

const libSource = fs.readFileSync(new URL("../lib/candidateDataRepair.ts", import.meta.url), "utf8");
const scriptSource = fs.readFileSync(new URL("../scripts/auditCandidateDataRepair.ts", import.meta.url), "utf8");
assert.equal(/\.update\(|\.insert\(|\.delete\(/.test(libSource), false, "repair library must not contain DB writes");
assert.equal(/\.update\(|\.insert\(|\.delete\(/.test(scriptSource), false, "repair audit script must not contain DB writes");
assert.equal(scriptSource.includes("loadRealTalentPoolCandidates"), true, "repair audit should reuse read-only candidate loader");

console.log("Candidate data repair dry-run tests passed");

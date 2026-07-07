import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { buildSelectiveAiExtractionQueue, classifySelectiveAiExtractionItem } from "../lib/selectiveAiExtractionQueue";
import { writeSelectiveAiExtractionQueueReport, SELECTIVE_AI_EXTRACTION_QUEUE_PATH } from "./auditSelectiveAiExtraction";

function item(overrides: Record<string, any> = {}) {
  return {
    candidateId: "candidate-1",
    reviewClassification: "search_ready_after_extraction",
    reviewReasons: [],
    searchReadiness: true,
    isNameSuspicious: false,
    isTitleSuspicious: false,
    isCompanySuspicious: false,
    sapModules: ["FICO"],
    primarySapModule: "FICO",
    expectedSalary: "",
    extractedCurrentCompany: "Deloitte",
    extractedFullName: "Priya Raman",
    extractedCurrentTitle: "SAP FICO Consultant",
    hasContact: true,
    isLocationMissing: false,
    rawTextQualityReason: "",
    extractionConfidenceOverall: 88,
    extractionCompletenessScore: 90,
    companyRejectReason: "",
    titleRejectReason: "",
    nameRejectReason: "",
    nameConfidence: 88,
    nameSource: "labelled_name_strong",
    nameEvidence: "Full Name: Priya Raman",
    identityRecoverySource: "labelled_name_strong",
    identityRecoveryEvidence: "Full Name: Priya Raman",
    primaryModuleAlignmentStatus: "aligned",
    existingDisplayName: "Priya Raman",
    existingTitle: "SAP FICO Consultant",
    existingCurrentCompany: "Deloitte",
    ...overrides,
  } as any;
}

function structuredName(name: string, overrides: Record<string, any> = {}) {
  return classifySelectiveAiExtractionItem(item({ extractedFullName: name, existingDisplayName: name, nameSource: "structured_identity", nameEvidence: name, identityRecoverySource: "structured_identity", identityRecoveryEvidence: name, ...overrides }));
}

assert.equal(classifySelectiveAiExtractionItem(item()).extractionStatus, "parser_search_ready", "clean parser-ready profile with labelled name evidence does not need AI");
assert.equal(classifySelectiveAiExtractionItem(item()).nameQualityLevel, "strong_labelled_name", "labelled name has strong quality level");
assert.equal(classifySelectiveAiExtractionItem(item({ nameSource: "contact_block", nameEvidence: "Priya Raman | priya@example.com | +60123456789" })).extractionStatus, "parser_search_ready", "valid name near email/phone can be parser ready");
assert.equal(classifySelectiveAiExtractionItem(item({ nameSource: "resume_header", nameEvidence: "Priya Raman\nEmail: priya@example.com" })).nameQualityLevel, "strong_header_name", "header name has strong quality level");
assert.equal(structuredName("Priya Raman").extractionStatus, "parser_search_ready", "structured_identity is not automatically weak");
assert.equal(structuredName("Priya Raman").nameQualityLevel, "acceptable_structured_name", "clean structured identity is acceptable");
assert.equal(classifySelectiveAiExtractionItem(item({ reviewClassification: "blocked_identity", isNameSuspicious: true })).extractionStatus, "ai_recommended_identity", "blocked identity goes to AI queue");
assert.equal(classifySelectiveAiExtractionItem(item({ reviewClassification: "blocked_title", isTitleSuspicious: true })).extractionStatus, "ai_recommended_title", "blocked title goes to AI queue");
assert.equal(classifySelectiveAiExtractionItem(item({ isCompanySuspicious: true, companyRejectReason: "sentence_fragment" })).extractionStatus, "ai_recommended_employer", "suspicious employer goes to AI queue");
assert.equal(classifySelectiveAiExtractionItem(item({ primaryModuleAlignmentStatus: "evidence_conflict" })).extractionStatus, "ai_recommended_module_alignment", "title/module mismatch goes to AI queue");
assert.equal(classifySelectiveAiExtractionItem(item({ extractionConfidenceOverall: 60 })).extractionStatus, "ai_recommended_low_confidence", "low parser confidence goes to AI queue");
assert.equal(classifySelectiveAiExtractionItem(item({ reviewClassification: "likely_reupload_required", rawTextQualityReason: "raw_text_too_short" })).extractionStatus, "reupload_required", "raw text quality issue requires reupload");

for (const cleanName of ["Ashok Kumar P", "Md Husaimi Abd Wahab", "Dainiel Paulo P. Dizon", "Alfredo L. Montilla Jr.", "Jane Pauline U. Fruelda", "Dennis Jordan D. Bangalan", "Sameer R S", "Om Joshi", "Sarath Krishnan", "Tran Thang Long", "Huynh Thi My Nhan"]) {
  const result = structuredName(cleanName);
  assert.equal(result.extractionStatus, "parser_search_ready", `${cleanName} remains parser_search_ready as clean structured identity`);
  assert.equal(result.nameQualityLevel, "acceptable_structured_name", `${cleanName} is acceptable structured name`);
}

for (const badName of ["Priyanka Tiwari Father's Name: Mahendra Tiwari", "Public GANESH G", "Lamkieumy Work", "Kone Industry", "Sesz Staff Reimbursement", "External Stakeholders", "Monitoring Compliance"]) {
  const result = structuredName(badName);
  assert.equal(result.extractionStatus, "ai_recommended_identity", `${badName} is not parser_search_ready`);
  assert.equal(result.aiRecommendationReasons.includes("suspicious_identity_quality"), true, `${badName} has suspicious identity quality reason`);
}

for (const joinedName of ["Nor Ain Humaimahmuhamad", "Eugeneong Jun Jie", "Yun Qiantan", "Wong Yokiee", "Yang Huiyee"]) {
  const result = structuredName(joinedName);
  assert.equal(result.extractionStatus, "ai_recommended_identity", `${joinedName} is not parser_search_ready without strong evidence`);
  assert.equal(result.nameQualityLevel, "suspicious_ocr_joined_name", `${joinedName} is flagged as OCR/joined`);
}

const cleanStructuredCandidates = [
  "Ashok Kumar P",
  "Md Husaimi Abd Wahab",
  "Dainiel Paulo P. Dizon",
  "Alfredo L. Montilla Jr.",
  "Jane Pauline U. Fruelda",
].map((name, index) => ({ id: `clean-${index}`, name, raw_text: `${name}\nEmail: clean${index}@example.com\nMalaysia\nSAP FICO Consultant\nS/4HANA implementation support data migration UAT SIT repeated SAP finance configuration evidence across several projects and employment history` }));
const candidates = [
  { id: "ready", name: "Priya Raman", raw_text: "Full Name: Priya Raman\nEmail: priya@example.com\nMalaysia\nSAP FICO Consultant\nS/4HANA implementation support data migration UAT SIT repeated SAP finance configuration evidence across several projects and employment history" },
  ...cleanStructuredCandidates,
  { id: "suspicious", name: "Lamkieumy Work", raw_text: "Lamkieumy Work\nEmail: suspicious@example.com\nMalaysia\nSAP FICO Consultant\nS/4HANA implementation support data migration UAT SIT repeated SAP finance configuration evidence across several projects and employment history" },
  { id: "blocked", name: "Candidate profile pending validation", raw_text: "Candidate profile pending validation\nEmail: blocked@example.com\nMalaysia\nSAP FICO Consultant\nS/4HANA implementation support data migration UAT SIT repeated SAP finance configuration evidence across several projects and employment history" },
  { id: "short", name: "Profile Under Review", raw_text: "x SAP" },
];
const report = buildSelectiveAiExtractionQueue(candidates);
assert.equal(report.mode, "read-only", "report is read-only");
assert.equal(report.summary.totalCandidates, 9, "report counts candidates");
assert.equal(report.summary.estimatedAiCallsSaved <= report.summary.totalCandidates, true, "AI calls saved is bounded");
assert.equal(report.aiQueueItems.every((queueItem) => queueItem.aiRecommended), true, "queue contains AI recommended items only");
assert.equal(report.items.some((queueItem) => queueItem.extractionStatus === "reupload_required"), true, "reupload bucket is present");
const baselineReady = structuredName("Ashok Kumar P");
const downgradedSuspicious = structuredName("Lamkieumy Work");
assert.equal(Number(downgradedSuspicious.aiRecommended) > Number(baselineReady.aiRecommended), true, "estimated AI queue increases when suspicious names are downgraded");
const cleanClassifierReadyCount = ["Ashok Kumar P", "Md Husaimi Abd Wahab", "Dainiel Paulo P. Dizon", "Alfredo L. Montilla Jr.", "Jane Pauline U. Fruelda"].filter((name) => structuredName(name).extractionStatus === "parser_search_ready").length;
assert.equal(cleanClassifierReadyCount, 5, "parser_search_ready count does not collapse when names are clean");
assert.equal(Number(report.summary.downgradedFromParserSearchReadyDueToIdentityQuality) >= 0, true, "identity downgrade counter is present");

const outputPath = path.join(process.cwd(), "reports", "selective-ai-extraction-queue.test.json");
const exported = writeSelectiveAiExtractionQueueReport(candidates, outputPath);
assert.equal(exported.summary.totalCandidates, 9, "export writes report payload");
assert.equal(fs.existsSync(outputPath), true, "export file is written locally");
assert.equal(SELECTIVE_AI_EXTRACTION_QUEUE_PATH, path.join("reports", "selective-ai-extraction-queue.json"), "export path is stable");
if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

const sources = [
  fs.readFileSync(new URL("../lib/selectiveAiExtractionQueue.ts", import.meta.url), "utf8"),
  fs.readFileSync(new URL("./auditSelectiveAiExtraction.ts", import.meta.url), "utf8"),
  fs.readFileSync(new URL("./exportSelectiveAiExtractionQueue.ts", import.meta.url), "utf8"),
].join("\n");
assert.equal(sources.includes("OPENAI_API_KEY"), false, "selective queue does not call OpenAI");
assert.equal(/from\([^)]*\)\.update\(/.test(sources), false, "no DB update behavior");
assert.equal(/from\([^)]*\)\.insert\(/.test(sources), false, "no DB insert behavior");
assert.equal(/from\([^)]*\)\.delete\(/.test(sources), false, "no DB delete behavior");

console.log("Selective AI extraction queue tests passed");

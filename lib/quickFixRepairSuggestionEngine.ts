import fs from "node:fs";
import path from "node:path";
import type { QuickFixRepairPlan, QuickFixRepairSuggestion, QuickFixRepairSuggestionFile, QuickFixTargetField } from "./quickFixRepairTypes";
import { statusForValidatedSuggestion } from "./quickFixRepairValidator";
import { summarizeQuickFixRepair } from "./quickFixRepairSummary";
import { writeWorkflowJson } from "./recruiterWorkflowStore";

function clean(value: any) {
  return String(Array.isArray(value) ? value.join(", ") : value ?? "").replace(/\s+/g, " ").trim();
}

function readJson(filePath: string) {
  const fullPath = path.resolve(filePath);
  if (!fs.existsSync(fullPath)) return null;
  try { return JSON.parse(fs.readFileSync(fullPath, "utf8")); } catch { return null; }
}

function fullCandidateMap(fullExtraction: any) {
  return new Map((Array.isArray(fullExtraction?.items) ? fullExtraction.items : []).map((item: any) => [clean(item.candidateId), item]));
}

function evidence(value: any, fallback: any) {
  return clean(value) || clean(fallback);
}

function latestEmployment(candidate: any) {
  const entries = [...(Array.isArray(candidate?.employerHistory) ? candidate.employerHistory : []), ...(Array.isArray(candidate?.employmentHistory) ? candidate.employmentHistory : [])];
  return entries.find((entry) => /present|current|till|now/i.test(clean(entry?.endDate || entry?.period))) || entries[0] || {};
}

function confidenceBand(confidence: number) {
  if (confidence >= 90) return "high" as const;
  if (confidence >= 75) return "medium" as const;
  return "low" as const;
}

function currentValue(candidate: any, field: QuickFixTargetField) {
  if (field === "currentCompany") return clean(candidate?.existingCurrentCompany);
  if (field === "title") return clean(candidate?.existingTitle);
  if (field === "primarySapModule") return "";
  if (field === "location") return clean(candidate?.city || candidate?.country);
  return "";
}

function suggestValue(candidate: any, field: QuickFixTargetField) {
  const latest = latestEmployment(candidate);
  if (field === "currentCompany") {
    const structured = clean(candidate?.currentCompany || candidate?.extractedCurrentCompany || candidate?.currentEmployer || candidate?.currentEmployerName);
    if (structured) return { value: structured, confidence: Number(candidate?.companyConfidence || 92), source: clean(candidate?.companySource || "structured current employer"), evidence: evidence(candidate?.companyEvidence, structured) };
    const employer = clean(latest?.employer || latest?.company || latest?.organization);
    return { value: employer, confidence: 82, source: "latest work experience", evidence: evidence(latest?.evidence, [employer, latest?.title, latest?.startDate, latest?.endDate].filter(Boolean).join(" | ")) };
  }
  if (field === "title") {
    const structured = clean(candidate?.title || candidate?.extractedCurrentTitle || candidate?.currentTitle || candidate?.headline);
    if (structured) return { value: structured, confidence: Number(candidate?.titleConfidence || 90), source: clean(candidate?.titleSource || "structured title"), evidence: evidence(candidate?.titleEvidence, structured) };
    const title = clean(latest?.title || latest?.role || latest?.position);
    return { value: title, confidence: 82, source: "latest work experience", evidence: evidence(latest?.evidence, [title, latest?.employer || latest?.company, latest?.startDate, latest?.endDate].filter(Boolean).join(" | ")) };
  }
  if (field === "primarySapModule") {
    const explicit = clean(candidate?.primarySapModule);
    if (explicit && explicit !== "UNKNOWN") return { value: explicit, confidence: Number(candidate?.sapConfidence || 90), source: "structured SAP module", evidence: evidence(candidate?.primaryModuleCorrectionReason || candidate?.s4hanaEvidence, explicit) };
    const modules = Array.isArray(candidate?.sapModules) ? candidate.sapModules.filter(Boolean) : [];
    const module = clean(modules[0]);
    return { value: module, confidence: module ? 86 : 0, source: "SAP skills/modules list", evidence: evidence(candidate?.evidenceSummary || candidate?.searchReadyReason, modules.join(", ")) };
  }
  const location = clean(candidate?.locationCountry || candidate?.country || candidate?.locationCity || candidate?.city || candidate?.location);
  return { value: location, confidence: Number(candidate?.locationConfidence || 88), source: clean(candidate?.locationSource || "structured location"), evidence: evidence(candidate?.locationEvidence, location) };
}

function alreadyVerified(candidateId: string, field: string, applyHistory: any) {
  return (Array.isArray(applyHistory?.items) ? applyHistory.items : []).some((item: any) => clean(item.candidateId) === candidateId && clean(item.fieldName) === field && /applied_verified|preserved_already_applied/i.test(clean(item.status)));
}

function alreadyApproved(candidateId: string, field: string, approvals: any) {
  return (Array.isArray(approvals?.approvals) ? approvals.approvals : []).some((item: any) => clean(item.candidateId) === candidateId && clean(item.fieldName) === field);
}

export function generateQuickFixRepairSuggestions(plan: QuickFixRepairPlan, options: { fullExtractionPath?: string; approvalsPath?: string; applyHistoryPath?: string } = {}): QuickFixRepairSuggestionFile {
  const fullExtraction = readJson(options.fullExtractionPath || path.join("reports", "full-candidate-extraction.json"));
  const approvals = readJson(options.approvalsPath || path.join("reports", "ai-extraction-approvals.json"));
  const applyHistory = readJson(options.applyHistoryPath || path.join("reports", "candidate-apply-history.json"));
  const candidates = fullCandidateMap(fullExtraction);
  const seen = new Set<string>();
  const suggestions: QuickFixRepairSuggestion[] = [];

  for (const item of plan.items || []) {
    const candidate: any = candidates.get(clean(item.candidateId)) || {};
    for (const field of item.targetFields || []) {
      const suggestionId = `${clean(item.candidateId)}:${field}`;
      if (seen.has(suggestionId)) continue;
      seen.add(suggestionId);
      const proposed = suggestValue(candidate, field);
      const base: QuickFixRepairSuggestion = {
        suggestionId,
        candidateId: clean(item.candidateId),
        candidateName: clean(item.candidateName) || clean(candidate?.displayName) || clean(item.candidateId),
        fieldName: field,
        currentValue: currentValue(candidate, field),
        suggestedValue: clean(proposed.value),
        confidence: Number(proposed.confidence || 0),
        confidenceBand: confidenceBand(Number(proposed.confidence || 0)),
        evidenceSource: clean(proposed.source),
        evidenceSnippet: clean(proposed.evidence),
        repairCategory: item.repairCategory,
        priority: item.priority,
        validationStatus: "blocked",
        approvalReadiness: "not_ready_conflict",
        validationReasons: [],
        safetyNote: "Suggestion only. Recruiter approval is required before staging or apply.",
      };
      const status = statusForValidatedSuggestion(base);
      base.validationStatus = status.validationStatus;
      base.approvalReadiness = status.approvalReadiness;
      base.validationReasons = status.reasons;
      if (alreadyVerified(base.candidateId, field, applyHistory)) {
        base.validationStatus = "already_verified";
        base.approvalReadiness = "not_ready_already_verified";
        base.validationReasons = ["Already applied or verified in apply history"];
      } else if (alreadyApproved(base.candidateId, field, approvals)) {
        base.validationStatus = "already_approved";
        base.approvalReadiness = "not_ready_existing_approval";
        base.validationReasons = ["Existing approval decision preserved"];
      }
      suggestions.push(base);
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    mode: "quick fix suggestion generation only; no candidate DB writes; no approvals write; no staging; no apply; no delete; no OpenAI calls",
    candidatesProcessed: plan.items.length,
    suggestions,
    summary: summarizeQuickFixRepair(suggestions, plan.items.length),
  };
}

export function writeQuickFixRepairSuggestions(file: QuickFixRepairSuggestionFile, outputPath = path.join("reports", "quick-fix-repair-suggestions.json")) {
  return writeWorkflowJson(outputPath, file);
}


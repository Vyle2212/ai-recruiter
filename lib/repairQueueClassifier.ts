import type { PersistedWorkflowState } from "./recruiterWorkflowPersistence";
import type { RepairBatchType, RepairPriority, RepairQueueCategory, RepairQueueItem } from "./repairQueueTypes";

function clean(value: any) {
  return String(Array.isArray(value) ? value.join(", ") : value ?? "").replace(/\s+/g, " ").trim();
}

function textOf(value: any): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map(textOf).join(" ");
  if (typeof value === "object") return Object.values(value).map(textOf).join(" ");
  return String(value);
}

export function normalizeMissingField(field: string) {
  const value = clean(field).toLowerCase();
  if (/company|employer/.test(value)) return "currentCompany";
  if (/title/.test(value)) return "title";
  if (/module|primarysap/.test(value)) return "primarySapModule";
  if (/location|country/.test(value)) return "location";
  if (/skill/.test(value)) return "sapSkills";
  return clean(field);
}

function hasRawEvidence(candidate: any) {
  const blob = textOf([candidate?.raw_text, candidate?.resume_text, candidate?.rawCv, candidate?.rawText, candidate?.titleEvidence, candidate?.currentCompanyEvidence, candidate?.moduleEvidence, candidate?.searchReadyReason, candidate?.contactEvidence]);
  return blob.length > 80;
}

function evidenceAvailability(candidate: any, state: PersistedWorkflowState) {
  const raw = hasRawEvidence(candidate);
  const notes = state.auditNotes.join(" ");
  if (raw && state.missingFields.length <= 2) return "good_evidence" as const;
  if (raw) return "partial_evidence" as const;
  if (/evidence|source|reason/i.test(notes)) return "partial_evidence" as const;
  return "low_evidence" as const;
}

function batchFor(category: RepairQueueCategory): RepairBatchType {
  if (category === "quick_fix_missing_company" || category === "quick_fix_missing_title") return "company_title_quick_fix";
  if (category === "quick_fix_missing_module") return "module_skill_quick_fix";
  if (category === "quick_fix_missing_location") return "location_contact_quick_fix";
  if (category === "ai_extractable") return "ai_extraction_batch";
  if (category === "duplicate_conflict") return "duplicate_resolution_batch";
  if (category === "requires_original_file_reupload") return "reupload_required_batch";
  if (category === "archive_candidate_review") return "archive_review_batch";
  return "manual_review_batch";
}

function priorityRank(priority: RepairPriority) {
  return { P0: 0, P1: 1, P2: 2, P3: 3, P4: 4, P5: 5 }[priority];
}

export function classifyRepairCandidate(state: PersistedWorkflowState, candidate: any = {}, applyHistory: any = null): RepairQueueItem | null {
  const candidateId = clean(state.candidateId);
  const missingFields = Array.from(new Set((state.missingFields || []).map(normalizeMissingField).filter(Boolean)));
  const notes = clean([...state.auditNotes, ...state.blockerReasons].join(" "));
  const candidateBlob = clean(textOf(candidate));
  const applyVerified = (Array.isArray(applyHistory?.items) ? applyHistory.items : []).some((item: any) => clean(item.candidateId) === candidateId && /applied_verified|preserved_already_applied/i.test(clean(item.status)));
  if (state.currentStatus === "ready_for_shortlist" && !missingFields.length) return null;

  const categories: RepairQueueCategory[] = [];
  let priority: RepairPriority = "P3";
  if (!candidateId || candidateId === "unknown") categories.push("blocked_from_repair");
  if (/duplicate.*conflict|conflict.*duplicate/i.test(notes + " " + candidateBlob)) categories.push("duplicate_conflict");
  if (/requires_original_file_reupload|reupload/i.test(notes + " " + candidateBlob)) categories.push("requires_original_file_reupload");
  if (applyVerified && state.currentStatus !== "needs_repair") categories.push("already_repaired_or_verified");

  const evidence = evidenceAvailability(candidate, state);
  const rawAvailable = evidence === "good_evidence" || evidence === "partial_evidence";
  const importantMissing = missingFields.filter((field) => ["currentCompany", "title", "primarySapModule", "location"].includes(field));
  if (missingFields.includes("currentCompany") && rawAvailable && importantMissing.length <= 2 && !categories.length) categories.push("quick_fix_missing_company");
  if (missingFields.includes("title") && rawAvailable && importantMissing.length <= 2 && !categories.length) categories.push("quick_fix_missing_title");
  if (missingFields.includes("primarySapModule") && rawAvailable && importantMissing.length <= 2 && !categories.length) categories.push("quick_fix_missing_module");
  if (missingFields.includes("location") && rawAvailable && importantMissing.length <= 2 && !categories.length) categories.push("quick_fix_missing_location");
  if (missingFields.length > 2 && rawAvailable && !categories.length) categories.push("ai_extractable");
  if (/conflict|inconsistent|unclear|manual/i.test(notes) && !categories.length) categories.push("manual_review_required");
  if (!rawAvailable && missingFields.length > 0 && !categories.length) categories.push("low_evidence_profile");
  if (missingFields.length >= 4 && !rawAvailable) categories.push("archive_candidate_review");
  if (!categories.length && state.currentStatus === "needs_repair") categories.push("manual_review_required");
  if (!categories.length) return null;

  const primary = categories[0];
  if (["blocked_from_repair", "duplicate_conflict"].includes(primary) || categories.includes("duplicate_conflict")) priority = "P0";
  else if (categories.includes("requires_original_file_reupload")) priority = "P4";
  else if (primary.startsWith("quick_fix")) priority = "P1";
  else if (primary === "ai_extractable") priority = "P2";
  else if (primary === "manual_review_required") priority = "P3";
  else if (primary === "low_evidence_profile") priority = "P4";
  else if (primary === "archive_candidate_review") priority = "P5";

  const recommended = primary.startsWith("quick_fix") ? "Repair the missing field from existing CV evidence" : primary === "ai_extractable" ? "Add to AI extraction repair batch" : primary === "duplicate_conflict" ? "Resolve duplicate identity conflict" : primary === "requires_original_file_reupload" ? "Request original CV reupload" : primary === "archive_candidate_review" ? "Review whether this profile should be archived" : "Manual recruiter review required";
  const blocker = categories.includes("duplicate_conflict") ? "Duplicate conflict unresolved" : categories.includes("requires_original_file_reupload") ? "Original CV reupload required" : state.blockerReasons.join("; ") || notes || "Missing repair data";
  return {
    repairId: `repair-${candidateId}`,
    candidateId,
    candidateName: state.displayName || candidateId,
    workflowStatus: state.currentStatus,
    repairCategory: primary,
    categories,
    priority,
    missingFields,
    evidenceAvailability: evidence === "low_evidence" && !rawAvailable ? "low_evidence" : evidence,
    recommendedRepairAction: recommended,
    blockerReason: blocker,
    suggestedBatch: batchFor(primary),
    readyAfterQuickFix: priority === "P1" && importantMissing.length <= 2,
    safetyNote: "Read-only repair classification. Candidate records are not updated.",
    sortScore: priorityRank(priority) * 1000 + missingFields.length * 10 + (rawAvailable ? 0 : 5),
  };
}

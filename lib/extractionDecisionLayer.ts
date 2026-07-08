import { auditFieldLevelExtractionQa, FieldLevelExtractionQaOptions } from "./fieldLevelExtractionQa";

export type ExtractionDecisionOptions = FieldLevelExtractionQaOptions;

export type ExtractionDecisionAction =
  | "keep_existing_record"
  | "safe_to_overwrite_later"
  | "send_to_ai_extraction_queue"
  | "requires_manual_review"
  | "requires_original_file_reupload"
  | "parser_fix_candidate";

function clean(value: any) {
  return String(Array.isArray(value) ? value.join(", ") : value || "").replace(/\s+/g, " ").trim();
}

function hasAny(row: any, field: string) {
  return Array.isArray(row.fieldIssues?.[field]) && row.fieldIssues[field].length > 0;
}

function includesIssue(row: any, field: string, pattern: RegExp) {
  return (row.fieldIssues?.[field] || []).some((issue: string) => pattern.test(issue));
}

function countBy<T extends string>(items: T[]) {
  const out: Record<string, number> = {};
  for (const item of items) out[item] = (out[item] || 0) + 1;
  return Object.fromEntries(Object.entries(out).sort((a, b) => b[1] - a[1]));
}

function dirtyIdentity(row: any) {
  return hasAny(row, "identity") || /tool|skill|module|metadata|fragment|placeholder|section/i.test(clean(row.simulated?.reviewReasons));
}

function dirtyEmployer(row: any) {
  return hasAny(row, "employer") || /company_suspicious|client_company_detected|employer/i.test(clean(row.simulated?.reviewReasons));
}

function moduleConflict(row: any) {
  return includesIssue(row, "module", /mismatch|conflict/i) || /module_mismatch/i.test(clean(row.simulated?.reviewReasons));
}

function dirtyField(row: any) {
  return dirtyIdentity(row) || dirtyEmployer(row) || hasAny(row, "title") || moduleConflict(row);
}

function manualReviewReason(row: any) {
  if (dirtyIdentity(row)) return "fake_or_uncertain_identity";
  if (moduleConflict(row)) return "title_module_mismatch";
  if (includesIssue(row, "employer", /client_project|confidence_low|role_title|location_or_date/)) return "employer_client_project_or_noise_confusion";
  if ((row.simulated?.reviewClassification || "") === "likely_non_sap_or_low_quality") return "non_sap_or_low_quality_suspicion";
  return "";
}

function aiReason(row: any) {
  if (row.requiresAi) return "parser_uncertain_or_quality_gate_failed";
  if (hasAny(row, "title")) return "missing_or_uncertain_title";
  if (hasAny(row, "module")) return "missing_or_uncertain_module";
  if (hasAny(row, "employer")) return "missing_or_uncertain_employer";
  return "";
}

function parserFixReason(row: any) {
  if (row.parserNeedsFix) return "common_parser_fix_candidate";
  if (row.recommendedParserFixes?.length) return row.recommendedParserFixes.join(",");
  return "";
}

function decide(row: any): { action: ExtractionDecisionAction; reasons: string[] } {
  const reasons: string[] = [];
  if (row.requiresOriginalFileReupload) {
    reasons.push("raw_text_requires_original_file_reupload");
    return { action: "requires_original_file_reupload", reasons };
  }

  if (row.keptExistingBecauseSimulatedWorse || (row.existingScore?.searchReady && (row.rawWorseThanExisting || dirtyField(row)))) {
    reasons.push(row.rawWorseThanExisting ? "simulated_extraction_worse_than_existing" : "existing_search_ready_and_simulated_dirty");
    return { action: "keep_existing_record", reasons };
  }

  const simulatedClean = row.simulatedScore?.searchReady && !dirtyField(row) && !row.requiresAi && !row.manualReviewRequired;
  const simulatedBetter = !row.existingScore?.searchReady || row.improved || row.simulatedScore?.score >= (row.existingScore?.score || 0) + 10;
  if (simulatedClean && simulatedBetter) {
    reasons.push("simulated_extraction_clean_and_better");
    return { action: "safe_to_overwrite_later", reasons };
  }

  const reviewReason = manualReviewReason(row);
  if (reviewReason) {
    reasons.push(reviewReason);
    return { action: "requires_manual_review", reasons };
  }

  const queueReason = aiReason(row);
  if (queueReason) {
    reasons.push(queueReason);
    return { action: "send_to_ai_extraction_queue", reasons };
  }

  const fixReason = parserFixReason(row);
  if (fixReason) {
    reasons.push(fixReason);
    return { action: "parser_fix_candidate", reasons };
  }

  reasons.push("not_safe_to_apply_without_review");
  return { action: "requires_manual_review", reasons };
}

function example(row: any) {
  return {
    candidateId: row.candidateId,
    action: row.decisionAction,
    decisionReasons: row.decisionReasons,
    existingName: row.existing?.name,
    simulatedName: row.simulated?.displayName,
    existingSearchReady: row.existingScore?.searchReady,
    simulatedSearchReady: row.simulatedScore?.searchReady,
    existingScore: row.existingScore?.score,
    simulatedScore: row.simulatedScore?.score,
    title: row.simulated?.title,
    currentEmployer: row.simulated?.currentCompany,
    primarySapModule: row.simulated?.primarySapModule,
    blockers: row.blockers,
    fieldIssues: row.fieldIssues,
    recommendedParserFixes: row.recommendedParserFixes || [],
  };
}

export function buildExtractionDecisionLayer(candidates: Record<string, any>[], options: ExtractionDecisionOptions = {}) {
  const fieldQa = auditFieldLevelExtractionQa(candidates, options);
  const rows: any[] = fieldQa.items.map((row: any) => {
    const decision = decide(row);
    const dirtyPrevented = dirtyField(row) && decision.action !== "safe_to_overwrite_later";
    return {
      ...row,
      decisionAction: decision.action,
      decisionReasons: decision.reasons,
      decisionSafeSearchReady: row.existingScore?.searchReady && decision.action === "keep_existing_record" || decision.action === "safe_to_overwrite_later",
      unsafeDowngradePrevented: decision.action === "keep_existing_record" && (row.rawWorseThanExisting || row.keptExistingBecauseSimulatedWorse),
      dirtyFieldPrevented: dirtyPrevented,
      moduleConflictPrevented: moduleConflict(row) && decision.action !== "safe_to_overwrite_later",
      employerNoisePrevented: dirtyEmployer(row) && decision.action !== "safe_to_overwrite_later",
      fakeIdentityPrevented: dirtyIdentity(row) && decision.action !== "safe_to_overwrite_later",
    };
  });

  const count = (predicate: (row: any) => boolean) => rows.filter(predicate).length;
  const actions = rows.map(row => row.decisionAction as ExtractionDecisionAction);
  const summary = {
    totalChecked: rows.length,
    existingSearchReady: count(row => row.existingScore?.searchReady),
    simulatedSearchReady: count(row => row.simulatedScore?.searchReady),
    decisionSafeSearchReady: count(row => row.decisionSafeSearchReady),
    keepExistingRecord: count(row => row.decisionAction === "keep_existing_record"),
    safeToOverwriteLater: count(row => row.decisionAction === "safe_to_overwrite_later"),
    sendToAiExtractionQueue: count(row => row.decisionAction === "send_to_ai_extraction_queue"),
    requiresManualReview: count(row => row.decisionAction === "requires_manual_review"),
    requiresOriginalFileReupload: count(row => row.decisionAction === "requires_original_file_reupload"),
    parserFixCandidate: count(row => row.decisionAction === "parser_fix_candidate"),
    unsafeDowngradePrevented: count(row => row.unsafeDowngradePrevented),
    dirtyFieldPrevented: count(row => row.dirtyFieldPrevented),
    moduleConflictPrevented: count(row => row.moduleConflictPrevented),
    employerNoisePrevented: count(row => row.employerNoisePrevented),
    fakeIdentityPrevented: count(row => row.fakeIdentityPrevented),
  };

  const examples = {
    keepExisting: rows.filter(row => row.decisionAction === "keep_existing_record").slice(0, 30).map(example),
    safeOverwriteLater: rows.filter(row => row.decisionAction === "safe_to_overwrite_later").slice(0, 30).map(example),
    sendToAi: rows.filter(row => row.decisionAction === "send_to_ai_extraction_queue").slice(0, 30).map(example),
    manualReview: rows.filter(row => row.decisionAction === "requires_manual_review").slice(0, 30).map(example),
    reuploadRequired: rows.filter(row => row.decisionAction === "requires_original_file_reupload").slice(0, 30).map(example),
    parserFixCandidates: rows.filter(row => row.decisionAction === "parser_fix_candidate").slice(0, 30).map(example),
    unsafeDowngradePrevented: rows.filter(row => row.unsafeDowngradePrevented).slice(0, 30).map(example),
  };

  return {
    mode: "read-only extraction decision layer; no DB writes; no deletes; no apply; no OpenAI calls",
    options: fieldQa.options,
    source: "existing DB data compared with simulated extraction from existing raw CV/resume text",
    summary,
    distributions: {
      decisionActions: countBy(actions),
      fieldQaRecommendedActions: fieldQa.distributions.recommendedActions,
      parserFixPriority: fieldQa.distributions.parserFixPriority,
    },
    examples,
    items: rows.map(row => ({
      candidateId: row.candidateId,
      decisionAction: row.decisionAction,
      decisionReasons: row.decisionReasons,
      decisionSafeSearchReady: row.decisionSafeSearchReady,
      unsafeDowngradePrevented: row.unsafeDowngradePrevented,
      dirtyFieldPrevented: row.dirtyFieldPrevented,
      moduleConflictPrevented: row.moduleConflictPrevented,
      employerNoisePrevented: row.employerNoisePrevented,
      fakeIdentityPrevented: row.fakeIdentityPrevented,
      existing: row.existing,
      simulated: row.simulated,
      existingScore: row.existingScore,
      simulatedScore: row.simulatedScore,
      fieldIssues: row.fieldIssues,
      blockers: row.blockers,
      rawWorseThanExisting: row.rawWorseThanExisting,
      improved: row.improved,
      parserNeedsFix: row.parserNeedsFix,
      requiresAi: row.requiresAi,
      manualReviewRequired: row.manualReviewRequired,
      requiresOriginalFileReupload: row.requiresOriginalFileReupload,
      recommendedParserFixes: row.recommendedParserFixes,
    })),
  };
}

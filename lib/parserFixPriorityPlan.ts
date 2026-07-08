import { auditFieldLevelExtractionQa, FieldLevelExtractionQaOptions } from "./fieldLevelExtractionQa";

export type ParserFixPriorityOptions = FieldLevelExtractionQaOptions & {
  onlyEmployerIssues?: boolean;
  onlyTitleIssues?: boolean;
  onlyModuleIssues?: boolean;
};

function hasIssues(row: any, field: string) {
  return Array.isArray(row.fieldIssues?.[field]) && row.fieldIssues[field].length > 0;
}

function short(value: any, length = 220) {
  const text = String(Array.isArray(value) ? value.join(", ") : value || "empty").replace(/\s+/g, " ").trim();
  return text.length > length ? `${text.slice(0, length - 3)}...` : text;
}

function count(rows: any[], predicate: (row: any) => boolean) {
  return rows.filter(predicate).length;
}

function countBy(rows: any[], getter: (row: any) => string[]) {
  const out: Record<string, number> = {};
  for (const row of rows) for (const value of getter(row)) if (value) out[value] = (out[value] || 0) + 1;
  return Object.fromEntries(Object.entries(out).sort((a,b)=>b[1]-a[1]));
}

function example(row: any, issueGroup: string) {
  return {
    candidateId: row.candidateId,
    existingName: short(row.existing?.name),
    simulatedName: short(row.simulated?.displayName),
    existingSearchReady: row.existingScore?.searchReady,
    simulatedSearchReady: row.simulatedScore?.searchReady,
    existingScore: row.existingScore?.score,
    simulatedScore: row.simulatedScore?.score,
    title: short(row.simulated?.title),
    currentEmployer: short(row.simulated?.currentCompany),
    primarySapModule: row.simulated?.primarySapModule,
    issues: row.fieldIssues?.[issueGroup] || [],
    blockers: row.blockers,
    recommendedAction: row.recommendedAction,
    recommendedParserFixes: row.recommendedParserFixes || [],
  };
}

function groupExamples(rows: any[], field: string, issue: string) {
  return rows.filter(row => (row.fieldIssues?.[field] || []).includes(issue)).slice(0, 30).map(row => example(row, field));
}

function actionSummary(rows: any[]) {
  return countBy(rows, row => [row.recommendedAction]);
}

export function buildParserFixPriorityPlan(candidates: Record<string, any>[], options: ParserFixPriorityOptions = {}) {
  const fieldQa = auditFieldLevelExtractionQa(candidates, options);
  let rows = fieldQa.items;
  if (options.onlyEmployerIssues) rows = rows.filter(row => hasIssues(row, "employer"));
  if (options.onlyTitleIssues) rows = rows.filter(row => hasIssues(row, "title"));
  if (options.onlyModuleIssues) rows = rows.filter(row => hasIssues(row, "module"));
  if (options.onlyWorseThanExisting) rows = rows.filter(row => row.worseThanExisting);

  const summary = {
    totalChecked: rows.length,
    existingSearchReady: count(rows, row => row.existingScore.searchReady),
    simulatedSearchReady: count(rows, row => row.simulatedScore.searchReady),
    employerParserIssues: count(rows, row => hasIssues(row, "employer")),
    titleParserIssues: count(rows, row => hasIssues(row, "title")),
    moduleParserIssues: count(rows, row => hasIssues(row, "module")),
    rawTextIngestionIssues: count(rows, row => hasIssues(row, "rawText")),
    identityParserIssues: count(rows, row => hasIssues(row, "identity")),
    trueReuploadRequired: count(rows, row => row.requiresOriginalFileReupload),
    safeAiQueueCandidates: count(rows, row => row.requiresAi && !row.requiresOriginalFileReupload),
    unsafeParserDowngradeCandidates: count(rows, row => row.worseThanExisting),
  };

  const recommendedActions = {
    all: actionSummary(rows),
    employer: actionSummary(rows.filter(row => hasIssues(row, "employer"))),
    title: actionSummary(rows.filter(row => hasIssues(row, "title"))),
    module: actionSummary(rows.filter(row => hasIssues(row, "module"))),
    rawText: actionSummary(rows.filter(row => hasIssues(row, "rawText"))),
  };

  const parserFixPriority = countBy(rows, row => row.recommendedParserFixes || []);

  const examples = {
    employer: {
      notDisclosed: groupExamples(rows, "employer", "employer_not_disclosed"),
      locationOrDate: groupExamples(rows, "employer", "employer_is_location_or_date"),
      clientProject: groupExamples(rows, "employer", "employer_is_client_project"),
      roleTitle: groupExamples(rows, "employer", "employer_is_role_title"),
      lowConfidence: groupExamples(rows, "employer", "employer_confidence_low"),
    },
    title: {
      empty: groupExamples(rows, "title", "missing_title"),
      generic: groupExamples(rows, "title", "generic_title"),
      notSapRelevant: groupExamples(rows, "title", "title_not_sap_relevant"),
      containsCompany: groupExamples(rows, "title", "title_contains_company"),
      containsClientProject: groupExamples(rows, "title", "title_contains_client_project"),
    },
    module: {
      missingPrimaryModule: groupExamples(rows, "module", "missing_primary_module"),
      mismatchWithTitle: groupExamples(rows, "module", "module_mismatch_with_title"),
      mismatchWithEvidence: groupExamples(rows, "module", "module_mismatch_with_evidence"),
      unknownButSapEvidenceExists: groupExamples(rows, "module", "module_unknown_but_sap_evidence_exists"),
    },
    rawText: {
      missingHeader: groupExamples(rows, "rawText", "raw_text_missing_header"),
      ocrGarbled: groupExamples(rows, "rawText", "raw_text_ocr_garbled"),
      unrelatedDocument: groupExamples(rows, "rawText", "raw_text_unrelated_document"),
      trueOriginalFileReuploadRequired: rows.filter(row => row.requiresOriginalFileReupload).slice(0, 30).map(row => example(row, "rawText")),
    },
    unsafeParserDowngradeCandidates: rows.filter(row => row.worseThanExisting).slice(0, 30).map(row => example(row, "rawText")),
    safeAiQueueCandidates: rows.filter(row => row.requiresAi && !row.requiresOriginalFileReupload).slice(0, 30).map(row => example(row, "rawText")),
  };

  return {
    mode: "read-only parser fix priority plan; no DB writes; no deletes; no apply; no OpenAI calls",
    options: { ...fieldQa.options, onlyEmployerIssues: Boolean(options.onlyEmployerIssues), onlyTitleIssues: Boolean(options.onlyTitleIssues), onlyModuleIssues: Boolean(options.onlyModuleIssues), onlyWorseThanExisting: Boolean(options.onlyWorseThanExisting) },
    summary,
    parserFixPriority,
    recommendedActions,
    fieldIssueBreakdown: fieldQa.distributions,
    examples,
    items: rows,
  };
}

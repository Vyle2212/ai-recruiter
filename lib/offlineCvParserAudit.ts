import { createHash } from "node:crypto";
import { prepareCandidateCv } from "./candidateCvIngestion";
import { CvSourceError } from "./cvPdfOcr";
import type { CandidateExtractionSection } from "./candidateExtractionCoverage";
import {
  isValidEmploymentEntry,
  isValidProjectEntry,
} from "./candidateProfileIngestion";
import { productionEmploymentGapQueue } from "./productionEmploymentProjectionAudit";

const REQUIRED_FIELDS = new Set([
  "display_name",
  "contact",
  "email",
  "phone",
  "location",
  "current_title",
  "current_employer",
  "current_role",
  "skills",
  "employment_history",
  "project_history",
  "education",
  "languages",
  "sap_module",
]);

const EMPLOYMENT_GAP_QUEUES = [
  "short-or-missing-source",
  "headed-table-needs-layout-review",
  "explicit-employer-label-needs-field-review",
  "near-heading-date-needs-boundary-review",
  "project-or-client-heavy-needs-employment-evidence",
  "other-narrative-or-layout-review",
] as const;

type EmploymentGapQueue = (typeof EMPLOYMENT_GAP_QUEUES)[number];

export type OfflineCvAudit = {
  artifact: "offline_cv_parser_audit_v3";
  targetCommitSha: string;
  collectionFingerprint: string;
  files: number;
  uniqueFiles: number;
  duplicateFiles: number;
  sourceFormats: {
    pdf: number;
    docx: number;
    txt: number;
    doc: number;
    rtf: number;
  };
  unsupportedLegacyFiles: number;
  completeForValidation: number;
  needsReview: number;
  classificationReview: number;
  classificationByType: { NON_SAP_CV: number; JD: number; UNKNOWN: number };
  qualityRejected: number;
  ocrRequired: number;
  employmentLayoutUnresolved: number;
  sourceFailures: number;
  employmentRows: number;
  projectRows: number;
  missingRequiredFields: Record<string, number>;
  missedObservedSections: Partial<Record<CandidateExtractionSection, number>>;
  employmentGapQueues: Record<EmploymentGapQueue, number>;
  privacy: {
    filenamesSerialized: 0;
    candidateIdentifiersSerialized: 0;
    sourceExcerptsSerialized: 0;
    contactFieldsSerialized: 0;
    fileDigestsSerialized: 0;
  };
  databaseWrites: 0;
  readyForBulkUpload: false;
};

export type OfflineCvAuditComparison = {
  artifact: "offline_cv_parser_audit_comparison_v1";
  samePopulation: boolean;
  before: { uniqueFiles: number; employmentGapSources: number };
  after: { uniqueFiles: number; employmentGapSources: number };
  delta: {
    completeForValidation: number;
    needsReview: number;
    employmentGapSources: number;
    sourceFailures: number;
  };
  readyForBulkUpload: false;
};

function recordCount(
  candidate: Record<string, unknown>,
  aliases: string[],
  valid: (item: unknown) => boolean,
) {
  const count = (value: unknown) => {
    if (Array.isArray(value)) return value.filter(valid).length;
    if (typeof value !== "string") return 0;
    try {
      const parsed: unknown = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter(valid).length : 0;
    } catch {
      return 0;
    }
  };
  return Math.max(0, ...aliases.map((alias) => count(candidate[alias])));
}

function zeroGapQueues(): Record<EmploymentGapQueue, number> {
  return Object.fromEntries(
    EMPLOYMENT_GAP_QUEUES.map((queue) => [queue, 0]),
  ) as Record<EmploymentGapQueue, number>;
}

function sourceFormat(
  fileName: string,
): keyof OfflineCvAudit["sourceFormats"] | null {
  const extension = fileName.toLowerCase().split(".").pop();
  return extension === "pdf" ||
    extension === "docx" ||
    extension === "txt" ||
    extension === "doc" ||
    extension === "rtf"
    ? extension
    : null;
}

/** Private aggregate only. Never return filenames, hashes, source text or
 * parser errors: those may contain candidate data. This audit has no writes.
 */
export function createOfflineCvAudit(
  options: { targetCommitSha?: string } = {},
) {
  const hashes = new Set<string>();
  const report: OfflineCvAudit = {
    artifact: "offline_cv_parser_audit_v3",
    targetCommitSha: options.targetCommitSha || "",
    collectionFingerprint: createHash("sha256")
      .update("[]", "utf8")
      .digest("hex"),
    files: 0,
    uniqueFiles: 0,
    duplicateFiles: 0,
    sourceFormats: { pdf: 0, docx: 0, txt: 0, doc: 0, rtf: 0 },
    unsupportedLegacyFiles: 0,
    completeForValidation: 0,
    needsReview: 0,
    classificationReview: 0,
    classificationByType: { NON_SAP_CV: 0, JD: 0, UNKNOWN: 0 },
    qualityRejected: 0,
    ocrRequired: 0,
    employmentLayoutUnresolved: 0,
    sourceFailures: 0,
    employmentRows: 0,
    projectRows: 0,
    missingRequiredFields: {},
    missedObservedSections: {},
    employmentGapQueues: zeroGapQueues(),
    privacy: {
      filenamesSerialized: 0,
      candidateIdentifiersSerialized: 0,
      sourceExcerptsSerialized: 0,
      contactFieldsSerialized: 0,
      fileDigestsSerialized: 0,
    },
    databaseWrites: 0,
    readyForBulkUpload: false,
  };
  const increment = (counts: Record<string, number>, value: string) => {
    counts[value] = (counts[value] || 0) + 1;
  };
  return {
    report,
    async process(buffer: Buffer, fileName: string, allowOcr = false) {
      report.files++;
      const hash = createHash("sha256").update(buffer).digest("hex");
      if (hashes.has(hash)) {
        report.duplicateFiles++;
        return;
      }
      hashes.add(hash);
      report.uniqueFiles++;
      const format = sourceFormat(fileName);
      if (format) report.sourceFormats[format]++;
      report.collectionFingerprint = createHash("sha256")
        .update(JSON.stringify([...hashes].sort()), "utf8")
        .digest("hex");
      try {
        const prepared = await prepareCandidateCv({
          buffer,
          fileName,
          source: "admin_upload",
          // Offline inspection must never send a private PDF to Vision by
          // accident. An explicit operator choice enables the real OCR path.
          pdfOcr: allowOcr
            ? undefined
            : async (_buffer, _pages, _requiredPages, reason) => {
                throw new CvSourceError(
                  reason === "PDF_EMPLOYMENT_UNRESOLVED"
                    ? "OFFLINE_EMPLOYMENT_UNRESOLVED"
                    : "OFFLINE_OCR_REQUIRED",
                  "PDF requires supervised fallback for offline audit",
                );
              },
        });
        if (!prepared.accepted) {
          if (prepared.rejectionType === "resume_quality")
            report.qualityRejected++;
          else {
            report.classificationReview++;
            if (prepared.recordType in report.classificationByType)
              report.classificationByType[
                prepared.recordType as keyof typeof report.classificationByType
              ]++;
          }
        } else if (
          prepared.extractionCoverage.status === "complete_for_validation" &&
          !prepared.parserQuality.needsManualReview
        ) {
          report.completeForValidation++;
        } else {
          report.needsReview++;
        }
        if (prepared.accepted) {
          const candidate = prepared.candidatePayload as Record<
            string,
            unknown
          >;
          const employmentRows = recordCount(
            candidate,
            [
              "experience",
              "employment",
              "employment_history",
              "employmentHistory",
            ],
            isValidEmploymentEntry,
          );
          report.employmentRows += employmentRows;
          report.projectRows += recordCount(
            candidate,
            ["projects", "project_history", "projectHistory"],
            isValidProjectEntry,
          );
          if (!employmentRows)
            report.employmentGapQueues[
              productionEmploymentGapQueue(prepared.rawText)
            ]++;
        }
        for (const field of prepared.extractionCoverage
          ?.missingRequiredFields || [])
          increment(
            report.missingRequiredFields,
            REQUIRED_FIELDS.has(field) ? field : "other",
          );
        for (const section of prepared.extractionCoverage
          ?.missedObservedSections || [])
          increment(report.missedObservedSections, section);
      } catch (error) {
        if (
          error instanceof CvSourceError &&
          error.code === "OFFLINE_OCR_REQUIRED"
        )
          report.ocrRequired++;
        else if (
          error instanceof CvSourceError &&
          error.code === "OFFLINE_EMPLOYMENT_UNRESOLVED"
        )
          report.employmentLayoutUnresolved++;
        else report.sourceFailures++;
      }
    },
  };
}

const gapSources = (report: OfflineCvAudit) =>
  Object.values(report.employmentGapQueues).reduce(
    (total, count) => total + count,
    0,
  );

export function compareOfflineCvAudits(
  before: OfflineCvAudit,
  after: OfflineCvAudit,
): OfflineCvAuditComparison {
  const beforeGaps = gapSources(before);
  const afterGaps = gapSources(after);
  return {
    artifact: "offline_cv_parser_audit_comparison_v1",
    samePopulation:
      before.files === after.files &&
      before.uniqueFiles === after.uniqueFiles &&
      before.collectionFingerprint === after.collectionFingerprint,
    before: {
      uniqueFiles: before.uniqueFiles,
      employmentGapSources: beforeGaps,
    },
    after: {
      uniqueFiles: after.uniqueFiles,
      employmentGapSources: afterGaps,
    },
    delta: {
      completeForValidation:
        after.completeForValidation - before.completeForValidation,
      needsReview: after.needsReview - before.needsReview,
      employmentGapSources: afterGaps - beforeGaps,
      sourceFailures: after.sourceFailures - before.sourceFailures,
    },
    readyForBulkUpload: false,
  };
}

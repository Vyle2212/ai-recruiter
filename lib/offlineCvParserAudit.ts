import { createHash } from "node:crypto";
import { prepareCandidateCv } from "./candidateCvIngestion";
import { CvSourceError } from "./cvPdfOcr";
import type { CandidateExtractionSection } from "./candidateExtractionCoverage";

export type OfflineCvAudit = {
  files: number;
  uniqueFiles: number;
  duplicateFiles: number;
  completeForValidation: number;
  needsReview: number;
  classificationReview: number;
  qualityRejected: number;
  ocrRequired: number;
  sourceFailures: number;
  missingRequiredFields: Record<string, number>;
  missedObservedSections: Partial<Record<CandidateExtractionSection, number>>;
  readyForBulkUpload: false;
};

/** Private aggregate only. Never return filenames, hashes, source text or
 * parser errors: those may contain candidate data. This audit has no writes.
 */
export function createOfflineCvAudit() {
  const hashes = new Set<string>();
  const report: OfflineCvAudit = {
    files: 0,
    uniqueFiles: 0,
    duplicateFiles: 0,
    completeForValidation: 0,
    needsReview: 0,
    classificationReview: 0,
    qualityRejected: 0,
    ocrRequired: 0,
    sourceFailures: 0,
    missingRequiredFields: {},
    missedObservedSections: {},
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
      try {
        const prepared = await prepareCandidateCv({
          buffer,
          fileName,
          source: "admin_upload",
          // Offline inspection must never send a private PDF to Vision by
          // accident. An explicit operator choice enables the real OCR path.
          pdfOcr: allowOcr
            ? undefined
            : async () => {
                throw new CvSourceError(
                  "OFFLINE_OCR_REQUIRED",
                  "OCR required for offline audit",
                );
              },
        });
        if (!prepared.accepted) {
          if (prepared.rejectionType === "resume_quality")
            report.qualityRejected++;
          else report.classificationReview++;
        } else if (
          prepared.extractionCoverage.status === "complete_for_validation" &&
          !prepared.parserQuality.needsManualReview
        ) {
          report.completeForValidation++;
        } else {
          report.needsReview++;
        }
        for (const field of prepared.extractionCoverage
          ?.missingRequiredFields || [])
          increment(report.missingRequiredFields, field);
        for (const section of prepared.extractionCoverage
          ?.missedObservedSections || [])
          increment(report.missedObservedSections, section);
      } catch (error) {
        if (
          error instanceof CvSourceError &&
          error.code === "OFFLINE_OCR_REQUIRED"
        )
          report.ocrRequired++;
        else report.sourceFailures++;
      }
    },
  };
}

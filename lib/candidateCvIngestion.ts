import { parseCv } from "./cv-parser";
import type { CvSourceExtraction } from "./cvPdfExtraction";
import {
  classifyCandidateText,
  normalizeCandidatePayloadForSapUpload,
} from "./candidateFileGuards";
import {
  evaluateCandidateExtractionCoverage,
  type CandidateExtractionCoverage,
} from "./candidateExtractionCoverage";
import { enrichCandidateUpload } from "./candidateUploadEnrichment";
import { evaluateResumeQualityGate } from "./resumeQualityGate";
import { enrichCandidateWithSapTaxonomy } from "./sapTalentTaxonomy";

export type CandidateCvIngestionSource = "admin_upload" | "candidate_upload";

type CandidateClassification = ReturnType<typeof classifyCandidateText>;
export type CandidateCvParserQuality = ReturnType<
  typeof evaluateResumeQualityGate
>;

export type PreparedCandidateCv = {
  accepted: true;
  rawText: string;
  sourceExtraction: CvSourceExtraction;
  classification: CandidateClassification;
  candidatePayload: Record<string, any>;
  parserQuality: CandidateCvParserQuality;
  extractionCoverage: CandidateExtractionCoverage;
};

export type RejectedCandidateCv = {
  accepted: false;
  rejectionType: "non_sap_or_non_cv" | "resume_quality";
  recordType: string;
  reason: string;
  signals: string[];
  sourceExtraction: CvSourceExtraction;
  parserQuality?: CandidateCvParserQuality;
  extractionCoverage?: CandidateExtractionCoverage;
};

/**
 * The single source-to-structured-profile pipeline for every CV origin.
 * Authorization, ownership, archiving and persistence stay in their route/
 * repository boundaries; extraction and SAP classification must not diverge.
 */
export async function prepareCandidateCv(input: {
  buffer: Buffer;
  fileName: string;
  source: CandidateCvIngestionSource;
}): Promise<PreparedCandidateCv | RejectedCandidateCv> {
  const parsed = await parseCv(input.buffer, input.fileName);
  const rawText = typeof parsed.rawText === "string" ? parsed.rawText : "";
  const classification = classifyCandidateText(rawText, input.fileName);

  if (!classification.shouldSave) {
    return {
      accepted: false,
      rejectionType: "non_sap_or_non_cv",
      recordType: classification.recordType,
      reason: classification.reason,
      signals: classification.signals,
      sourceExtraction: parsed.sourceExtraction,
    };
  }

  const normalizedParsed = normalizeCandidatePayloadForSapUpload(
    {
      ...parsed,
      raw_text: rawText,
      resume_text: rawText,
      raw_cv: rawText,
      source_file: input.fileName,
      file_name: input.fileName,
    },
    rawText,
  );
  const baseCandidatePayload = enrichCandidateWithSapTaxonomy({
    ...normalizedParsed,
    file_classification: classification,
    record_type: "SAP_CV",
    is_sap_profile: true,
    source_file: input.fileName,
    file_name: input.fileName,
  });
  const candidatePayload = enrichCandidateUpload(baseCandidatePayload, rawText);
  const extractionCoverage = evaluateCandidateExtractionCoverage(
    rawText,
    candidatePayload,
  );
  const parserQuality = evaluateResumeQualityGate(candidatePayload);

  if (parserQuality.rejected) {
    const reason =
      parserQuality.rejectionReasons.join(", ") ||
      "Rejected by Resume Quality Gate.";
    return {
      accepted: false,
      rejectionType: "resume_quality",
      recordType: "REJECTED_RESUME_QUALITY",
      reason,
      signals: [...parserQuality.rejectionReasons, ...parserQuality.warnings],
      sourceExtraction: parsed.sourceExtraction,
      parserQuality,
      extractionCoverage,
    };
  }

  return {
    accepted: true,
    rawText,
    sourceExtraction: parsed.sourceExtraction,
    classification,
    candidatePayload: {
      ...candidatePayload,
      parser_quality: parserQuality,
      extraction_coverage: extractionCoverage,
      extraction_coverage_status: extractionCoverage.status,
      extraction_missing_sections: extractionCoverage.missedObservedSections,
      profile_source_type: input.source,
      profile_quality_score: parserQuality.parserQualityScore,
      name_review_required:
        parserQuality.needsManualReview ||
        extractionCoverage.missingRequiredFields.includes("display_name"),
    },
    parserQuality,
    extractionCoverage,
  };
}

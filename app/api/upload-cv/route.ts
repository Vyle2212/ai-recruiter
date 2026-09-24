import { NextRequest, NextResponse } from "next/server";
import { parseCv } from "@/lib/cv-parser";
import { CvSourceError } from "@/lib/cvPdfOcr";
import type { CvSourceExtraction } from "@/lib/cvPdfExtraction";
import { saveCandidate } from "@/lib/saveCandidate";
import { enrichCandidateWithSapTaxonomy } from "@/lib/sapTalentTaxonomy";
import {
  classifyCandidateText,
  normalizeCandidatePayloadForSapUpload,
} from "@/lib/candidateFileGuards";
import {
  evaluateResumeQualityGate,
  summarizeImportResults,
} from "@/lib/resumeQualityGate";
import {
  archiveOriginalCv,
  discardUnlinkedOriginalCv,
} from "@/lib/originalCvArchive";
import { commitCandidateWithArchivedCv } from "@/lib/originalCvArchiveCommit";
import {
  evaluateCandidateExtractionCoverage,
  type CandidateExtractionCoverage,
} from "@/lib/candidateExtractionCoverage";
import { enrichCandidateUpload } from "@/lib/candidateUploadEnrichment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UploadResult = {
  fileName: string;
  ok: boolean;
  candidate?: any;
  error?: string;
  errorCode?: string;
  sourceExtraction?: CvSourceExtraction;
  rejected?: boolean;
  reason?: string;
  recordType?: string;
  signals?: string[];
  parserQuality?: ReturnType<typeof evaluateResumeQualityGate>;
  extractionCoverage?: CandidateExtractionCoverage;
  ingestionAction?:
    | "create_new"
    | "update_existing"
    | "hold_for_identity_review";
};

function isSupportedFile(fileName: string) {
  return /\.(pdf|docx|txt)$/i.test(fileName || "");
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const filesFromBulk = formData
      .getAll("files")
      .filter((item): item is File => item instanceof File);

    const singleFile = formData.get("file");
    const filesFromSingle = singleFile instanceof File ? [singleFile] : [];

    const files = filesFromBulk.length > 0 ? filesFromBulk : filesFromSingle;

    if (!files.length) {
      return NextResponse.json(
        { success: false, error: "No CV files uploaded." },
        { status: 400 },
      );
    }

    const results: UploadResult[] = [];

    for (const file of files) {
      const fileName = file.name || "unknown-file";

      try {
        if (!isSupportedFile(fileName)) {
          results.push({
            fileName,
            ok: false,
            rejected: true,
            error: "Unsupported file type. Please upload PDF, DOCX, or TXT.",
          });
          continue;
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const parsed = await parseCv(buffer, fileName);
        const rawText =
          typeof parsed.rawText === "string" ? parsed.rawText : "";

        const classification = classifyCandidateText(rawText, fileName);

        if (!classification.shouldSave) {
          results.push({
            fileName,
            ok: false,
            rejected: true,
            recordType: classification.recordType,
            reason: classification.reason,
            signals: classification.signals,
            error: classification.reason,
          });
          continue;
        }

        const normalizedParsed = normalizeCandidatePayloadForSapUpload(
          {
            ...parsed,
            raw_text: rawText,
            resume_text: rawText,
            raw_cv: rawText,
            source_file: fileName,
            file_name: fileName,
          },
          rawText,
        );

        const baseCandidatePayload = enrichCandidateWithSapTaxonomy({
          ...normalizedParsed,
          file_classification: classification,
          record_type: "SAP_CV",
          is_sap_profile: true,
          source_file: fileName,
          file_name: fileName,
        });
        const candidatePayload = enrichCandidateUpload(
          baseCandidatePayload,
          rawText,
        );
        const extractionCoverage = evaluateCandidateExtractionCoverage(
          rawText,
          candidatePayload,
        );

        const parserQuality = evaluateResumeQualityGate(candidatePayload);

        if (parserQuality.rejected) {
          results.push({
            fileName,
            ok: false,
            rejected: true,
            recordType: "REJECTED_RESUME_QUALITY",
            reason:
              parserQuality.rejectionReasons.join(", ") ||
              "Rejected by Resume Quality Gate.",
            signals: [
              ...parserQuality.rejectionReasons,
              ...parserQuality.warnings,
            ],
            parserQuality,
            extractionCoverage,
            error:
              parserQuality.rejectionReasons.join(", ") ||
              "Rejected by Resume Quality Gate.",
          });
          continue;
        }

        // Preserve the actual document before committing its parsed text. A
        // missing private bucket fails closed, so a new CV cannot silently
        // become another flattened, non-recoverable source.
        const saved = await commitCandidateWithArchivedCv(
          () => archiveOriginalCv(fileName, buffer),
          (archivedCvReference) =>
            saveCandidate({
              ...candidatePayload,
              archivedCvReference,
              parser_quality: parserQuality,
              extraction_coverage: extractionCoverage,
              extraction_coverage_status: extractionCoverage.status,
              extraction_missing_sections:
                extractionCoverage.missedObservedSections,
              profile_source_type: "admin_upload",
              profile_quality_score: parserQuality.parserQualityScore,
              name_review_required:
                parserQuality.needsManualReview ||
                extractionCoverage.missingRequiredFields.includes(
                  "display_name",
                ),
            }),
          discardUnlinkedOriginalCv,
        );

        if (
          saved?.skipped ||
          saved?.rejected_noise ||
          String(saved?.status || "").toLowerCase() === "rejected_noise"
        ) {
          results.push({
            fileName,
            ok: false,
            rejected: true,
            recordType: "REJECTED_NOISE",
            reason: Array.isArray(saved?.extraction_notes)
              ? saved.extraction_notes.join(", ")
              : "Rejected by recruiter-grade save gate.",
            signals: Array.isArray(saved?.extraction_notes)
              ? saved.extraction_notes
              : [],
            error: Array.isArray(saved?.extraction_notes)
              ? saved.extraction_notes.join(", ")
              : "Rejected by recruiter-grade save gate.",
          });
          continue;
        }

        if (saved?.ingestion_action === "hold_for_identity_review") {
          results.push({
            fileName,
            ok: true,
            recordType: "IDENTITY_REVIEW_REQUIRED",
            reason:
              "The CV was preserved privately, but no candidate row was created or overwritten because identity evidence matched more than one profile.",
            signals: Array.isArray(saved?.ingestion_reasons)
              ? saved.ingestion_reasons
              : [],
            ingestionAction: "hold_for_identity_review",
            candidate: {
              status: saved.status,
              competingCandidateCount: saved.competing_candidate_count,
            },
            sourceExtraction: parsed.sourceExtraction,
            extractionCoverage,
          });
          continue;
        }

        results.push({
          fileName,
          ok: true,
          recordType:
            extractionCoverage.status === "complete_for_validation"
              ? "SAP_CV"
              : "SAP_CV_INCOMPLETE_REVIEW",
          reason: classification.reason,
          candidate: saved,
          ingestionAction: saved?.ingestion_action,
          sourceExtraction: parsed.sourceExtraction,
          extractionCoverage,
        });
      } catch (error: any) {
        if (error instanceof CvSourceError) {
          results.push({
            fileName,
            ok: false,
            recordType: "SOURCE_REVIEW_REQUIRED",
            errorCode: error.code,
            error: error.message,
            reason: error.message,
            signals: [error.code],
          });
          continue;
        }
        console.error("Upload CV failed:", error);

        const message = error?.message || "Failed to parse/save CV.";
        const rejectedByGate =
          String(error?.code || "").startsWith("REJECTED_") ||
          /^REJECTED_/i.test(message);

        results.push({
          fileName,
          ok: false,
          rejected: rejectedByGate,
          recordType: rejectedByGate ? "REJECTED_NOISE" : undefined,
          reason: rejectedByGate ? message : undefined,
          error: message,
        });
      }
    }

    const successCount = results.filter((r) => r.ok).length;
    const rejectedCount = results.filter((r) => r.rejected).length;
    const createdCount = results.filter(
      (r) => r.ingestionAction === "create_new",
    ).length;
    const updatedCount = results.filter(
      (r) => r.ingestionAction === "update_existing",
    ).length;
    const heldForReviewCount = results.filter(
      (r) => r.ingestionAction === "hold_for_identity_review",
    ).length;
    const incompleteExtractionCount = results.filter(
      (r) => r.extractionCoverage?.status === "incomplete_needs_review",
    ).length;
    const failCount = results.length - successCount;

    return NextResponse.json({
      success: successCount > 0 && failCount === 0,
      partialSuccess: successCount > 0 && failCount > 0,
      total: results.length,
      successCount,
      rejectedCount,
      createdCount,
      updatedCount,
      heldForReviewCount,
      incompleteExtractionCount,
      failCount,
      results,
    });
  } catch (error: any) {
    console.error("Bulk upload CV API error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Upload CV failed.",
      },
      { status: 500 },
    );
  }
}

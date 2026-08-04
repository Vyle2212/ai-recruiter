import { NextRequest, NextResponse } from "next/server";
import { parseCv } from "@/lib/cv-parser";
import { saveCandidate } from "@/lib/saveCandidate";
import { enrichCandidateWithSapTaxonomy } from "@/lib/sapTalentTaxonomy";
import {
  classifyCandidateText,
  normalizeCandidatePayloadForSapUpload,
} from "@/lib/candidateFileGuards";
import { evaluateResumeQualityGate, summarizeImportResults } from "@/lib/resumeQualityGate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UploadResult = {
  fileName: string;
  ok: boolean;
  candidate?: any;
  error?: string;
  rejected?: boolean;
  reason?: string;
  recordType?: string;
  signals?: string[];
  parserQuality?: ReturnType<typeof evaluateResumeQualityGate>;
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
        { status: 400 }
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
        const rawText = typeof parsed.rawText === "string" ? parsed.rawText : "";

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
          rawText
        );

        const candidatePayload = enrichCandidateWithSapTaxonomy({
          ...normalizedParsed,
          file_classification: classification,
          record_type: "SAP_CV",
          is_sap_profile: true,
          source_file: fileName,
          file_name: fileName,
        });

        const parserQuality = evaluateResumeQualityGate(candidatePayload);

        if (parserQuality.rejected) {
          results.push({
            fileName,
            ok: false,
            rejected: true,
            recordType: "REJECTED_RESUME_QUALITY",
            reason: parserQuality.rejectionReasons.join(", ") || "Rejected by Resume Quality Gate.",
            signals: [...parserQuality.rejectionReasons, ...parserQuality.warnings],
            parserQuality,
            error: parserQuality.rejectionReasons.join(", ") || "Rejected by Resume Quality Gate.",
          });
          continue;
        }

        const saved = await saveCandidate({ ...candidatePayload, parser_quality: parserQuality, profile_quality_score: parserQuality.parserQualityScore, name_review_required: parserQuality.needsManualReview });

        if (saved?.skipped || saved?.rejected_noise || String(saved?.status || "").toLowerCase() === "rejected_noise") {
          results.push({
            fileName,
            ok: false,
            rejected: true,
            recordType: "REJECTED_NOISE",
            reason: Array.isArray(saved?.extraction_notes) ? saved.extraction_notes.join(", ") : "Rejected by recruiter-grade save gate.",
            signals: Array.isArray(saved?.extraction_notes) ? saved.extraction_notes : [],
            error: Array.isArray(saved?.extraction_notes) ? saved.extraction_notes.join(", ") : "Rejected by recruiter-grade save gate.",
          });
          continue;
        }

        results.push({
          fileName,
          ok: true,
          recordType: "SAP_CV",
          reason: classification.reason,
          candidate: saved,
        });
      } catch (error: any) {
        console.error(`Upload CV failed for ${fileName}:`, error);

        const message = error?.message || "Failed to parse/save CV.";
        const rejectedByGate = String(error?.code || "").startsWith("REJECTED_") || /^REJECTED_/i.test(message);

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
    const failCount = results.length - successCount;

    return NextResponse.json({
      success: successCount > 0 && failCount === 0,
      partialSuccess: successCount > 0 && failCount > 0,
      total: results.length,
      successCount,
      rejectedCount,
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
      { status: 500 }
    );
  }
}




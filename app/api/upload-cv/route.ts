import { NextRequest, NextResponse } from "next/server";
import { CvSourceError } from "@/lib/cvPdfOcr";
import type { CvSourceExtraction } from "@/lib/cvPdfExtraction";
import { saveCandidate } from "@/lib/saveCandidate";
import { summarizeImportResults } from "@/lib/resumeQualityGate";
import { archiveOriginalCv } from "@/lib/originalCvArchive";
import { commitCandidateWithArchivedCv } from "@/lib/originalCvArchiveCommit";
import type { CandidateExtractionCoverage } from "@/lib/candidateExtractionCoverage";
import {
  candidateCvRejectedOriginalPolicy,
  prepareCandidateCv,
  type CandidateCvParserQuality,
} from "@/lib/candidateCvIngestion";
import { recordCandidateUploadReview } from "@/lib/candidateUploadReviewQueue";
import { requireRecruiterApiRouteAuthorization } from "@/lib/recruiterApiAuthorization";
import { supabase } from "@/lib/supabase";
import {
  MAX_ORIGINAL_BYTES,
  ORIGINAL_CV_BUCKET,
  originalCvObjectKey,
  ownedOriginalCvObjectKey,
} from "@/lib/originalCvArchiveKey";
import {
  cvContentDigestMatches,
  normalizeCvContentDigest,
} from "@/lib/serverCvContentDigest";

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
  parserQuality?: CandidateCvParserQuality;
  extractionCoverage?: CandidateExtractionCoverage;
  ingestionAction?:
    | "create_new"
    | "update_existing"
    | "hold_for_identity_review"
    | "already_processed";
};

function isSupportedFile(fileName: string) {
  return /\.(pdf|docx|txt)$/i.test(fileName || "");
}

export async function POST(req: NextRequest) {
  const authorization = await requireRecruiterApiRouteAuthorization({
    request: req,
  });
  if (!authorization.allowed) return authorization.response;

  try {
    let files: Array<{
      fileName: string;
      buffer: Buffer;
      archivedObjectKey?: string;
    }>;
    if (req.headers.get("content-type")?.startsWith("application/json")) {
      // The browser uploads the bytes straight to a private Storage bucket;
      // this small request parses only an object owned by the signed-in admin.
      let input: {
        fileName?: unknown;
        objectKey?: unknown;
        size?: unknown;
        contentDigest?: unknown;
      };
      try {
        input = await req.json();
      } catch {
        return NextResponse.json(
          { success: false, error: "Invalid upload request." },
          { status: 400 },
        );
      }
      const objectKey =
        typeof input.objectKey === "string" ? input.objectKey : "";
      const fileName = typeof input.fileName === "string" ? input.fileName : "";
      const contentDigest = normalizeCvContentDigest(input.contentDigest);
      if (
        !contentDigest ||
        !ownedOriginalCvObjectKey(authorization.scope.subjectId, objectKey) ||
        !isSupportedFile(fileName) ||
        !Number.isSafeInteger(input.size) ||
        Number(input.size) < 1 ||
        Number(input.size) > MAX_ORIGINAL_BYTES ||
        objectKey.split(".").at(-1)?.toLowerCase() !==
          fileName.split(".").at(-1)?.toLowerCase()
      ) {
        return NextResponse.json(
          { success: false, error: "Invalid CV reference." },
          { status: 400 },
        );
      }
      const { data, error } = await supabase.storage
        .from(ORIGINAL_CV_BUCKET)
        .download(objectKey);
      if (error || !data) {
        return NextResponse.json(
          {
            success: false,
            error: "Original CV was not found in private storage.",
          },
          { status: 404 },
        );
      }
      const buffer = Buffer.from(await data.arrayBuffer());
      if (buffer.length !== input.size || buffer.length > MAX_ORIGINAL_BYTES) {
        return NextResponse.json(
          {
            success: false,
            error: "Uploaded CV size does not match the request.",
          },
          { status: 400 },
        );
      }
      if (!cvContentDigestMatches(buffer, contentDigest)) {
        try {
          await recordCandidateUploadReview({
            objectKey,
            fileName,
            actorUserId: authorization.scope.subjectId,
            reasonCodes: ["content_digest_mismatch"],
          });
        } catch {
          return NextResponse.json(
            {
              success: false,
              error: "CV integrity review queue is unavailable.",
            },
            { status: 503 },
          );
        }
        return NextResponse.json(
          {
            success: false,
            error:
              "Uploaded CV content changed after selection and was preserved for review.",
          },
          { status: 409 },
        );
      }
      const reference = `${ORIGINAL_CV_BUCKET}/${objectKey}`;
      const processed = await supabase
        .from("candidates")
        .select("id,name,current_title,primary_module")
        .eq("source_file", reference)
        .limit(2);
      if (processed.error || (processed.data?.length || 0) > 1) {
        return NextResponse.json(
          { success: false, error: "CV upload readback needs review." },
          { status: 409 },
        );
      }
      if (processed.data?.length === 1) {
        return NextResponse.json(
          {
            success: true,
            total: 1,
            successCount: 1,
            failCount: 0,
            createdCount: 0,
            updatedCount: 0,
            heldForReviewCount: 0,
            incompleteExtractionCount: 0,
            results: [
              {
                fileName,
                ok: true,
                ingestionAction: "already_processed",
                candidate: processed.data[0],
              },
            ],
          },
          { headers: { "Cache-Control": "private, no-store" } },
        );
      }
      files = [
        {
          fileName,
          buffer,
          archivedObjectKey: objectKey,
        },
      ];
    } else {
      const formData = await req.formData();
      const filesFromBulk = formData
        .getAll("files")
        .filter((item): item is File => item instanceof File);
      const singleFile = formData.get("file");
      const selected = filesFromBulk.length
        ? filesFromBulk
        : singleFile instanceof File
          ? [singleFile]
          : [];
      files = await Promise.all(
        selected.map(async (file) => ({
          fileName: file.name || "unknown-file",
          buffer: Buffer.from(await file.arrayBuffer()),
        })),
      );
    }

    if (!files.length) {
      return NextResponse.json(
        { success: false, error: "No CV files uploaded." },
        { status: 400 },
      );
    }

    const results: UploadResult[] = [];

    for (const file of files) {
      const { fileName, buffer, archivedObjectKey } = file;
      let reviewObjectKey = archivedObjectKey;

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

        originalCvObjectKey(fileName, buffer);

        const prepared = await prepareCandidateCv({
          buffer,
          fileName,
          source: "admin_upload",
        });

        if (!prepared.accepted) {
          const originalPolicy = candidateCvRejectedOriginalPolicy(
            prepared.rejectionType,
          );
          if (!reviewObjectKey)
            reviewObjectKey = (await archiveOriginalCv(fileName, buffer))
              .objectKey;
          await recordCandidateUploadReview({
            objectKey: reviewObjectKey,
            fileName,
            actorUserId: authorization.scope.subjectId,
            reasonCodes: originalPolicy.reasonCodes,
          });
          results.push({
            fileName,
            ok: false,
            rejected: true,
            recordType: prepared.recordType,
            reason: prepared.reason,
            signals: prepared.signals,
            parserQuality: prepared.parserQuality,
            extractionCoverage: prepared.extractionCoverage,
            sourceExtraction: prepared.sourceExtraction,
            error: prepared.reason,
          });
          continue;
        }
        const {
          candidatePayload,
          classification,
          extractionCoverage,
          parserQuality,
          sourceExtraction,
        } = prepared;

        // Preserve the actual document before committing its parsed text. A
        // missing private bucket fails closed, so a new CV cannot silently
        // become another flattened, non-recoverable source.
        const saved = await commitCandidateWithArchivedCv(
          async () => {
            if (reviewObjectKey)
              return {
                reference: `${ORIGINAL_CV_BUCKET}/${reviewObjectKey}`,
                objectKey: reviewObjectKey,
              };
            const archived = await archiveOriginalCv(fileName, buffer);
            reviewObjectKey = archived.objectKey;
            return archived;
          },
          (archivedCvReference) =>
            saveCandidate({
              ...candidatePayload,
              archivedCvReference,
            }),
        );

        if (
          saved?.skipped ||
          saved?.rejected_noise ||
          String(saved?.status || "").toLowerCase() === "rejected_noise"
        ) {
          if (reviewObjectKey)
            await recordCandidateUploadReview({
              objectKey: reviewObjectKey,
              fileName,
              actorUserId: authorization.scope.subjectId,
              reasonCodes: ["save_gate_rejected"],
            });
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
          const heldObjectKey = String(saved.source_file || "").replace(
            `${ORIGINAL_CV_BUCKET}/`,
            "",
          );
          await recordCandidateUploadReview({
            objectKey: heldObjectKey,
            fileName,
            actorUserId: authorization.scope.subjectId,
            reasonCodes: Array.isArray(saved.ingestion_reasons)
              ? saved.ingestion_reasons
              : ["identity_review_required"],
          });
          results.push({
            fileName,
            ok: false,
            recordType: "IDENTITY_REVIEW_REQUIRED",
            reason:
              "The CV was preserved privately for review. No candidate record was created or overwritten.",
            error: "Needs identity review; no candidate record changed.",
            signals: Array.isArray(saved?.ingestion_reasons)
              ? saved.ingestion_reasons
              : [],
            ingestionAction: "hold_for_identity_review",
            candidate: {
              status: saved.status,
              competingCandidateCount: saved.competing_candidate_count,
            },
            sourceExtraction,
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
          candidate: {
            id: saved?.id,
            name: saved?.name,
            current_title: saved?.current_title,
            title: saved?.title,
            primary_module: saved?.primary_module,
            role_type: saved?.role_type,
            consulting_level: saved?.consulting_level,
            years: saved?.years,
            implementation_projects: saved?.implementation_projects,
            ams_projects: saved?.ams_projects,
            s4hana_projects: saved?.s4hana_projects,
          },
          ingestionAction: saved?.ingestion_action,
          sourceExtraction,
          extractionCoverage,
        });
      } catch (error: any) {
        if (error instanceof CvSourceError) {
          if (!reviewObjectKey)
            reviewObjectKey = (await archiveOriginalCv(fileName, buffer))
              .objectKey;
          if (reviewObjectKey)
            await recordCandidateUploadReview({
              objectKey: reviewObjectKey,
              fileName,
              actorUserId: authorization.scope.subjectId,
              reasonCodes: [error.code],
            });
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

        if (!reviewObjectKey)
          reviewObjectKey = (await archiveOriginalCv(fileName, buffer))
            .objectKey;
        if (reviewObjectKey)
          await recordCandidateUploadReview({
            objectKey: reviewObjectKey,
            fileName,
            actorUserId: authorization.scope.subjectId,
            reasonCodes: ["processing_failure"],
          });

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

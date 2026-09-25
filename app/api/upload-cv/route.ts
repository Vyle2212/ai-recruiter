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
import { originalCvStorageReadStatus } from "@/lib/originalCvStorageRead";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The normal UI streams CVs directly to private Storage. Bound this older
// multipart path so a large selection cannot fill the function's memory.
const MAX_LEGACY_MULTIPART_BYTES = 4 * 1024 * 1024;
const MAX_LEGACY_MULTIPART_FILES = 5;

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
  return /\.(pdf|docx|doc|rtf|txt)$/i.test(fileName || "");
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
      let download;
      try {
        download = await supabase.storage
          .from(ORIGINAL_CV_BUCKET)
          .download(objectKey);
      } catch {
        return NextResponse.json(
          {
            success: false,
            error:
              "Private CV storage is unavailable; retry the same reference.",
          },
          { status: 503 },
        );
      }
      const { data, error } = download;
      if (error || !data) {
        const missing = originalCvStorageReadStatus(error) === 404;
        return NextResponse.json(
          {
            success: false,
            error: missing
              ? "Original CV was not found in private storage."
              : "Private CV storage is unavailable; retry the same reference.",
          },
          { status: missing ? 404 : 503 },
        );
      }
      const buffer = Buffer.from(await data.arrayBuffer());
      if (buffer.length !== input.size || buffer.length > MAX_ORIGINAL_BYTES) {
        try {
          await recordCandidateUploadReview({
            objectKey,
            fileName,
            actorUserId: authorization.scope.subjectId,
            reasonCodes: ["content_size_mismatch"],
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
              "Uploaded CV size does not match the request and was preserved for review.",
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
      let processed;
      try {
        processed = await supabase
          .from("candidates")
          .select("id,name,current_title,primary_module")
          .eq("source_file", reference)
          .limit(2);
      } catch {
        // The original is still private. The review queue below tracks it.
      }
      if (!processed || processed.error || (processed.data?.length || 0) > 1) {
        try {
          await recordCandidateUploadReview({
            objectKey,
            fileName,
            actorUserId: authorization.scope.subjectId,
            reasonCodes: ["candidate_readback_unavailable"],
          });
        } catch {
          return NextResponse.json(
            { success: false, error: "CV review queue is unavailable." },
            { status: 503 },
          );
        }
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
      const declaredLength = req.headers.get("content-length");
      if (!declaredLength) {
        return NextResponse.json(
          {
            success: false,
            error: "Use the private CV upload page for this request.",
          },
          { status: 411 },
        );
      }
      const declaredBytes = Number(declaredLength);
      if (
        !Number.isSafeInteger(declaredBytes) ||
        declaredBytes < 1 ||
        declaredBytes > MAX_LEGACY_MULTIPART_BYTES
      ) {
        return NextResponse.json(
          {
            success: false,
            error: "Use the private CV upload page for this file size.",
          },
          { status: 413 },
        );
      }
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
      if (
        selected.length > MAX_LEGACY_MULTIPART_FILES ||
        selected.some(
          (file) => file.size < 1 || file.size > MAX_LEGACY_MULTIPART_BYTES,
        ) ||
        selected.reduce((total, file) => total + file.size, 0) >
          MAX_LEGACY_MULTIPART_BYTES
      ) {
        return NextResponse.json(
          {
            success: false,
            error: "Use the private CV upload page for this collection.",
          },
          { status: 413 },
        );
      }
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
            error:
              "Unsupported file type. Please upload PDF, DOCX, DOC, RTF, or TXT.",
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

        const rejectedByGate =
          typeof error?.code === "string" &&
          /^REJECTED_[A-Z_]+$/.test(error.code);
        const message = rejectedByGate
          ? "CV requires quality review. The original was preserved privately."
          : "CV processing failed. The original was preserved privately for review.";

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
    return NextResponse.json(
      {
        success: false,
        error: "CV upload could not be completed; retry the same file.",
      },
      { status: 500 },
    );
  }
}

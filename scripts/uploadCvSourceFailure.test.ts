import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { CvSourceError } from "../lib/cvPdfOcr";
import { commitCandidateWithArchivedCv } from "../lib/originalCvArchiveCommit";
import * as originalCvArchiveKey from "../lib/originalCvArchiveKey";
async function main() {
  const saved: string[] = [];
  const archived: string[] = [];
  const queued: string[] = [];
  let processed = false;
  let downloads = 0;
  const ownerId = "00000000-0000-4000-8000-000000000001";
  const signedObjectKey = `${ownerId}/00000000-0000-4000-8000-000000000002.pdf`;
  const stubs: Record<string, unknown> = {
    "next/server": { NextResponse: { json: (body: unknown) => body } },
    "@/lib/cvPdfOcr": { CvSourceError },
    "@/lib/candidateCvIngestion": {
      prepareCandidateCv: async ({ fileName }: { fileName: string }) => {
        if (fileName === "failed.pdf")
          throw new CvSourceError(
            "OCR_INCOMPLETE",
            "OCR did not return all pages.",
          );
        return {
          accepted: true,
          rawText: "Synthetic CV",
          sourceExtraction: { method: "native", pageCount: 1, reason: "" },
          classification: {
            shouldSave: true,
            recordType: "SAP_CV",
            reason: "CV",
            signals: [],
          },
          candidatePayload: { name: fileName },
          parserQuality: {
            rejected: false,
            warnings: [],
            rejectionReasons: [],
            parserQualityScore: 90,
            needsManualReview: false,
          },
          extractionCoverage: {
            status: "complete_for_validation",
            coveragePercent: 100,
            observedSections: [],
            extractedSections: [],
            missedObservedSections: [],
            missingRequiredFields: [],
          },
        };
      },
    },
    "@/lib/cv-parser": {
      parseCv: async (_: Buffer, name: string) => {
        if (name === "failed.pdf")
          throw new CvSourceError(
            "OCR_INCOMPLETE",
            "OCR did not return all pages.",
          );
        return {
          name,
          rawText: "Synthetic CV",
          sourceExtraction: { method: "native", pageCount: 1, reason: "" },
        };
      },
    },
    "@/lib/saveCandidate": {
      saveCandidate: async (input: any) => {
        saved.push(input.name);
        if (input.name === "held.pdf")
          return {
            status: "identity_review_required",
            source_file: input.archivedCvReference,
            ingestion_action: "hold_for_identity_review",
            ingestion_reasons: ["existing_profile_contains_confirmed_fields"],
            competing_candidate_count: 1,
          };
        processed = true;
        return {
          id: "synthetic",
          name: input.name,
          source_file: input.archivedCvReference,
        };
      },
    },
    "@/lib/originalCvArchive": {
      archiveOriginalCv: async (name: string) => {
        archived.push(name);
        return {
          reference:
            "candidate-original-cvs/00000000-0000-4000-8000-000000000000.pdf",
          objectKey: "00000000-0000-4000-8000-000000000000.pdf",
        };
      },
      discardUnlinkedOriginalCv: async () => {},
    },
    "@/lib/originalCvArchiveCommit": { commitCandidateWithArchivedCv },
    "@/lib/originalCvArchiveKey": originalCvArchiveKey,
    "@/lib/candidateUploadReviewQueue": {
      recordCandidateUploadReview: async (input: { fileName: string }) => {
        queued.push(input.fileName);
      },
    },
    "@/lib/recruiterApiAuthorization": {
      requireRecruiterApiRouteAuthorization: async () => ({
        allowed: true,
        scope: { subjectId: ownerId },
      }),
    },
    "@/lib/supabase": {
      supabase: {
        storage: {
          from: () => ({
            download: async () => {
              downloads++;
              return { data: new Blob(["valid"]), error: null };
            },
          }),
        },
        from: () => ({
          select: () => ({
            eq: () => ({
              limit: async () => ({
                data: processed ? [{ id: "synthetic", name: "valid.pdf" }] : [],
                error: null,
              }),
            }),
          }),
        }),
      },
    },
    "@/lib/candidateExtractionCoverage": {
      evaluateCandidateExtractionCoverage: () => ({
        status: "complete_for_validation",
        coveragePercent: 100,
        observedSections: [],
        extractedSections: [],
        missedObservedSections: [],
        missingRequiredFields: [],
      }),
    },
    "@/lib/candidateUploadEnrichment": {
      enrichCandidateUpload: (candidate: unknown) => candidate,
    },
    "@/lib/sapTalentTaxonomy": {
      enrichCandidateWithSapTaxonomy: (x: unknown) => x,
    },
    "@/lib/candidateFileGuards": {
      classifyCandidateText: () => ({
        shouldSave: true,
        recordType: "SAP_CV",
        reason: "CV",
        signals: [],
      }),
      normalizeCandidatePayloadForSapUpload: (x: unknown) => x,
    },
    "@/lib/resumeQualityGate": {
      evaluateResumeQualityGate: () => ({
        rejected: false,
        warnings: [],
        rejectionReasons: [],
        parserQualityScore: 90,
        needsManualReview: false,
      }),
    },
  };
  const source = ts.transpileModule(
    fs.readFileSync("app/api/upload-cv/route.ts", "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  const exports: Record<string, any> = {};
  vm.runInNewContext(source, {
    exports,
    require: (name: string) => {
      assert.ok(name in stubs, name);
      return stubs[name];
    },
    File,
    Buffer,
    console,
  });
  const form = new FormData();
  form.append("files", new File(["broken"], "failed.pdf"));
  form.append("files", new File(["valid"], "valid.pdf"));
  const response = await exports.POST({
    headers: new Headers({ "content-type": "multipart/form-data" }),
    formData: async () => form,
  });
  assert.deepEqual(
    saved,
    ["valid.pdf"],
    "An OCR failure must never reach saveCandidate",
  );
  assert.deepEqual(
    archived,
    ["valid.pdf"],
    "An OCR failure must never archive invalid bytes",
  );
  assert.equal(response.partialSuccess, true);
  assert.equal(response.successCount, 1);
  assert.equal(response.failCount, 1);
  assert.equal(response.results[0].errorCode, "OCR_INCOMPLETE");
  assert.equal(response.results[0].recordType, "SOURCE_REVIEW_REQUIRED");
  assert.equal(response.results[1].sourceExtraction.method, "native");
  processed = false;
  const signedRequest = (objectKey: string) => ({
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => ({ fileName: "valid.pdf", size: 5, objectKey }),
  });
  const invalid = await exports.POST(
    signedRequest(
      `00000000-0000-4000-8000-000000000009/00000000-0000-4000-8000-000000000002.pdf`,
    ),
  );
  assert.equal(invalid.success, false);
  assert.equal(downloads, 0, "Another admin's object cannot be downloaded");
  const signed = await exports.POST(signedRequest(signedObjectKey));
  assert.equal(signed.success, true);
  assert.equal(saved.length, 2, "Signed original was parsed and saved once");
  assert.deepEqual(
    archived,
    ["valid.pdf"],
    "Signed original was not uploaded twice",
  );
  const retry = await exports.POST(signedRequest(signedObjectKey));
  assert.equal(retry.results[0].ingestionAction, "already_processed");
  assert.equal(
    saved.length,
    2,
    "Retry cannot increment the candidate CV version",
  );
  const heldForm = new FormData();
  heldForm.append("file", new File(["held"], "held.pdf"));
  const held = await exports.POST({
    headers: new Headers({ "content-type": "multipart/form-data" }),
    formData: async () => heldForm,
  });
  assert.equal(held.successCount, 0);
  assert.equal(held.heldForReviewCount, 1);
  assert.equal(held.results[0].ok, false);
  assert.deepEqual(
    queued,
    ["held.pdf"],
    "Held original must enter a durable review queue",
  );
  console.log(
    "Upload route: OCR failure isolation, signed original ownership and retry safety passed",
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

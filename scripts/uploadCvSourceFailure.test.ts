import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { createHash } from "node:crypto";
import { CvSourceError } from "../lib/cvPdfOcr";
import { candidateCvRejectedOriginalPolicy } from "../lib/candidateCvIngestion";
import { commitCandidateWithArchivedCv } from "../lib/originalCvArchiveCommit";
import * as originalCvArchiveKey from "../lib/originalCvArchiveKey";
import { originalCvStorageReadStatus } from "../lib/originalCvStorageRead";
async function main() {
  const saved: string[] = [];
  const archived: string[] = [];
  const queued: string[] = [];
  const queuedReasons: string[][] = [];
  const discarded: string[] = [];
  let processed = false;
  let readbackUnavailable = false;
  let throwReadback = false;
  let storageError: unknown = null;
  let throwDownload = false;
  let downloads = 0;
  let signedUrls = 0;
  let uploadFoundationReady = false;
  const ownerId = "00000000-0000-4000-8000-000000000001";
  const signedObjectKey = `${ownerId}/00000000-0000-4000-8000-000000000002.pdf`;
  const validDigest = createHash("sha256").update("valid").digest("hex");
  const stubs: Record<string, unknown> = {
    "next/server": {
      NextResponse: {
        json: (body: object, options?: { status?: number }) => ({
          ...body,
          status: options?.status || 200,
        }),
      },
    },
    "@/lib/cvPdfOcr": { CvSourceError },
    "@/lib/candidateCvIngestion": {
      prepareCandidateCv: async ({ fileName }: { fileName: string }) => {
        if (fileName === "failed.pdf")
          throw new CvSourceError(
            "OCR_INCOMPLETE",
            "OCR did not return all pages.",
          );
        if (fileName === "low-evidence.pdf")
          return {
            accepted: false,
            rejectionType: "non_sap_or_non_cv",
            recordType: "UNKNOWN",
            reason: "SAP evidence could not be confirmed.",
            signals: ["sap_score:0"],
            sourceExtraction: { method: "native", pageCount: 1, reason: "" },
          };
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
      candidateCvRejectedOriginalPolicy,
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
        if (input.name === "error.pdf")
          throw new Error("synthetic save failure");
        if (input.name === "gate.pdf")
          return { skipped: true, extraction_notes: ["quality_gate_rejected"] };
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
      discardUnlinkedOriginalCv: async (objectKey: string) => {
        discarded.push(objectKey);
      },
    },
    "@/lib/originalCvArchiveCommit": { commitCandidateWithArchivedCv },
    "@/lib/originalCvArchiveKey": originalCvArchiveKey,
    "@/lib/originalCvStorageRead": { originalCvStorageReadStatus },
    "@/lib/serverCvContentDigest": {
      normalizeCvContentDigest: (value: unknown) =>
        typeof value === "string" && /^[0-9a-f]{64}$/i.test(value)
          ? value.toLowerCase()
          : null,
      cvContentDigestMatches: (bytes: Buffer, claimed: string) =>
        createHash("sha256").update(bytes).digest("hex") === claimed,
    },
    "@/lib/candidateUploadReviewQueue": {
      recordCandidateUploadReview: async (input: {
        fileName: string;
        reasonCodes: string[];
      }) => {
        queued.push(input.fileName);
        queuedReasons.push(input.reasonCodes);
      },
    },
    "@/lib/recruiterApiAuthorization": {
      requireRecruiterApiRouteAuthorization: async () => ({
        allowed: true,
        scope: { subjectId: ownerId },
      }),
    },
    "@/lib/adminCvUploadReadiness": {
      adminCvUploadFoundationReady: async () => uploadFoundationReady,
    },
    "@/lib/supabase": {
      supabase: {
        storage: {
          from: () => ({
            createSignedUploadUrl: async () => {
              signedUrls++;
              return { data: { token: "synthetic" }, error: null };
            },
            download: async () => {
              downloads++;
              if (throwDownload) throw new Error("Storage connection lost");
              return storageError
                ? { data: null, error: storageError }
                : { data: new Blob(["valid"]), error: null };
            },
          }),
        },
        from: () => ({
          select: () => ({
            eq: () => ({
              limit: async () => {
                if (throwReadback) throw new Error("database unavailable");
                return {
                  data: processed
                    ? [{ id: "synthetic", name: "valid.pdf" }]
                    : [],
                  error: readbackUnavailable
                    ? new Error("database unavailable")
                    : null,
                };
              },
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
  const signExports: Record<string, any> = {};
  vm.runInNewContext(
    ts.transpileModule(
      fs.readFileSync("app/api/upload-cv/sign/route.ts", "utf8"),
      { compilerOptions: { module: ts.ModuleKind.CommonJS } },
    ).outputText,
    {
      exports: signExports,
      require: (name: string) => {
        assert.ok(name in stubs, name);
        return stubs[name];
      },
      Buffer,
    },
  );
  const blockedSign = await signExports.POST({
    json: async () => ({
      fileName: "synthetic.pdf",
      size: 5,
      contentDigest: validDigest,
    }),
  });
  assert.equal(blockedSign.status, 503);
  const blockedProcessing = await exports.POST({
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => {
      throw new Error("Blocked processing must not read the request body");
    },
  });
  assert.equal(blockedProcessing.status, 503);
  assert.equal(signedUrls, 0);
  assert.equal(downloads, 0);
  assert.equal(archived.length, 0);
  uploadFoundationReady = true;
  const allowedSign = await signExports.POST({
    json: async () => ({
      fileName: "synthetic.pdf",
      size: 5,
      contentDigest: validDigest,
    }),
  });
  assert.equal(allowedSign.status, 200);
  assert.equal(signedUrls, 1);
  const oversizedHeader = await exports.POST({
    headers: new Headers({
      "content-type": "multipart/form-data",
      "content-length": String(4 * 1024 * 1024 + 1),
    }),
    formData: async () => {
      throw new Error("Oversized request must be refused before parsing");
    },
  });
  assert.equal(oversizedHeader.status, 413);
  const unbounded = await exports.POST({
    headers: new Headers({ "content-type": "multipart/form-data" }),
    formData: async () => {
      throw new Error("Unbounded request must be refused before parsing");
    },
  });
  assert.equal(unbounded.status, 411);
  const multipartHeaders = () =>
    new Headers({
      "content-type": "multipart/form-data",
      "content-length": "1024",
    });
  const tooMany = new FormData();
  for (let i = 0; i < 6; i++)
    tooMany.append("files", new File(["SAP"], `synthetic-${i}.pdf`));
  const tooManyResult = await exports.POST({
    headers: multipartHeaders(),
    formData: async () => tooMany,
  });
  assert.equal(tooManyResult.status, 413);
  const oversizedFile = new FormData();
  oversizedFile.append(
    "file",
    new File([new Uint8Array(4 * 1024 * 1024 + 1)], "oversized.pdf"),
  );
  const oversizedFileResult = await exports.POST({
    headers: multipartHeaders(),
    formData: async () => oversizedFile,
  });
  assert.equal(oversizedFileResult.status, 413);
  assert.equal(saved.length, 0, "Rejected batches cannot reach the CV parser");
  assert.equal(archived.length, 0, "Rejected batches cannot archive a CV");
  const form = new FormData();
  form.append("files", new File(["broken"], "failed.pdf"));
  form.append("files", new File(["valid"], "valid.pdf"));
  const response = await exports.POST({
    headers: multipartHeaders(),
    formData: async () => form,
  });
  assert.deepEqual(
    saved,
    ["valid.pdf"],
    "An OCR failure must never reach saveCandidate",
  );
  assert.deepEqual(
    archived,
    ["failed.pdf", "valid.pdf"],
    "An OCR failure must preserve the private original before review",
  );
  assert.deepEqual(
    queued,
    ["failed.pdf"],
    "An OCR failure must enter the durable review queue",
  );
  assert.equal(response.partialSuccess, true);
  assert.equal(response.successCount, 1);
  assert.equal(response.failCount, 1);
  assert.equal(response.results[0].errorCode, "OCR_INCOMPLETE");
  assert.equal(response.results[0].recordType, "SOURCE_REVIEW_REQUIRED");
  assert.equal(response.results[1].sourceExtraction.method, "native");

  const errorForm = new FormData();
  errorForm.append("file", new File(["error"], "error.pdf"));
  const saveFailure = await exports.POST({
    headers: multipartHeaders(),
    formData: async () => errorForm,
  });
  assert.equal(saveFailure.successCount, 0);
  assert.equal(saveFailure.failCount, 1);
  assert.ok(
    !JSON.stringify(saveFailure).includes("synthetic save failure"),
    "Internal failures must not expose database or CV details to the browser",
  );
  assert.equal(
    archived.filter((name) => name === "error.pdf").length,
    1,
    "An ambiguous save failure must not create a second private original",
  );
  assert.deepEqual(
    queued,
    ["failed.pdf", "error.pdf"],
    "An ambiguous save failure must queue the already archived original",
  );

  processed = false;
  const signedRequest = (
    objectKey: string,
    contentDigest = validDigest,
    claimedSize = 5,
  ) => ({
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => ({
      fileName: "valid.pdf",
      size: claimedSize,
      objectKey,
      contentDigest,
    }),
  });
  const invalid = await exports.POST(
    signedRequest(
      `00000000-0000-4000-8000-000000000009/00000000-0000-4000-8000-000000000002.pdf`,
    ),
  );
  assert.equal(invalid.success, false);
  assert.equal(downloads, 0, "Another admin's object cannot be downloaded");
  storageError = { status: 404, statusCode: "NoSuchKey" };
  assert.equal(
    (await exports.POST(signedRequest(signedObjectKey))).status,
    404,
  );
  for (const error of [
    { status: 404, statusCode: "NoSuchBucket" },
    new Error("Storage connection lost"),
  ]) {
    storageError = error;
    const unavailable = await exports.POST(signedRequest(signedObjectKey));
    assert.equal(unavailable.status, 503);
    assert.equal(unavailable.success, false);
  }
  storageError = null;
  throwDownload = true;
  assert.equal(
    (await exports.POST(signedRequest(signedObjectKey))).status,
    503,
  );
  throwDownload = false;
  readbackUnavailable = true;
  const readback = await exports.POST(signedRequest(signedObjectKey));
  assert.equal(readback.status, 409);
  assert.equal(
    queuedReasons.at(-1)?.join(","),
    "candidate_readback_unavailable",
  );
  readbackUnavailable = false;
  throwReadback = true;
  const thrownReadback = await exports.POST(signedRequest(signedObjectKey));
  assert.equal(thrownReadback.status, 409);
  assert.equal(
    queuedReasons.at(-1)?.join(","),
    "candidate_readback_unavailable",
  );
  throwReadback = false;
  const wrongSize = await exports.POST(
    signedRequest(signedObjectKey, validDigest, 4),
  );
  assert.equal(wrongSize.success, false);
  assert.deepEqual(
    queued,
    ["failed.pdf", "error.pdf", "valid.pdf", "valid.pdf", "valid.pdf"],
    "A present original with an unexpected size must enter private review",
  );
  assert.equal(queuedReasons.at(-1)?.join(","), "content_size_mismatch");
  assert.equal(
    saved.filter((name) => name === "valid.pdf").length,
    1,
    "Size mismatch must fail before parsing or saving",
  );
  const mismatched = await exports.POST(
    signedRequest(signedObjectKey, "0".repeat(64)),
  );
  assert.equal(mismatched.success, false);
  assert.equal(
    saved.filter((name) => name === "valid.pdf").length,
    1,
    "Digest mismatch must fail before parsing or saving",
  );
  assert.deepEqual(
    queued,
    [
      "failed.pdf",
      "error.pdf",
      "valid.pdf",
      "valid.pdf",
      "valid.pdf",
      "valid.pdf",
    ],
    "Digest mismatch must preserve the private object for review",
  );
  const signed = await exports.POST(signedRequest(signedObjectKey));
  assert.equal(signed.success, true);
  assert.equal(
    saved.filter((name) => name === "valid.pdf").length,
    2,
    "Signed original was parsed and saved once after the multipart fixture",
  );
  assert.deepEqual(
    archived,
    ["failed.pdf", "valid.pdf", "error.pdf"],
    "Signed original was not uploaded twice",
  );
  const retry = await exports.POST(signedRequest(signedObjectKey));
  assert.equal(retry.results[0].ingestionAction, "already_processed");
  assert.equal(
    saved.filter((name) => name === "valid.pdf").length,
    2,
    "Retry cannot increment the candidate CV version",
  );
  const heldForm = new FormData();
  heldForm.append("file", new File(["held"], "held.pdf"));
  const held = await exports.POST({
    headers: multipartHeaders(),
    formData: async () => heldForm,
  });
  assert.equal(held.successCount, 0);
  assert.equal(held.heldForReviewCount, 1);
  assert.equal(held.results[0].ok, false);
  assert.deepEqual(
    queued,
    [
      "failed.pdf",
      "error.pdf",
      "valid.pdf",
      "valid.pdf",
      "valid.pdf",
      "valid.pdf",
      "held.pdf",
    ],
    "Held original must enter a durable review queue",
  );
  const uncertainForm = new FormData();
  uncertainForm.append("file", new File(["low evidence"], "low-evidence.pdf"));
  const uncertain = await exports.POST({
    headers: multipartHeaders(),
    formData: async () => uncertainForm,
  });
  assert.equal(uncertain.results[0].recordType, "UNKNOWN");
  assert.ok(archived.includes("low-evidence.pdf"));
  assert.equal(queued.at(-1), "low-evidence.pdf");
  assert.deepEqual(
    discarded,
    [],
    "a missing SAP keyword must not delete an uncertain original",
  );
  assert.ok(!saved.includes("low-evidence.pdf"));
  const gateForm = new FormData();
  gateForm.append("file", new File(["SAP synthetic CV"], "gate.pdf"));
  const gate = await exports.POST({
    headers: multipartHeaders(),
    formData: async () => gateForm,
  });
  assert.equal(gate.results[0].recordType, "REJECTED_NOISE");
  assert.ok(archived.includes("gate.pdf"));
  assert.equal(queued.at(-1), "gate.pdf");
  assert.deepEqual(discarded, [], "a save-gate rejection keeps the original");
  console.log(
    "Upload route: OCR failure isolation, signed original ownership and retry safety passed",
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const bytes = Buffer.from("synthetic candidate CV bytes");
const digest = createHash("sha256").update(bytes).digest("hex");
const owner = "00000000-0000-4000-8000-000000000001";
const objectKey = `${owner}/00000000-0000-4000-8000-000000000002.pdf`;
const sourceReference = `candidate-original-cvs/${objectKey}`;
let stored: Buffer | null = null;
let reviewCalls = 0;
let saveCalls = 0;

const stubs: Record<string, unknown> = {
  "next/server": {
    NextResponse: {
      json: (body: unknown, options?: { status?: number }) => ({
        body,
        status: options?.status || 200,
      }),
    },
  },
  "@/lib/candidateCvAuthorization": {
    candidateCvUploadRuntimeEnabled: () => true,
    validateCandidateCvWriteRequest: () => null,
    authorizeCandidateCvUpload: async () => ({
      allowed: true,
      scope: {
        authUserId: owner,
        candidateId: "synthetic-candidate",
        candidateSourceFile: sourceReference,
        candidateCvVersion: 2,
        extractionCoverageStatus: "complete_for_validation",
        profileConfirmationStatus: "needs_review",
      },
    }),
  },
  "@/lib/candidateCvIngestion": {
    prepareCandidateCv: () => {
      throw new Error("replays must not enter the parser");
    },
  },
  "@/lib/candidateProfileIngestion": {},
  "@/lib/candidateUploadReviewQueue": {
    recordCandidateUploadReview: async () => {
      reviewCalls++;
    },
  },
  "@/lib/cvPdfOcr": { CvSourceError: class extends Error {} },
  "@/lib/originalCvArchive": {},
  "@/lib/originalCvArchiveKey": {
    MAX_ORIGINAL_BYTES: 10 * 1024 * 1024,
    ORIGINAL_CV_BUCKET: "candidate-original-cvs",
    ownedOriginalCvObjectKey: (user: string, key: string) =>
      user === owner && key === objectKey,
  },
  "@/lib/saveCandidate": {
    saveCandidate: async () => {
      saveCalls++;
      throw new Error("replays must not save a candidate");
    },
  },
  "@/lib/supabase": {
    supabase: {
      storage: {
        from: () => ({
          download: async () => ({
            data: stored === null ? null : new Blob([Uint8Array.from(stored)]),
            error: stored === null ? new Error("not found") : null,
          }),
        }),
      },
    },
  },
  "@/lib/serverCvContentDigest": {
    normalizeCvContentDigest: (input: unknown) =>
      typeof input === "string" && /^[0-9a-f]{64}$/.test(input) ? input : null,
    cvContentDigestMatches: (buffer: Buffer, claimed: string) =>
      createHash("sha256").update(buffer).digest("hex") === claimed,
  },
};

const source = ts.transpileModule(
  fs.readFileSync("app/api/candidate/profile/cv/route.ts", "utf8"),
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
    assert.ok(name in stubs, `unexpected import: ${name}`);
    return stubs[name];
  },
  Buffer,
});

async function request(claimedDigest = digest) {
  return exports.POST({
    json: async () => ({
      fileName: "synthetic.pdf",
      objectKey,
      size: bytes.length,
      contentDigest: claimedDigest,
    }),
  });
}

async function main() {
  const missing = await request();
  assert.equal(missing.status, 404);
  assert.notEqual(missing.body.alreadyProcessed, true);

  stored = Buffer.from(bytes);
  stored[0] ^= 1;
  const changed = await request();
  assert.equal(changed.status, 409);
  assert.notEqual(changed.body.alreadyProcessed, true);
  assert.equal(reviewCalls, 1, "changed originals must enter private review");

  stored = bytes;
  const intact = await request();
  assert.equal(intact.status, 200);
  assert.equal(intact.body.alreadyProcessed, true);
  assert.equal(saveCalls, 0, "a valid replay must not update the candidate");
  console.log("Candidate CV replay byte-integrity regression passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

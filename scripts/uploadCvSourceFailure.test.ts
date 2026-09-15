import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { CvSourceError } from "../lib/cvPdfOcr";
async function main() {
  const saved: string[] = [];
  const stubs: Record<string, unknown> = {
    "next/server": { NextResponse: { json: (body: unknown) => body } },
    "@/lib/cvPdfOcr": { CvSourceError },
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
        return { id: "synthetic", name: input.name };
      },
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
  const response = await exports.POST({ formData: async () => form });
  assert.deepEqual(
    saved,
    ["valid.pdf"],
    "An OCR failure must never reach saveCandidate",
  );
  assert.equal(response.partialSuccess, true);
  assert.equal(response.successCount, 1);
  assert.equal(response.failCount, 1);
  assert.equal(response.results[0].errorCode, "OCR_INCOMPLETE");
  assert.equal(response.results[0].recordType, "SOURCE_REVIEW_REQUIRED");
  assert.equal(response.results[1].sourceExtraction.method, "native");
  console.log(
    "Upload route: failed OCR never saves, later valid file succeeds, source error remains explicit",
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

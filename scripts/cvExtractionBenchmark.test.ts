import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { ensureSampleGoldset, GOLDSET_SAMPLE_PATH, loadGoldset, runCvExtractionBenchmark } from "../lib/cvExtractionBenchmark";

async function main() {
const tmpGoldset = path.join(process.cwd(), "reports", "cv-extraction-goldset.test.json");
if (fs.existsSync(tmpGoldset)) fs.unlinkSync(tmpGoldset);
ensureSampleGoldset(tmpGoldset);
assert.equal(fs.existsSync(tmpGoldset), true, "sample gold set can be generated");

const cases = loadGoldset(tmpGoldset);
assert.equal(cases.length >= 5, true, "gold set covers multiple CV patterns");

const result = await runCvExtractionBenchmark(cases);
assert.equal(result.totalBenchmarkCases, cases.length, "benchmark counts all cases");
assert.equal(result.identityPrecision >= 0, true, "identity precision is reported");
assert.equal(result.contactPrecision >= 0, true, "contact precision is reported");
assert.equal(result.titlePrecision >= 0, true, "title precision is reported");
assert.equal(result.employerPrecision >= 0, true, "employer precision is reported");
assert.equal(result.sapModulePrecision >= 0, true, "SAP module precision is reported");
assert.equal(result.fieldCompleteness >= 0, true, "field completeness is reported");
assert.equal(result.hallucinationRate >= 0, true, "hallucination rate is reported");
assert.equal(result.validationRejectionRate >= 0, true, "validation rejection rate is reported");
assert.equal(GOLDSET_SAMPLE_PATH, path.join("reports", "cv-extraction-goldset.sample.json"), "sample gold set path is stable");

if (fs.existsSync(tmpGoldset)) fs.unlinkSync(tmpGoldset);

console.log("CV extraction benchmark tests passed");
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });

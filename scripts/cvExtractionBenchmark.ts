import { ensureSampleGoldset, GOLDSET_SAMPLE_PATH, loadGoldset, runCvExtractionBenchmark } from "../lib/cvExtractionBenchmark";

export function formatCvExtractionBenchmark(result: Awaited<ReturnType<typeof runCvExtractionBenchmark>>) {
  return [
    "==================================================",
    "PRIMUS AI Recruiter",
    "AI Candidate CV Extraction Benchmark v3",
    "==================================================",
    "",
    "Mode: read-only; synthetic gold set",
    `Gold set: ${GOLDSET_SAMPLE_PATH}`,
    `Total benchmark cases: ${result.totalBenchmarkCases}`,
    `Identity precision: ${result.identityPrecision}`,
    `Contact precision: ${result.contactPrecision}`,
    `Title precision: ${result.titlePrecision}`,
    `Employer precision: ${result.employerPrecision}`,
    `SAP module precision: ${result.sapModulePrecision}`,
    `Field completeness: ${result.fieldCompleteness}`,
    `Hallucination rate: ${result.hallucinationRate}`,
    `Validation rejection rate: ${result.validationRejectionRate}`,
  ].join("\n");
}

async function main() {
  ensureSampleGoldset();
  console.log(formatCvExtractionBenchmark(await runCvExtractionBenchmark(loadGoldset())));
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/cvExtractionBenchmark.ts")) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

import { formatCvExtractionBenchmark } from "./cvExtractionBenchmark";
import { ensureSampleGoldset, loadGoldset, runCvExtractionBenchmark } from "../lib/cvExtractionBenchmark";

async function main() {
  ensureSampleGoldset();
  console.log(formatCvExtractionBenchmark(await runCvExtractionBenchmark(loadGoldset())));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

import fs from "node:fs";
import path from "node:path";
import { loadRealTalentPoolCandidates } from "../lib/candidateAudit";
import { buildThreeTierRecoveryPlan } from "../lib/threeTierRecovery";

const value = (name: string) => {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
};

async function main() {
  const inputPath = value("input");
  const candidates = inputPath
    ? (() => {
        const parsed = JSON.parse(fs.readFileSync(inputPath, "utf8"));
        const rows = Array.isArray(parsed) ? parsed : parsed.samples;
        if (!Array.isArray(rows)) throw new Error("Expected an array or { samples: [...] } input");
        return rows.map((row) => row.source || row);
      })()
    : (await loadRealTalentPoolCandidates()).candidates;
  const budget = Number(value("aiReviewBudget") || 12);
  const plan = buildThreeTierRecoveryPlan(candidates, { aiReviewBudget: budget });
  const outputPath = path.join(process.cwd(), "reports", "three-tier-recovery-plan.json");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify({ exportedAt: new Date().toISOString(), ...plan }, null, 2));
  console.log(JSON.stringify({ outputPath, ...plan.tiers, safety: plan.safety }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

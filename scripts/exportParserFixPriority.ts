import fs from "node:fs";
import path from "node:path";
import { loadRealTalentPoolCandidates } from "../lib/candidateAudit";
import { buildParserFixPriorityPlan } from "../lib/parserFixPriorityPlan";
import { parseParserFixPriorityArgs } from "./auditParserFixPriority";

export const PARSER_FIX_PRIORITY_PLAN_PATH = path.join("reports", "parser-fix-priority-plan.json");

export function writeParserFixPriorityPlan(candidates: Record<string, any>[], outputPath = path.join(process.cwd(), PARSER_FIX_PRIORITY_PLAN_PATH), options = parseParserFixPriorityArgs()) {
  const report = buildParserFixPriorityPlan(candidates, options);
  const payload = { exportedAt: new Date().toISOString(), outputPath: PARSER_FIX_PRIORITY_PLAN_PATH, ...report };
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2));
  return { ...payload, outputPath };
}

async function main() {
  const { candidates } = await loadRealTalentPoolCandidates();
  const outputPath = path.join(process.cwd(), PARSER_FIX_PRIORITY_PLAN_PATH);
  const report = writeParserFixPriorityPlan(candidates, outputPath, parseParserFixPriorityArgs());
  console.log(`Parser fix priority plan exported: ${outputPath}`);
  console.log(`Mode: ${report.mode}`);
  console.log(`Total checked: ${report.summary.totalChecked}`);
  console.log(`Existing search-ready: ${report.summary.existingSearchReady}`);
  console.log(`Simulated search-ready: ${report.summary.simulatedSearchReady}`);
  console.log(`Employer parser issues: ${report.summary.employerParserIssues}`);
  console.log(`Title parser issues: ${report.summary.titleParserIssues}`);
  console.log(`Module parser issues: ${report.summary.moduleParserIssues}`);
  console.log(`True reupload required: ${report.summary.trueReuploadRequired}`);
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/exportParserFixPriority.ts")) {
  main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
}

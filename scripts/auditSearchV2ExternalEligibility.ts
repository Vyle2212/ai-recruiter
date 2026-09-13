import fs from "node:fs";
import path from "node:path";
import { auditExternalTalentEligibility } from "../lib/externalTalentEligibilityAudit";
import type { ExternalTalentSearchResponse } from "../lib/externalTalentTypes";

const inputPath = process.argv[2];
if (!inputPath) {
  throw new Error(
    "Usage: npx tsx scripts/auditSearchV2ExternalEligibility.ts <external-search-response.json>",
  );
}

const resolved = path.resolve(inputPath);
const response = JSON.parse(
  fs.readFileSync(resolved, "utf8"),
) as ExternalTalentSearchResponse;
const report = auditExternalTalentEligibility(response);
if (!report.reconciled) {
  throw new Error("External eligibility counts do not reconcile.");
}
console.log(JSON.stringify(report, null, 2));

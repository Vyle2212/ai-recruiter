import fs from "node:fs";
import path from "node:path";
import type { ImportMergePostAudit, ImportMergeResult, ImportMergeRollback } from "../lib/importMergeTypes";

function read<T>(fileName: string): T | null { try { return JSON.parse(fs.readFileSync(path.resolve("reports", "import", fileName), "utf8")) as T; } catch { return null; } }
export function auditImportMergeApply(baseDir = path.resolve("reports", "import")) {
  const readAt = <T>(fileName: string): T | null => { try { return JSON.parse(fs.readFileSync(path.join(baseDir, fileName), "utf8")) as T; } catch { return null; } };
  const result = readAt<ImportMergeResult>("import-merge-result.json");
  const postAudit = readAt<ImportMergePostAudit>("import-merge-post-audit.json");
  const rollback = readAt<ImportMergeRollback>("import-merge-rollback.json");
  return {
    generatedAt: new Date().toISOString(), mode: "read-only import merge apply audit; no candidate DB writes",
    expectedFieldUpdates: result?.expectedFieldUpdates || postAudit?.expectedFieldUpdates || 0,
    appliedVerified: postAudit?.appliedVerified || 0, pending: postAudit?.pending || 0, mismatch: postAudit?.mismatch || 0,
    backupAvailable: fs.existsSync(path.join(baseDir, "import-merge-backup.json")),
    rollbackAvailable: fs.existsSync(path.join(baseDir, "import-merge-rollback.json")),
    rollbackSafe: Boolean(rollback?.safe),
    dryRun: result?.dryRun ?? true,
  };
}
function main() {
  const audit = auditImportMergeApply();
  fs.writeFileSync(path.resolve("reports", "import", "import-merge-apply-audit.json"), `${JSON.stringify(audit, null, 2)}\n`);
  console.log("Mode: read-only import merge apply audit; no candidate DB writes");
  console.log(`Expected field updates: ${audit.expectedFieldUpdates}`);
  console.log(`Applied verified: ${audit.appliedVerified}`);
  console.log(`Pending: ${audit.pending}`);
  console.log(`Mismatch: ${audit.mismatch}`);
  console.log(`Backup available: ${audit.backupAvailable}`);
  console.log(`Rollback available: ${audit.rollbackAvailable}`);
  console.log(`Rollback safe: ${audit.rollbackSafe}`);
}
if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/auditImportMergeApply.ts")) { try { main(); } catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; } }

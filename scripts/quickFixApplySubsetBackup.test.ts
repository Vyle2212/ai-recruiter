import assert from "node:assert/strict";
import { buildQuickFixSubsetBackup, buildQuickFixSubsetRollback } from "../lib/quickFixApplySubsetBackup";
const plan:any={eligibleItems:[{candidateId:"c1",fieldName:"currentCompany",candidateField:"current_company",currentDbValue:null,approvedValue:"EY Consulting",stagingId:"s1"}]};
const backup=buildQuickFixSubsetBackup(plan); assert.equal(backup.entries.length,1,"backup generated before real apply");
const rollback=buildQuickFixSubsetRollback(backup); assert.equal(rollback.entries.length,1,"rollback generated before real apply");
console.log("Quick fix apply subset backup tests passed");

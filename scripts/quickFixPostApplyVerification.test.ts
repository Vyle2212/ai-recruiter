import assert from "node:assert/strict";
import fs from "node:fs";import os from "node:os";import path from "node:path";
import { buildQuickFixPostApplyVerification } from "../lib/quickFixPostApplyVerification";
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"qf-post-"));const subset=path.join(tmp,"subset.json"), result=path.join(tmp,"result.json"), post=path.join(tmp,"post.json"), backup=path.join(tmp,"backup.json"), rollback=path.join(tmp,"rollback.json");
fs.writeFileSync(subset,JSON.stringify({subsetItems:[{candidateId:"c1",candidateName:"C",fieldName:"currentCompany",approvedValue:"EY Consulting"}]}));
let report=buildQuickFixPostApplyVerification({subsetPath:subset,resultPath:result,postAuditPath:post,backupPath:backup,rollbackPath:rollback});assert.equal(report.pendingApply,1,"pending apply when result missing");assert.equal(report.backupAvailable,false,"backup missing reported");assert.equal(report.rollbackAvailable,false,"rollback missing reported");
fs.writeFileSync(result,JSON.stringify({executionMode:"confirmed_apply"}));fs.writeFileSync(post,JSON.stringify({items:[{candidateId:"c1",fieldName:"currentCompany",finalDbValue:"EY Consulting"}]}));report=buildQuickFixPostApplyVerification({subsetPath:subset,resultPath:result,postAuditPath:post,backupPath:backup,rollbackPath:rollback});assert.equal(report.appliedVerified,1,"verified applied when final DB matches approved value");
fs.writeFileSync(post,JSON.stringify({items:[{candidateId:"c1",fieldName:"currentCompany",finalDbValue:"Other"}]}));report=buildQuickFixPostApplyVerification({subsetPath:subset,resultPath:result,postAuditPath:post,backupPath:backup,rollbackPath:rollback});assert.equal(report.mismatch,1,"mismatch when final DB differs");
async function checkApi(){const route=await import("../app/api/recruiter/quick-fix-apply-review/post-apply-verification/route");const response:any=await route.GET();const json=await response.json();assert.equal(Boolean(json.mode),true,"API summary returns post-apply verification");}
checkApi().then(()=>console.log("Quick fix post-apply verification tests passed"));


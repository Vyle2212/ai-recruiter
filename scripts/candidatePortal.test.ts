import assert from "node:assert/strict";
import fs from "node:fs";
import {buildCandidatePortalAudit} from "./auditCandidatePortal";
import {recruiterRouteRegistry} from "../lib/recruiterRouteRegistry";

async function main(){
  const audit=await buildCandidatePortalAudit();
  assert.equal(fs.existsSync("app/candidate/portal/page.tsx"),true);
  assert.match(audit.selfConfirmRouteSample,/^\/candidate\/self-confirm\/.+/);
  assert.equal(audit.candidateSelfConfirmPreview,true);
  assert.equal(audit.consentRequired,true);
  assert.equal(audit.submitDisabled,true);
  assert.equal(audit.recruiterReviewReadOnly,true);
  assert.equal(audit.candidateFacingAdminLinksExposed,false);
  assert.ok(recruiterRouteRegistry.some(item=>item.route==="/candidate/portal"&&item.readOnly&&!item.candidateDbWrites&&!item.openAiCallsDefault));
  const files=["app/candidate/portal/page.tsx","app/candidate/portal/CandidatePortalClient.tsx","app/candidate/self-confirm/[candidateId]/page.tsx","app/recruiter/candidate-self-confirm-review/page.tsx"];
  const source=files.map(file=>fs.readFileSync(file,"utf8")).join("\n");
  assert.doesNotMatch(source,/new OpenAI|responses\.create|sendMail|sendEmail|\.delete\(|unlink|rmSync/i);
  assert.doesNotMatch(source,/supabase[\s\S]{0,100}\.(?:insert|update|upsert|delete)\(/i);
  console.log("candidatePortal.test.ts passed");
}
main().catch(error=>{console.error(error);process.exitCode=1;});

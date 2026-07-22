import fs from "node:fs";
import path from "node:path";
import { loadRealTalentPoolCandidates } from "./candidateAudit";
import { buildCandidate360Profile } from "./candidate360Profile";
import { hydrateRecruiterWorkflow } from "./recruiterWorkflowStateHydration";
import { buildCandidateCompareResult } from "./candidateCompare";
import { normalizeCandidateCompareRequest } from "./candidateCompareRequest";
function readReport(name:string){try{return JSON.parse(fs.readFileSync(path.join(process.cwd(),"reports",name),"utf8"));}catch{return null;}}
export async function runCandidateCompare(input:unknown){const request=normalizeCandidateCompareRequest(input);const[{candidates},workflow]=await Promise.all([loadRealTalentPoolCandidates(),Promise.resolve(hydrateRecruiterWorkflow())]);const requested=new Set(request.candidateIds);const stateById=new Map(workflow.states.map(state=>[state.candidateId,state]));const approvals=readReport("ai-extraction-approvals.json"),decisions=readReport("quick-fix-apply-decisions.json"),history=readReport("candidate-apply-history.json")||readReport("quick-fix-post-apply-verification.json");const profiles=candidates.filter(candidate=>requested.has(String(candidate.id||candidate.candidate_id||""))).map(candidate=>{const id=String(candidate.id||candidate.candidate_id||"");return buildCandidate360Profile(candidate,stateById.get(id),approvals,decisions,history)});return buildCandidateCompareResult(request,profiles);}

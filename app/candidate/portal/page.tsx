import CandidatePortalClient from "./CandidatePortalClient";
import {buildUiSmokeTestData} from "@/lib/uiSmokeTestData";

export default async function CandidatePortalPage(){
  let sampleCandidateId="";
  try{sampleCandidateId=(await buildUiSmokeTestData()).sampleCandidateId;}catch{}
  return <><div className="border-b border-violet-500/30 bg-violet-500/5 px-6 py-3 text-center text-xs text-violet-100">Role access: preview only · intended role: candidate · authentication is not enabled yet</div><CandidatePortalClient sampleCandidateId={sampleCandidateId}/></>;
}

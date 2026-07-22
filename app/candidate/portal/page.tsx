import CandidatePortalClient from "./CandidatePortalClient";
import {buildUiSmokeTestData} from "@/lib/uiSmokeTestData";
import Link from "next/link";

export default async function CandidatePortalPage(){
  let sampleCandidateId="";
  try{sampleCandidateId=(await buildUiSmokeTestData()).sampleCandidateId;}catch{}
  return <><div className="border-b border-violet-500/30 bg-violet-500/5 px-6 py-3 text-center text-xs text-violet-100">Role access: preview only · candidate · real login is not enabled · <Link className="text-cyan-300" href="/auth/login?role=candidate">Sign in preview</Link></div><CandidatePortalClient sampleCandidateId={sampleCandidateId}/></>;
}

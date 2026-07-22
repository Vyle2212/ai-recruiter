import CandidatePortalClient from "./CandidatePortalClient";
import {buildUiSmokeTestData} from "@/lib/uiSmokeTestData";

export default async function CandidatePortalPage(){
  let sampleCandidateId="";
  try{sampleCandidateId=(await buildUiSmokeTestData()).sampleCandidateId;}catch{}
  return <CandidatePortalClient sampleCandidateId={sampleCandidateId}/>;
}

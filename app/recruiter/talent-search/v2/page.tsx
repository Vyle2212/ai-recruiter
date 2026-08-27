import type {
  Metadata,
} from "next";

import CandidateSearchV2Client from "./CandidateSearchV2Client";

export const metadata:
  Metadata = {
    title:
      "Candidate Search V2 | AI Recruiter",

    description:
      "Explainable hybrid recruiter search with SAP module relevance.",
  };

export default function CandidateSearchV2Page() {
  return (
    <CandidateSearchV2Client guidedSourcingEnabled={process.env.AI_GUIDED_SOURCING_PHASE1 === "true"} />
  );
}
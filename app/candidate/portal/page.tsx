import CandidatePortalClient from "./CandidatePortalClient";

export const dynamic = "force-dynamic";

export default function CandidatePortalPage() {
  return (
    <CandidatePortalClient chatEnabled={process.env.CHAT_ENABLED === "true"} />
  );
}

import Candidate360V2Client from "./Candidate360V2Client";

export default async function Candidate360V2Page({
  params,
}: {
  params: Promise<{ candidateId: string }>;
}) {
  const { candidateId } = await params;

  return <Candidate360V2Client candidateId={candidateId} />;
}

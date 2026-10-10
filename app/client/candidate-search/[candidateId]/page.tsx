import ClientCandidateDetail from "./ClientCandidateDetail";

export const dynamic = "force-dynamic";

export default function ClientCandidateDetailPage() {
  return <ClientCandidateDetail chatEnabled={process.env.CHAT_ENABLED === "true"} />;
}

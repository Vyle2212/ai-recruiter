import { notFound } from "next/navigation";
import ChatConversation from "./ChatConversation";

export const dynamic = "force-dynamic";

const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export default async function ChatPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;
  if (process.env.CHAT_ENABLED !== "true" || !uuid.test(conversationId))
    notFound();
  return <ChatConversation conversationId={conversationId} />;
}

export type PendingChatMessage = {
  conversationId: string;
  text: string;
  clientMessageId: string;
};

/** Keep the idempotency key when a response was lost; scope it to exact content. */
export function prepareChatMessageRetry(
  pending: PendingChatMessage | null,
  conversationId: string,
  text: string,
  createId: () => string,
): PendingChatMessage {
  if (pending?.conversationId === conversationId && pending.text === text)
    return pending;
  return { conversationId, text, clientMessageId: createId() };
}

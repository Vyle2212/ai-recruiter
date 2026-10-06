"use client";

import { useCallback, useEffect, useState } from "react";

type Message = {
  id: string;
  sender_profile_id: string;
  body: string;
  created_at: string;
};

export default function ChatConversation({ conversationId, suggestionsEnabled }: { conversationId: string; suggestionsEnabled: boolean }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [viewerId, setViewerId] = useState("");
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "denied" | "error">("loading");
  const [sending, setSending] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [unreadCount, setUnreadCount] = useState<number | null>(null);
  const [markingRead, setMarkingRead] = useState(false);
  const [error, setError] = useState("");
  const endpoint = `/api/chat/conversations/${encodeURIComponent(conversationId)}/messages`;
  const receiptsEndpoint = `/api/chat/conversations/${encodeURIComponent(conversationId)}/receipts`;

  const refreshReceipts = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch(receiptsEndpoint, { cache: "no-store", signal });
      if (!response.ok) { if (!signal?.aborted) setUnreadCount(null); return; }
      const result = await response.json();
      if (!signal?.aborted) setUnreadCount(Number.isSafeInteger(result.unreadCount) ? result.unreadCount : null);
    } catch { if (!signal?.aborted) setUnreadCount(null); }
  }, [receiptsEndpoint]);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch(endpoint, { cache: "no-store", signal });
      if (response.status === 401 || response.status === 403 || response.status === 404) {
        setStatus("denied");
        return;
      }
      if (!response.ok) throw new Error("Messages are temporarily unavailable.");
      const result = await response.json();
      if (!Array.isArray(result.messages) || typeof result.viewerProfileId !== "string")
        throw new Error("Messages are temporarily unavailable.");
      setMessages(result.messages);
      setViewerId(result.viewerProfileId);
      setStatus("ready");
      setError("");
      void refreshReceipts(signal);
    } catch (cause) {
      if (signal?.aborted) return;
      setError(cause instanceof Error ? cause.message : "Messages are temporarily unavailable.");
      setStatus("error");
    }
  }, [endpoint, refreshReceipts]);

  async function markRead() {
    if (markingRead || !unreadCount || status !== "ready") return;
    setMarkingRead(true);
    try {
      const response = await fetch(receiptsEndpoint, { method: "POST" });
      if ([401, 403, 404].includes(response.status)) { setStatus("denied"); return; }
      if (!response.ok) throw new Error("Read status could not be updated.");
      await refreshReceipts();
    } catch { setError("Read status could not be updated. Please retry."); }
    finally { setMarkingRead(false); }
  }

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => controller.abort();
  }, [refresh]);

  async function suggestDraft() {
    if (suggesting || status !== "ready") return;
    setSuggesting(true);
    setError("");
    try {
      const response = await fetch(`/api/chat/conversations/${encodeURIComponent(conversationId)}/suggestion`, { method: "POST" });
      if ([401, 403, 404].includes(response.status)) {
        setStatus("denied");
        return;
      }
      if (response.status === 429)
        throw new Error("Please wait a minute before requesting another draft.");
      if (!response.ok) throw new Error("A suggestion is not available right now.");
      const result = await response.json();
      if (typeof result.suggestion !== "string" || !result.suggestion.trim())
        throw new Error("A suggestion is not available right now.");
      setDraft(current => current.trim() ? current : result.suggestion);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "A suggestion is not available right now.");
    } finally {
      setSuggesting(false);
    }
  }

  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || sending || status !== "ready") return;
    setSending(true);
    setError("");
    try {
      const body = JSON.stringify({ clientMessageId: crypto.randomUUID(), text });
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      if (response.status === 401 || response.status === 403 || response.status === 404) {
        setStatus("denied");
        return;
      }
      if (!response.ok) throw new Error("Message could not be sent. Please retry.");
      setDraft("");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Message could not be sent.");
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#070D19] px-4 py-8 text-slate-100 sm:px-8">
      <section className="mx-auto flex min-h-[75vh] max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-700/70 bg-[#0D1728] shadow-2xl shadow-black/30">
        <header className="flex items-center justify-between border-b border-slate-700/70 px-5 py-4">
          <div><p className="text-xs font-semibold uppercase tracking-widest text-cyan-300">SAP Talent Hub</p><h1 className="mt-1 text-xl font-semibold">Conversation</h1></div>
          {status === "ready" && <div className="flex flex-wrap items-center gap-2">
            {unreadCount !== null && unreadCount > 0 && <button type="button" disabled={markingRead} onClick={() => void markRead()} className="rounded-lg border border-cyan-600 px-3 py-2 text-sm text-cyan-200 disabled:opacity-50">{markingRead ? "Updating…" : `Mark ${unreadCount} unread as read`}</button>}
            <button type="button" onClick={() => void refresh()} className="rounded-lg border border-slate-600 px-3 py-2 text-sm hover:border-cyan-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300">Refresh messages</button>
          </div>}
        </header>
        <div aria-live="polite" className="flex-1 space-y-3 overflow-y-auto p-5">
          {status === "loading" && <p className="text-slate-400">Loading conversation…</p>}
          {status === "denied" && <p className="rounded-xl border border-amber-600/40 p-4 text-amber-100">This conversation is unavailable to your account. Access may have changed.</p>}
          {status === "error" && <button type="button" onClick={() => void refresh()} className="text-cyan-300 underline">Retry loading messages</button>}
          {status === "ready" && messages.length === 0 && <p className="text-slate-400">No messages yet. Start the conversation below.</p>}
          {status === "ready" && messages.map(message => (
            <article key={message.id} className={`max-w-[85%] rounded-xl border px-4 py-3 ${message.sender_profile_id === viewerId ? "ml-auto border-cyan-600/40 bg-cyan-900/30" : "border-slate-700 bg-slate-800/70"}`}>
              <p className="whitespace-pre-wrap wrap-break-word text-sm leading-relaxed">{message.body}</p>
              <time className="mt-2 block text-xs text-slate-400" dateTime={message.created_at}>{new Date(message.created_at).toLocaleString()}</time>
            </article>
          ))}
        </div>
        {error && <p role="alert" className="px-5 py-2 text-sm text-amber-200">{error}</p>}
        {status === "ready" && <form onSubmit={send} className="border-t border-slate-700/70 p-4">
          <label htmlFor="chat-draft" className="mb-2 block text-sm font-medium">Message</label>
          <textarea id="chat-draft" value={draft} onChange={event => setDraft(event.target.value)} maxLength={8000} rows={3} className="w-full resize-y rounded-lg border border-slate-600 bg-slate-950 p-3 text-sm focus-visible:outline-2 focus-visible:outline-cyan-300" placeholder="Write a message for the other participant" />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            {suggestionsEnabled ? <button type="button" disabled={suggesting || !!draft.trim()} onClick={() => void suggestDraft()} className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-cyan-200 disabled:opacity-50">{suggesting ? "Suggesting…" : "Suggest a draft"}</button> : <span />}
            <button type="submit" disabled={sending || !draft.trim()} className="rounded-lg bg-cyan-300 px-5 py-2 font-semibold text-slate-950 disabled:opacity-50">{sending ? "Sending…" : "Send message"}</button>
          </div>
          {suggestionsEnabled && <p className="mt-2 text-xs text-slate-400">Suggestions are drafts. Review and edit before sending.</p>}
        </form>}
      </section>
    </main>
  );
}

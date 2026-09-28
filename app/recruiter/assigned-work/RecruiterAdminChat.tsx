"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RecruiterAdminChat({ admins }: { admins: Array<{ id: string; name: string }> }) {
  const router = useRouter();
  const [adminId, setAdminId] = useState(admins[0]?.id || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function openChat() {
    if (!adminId || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/chat/internal-conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminProfileId: adminId }),
      });
      if (!response.ok) {
        if ([401, 403, 404].includes(response.status))
          throw new Error("This admin conversation is no longer available to your account.");
        throw new Error("Chat is temporarily unavailable. Please try again.");
      }
      const result = await response.json();
      if (typeof result.conversationId !== "string" ||
          !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(result.conversationId))
        throw new Error("Chat is temporarily unavailable. Please try again.");
      router.push(`/chat/${encodeURIComponent(result.conversationId)}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Chat is unavailable.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-5" aria-label="Admin conversation">
    <h2 className="text-lg font-semibold">Chat with admin</h2>
    <p className="mt-1 text-sm text-slate-400">Contact an active admin in your organization.</p>
    <div className="mt-4 flex flex-wrap items-end gap-3">
      <label className="min-w-48 text-sm text-slate-300">Admin
        <select value={adminId} onChange={event => setAdminId(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-600 bg-slate-950 p-2 text-slate-100">
          {admins.map(admin => <option value={admin.id} key={admin.id}>{admin.name}</option>)}
        </select>
      </label>
      <button type="button" disabled={!adminId || busy} onClick={() => void openChat()} className="rounded-lg bg-cyan-300 px-4 py-2 font-semibold text-slate-950 disabled:opacity-50">{busy ? "Opening…" : "Open chat"}</button>
    </div>
    {error && <p role="alert" className="mt-3 text-sm text-amber-200">{error}</p>}
  </section>;
}

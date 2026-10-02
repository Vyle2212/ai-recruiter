"use client";

import { useEffect, useState } from "react";

export default function CandidateChatConsent() {
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/candidate/chat-consent", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Contact preference is unavailable.");
        return response.json();
      })
      .then((result) => {
        if (controller.signal.aborted) return;
        setConsent(result.consent === true);
        setState("ready");
      })
      .catch(() => {
        if (!controller.signal.aborted) setState("error");
      });
    return () => controller.abort();
  }, []);

  async function changeConsent(next: boolean) {
    if (saving || state !== "ready") return;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/candidate/chat-consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consent: next }),
      });
      if (!response.ok)
        throw new Error(
          "Could not save your contact preference. Please retry.",
        );
      const result = await response.json();
      if (result.consent !== next)
        throw new Error("Could not verify your saved preference.");
      setConsent(next);
      setMessage(
        next
          ? "Chat contact allowed."
          : "Chat contact withdrawn. New messages are blocked.",
      );
    } catch (cause) {
      setMessage(
        cause instanceof Error
          ? cause.message
          : "Contact preference unavailable.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      className="rounded-2xl border border-cyan-500/25 bg-cyan-500/5 p-5"
      aria-labelledby="chat-consent-heading"
    >
      <h2 id="chat-consent-heading" className="text-xl font-semibold">
        Chat contact preference
      </h2>
      <p className="mt-2 text-sm text-slate-300">
        This is separate from sharing your searchable profile. Only a verified
        candidate account can choose whether eligible clients and recruiters may
        contact them in chat. You can withdraw consent at any time.
      </p>
      {state === "loading" && (
        <p className="mt-4 text-sm text-slate-400">
          Loading contact preference…
        </p>
      )}
      {state === "error" && (
        <p role="alert" className="mt-4 text-sm text-amber-200">
          Contact preference is unavailable. No consent is assumed.
        </p>
      )}
      {state === "ready" && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span
            className={`rounded-full border px-3 py-1 text-sm ${consent ? "border-emerald-500/50 text-emerald-200" : "border-slate-600 text-slate-300"}`}
          >
            {consent ? "Contact allowed" : "Contact off"}
          </span>
          <button
            type="button"
            disabled={saving}
            onClick={() => void changeConsent(!consent)}
            className="rounded-lg border border-cyan-500/50 px-4 py-2 text-sm font-semibold text-cyan-100 disabled:opacity-50"
          >
            {saving
              ? "Saving…"
              : consent
                ? "Withdraw chat consent"
                : "Allow chat contact"}
          </button>
        </div>
      )}
      {message && (
        <p role="status" className="mt-3 text-sm text-slate-300">
          {message}
        </p>
      )}
    </section>
  );
}

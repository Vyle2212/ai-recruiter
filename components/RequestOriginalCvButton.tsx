"use client";

import { useState } from "react";

export function RequestOriginalCvButton({
  candidateId,
}: {
  candidateId: string;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [approved, setApproved] = useState(false);

  async function requestAccess() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/recruiter/original-cv-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Recruiter-Action": "recruiter-original-cv-request",
        },
        body: JSON.stringify({ candidateId, purpose: "headhunting" }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Request could not be sent.");
      setApproved(result.status === "approved");
      setMessage(
        result.status === "approved"
          ? "Already approved. You can open the original CV."
          : "Request sent to admin.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Request could not be sent.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        disabled={busy}
        onClick={requestAccess}
        className="rounded border border-amber-500/40 px-4 py-2 text-sm text-amber-100 disabled:opacity-50"
      >
        {busy ? "Sending..." : "Request original CV access"}
      </button>
      {message && (
        <span role="status" className="max-w-64 text-xs text-slate-300">
          {message}
        </span>
      )}
      {approved && (
        <a
          href={`/api/candidate360/${encodeURIComponent(candidateId)}/resume`}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-cyan-300"
        >
          Open original CV
        </a>
      )}
    </span>
  );
}

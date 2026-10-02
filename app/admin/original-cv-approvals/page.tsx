"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type PendingRequest = {
  id: string;
  candidate_id: string;
  recruiter_profile_id: string;
  purpose: "headhunting" | "client_support";
  client_id: string | null;
  requested_at: string;
};

export default function OriginalCvApprovalsPage() {
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/admin/original-cv-grants", {
      cache: "no-store",
    });
    const data = await response.json();
    if (!response.ok)
      throw new Error(data.error || "Could not load approval queue.");
    setRequests(data.requests || []);
  }, []);

  useEffect(() => {
    refresh()
      .catch((error) => setMessage(error.message))
      .finally(() => setLoading(false));
  }, [refresh]);

  async function decide(requestId: string, action: "approve" | "deny") {
    setBusy(requestId);
    setMessage("");
    try {
      const response = await fetch("/api/admin/original-cv-grants", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Recruiter-Action": "admin-original-cv-approval-write",
        },
        body: JSON.stringify({
          action,
          requestId,
          ...(action === "approve"
            ? { expiresAt: new Date(Date.now() + 7 * 86400000).toISOString() }
            : {}),
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Decision was not saved.");
      await refresh();
      setMessage(
        action === "approve" ? "Approved for seven days." : "Request denied.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Decision was not saved.",
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#05070A] px-6 py-8 text-slate-100">
      <div className="mx-auto max-w-5xl">
        <Link href="/admin/portal" className="text-sm text-cyan-300">
          Back to admin portal
        </Link>
        <h1 className="mt-4 text-3xl font-semibold">Original CV approvals</h1>
        <p className="mt-2 text-sm text-slate-400">
          Review recruiter requests. Client support requests require an active
          assignment, CV share, candidate visibility and eligible subscription
          at approval and read time.
        </p>
        {message && (
          <p
            role="status"
            className="mt-5 rounded border border-amber-500/40 p-3 text-sm"
          >
            {message}
          </p>
        )}
        {loading ? (
          <p className="mt-6">Loading requests...</p>
        ) : requests.length === 0 ? (
          <p className="mt-6 text-slate-400">No pending requests.</p>
        ) : (
          <div className="mt-6 space-y-4">
            {requests.map((item) => (
              <article
                key={item.id}
                className="rounded-xl border border-slate-700 bg-[#0B0F16] p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-2 text-sm">
                    <div className="font-semibold">
                      {item.purpose === "client_support"
                        ? "Client support"
                        : "Headhunting"}
                    </div>
                    <div>
                      Candidate:{" "}
                      <Link
                        className="text-cyan-300"
                        href={`/recruiter/candidate360/${item.candidate_id}`}
                      >
                        {item.candidate_id}
                      </Link>
                    </div>
                    <div>Recruiter profile: {item.recruiter_profile_id}</div>
                    {item.client_id && <div>Client: {item.client_id}</div>}
                    <div className="text-slate-400">
                      Requested: {new Date(item.requested_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      disabled={busy !== null}
                      onClick={() => decide(item.id, "approve")}
                      className="rounded bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
                    >
                      Approve 7 days
                    </button>
                    <button
                      disabled={busy !== null}
                      onClick={() => decide(item.id, "deny")}
                      className="rounded border border-slate-600 px-4 py-2 text-sm disabled:opacity-50"
                    >
                      Deny
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

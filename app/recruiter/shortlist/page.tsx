"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Item = {
  candidateId: string;
  createdAt: string;
  profile: {
    name?: string | null;
    title?: string | null;
    current_title?: string | null;
    company?: string | null;
    current_company?: string | null;
    location?: string | null;
  } | null;
};

export default function SearchShortlistPage() {
  const [jobId, setJobId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Item[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [removing, setRemoving] = useState("");

  useEffect(() => {
    setJobId(new URLSearchParams(window.location.search).get("jobId"));
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page) });
    if (jobId) params.set("jobId", jobId);
    setLoading(true);
    setError("");
    fetch(`/api/recruiter/search-v2/shortlist?${params}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (reply) => {
        if (!reply.ok) throw new Error("Could not load your shortlist.");
        return reply.json();
      })
      .then((payload) => {
        if (controller.signal.aborted) return;
        setItems(payload.items || []);
        setHasMore(payload.hasMore === true);
        setLoading(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
          setError("Could not load your shortlist. Please retry.");
        }
      });
    return () => controller.abort();
  }, [ready, jobId, page, revision]);

  async function remove(candidateId: string) {
    if (!window.confirm("Remove this candidate from your shortlist?")) return;
    setRemoving(candidateId);
    setError("");
    try {
      const reply = await fetch("/api/recruiter/search-v2/shortlist", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, candidateId }),
      });
      if (!reply.ok) throw new Error("remove_failed");
      setRevision((value) => value + 1);
    } catch {
      setError("Could not remove the candidate. Please retry.");
    } finally {
      setRemoving("");
    }
  }

  return (
    <main className="min-h-screen bg-[#05070A] px-6 py-8 text-slate-100">
      <div className="mx-auto max-w-5xl">
        <Link
          href={`/recruiter/talent-search/v2${jobId ? `?jobId=${encodeURIComponent(jobId)}` : ""}`}
          className="text-sm text-cyan-200"
        >
          Back to Search V2
        </Link>
        <h1 className="mt-5 text-3xl font-semibold">My shortlist</h1>
        <p className="mt-2 text-sm text-slate-400">
          {jobId
            ? "Candidates saved for this job."
            : "Candidates saved without a job."}{" "}
          Only your own saved candidates are shown.
        </p>
        {error ? (
          <p
            role="alert"
            className="mt-5 rounded-lg border border-amber-700 p-3 text-amber-100"
          >
            {error}{" "}
            <button
              type="button"
              onClick={() => setRevision((value) => value + 1)}
              className="underline"
            >
              Retry
            </button>
          </p>
        ) : null}
        {loading ? (
          <p role="status" className="mt-6 text-slate-400">
            Loading shortlist...
          </p>
        ) : null}
        {!loading && !error && !items.length ? (
          <p className="mt-6 rounded-xl border border-slate-800 p-6 text-slate-400">
            No available candidates on this page. Add profiles from Search V2.
          </p>
        ) : null}
        <ol className="mt-6 space-y-3">
          {items.map((item) => (
            <li
              key={item.candidateId}
              className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-800 bg-[#0B1118] p-4"
            >
              <div>
                <h2 className="font-semibold">
                  {item.profile?.name ||
                    `Candidate #${item.candidateId.slice(0, 8)}`}
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  {item.profile?.current_title ||
                    item.profile?.title ||
                    "Title unavailable"}{" "}
                  ·{" "}
                  {item.profile?.current_company ||
                    item.profile?.company ||
                    "Employer unavailable"}
                  {item.profile?.location ? ` · ${item.profile.location}` : ""}
                </p>
              </div>
              <div className="flex gap-3 text-sm">
                {item.profile?.name ? (
                  <Link
                    href={`/recruiter/talent-search/v2?q=${encodeURIComponent(item.profile.name)}&focusCandidateId=${encodeURIComponent(item.candidateId)}${jobId ? `&jobId=${encodeURIComponent(jobId)}` : ""}`}
                    className="rounded-lg border border-cyan-700 px-3 py-2 text-cyan-100"
                  >
                    Find in Search V2
                  </Link>
                ) : null}
                <button
                  type="button"
                  disabled={removing === item.candidateId}
                  onClick={() => void remove(item.candidateId)}
                  className="rounded-lg border border-slate-700 px-3 py-2 disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ol>
        <nav
          aria-label="Shortlist pages"
          className="mt-6 flex items-center gap-3"
        >
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => setPage((value) => value - 1)}
            className="rounded-lg border border-slate-700 px-3 py-2 disabled:opacity-40"
          >
            Previous
          </button>
          <span>Page {page}</span>
          <button
            type="button"
            disabled={!hasMore || loading}
            onClick={() => setPage((value) => value + 1)}
            className="rounded-lg border border-slate-700 px-3 py-2 disabled:opacity-40"
          >
            Next
          </button>
        </nav>
      </div>
    </main>
  );
}

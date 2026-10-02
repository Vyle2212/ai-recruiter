"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Candidate = { id: string; name: string; title: string };
type Recruiter = { id: string; name: string };
type Share = { kind: "candidate" | "job"; resourceId: string; recruiterId: string };

export default function ClientRecruiterSharing({ candidates, jobs, recruiters, shares, totalCandidates, totalJobs, page, jobsPage, chatEnabled }: {
  candidates: Candidate[];
  jobs: Candidate[];
  recruiters: Recruiter[];
  shares: Share[];
  totalCandidates: number;
  totalJobs: number;
  page: number;
  jobsPage: number;
  chatEnabled: boolean;
}) {
  const router = useRouter();
  const [recruiterId, setRecruiterId] = useState(recruiters[0]?.id || "");
  const [pendingId, setPendingId] = useState("");
  const [error, setError] = useState("");
  const [workingShares, setWorkingShares] = useState(shares);
  const [openingChat, setOpeningChat] = useState(false);

  async function openRecruiterChat() {
    if (!recruiterId || openingChat) return;
    setOpeningChat(true);
    setError("");
    try {
      const response = await fetch("/api/chat/client-recruiter-conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recruiterProfileId: recruiterId }),
      });
      if (!response.ok) {
        if ([401, 403, 404].includes(response.status))
          throw new Error("Chat is unavailable for this recruiter assignment or subscription.");
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
      setOpeningChat(false);
    }
  }

  async function changeShare(kind: "candidate" | "job", resourceId: string, action: "share" | "revoke") {
    if (!recruiterId || pendingId) return;
    setPendingId(`${kind}:${resourceId}`);
    setError("");
    try {
      const response = await fetch("/api/client/recruiter-shares", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Recruiter-Action": "client.recruiter-shares.write" },
        body: JSON.stringify({ kind, resourceId, recruiterProfileId: recruiterId, action }),
      });
      if (!response.ok) throw new Error(`Could not ${action} ${kind} (${response.status}). Please refresh and try again.`);
      setWorkingShares(current => action === "share"
        ? [...current.filter(item => item.kind !== kind || item.resourceId !== resourceId || item.recruiterId !== recruiterId), { kind, resourceId, recruiterId }]
        : current.filter(item => item.kind !== kind || item.resourceId !== resourceId || item.recruiterId !== recruiterId));
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sharing could not be updated.");
    } finally {
      setPendingId("");
    }
  }

  if (!recruiters.length) return <p className="text-slate-400">No active recruiter is assigned to this client account.</p>;
  return <div className="space-y-4">
    <label className="block max-w-sm text-sm text-slate-300">Assigned recruiter
      <select className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-slate-100" value={recruiterId} onChange={event => setRecruiterId(event.target.value)}>
        {recruiters.map(recruiter => <option key={recruiter.id} value={recruiter.id}>{recruiter.name}</option>)}
      </select>
    </label>
    {chatEnabled && <button type="button" disabled={!recruiterId || openingChat} onClick={() => void openRecruiterChat()}
      className="rounded-lg border border-cyan-500/50 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-500/20 disabled:opacity-50">
      {openingChat ? "Opening chat…" : "Chat with assigned recruiter"}
    </button>}
    {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
    <h3 className="pt-2 text-lg font-medium">Candidates</h3>
    {!candidates.length && <p className="text-slate-400">No candidate is available on this page.</p>}
    {candidates.map(candidate => {
      const shared = workingShares.some(item => item.kind === "candidate" && item.resourceId === candidate.id && item.recruiterId === recruiterId);
      return <div key={candidate.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 p-4">
        <div><p className="font-medium">{candidate.name}</p><p className="text-sm text-slate-400">{candidate.title}</p></div>
        <button type="button" disabled={!!pendingId} onClick={() => changeShare("candidate", candidate.id, shared ? "revoke" : "share")}
          className="rounded-lg border border-cyan-500/50 px-4 py-2 text-sm text-cyan-200 disabled:opacity-50">
          {pendingId === `candidate:${candidate.id}` ? "Saving…" : shared ? "Revoke share" : "Share with recruiter"}
        </button>
      </div>;
    })}
    {totalCandidates > 20 && <nav aria-label="Candidate pages" className="flex items-center gap-4 text-sm">
      {page > 1 && <a className="text-cyan-200 underline" href={`/client/portal?page=${page - 1}&jobsPage=${jobsPage}`}>Previous</a>}
      <span className="text-slate-400">Page {page} of {Math.ceil(totalCandidates / 20)}</span>
      {page * 20 < totalCandidates && <a className="text-cyan-200 underline" href={`/client/portal?page=${page + 1}&jobsPage=${jobsPage}`}>Next</a>}
    </nav>}
    <h3 className="pt-5 text-lg font-medium">Jobs</h3>
    {!jobs.length && <p className="text-slate-400">No owned job is currently available to share.</p>}
    {jobs.map(job => {
      const shared = workingShares.some(item => item.kind === "job" && item.resourceId === job.id && item.recruiterId === recruiterId);
      return <div key={job.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 p-4">
        <div><p className="font-medium">{job.name}</p><p className="text-sm text-slate-400">{job.title}</p></div>
        <button type="button" disabled={!!pendingId} onClick={() => changeShare("job", job.id, shared ? "revoke" : "share")}
          className="rounded-lg border border-cyan-500/50 px-4 py-2 text-sm text-cyan-200 disabled:opacity-50">
          {pendingId === `job:${job.id}` ? "Saving…" : shared ? "Revoke share" : "Share with recruiter"}
        </button>
      </div>;
    })}
    {totalJobs > 20 && <nav aria-label="Job pages" className="flex items-center gap-4 text-sm">
      {jobsPage > 1 && <a className="text-cyan-200 underline" href={`/client/portal?page=${page}&jobsPage=${jobsPage - 1}`}>Previous</a>}
      <span className="text-slate-400">Page {jobsPage} of {Math.ceil(totalJobs / 20)}</span>
      {jobsPage * 20 < totalJobs && <a className="text-cyan-200 underline" href={`/client/portal?page=${page}&jobsPage=${jobsPage + 1}`}>Next</a>}
    </nav>}
  </div>;
}

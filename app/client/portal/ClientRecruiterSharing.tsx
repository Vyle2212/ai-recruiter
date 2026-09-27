"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Candidate = { id: string; name: string; title: string };
type Recruiter = { id: string; name: string };
type Share = { candidateId: string; recruiterId: string };

export default function ClientRecruiterSharing({ candidates, recruiters, shares, totalCandidates }: {
  candidates: Candidate[];
  recruiters: Recruiter[];
  shares: Share[];
  totalCandidates: number;
}) {
  const router = useRouter();
  const [recruiterId, setRecruiterId] = useState(recruiters[0]?.id || "");
  const [pendingId, setPendingId] = useState("");
  const [error, setError] = useState("");
  const [workingShares, setWorkingShares] = useState(shares);

  async function changeShare(candidateId: string, action: "share" | "revoke") {
    if (!recruiterId || pendingId) return;
    setPendingId(candidateId);
    setError("");
    try {
      const response = await fetch("/api/client/recruiter-shares", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Recruiter-Action": "client.recruiter-shares.write" },
        body: JSON.stringify({ kind: "candidate", resourceId: candidateId, recruiterProfileId: recruiterId, action }),
      });
      if (!response.ok) throw new Error(`Could not ${action} candidate (${response.status}). Please refresh and try again.`);
      setWorkingShares(current => action === "share"
        ? [...current.filter(item => item.candidateId !== candidateId || item.recruiterId !== recruiterId), { candidateId, recruiterId }]
        : current.filter(item => item.candidateId !== candidateId || item.recruiterId !== recruiterId));
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
    {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
    {!candidates.length && <p className="text-slate-400">No candidate is currently available to share.</p>}
    {candidates.map(candidate => {
      const shared = workingShares.some(item => item.candidateId === candidate.id && item.recruiterId === recruiterId);
      return <div key={candidate.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 p-4">
        <div><p className="font-medium">{candidate.name}</p><p className="text-sm text-slate-400">{candidate.title}</p></div>
        <button type="button" disabled={!!pendingId} onClick={() => changeShare(candidate.id, shared ? "revoke" : "share")}
          className="rounded-lg border border-cyan-500/50 px-4 py-2 text-sm text-cyan-200 disabled:opacity-50">
          {pendingId === candidate.id ? "Saving…" : shared ? "Revoke share" : "Share with recruiter"}
        </button>
      </div>;
    })}
    {totalCandidates > 20 && <p className="text-sm text-slate-400">Showing the 20 most recently assigned candidates. More candidates require pagination.</p>}
  </div>;
}

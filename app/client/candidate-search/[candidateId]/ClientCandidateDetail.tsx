"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Entry = { id: string; [key: string]: unknown };
type Profile = {
  overview: { name: string; currentTitle: string; currentCompany: string; location: string };
  experience: Array<Entry & { company: string; title: string; start: string; end: string; responsibilities: string[] }>;
  projects: Array<Entry & { name: string; client: string; employer: string; role: string; start: string; end: string; modules: string[]; responsibilities: string[] }>;
  education: Array<Entry & { qualification: string; institution: string; fieldOfStudy: string; startYear: string; endYear: string }>;
  skills: string[];
  sapModules: string[];
};

const card = "rounded-2xl border border-slate-800 bg-[#0B0F16] p-5";
const dateRange = (start: string, end: string) => [start, end].filter(Boolean).join(" – ") || "Dates not specified";

export default function ClientCandidateDetail({ chatEnabled }: { chatEnabled: boolean }) {
  const { candidateId } = useParams<{ candidateId: string }>();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState("");
  const [chatError, setChatError] = useState("");
  const [openingChat, setOpeningChat] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/client/candidates/${encodeURIComponent(candidateId)}`, { signal: controller.signal, cache: "no-store" })
      .then(async response => {
        if (!response.ok) throw new Error(response.status === 404 ? "This profile is not available to your client account." : "Profile is unavailable. Please try again.");
        return response.json() as Promise<Profile>;
      })
      .then(setProfile).catch(cause => { if (!controller.signal.aborted) setError(cause.message); });
    return () => controller.abort();
  }, [candidateId]);
  async function openChat() {
    if (openingChat) return;
    setOpeningChat(true);
    setChatError("");
    try {
      const body = JSON.stringify({ candidateId });
      const response = await fetch("/api/chat/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      if (!response.ok) {
        if ([401, 403, 404].includes(response.status))
          throw new Error("Chat is available only when your subscription is active and this candidate has a verified account and agreed to contact.");
        throw new Error("Chat is temporarily unavailable. Please retry later.");
      }
      const result = await response.json();
      if (typeof result.conversationId !== "string" || !/^[0-9a-f-]{36}$/i.test(result.conversationId))
        throw new Error("Chat is temporarily unavailable. Please retry later.");
      router.push(`/chat/${encodeURIComponent(result.conversationId)}`);
    } catch (cause) {
      setChatError(cause instanceof Error ? cause.message : "Chat is unavailable.");
    } finally {
      setOpeningChat(false);
    }
  }
  return <main className="min-h-screen bg-[#05070A] px-6 py-10 text-slate-100"><div className="mx-auto max-w-5xl space-y-6">
    <Link href="/client/candidate-search" className="text-sm text-cyan-300">← Candidate search</Link>
    {error && <p role="alert" className="rounded-xl border border-amber-500/30 p-5 text-amber-200">{error}</p>}
    {!profile && !error && <p className="text-slate-400">Loading profile…</p>}
    {profile && <>
      <header><h1 className="text-3xl font-semibold">{profile.overview.name || "Candidate"}</h1><p className="mt-2 text-slate-400">{[profile.overview.currentTitle, profile.overview.currentCompany, profile.overview.location].filter(Boolean).join(" · ")}</p>
        {chatEnabled && <div className="mt-5"><button type="button" onClick={() => void openChat()} disabled={openingChat} className="rounded-lg border border-cyan-500/50 bg-cyan-500/10 px-5 py-2 font-semibold text-cyan-100 hover:bg-cyan-500/20 disabled:opacity-50">{openingChat ? "Opening chat…" : "Chat with candidate"}</button>{chatError && <p role="alert" className="mt-2 text-sm text-amber-200">{chatError}</p>}</div>}
      </header>
      <section className={card}><h2 className="text-xl font-semibold">Experience</h2><div className="mt-4 space-y-5">{profile.experience.length ? profile.experience.map(item => <article key={item.id}><h3 className="font-medium">{item.title || "Role unspecified"} · {item.company || "Employer unspecified"}</h3><p className="text-sm text-slate-400">Employment: {dateRange(item.start, item.end)}</p><ul className="mt-2 space-y-1 text-sm text-slate-300">{item.responsibilities.map((text, index) => <li key={index}>• {text}</li>)}</ul></article>) : <p className="text-slate-400">No structured employment history available.</p>}</div></section>
      <section className={card}><h2 className="text-xl font-semibold">Projects</h2><div className="mt-4 space-y-5">{profile.projects.length ? profile.projects.map(item => <article key={item.id}><h3 className="font-medium">{item.name || "Project"}</h3><p className="text-sm text-slate-400">{[item.role, item.client && `Client: ${item.client}`, item.employer && `Employer: ${item.employer}`].filter(Boolean).join(" · ")}</p><p className="text-sm text-slate-400">Project: {dateRange(item.start, item.end)}</p><p className="mt-2 text-sm text-cyan-200">{item.modules.join(" · ")}</p><ul className="mt-2 space-y-1 text-sm text-slate-300">{item.responsibilities.map((text, index) => <li key={index}>• {text}</li>)}</ul></article>) : <p className="text-slate-400">No structured projects available.</p>}</div></section>
      <section className={card}><h2 className="text-xl font-semibold">Education</h2><div className="mt-4 space-y-3">{profile.education.length ? profile.education.map(item => <p key={item.id}>{[item.qualification, item.fieldOfStudy, item.institution, dateRange(item.startYear, item.endYear)].filter(Boolean).join(" · ")}</p>) : <p className="text-slate-400">No structured education available.</p>}</div></section>
      <section className={card}><h2 className="text-xl font-semibold">Skills</h2><p className="mt-4 text-slate-300">{[...new Set([...profile.sapModules, ...profile.skills])].join(" · ") || "No structured skills available."}</p></section>
      <p className="text-sm text-slate-500">Original CV access is handled separately. Project dates are shown only when recorded and do not set employer tenure.</p>
    </>}
  </div></main>;
}

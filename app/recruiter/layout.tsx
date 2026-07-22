"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [["Dashboard", "/recruiter/dashboard"], ["Smart Shortlist", "/recruiter/smart-shortlist"], ["Candidate Compare", "/recruiter/candidate-compare"], ["Submission Generator", "/recruiter/submission-generator"], ["Client Report", "/recruiter/client-report"], ["Import Staging", "/recruiter/import-staging"], ["Import Merge", "/recruiter/import-merge"], ["Workflow", "/recruiter/workflow"]];

export default function RecruiterLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return <><nav aria-label="Recruiter navigation" className="sticky top-0 z-50 border-b border-slate-800 bg-[#070A0F]/95 px-4 py-3 text-slate-100 shadow-lg shadow-black/20 backdrop-blur"><div className="mx-auto flex max-w-[1500px] items-center gap-3"><Link href="/recruiter/dashboard" className="shrink-0 rounded-lg px-2 py-2 font-semibold text-white">AI Recruiter</Link><div className="flex min-w-0 flex-1 gap-1 overflow-x-auto pb-1 sm:pb-0">{links.map(([label, href]) => { const active = pathname === href || (href !== "/recruiter/dashboard" && pathname.startsWith(`${href}/`)); return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`shrink-0 rounded-lg px-3 py-2 text-xs font-medium transition ${active ? "bg-cyan-400 text-slate-950" : "text-slate-300 hover:bg-slate-800 hover:text-cyan-100"}`}>{label}</Link>; })}</div><span className="shrink-0 rounded-full border border-emerald-500/30 bg-emerald-500/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-100">Read-only</span></div></nav>{children}</>;
}

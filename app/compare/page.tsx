import { CandidateCompareWorkspace } from "@/components/candidate-compare-workspace";
import Link from "next/link";

export default function ComparePage() {
  return <><div className="border-b border-violet-500/20 bg-[#0B0F16] px-5 py-3 text-white"><div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-3"><div><span className="text-xs font-semibold uppercase text-violet-200">Pack Compare</span><p className="text-sm text-slate-400">Executive comparison for Top 5, Top 10, or Top 20 search-result packs.</p></div><div className="flex gap-3 text-sm"><Link href="/recruiter/talent-search" className="text-violet-100">Back to Talent Search</Link><Link href="/recruiter/dashboard" className="text-cyan-100">AI Recruiter Dashboard</Link></div></div></div><CandidateCompareWorkspace /></>;
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { StagingRuntimeSignOutButton } from "../auth/staging/runtime/StagingRuntimeSignOutButton";

const PRIMARY_RECRUITER_NAV=[["Dashboard","/recruiter/dashboard"],["Jobs","/recruiter/jobs"],["Search","/recruiter/talent-search"],["Shortlist","/recruiter/smart-shortlist"],["Compare","/recruiter/compare"],["Submissions","/recruiter/submission-generator"],["Reports","/recruiter/client-report"]] as const;
const ADMIN_DATA_NAV=[["Data Import","/recruiter/import-staging"],["Merge Review","/recruiter/import-merge"],["Data Workflow","/recruiter/workflow"],["Product Health","/recruiter/dashboard#product-health"]] as const;

export default function RecruiterLayout({children}:{children:React.ReactNode}){
  const pathname=usePathname();
  const item=(label:string,href:string,secondary=false)=>{const route=href.split("#")[0],active=pathname===route||(route!=="/recruiter/dashboard"&&pathname.startsWith(`${route}/`));return <Link key={href} href={href} aria-current={active?"page":undefined} className={`shrink-0 rounded-lg px-3 py-2 text-xs font-medium transition ${active?secondary?"bg-slate-700 text-white":"bg-cyan-400 text-slate-950":secondary?"text-slate-400 hover:bg-slate-800 hover:text-white":"text-slate-300 hover:bg-slate-800 hover:text-cyan-100"}`}>{label}</Link>};
  return <><nav aria-label="Recruiter navigation" className="sticky top-0 z-50 border-b border-slate-800 bg-[#070A0F]/95 text-slate-100 shadow-lg shadow-black/20 backdrop-blur"><div className="mx-auto flex max-w-[1500px] items-center gap-3 px-4 py-3"><Link href="/recruiter/dashboard" className="shrink-0 rounded-lg px-2 py-2 font-semibold text-white">AI Recruiter</Link><div aria-label="Primary recruiter" className="flex min-w-0 flex-1 gap-1 overflow-x-auto pb-1 sm:pb-0">{PRIMARY_RECRUITER_NAV.map(([label,href])=>item(label,href))}</div><span className="shrink-0 rounded-full border border-emerald-500/30 bg-emerald-500/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-100">
  Staging guarded
</span>
<StagingRuntimeSignOutButton className="shrink-0" /></div><div className="border-t border-slate-800/70 bg-[#05070A]/80"><div className="mx-auto flex max-w-[1500px] items-center gap-2 overflow-x-auto px-4 py-2"><span className="shrink-0 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Admin / Data</span>{ADMIN_DATA_NAV.map(([label,href])=>item(label,href,true))}</div></div></nav>{children}</>;
}

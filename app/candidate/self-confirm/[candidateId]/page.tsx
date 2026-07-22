"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Candidate360Profile } from "@/lib/candidate360Types";

type FormValues = Record<string, string | boolean>;
const inputClass = "mt-1 w-full rounded-md border border-slate-700 bg-[#05070A] px-3 py-2 text-sm text-white outline-none focus:border-cyan-400";

export default function CandidateSelfConfirmPage({ params }: { params: Promise<{ candidateId: string }> }) {
  const [candidateId, setCandidateId] = useState("");
  const [profile, setProfile] = useState<Candidate360Profile | null>(null);
  const [values, setValues] = useState<FormValues>({});
  const [preview, setPreview] = useState<any>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    params.then(async ({ candidateId }) => {
      setCandidateId(candidateId);
      const response = await fetch(`/api/candidate360/${encodeURIComponent(candidateId)}`, { signal: controller.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load candidate profile");
      setProfile(data);
      setValues({
        displayName: String(data.displayName.value ?? ""), email: String(data.contactInfo.email.value ?? ""), phone: String(data.contactInfo.phone.value ?? ""),
        currentTitle: String(data.currentTitle.value ?? ""), currentCompany: String(data.currentCompany.value ?? ""), location: String(data.location.value ?? ""),
        workExperience: JSON.stringify(data.workExperience, null, 2),
        sapModules: data.sapModules.map((item: any) => item.name.value).join(", "),
        techSkills: data.techSkills.map((item: any) => item.name.value).join(", "),
        expectedSalary: "", availability: "", confirmAccuracy: false,
      });
    }).catch((reason) => { if (reason?.name !== "AbortError") setError(reason instanceof Error ? reason.message : "Unable to load profile"); });
    return () => controller.abort();
  }, [params]);
  function set(fieldName: string, value: string | boolean) { setValues((current) => ({ ...current, [fieldName]: value })); }
  async function previewChanges() {
    setError(""); setPreview(null);
    try {
      const response = await fetch(`/api/candidate360/${encodeURIComponent(candidateId)}/self-confirm/preview`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ submittedFields: values }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to preview changes");
      setPreview(data);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to preview changes"); }
  }
  const profileField=(fieldName:string)=>fieldName==="email"?profile?.contactInfo.email:fieldName==="phone"?profile?.contactInfo.phone:(profile as any)?.[fieldName];
  const textInput = (fieldName: string, label: string, required = false) => {const field=profileField(fieldName),current=String(field?.value??"").trim(),status=!current?"Missing":field?.verificationStatus==="candidate_confirmed"?"Confirmed":field?.verificationStatus==="candidate_edited_needs_recruiter_review"?"Recruiter review required":"Needs confirmation";return <label className="block text-sm text-slate-300"><span className="flex flex-wrap items-center justify-between gap-2"><span>{label}{required ? " *" : ""}</span><span className={`rounded-full border px-2 py-0.5 text-[11px] ${status==="Confirmed"?"border-emerald-500/30 text-emerald-100":status==="Missing"?"border-amber-500/30 text-amber-100":status.includes("review")?"border-red-500/30 text-red-100":"border-slate-700 text-slate-400"}`}>{status}</span></span><span className="mt-2 block text-xs text-slate-500">Current: {current||"Not provided"}</span><input className={inputClass} value={String(values[fieldName] ?? "")} onChange={(event) => set(fieldName, event.target.value)} /></label>};
  return <main className="min-h-screen bg-[#05070A] text-slate-100">
    <header className="border-b border-slate-800 bg-[#070A0F] px-6 py-6"><div className="mx-auto max-w-[1000px]"><Link href="/candidate/portal" className="text-sm text-cyan-100">Back to Candidate Portal</Link><div className="mt-3 flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-3xl font-semibold">Review your profile</h1><p className="mt-2 text-lg text-white">{profile?String(profile.displayName.value)||"Candidate profile":"Candidate profile"}</p>{profile?<p className="mt-1 text-sm text-slate-400">{String(profile.currentTitle.value)||"Title missing"} &bull; {String(profile.currentCompany.value)||"Company missing"} &bull; {String(profile.location.value)||"Location missing"}</p>:null}</div><div className="text-right"><span className="rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-bold uppercase text-amber-100">Preview only</span>{profile?<div className="mt-3 text-sm text-slate-400">Profile completeness <span className="font-semibold text-white">{profile.completeness.score}%</span></div>:null}</div></div></div></header>
    <div className="border-b border-cyan-500/20 bg-cyan-500/5 px-6 py-4"><div className="mx-auto flex max-w-[1000px] flex-wrap items-center justify-between gap-3"><div><div className="font-semibold text-cyan-100">Candidate Portal MVP Preview</div><div className="mt-1 text-xs text-slate-400">Manage availability, salary expectations, preferences, CV upload placeholder, and consent.</div></div><Link className="text-sm text-cyan-300" href={"/candidate/portal?candidateId="+encodeURIComponent(candidateId)}>Back to Candidate Portal</Link></div></div>
    <section className="mx-auto max-w-[1000px] space-y-5 px-6 py-6">
      {error ? <div className="border border-red-500/30 bg-red-500/10 p-4 text-red-100">{error}</div> : null}
      {!profile && !error ? <div className="border border-slate-800 bg-[#0B0F16] p-6">Loading self-confirm form...</div> : null}
      {profile ? <>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{["Review","Edit","Preview changes","Submit for review"].map((step,index)=><div key={step} className="rounded-lg border border-slate-800 bg-[#0B0F16] p-4"><div className="text-xs font-bold uppercase text-cyan-200">Step {index+1}</div><div className="mt-1 text-sm text-slate-200">{step}</div>{index===3?<div className="mt-1 text-xs text-slate-500">Coming soon</div>:null}</div>)}</div>
        <div className="border border-slate-800 bg-[#0B0F16] p-5"><h2 className="font-semibold">Personal information</h2><div className="mt-4">{textInput("displayName", "Full name", true)}</div></div>
        <div className="border border-slate-800 bg-[#0B0F16] p-5"><h2 className="font-semibold">Contact information</h2><div className="mt-4 grid gap-4 md:grid-cols-2">{textInput("email", "Email")}{textInput("phone", "Phone")}</div></div>
        <div className="border border-slate-800 bg-[#0B0F16] p-5"><h2 className="font-semibold">Current role</h2><div className="mt-4 grid gap-4 md:grid-cols-3">{textInput("currentTitle", "Current title", true)}{textInput("currentCompany", "Current company", true)}{textInput("location", "Location", true)}</div></div>
        <div className="border border-slate-800 bg-[#0B0F16] p-5"><h2 className="font-semibold">Work experience</h2><textarea className={`${inputClass} min-h-48 font-mono text-xs`} value={String(values.workExperience ?? "")} onChange={(event) => set("workExperience", event.target.value)} /><p className="mt-2 text-xs text-slate-500">Structured editor foundation; JSON is shown in this preview iteration.</p></div>
        <div className="border border-slate-800 bg-[#0B0F16] p-5"><h2 className="font-semibold">Skills / modules</h2><div className="mt-4 grid gap-4 md:grid-cols-2">{textInput("sapModules", "SAP modules")}{textInput("techSkills", "Technical skills")}</div></div>
<div className="border border-slate-800 bg-[#0B0F16] p-5"><h2 className="font-semibold">Missing information</h2><div className="mt-3 flex flex-wrap gap-2">{profile.missingFields.length?profile.missingFields.map(item=><span key={item} className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs text-amber-100">{item}</span>):<span className="text-sm text-emerald-100">No foundation fields are missing.</span>}</div><p className="mt-3 text-xs text-slate-500">Missing details can be previewed here; nothing is saved yet.</p></div>
        <div className="border border-cyan-500/20 bg-cyan-500/5 p-5"><h2 className="mb-4 font-semibold">Confirmation and consent</h2><label className="flex items-start gap-3 text-sm text-slate-200"><input type="checkbox" className="mt-1" checked={Boolean(values.confirmAccuracy)} onChange={(event) => set("confirmAccuracy", event.target.checked)} /><span>I consent to submit these profile confirmations and confirm they are accurate to the best of my knowledge.</span></label><div className="mt-4 flex flex-wrap gap-3"><button type="button" disabled={!Boolean(values.confirmAccuracy)} onClick={previewChanges} className="disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400 rounded-md bg-cyan-400 px-5 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300">Preview changes</button><button type="button" disabled className="cursor-not-allowed rounded-md border border-slate-700 px-5 py-2 text-sm text-slate-500">Submit confirmation — coming soon</button></div><p className="mt-2 text-xs text-slate-500">Your changes are not saved yet. This preview shows what would be sent for recruiter review.</p></div>
        {preview ? <div className="border border-slate-700 bg-[#0B0F16] p-5"><h2 className="font-semibold">Change preview</h2><div className="mt-3 grid gap-3 md:grid-cols-3"><div className="rounded border border-emerald-500/20 bg-emerald-500/5 p-3"><div className="text-xs text-emerald-100">Safe confirmations</div><div className="mt-1 text-2xl">{preview.safeConfirmations?.length??0}</div></div><div className="rounded border border-amber-500/20 bg-amber-500/5 p-3"><div className="text-xs text-amber-100">Needs recruiter review</div><div className="mt-1 text-2xl">{preview.needsRecruiterReview?.length??0}</div></div><div className="rounded border border-red-500/20 bg-red-500/5 p-3"><div className="text-xs text-red-100">Blocked changes</div><div className="mt-1 text-2xl">{preview.blockedChanges?.length??0}</div></div></div><div className="mt-3 grid gap-3 md:grid-cols-3"><div className="border border-slate-800 p-3"><div className="text-xs text-slate-500">Changed fields</div><div className="text-2xl">{preview.changedFields.length}</div></div><div className="border border-slate-800 p-3"><div className="text-xs text-slate-500">Completeness</div><div className="text-2xl">{preview.completenessBefore}% &rarr; {preview.completenessAfter}%</div></div><div className="border border-slate-800 p-3"><div className="text-xs text-slate-500">Recruiter review</div><div className="text-2xl">{preview.recruiterReviewRequired ? "Required" : "Not required"}</div></div></div><div className="mt-4 space-y-2">{preview.changedFields.map((item: any) => <div key={item.fieldName} className="border border-slate-800 bg-[#05070A] p-3 text-sm"><div className="font-semibold text-cyan-100">{item.fieldName}</div><div className="text-slate-400">{String(item.beforeValue ?? "Missing")} &rarr; {String(item.submittedValue ?? "Missing")}</div><div className="text-xs text-amber-100">{item.proposedVerificationStatus.replace(/_/g, " ")}</div></div>)}</div><p className="mt-4 text-sm text-cyan-100">What happens next: safe confirmations could be staged; conflicts stay held for recruiter review. No database write is performed.</p></div> : null}
      </> : null}
    </section>
  </main>;
}

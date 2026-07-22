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
  const textInput = (fieldName: string, label: string, required = false) => <label className="block text-sm text-slate-300">{label}{required ? " *" : ""}<input className={inputClass} value={String(values[fieldName] ?? "")} onChange={(event) => set(fieldName, event.target.value)} /></label>;
  return <main className="min-h-screen bg-[#05070A] text-slate-100">
    <header className="border-b border-slate-800 bg-[#070A0F] px-6 py-5"><div className="mx-auto max-w-[1000px]"><Link href={candidateId ? `/recruiter/candidate360/${candidateId}` : "/recruiter/workflow"} className="text-sm text-cyan-100">Back to Candidate360</Link><div className="mt-2 flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-semibold">Review and confirm your profile</h1><p className="mt-1 text-sm text-slate-400">Review each section and preview how corrections affect completeness and trust.</p></div><span className="rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-bold uppercase text-amber-100">Preview only. No profile updates are saved yet.</span></div></div></header>
    <section className="mx-auto max-w-[1000px] space-y-5 px-6 py-6">
      {error ? <div className="border border-red-500/30 bg-red-500/10 p-4 text-red-100">{error}</div> : null}
      {!profile && !error ? <div className="border border-slate-800 bg-[#0B0F16] p-6">Loading self-confirm form...</div> : null}
      {profile ? <>
        <div className="border border-slate-800 bg-[#0B0F16] p-5"><h2 className="font-semibold">Personal information</h2><div className="mt-4">{textInput("displayName", "Full name", true)}</div></div>
        <div className="border border-slate-800 bg-[#0B0F16] p-5"><h2 className="font-semibold">Contact information</h2><div className="mt-4 grid gap-4 md:grid-cols-2">{textInput("email", "Email")}{textInput("phone", "Phone")}</div></div>
        <div className="border border-slate-800 bg-[#0B0F16] p-5"><h2 className="font-semibold">Current role and location</h2><div className="mt-4 grid gap-4 md:grid-cols-3">{textInput("currentTitle", "Current title", true)}{textInput("currentCompany", "Current company", true)}{textInput("location", "Location", true)}</div></div>
        <div className="border border-slate-800 bg-[#0B0F16] p-5"><h2 className="font-semibold">Work experience</h2><textarea className={`${inputClass} min-h-48 font-mono text-xs`} value={String(values.workExperience ?? "")} onChange={(event) => set("workExperience", event.target.value)} /><p className="mt-2 text-xs text-slate-500">Structured editor foundation; JSON is shown in this preview iteration.</p></div>
        <div className="border border-slate-800 bg-[#0B0F16] p-5"><h2 className="font-semibold">Skills / modules</h2><div className="mt-4 grid gap-4 md:grid-cols-2">{textInput("sapModules", "SAP modules")}{textInput("techSkills", "Technical skills")}</div></div>
        <div className="border border-slate-800 bg-[#0B0F16] p-5"><h2 className="font-semibold">Salary / availability <span className="text-sm font-normal text-slate-500">(optional placeholder)</span></h2><div className="mt-4 grid gap-4 md:grid-cols-2">{textInput("expectedSalary", "Expected salary")}{textInput("availability", "Availability / notice period")}</div></div>
        <div className="border border-cyan-500/20 bg-cyan-500/5 p-5"><label className="flex items-start gap-3 text-sm text-slate-200"><input type="checkbox" className="mt-1" checked={Boolean(values.confirmAccuracy)} onChange={(event) => set("confirmAccuracy", event.target.checked)} /><span>I confirm that this profile is accurate to the best of my knowledge.</span></label><button type="button" onClick={previewChanges} className="mt-4 rounded-md bg-cyan-400 px-5 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300">Preview changes</button><p className="mt-2 text-xs text-slate-500">There is no final submit endpoint. Previewing does not update the candidate database.</p></div>
        {preview ? <div className="border border-slate-700 bg-[#0B0F16] p-5"><h2 className="font-semibold">Change preview</h2><div className="mt-3 grid gap-3 md:grid-cols-3"><div className="border border-slate-800 p-3"><div className="text-xs text-slate-500">Changed fields</div><div className="text-2xl">{preview.changedFields.length}</div></div><div className="border border-slate-800 p-3"><div className="text-xs text-slate-500">Completeness</div><div className="text-2xl">{preview.completenessBefore}% ? {preview.completenessAfter}%</div></div><div className="border border-slate-800 p-3"><div className="text-xs text-slate-500">Recruiter review</div><div className="text-2xl">{preview.recruiterReviewRequired ? "Required" : "Not required"}</div></div></div><div className="mt-4 space-y-2">{preview.changedFields.map((item: any) => <div key={item.fieldName} className="border border-slate-800 bg-[#05070A] p-3 text-sm"><div className="font-semibold text-cyan-100">{item.fieldName}</div><div className="text-slate-400">{String(item.beforeValue ?? "Missing")} ? {String(item.submittedValue ?? "Missing")}</div><div className="text-xs text-amber-100">{item.proposedVerificationStatus.replace(/_/g, " ")}</div></div>)}</div><p className="mt-4 text-sm text-cyan-100">Preview only. Candidate DB write performed: no.</p></div> : null}
      </> : null}
    </section>
  </main>;
}

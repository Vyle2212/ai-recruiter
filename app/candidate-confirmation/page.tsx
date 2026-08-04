"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type AnyRecord = Record<string, any>;

const VISA_STATUS_OPTIONS = ["Citizen", "PR", "EP Holder", "DP Holder", "Work Visa", "Visa Required / Sponsorship"];
const AVAILABILITY_OPTIONS = ["Actively Looking", "Open To Work", "Open To Discussion", "Passive", "Not Open To Work"];
const AVAILABLE_WITHIN_OPTIONS = ["Immediate", "2 weeks", "1 month", "2 months", "3 months", "6 months"];
const EMPLOYMENT_OPTIONS = ["Permanent", "Contract", "Both"];
const CURRENCIES = ["USD", "EUR", "GBP", "SGD", "MYR", "PHP", "THB", "VND", "IDR", "AUD", "NZD", "JPY", "CNY", "HKD", "AED", "SAR", "QAR", "INR"];

function n(value: any) {
  const num = Number(value);
  return Number.isFinite(num) ? String(num) : "0";
}

function parseLanguages(value: any): string {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.join(", ");
    } catch {}
    return value;
  }
  return "";
}

function Input({ label, value, onChange, type = "text", placeholder = "" }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return <label className="block"><span className="mb-1 block text-xs font-black uppercase tracking-wide text-sky-200">{label}</span><input type={type} min={type === "number" ? 0 : undefined} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="h-11 w-full rounded-lg border border-slate-700 bg-black px-3 text-sm font-bold text-white outline-none focus:border-cyan-400" /></label>;
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return <label className="block"><span className="mb-1 block text-xs font-black uppercase tracking-wide text-sky-200">{label}</span><select value={value} onChange={(e) => onChange(e.target.value)} className="h-11 w-full rounded-lg border border-slate-700 bg-black px-3 text-sm font-bold text-white outline-none focus:border-cyan-400">{options.map((option) => <option key={option}>{option}</option>)}</select></label>;
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-slate-800 bg-[#15191e] p-5"><div className="mb-4"><h2 className="text-xs font-black uppercase tracking-[0.25em] text-cyan-300">{title}</h2>{subtitle ? <p className="mt-1 text-xs text-slate-400">{subtitle}</p> : null}</div>{children}</section>;
}

export default function CandidateConfirmationPage() {
  const [candidateId, setCandidateId] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const [greenfield, setGreenfield] = useState("0");
  const [rollout, setRollout] = useState("0");
  const [brownfield, setBrownfield] = useState("0");
  const [selective, setSelective] = useState("0");
  const [s4Implementation, setS4Implementation] = useState("0");
  const [s4Ams, setS4Ams] = useState("0");

  const [visaStatus, setVisaStatus] = useState("Citizen");
  const [languages, setLanguages] = useState("");
  const [availability, setAvailability] = useState("Open To Discussion");
  const [availableWithin, setAvailableWithin] = useState("1 month");
  const [relocation, setRelocation] = useState("Open to Relocation");
  const [employmentType, setEmploymentType] = useState("Both");
  const [currency, setCurrency] = useState("USD");
  const [expectedSalary, setExpectedSalary] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id") || params.get("candidateId") || "";
    setCandidateId(id);
    if (!id) return;

    fetch(`/api/candidates/${encodeURIComponent(id)}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => {
        const c: AnyRecord = json.candidate || json || {};
        setGreenfield(n(c.greenfield_projects));
        setRollout(n(c.rollout_projects));
        setBrownfield(n(c.brownfield_projects));
        setSelective(n(c.selective_transformation_projects));
        setS4Implementation(n(c.s4_implementation_projects || c.s4hana_projects));
        setS4Ams(n(c.s4_ams_projects));
        setVisaStatus(c.visa_status || c.work_authorization || "Citizen");
        setLanguages(parseLanguages(c.languages || c.language_skills));
        setAvailability(c.availability_status || "Open To Discussion");
        setAvailableWithin(c.availability_timeline || "1 month");
        setRelocation(c.relocation || c.relocation_willingness || "Open to Relocation");
        setEmploymentType(c.employment_type || c.employment_preference || "Both");
        setCurrency(c.expected_salary_currency || c.salary_currency || "USD");
        setExpectedSalary(c.expected_salary ? String(c.expected_salary) : "");
      })
      .catch(() => setMessage("Could not load candidate. You can still paste the candidate id and submit."));
  }, []);

  async function submit() {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/update-candidate-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: candidateId,
          greenfield_projects: greenfield,
          rollout_projects: rollout,
          brownfield_projects: brownfield,
          selective_transformation_projects: selective,
          s4_implementation_projects: s4Implementation,
          s4_ams_projects: s4Ams,
          visa_status: visaStatus,
          work_authorization: visaStatus,
          languages: languages.split(/[,;|]+/).map((x) => x.trim()).filter(Boolean),
          availability_status: availability,
          availability_timeline: availableWithin,
          relocation,
          relocation_willingness: relocation,
          employment_type: employmentType,
          employment_preference: employmentType,
          expected_salary_currency: currency,
          expected_salary: expectedSalary,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Update failed");
      setMessage("Profile confirmed successfully. Project data source is now Candidate Portal.");
    } catch (err: any) {
      setMessage(err?.message || "Update failed");
    } finally {
      setLoading(false);
    }
  }

  return <main className="min-h-screen bg-black p-6 text-white">
    <div className="mb-6 flex items-center justify-between"><div><h1 className="text-3xl font-bold">Candidate Confirmation Portal</h1><p className="mt-1 text-sm text-slate-400">Candidate confirms SAP delivery, work rights, languages, compensation, and availability.</p></div><Link href="/candidates" className="text-sm font-bold text-sky-300">← Candidates</Link></div>

    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      <Section title="Candidate" subtitle="Use a secure token later. For Sprint build, candidate id is enough."><Input label="Candidate ID" value={candidateId} onChange={setCandidateId} placeholder="Paste candidate UUID" /></Section>

      <Section title="Project Delivery Confirmation" subtitle="Do not merge S/4 Implementation with Greenfield/Rollout/Brownfield. S/4 is tracked independently.">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3"><Input label="Greenfield" type="number" value={greenfield} onChange={setGreenfield} /><Input label="Rollout" type="number" value={rollout} onChange={setRollout} /><Input label="Brownfield" type="number" value={brownfield} onChange={setBrownfield} /><Input label="Selective Transformation" type="number" value={selective} onChange={setSelective} /><Input label="S/4 Implementation" type="number" value={s4Implementation} onChange={setS4Implementation} /><Input label="S/4 AMS" type="number" value={s4Ams} onChange={setS4Ams} /></div>
      </Section>

      <Section title="Work Authorization & Availability">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2"><Select label="Visa / Work Rights" value={visaStatus} onChange={setVisaStatus} options={VISA_STATUS_OPTIONS} /><Select label="Availability" value={availability} onChange={setAvailability} options={AVAILABILITY_OPTIONS} /><Select label="Available Within" value={availableWithin} onChange={setAvailableWithin} options={AVAILABLE_WITHIN_OPTIONS} /><Select label="Employment Type" value={employmentType} onChange={setEmploymentType} options={EMPLOYMENT_OPTIONS} /><Input label="Relocation / Travel" value={relocation} onChange={setRelocation} /></div>
      </Section>

      <Section title="Language & Compensation" subtitle="Examples: English 9/10, Mandarin 7/10, Japanese N2.">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3"><div className="md:col-span-3"><Input label="Languages" value={languages} onChange={setLanguages} placeholder="English 9/10, Japanese N2" /></div><Select label="Currency" value={currency} onChange={setCurrency} options={CURRENCIES} /><div className="md:col-span-2"><Input label="Expected Monthly Salary" type="number" value={expectedSalary} onChange={setExpectedSalary} placeholder="Example: 180000" /></div></div>
      </Section>
    </div>

    <div className="mt-6 flex items-center gap-3"><button onClick={submit} disabled={loading || !candidateId} className="rounded-xl bg-green-600 px-6 py-3 text-sm font-black text-white hover:bg-green-700 disabled:opacity-50">{loading ? "Saving..." : "Confirm Profile"}</button>{message ? <p className="text-sm font-bold text-cyan-300">{message}</p> : null}</div>
  </main>;
}

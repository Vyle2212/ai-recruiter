"use client";

import { useEffect, useMemo, useState } from "react";
import { COMPANY_TAXONOMY, SAP_SKILL_TAXONOMY } from "@/lib/sapTalentTaxonomy";

type TaxonomyType = "sap" | "company";
type AnyRecord = Record<string, any>;

function normalizeList(value: string) {
  return value
    .split(/[\n,;|]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function AdminTaxonomyPage() {
  const [type, setType] = useState<TaxonomyType>("sap");
  const [q, setQ] = useState("");
  const [records, setRecords] = useState<AnyRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState<AnyRecord>({
    code: "",
    name: "",
    category: "",
    aliases: "",
    submodules: "",
    countries: "",
    active: true,
  });

  async function load() {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch(`/api/admin/taxonomy?type=${type}`, { cache: "no-store" });
      const json = await res.json();
      setRecords(json.records || []);
    } catch (err: any) {
      setMessage(err?.message || "Unable to load taxonomy");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [type]);

  const filtered = useMemo(() => {
    const needle = q.toLowerCase().trim();
    if (!needle) return records;
    return records.filter((record) => JSON.stringify(record).toLowerCase().includes(needle));
  }, [q, records]);

  async function saveRecord() {
    setLoading(true);
    setMessage("");
    try {
      const payload =
        type === "sap"
          ? {
              type,
              record: {
                code: form.code.trim(),
                name: form.name.trim(),
                category: form.category.trim() || "Other",
                aliases: normalizeList(form.aliases || ""),
                submodules: normalizeList(form.submodules || ""),
                active: !!form.active,
              },
            }
          : {
              type,
              record: {
                name: form.name.trim(),
                category: form.category.trim() || "Other",
                countries: normalizeList(form.countries || ""),
                aliases: normalizeList(form.aliases || ""),
                active: !!form.active,
              },
            };
      const res = await fetch("/api/admin/taxonomy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Save failed");
      setMessage("Saved. Taxonomy is ready for search/parser alias matching.");
      setForm({ code: "", name: "", category: "", aliases: "", submodules: "", countries: "", active: true });
      load();
    } catch (err: any) {
      setMessage(err?.message || "Save failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-black p-6 text-white">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-300">Admin</p>
          <h1 className="text-3xl font-semibold">Global Taxonomy</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            Maintain SAP modules, submodules, aliases, consulting firms, local partners, and end-client company references without hardcoding search UI.
          </p>
        </div>
        <a href="/search" className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-bold text-sky-100 hover:border-cyan-500">
          Back to Search
        </a>
      </div>

      <section className="mb-5 rounded-2xl border border-slate-800 bg-[#15191e] p-4">
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => setType("sap")} className={`rounded-full border px-4 py-2 text-sm font-black ${type === "sap" ? "border-cyan-400 bg-cyan-950 text-cyan-100" : "border-slate-700 bg-slate-900 text-slate-300"}`}>SAP Skills</button>
          <button onClick={() => setType("company")} className={`rounded-full border px-4 py-2 text-sm font-black ${type === "company" ? "border-cyan-400 bg-cyan-950 text-cyan-100" : "border-slate-700 bg-slate-900 text-slate-300"}`}>Companies</button>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search taxonomy..." className="h-11 min-w-[260px] flex-1 rounded-lg border border-slate-700 bg-black px-3 text-sm font-semibold outline-none focus:border-cyan-400" />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="rounded-2xl border border-slate-800 bg-[#15191e] p-4 lg:col-span-4">
          <p className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-cyan-300">Add / Update</p>
          {type === "sap" ? (
            <div className="space-y-3">
              <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="Code, e.g. SD" className="h-11 w-full rounded-lg border border-slate-700 bg-black px-3 text-sm font-bold" />
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full module name, e.g. Sales & Distribution" className="h-11 w-full rounded-lg border border-slate-700 bg-black px-3 text-sm font-bold" />
              <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Category, e.g. Logistics & SCM" className="h-11 w-full rounded-lg border border-slate-700 bg-black px-3 text-sm font-bold" />
              <textarea value={form.aliases} onChange={(e) => setForm({ ...form, aliases: e.target.value })} placeholder="Aliases, comma/newline separated" rows={4} className="w-full rounded-lg border border-slate-700 bg-black px-3 py-2 text-sm font-semibold" />
              <textarea value={form.submodules} onChange={(e) => setForm({ ...form, submodules: e.target.value })} placeholder="Submodules / keywords, comma/newline separated" rows={4} className="w-full rounded-lg border border-slate-700 bg-black px-3 py-2 text-sm font-semibold" />
            </div>
          ) : (
            <div className="space-y-3">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Company name" className="h-11 w-full rounded-lg border border-slate-700 bg-black px-3 text-sm font-bold" />
              <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Category: Big 4 / Global Consulting / Regional SI / Boutique SAP Partner / End Client" className="h-11 w-full rounded-lg border border-slate-700 bg-black px-3 text-sm font-bold" />
              <textarea value={form.aliases} onChange={(e) => setForm({ ...form, aliases: e.target.value })} placeholder="Aliases / local entity names" rows={4} className="w-full rounded-lg border border-slate-700 bg-black px-3 py-2 text-sm font-semibold" />
              <textarea value={form.countries} onChange={(e) => setForm({ ...form, countries: e.target.value })} placeholder="Countries" rows={3} className="w-full rounded-lg border border-slate-700 bg-black px-3 py-2 text-sm font-semibold" />
            </div>
          )}
          <button onClick={saveRecord} disabled={loading} className="mt-4 w-full rounded-lg bg-cyan-600 px-4 py-3 text-sm font-black text-white hover:bg-cyan-500 disabled:opacity-50">
            Save Taxonomy Record
          </button>
          {message ? <p className="mt-3 text-sm text-sky-200">{message}</p> : null}
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#15191e] p-4 lg:col-span-8">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">Records</p>
            <span className="text-sm font-bold text-slate-400">{filtered.length} items</span>
          </div>
          <div className="max-h-[650px] overflow-auto rounded-xl border border-slate-800">
            {filtered.map((record, index) => (
              <div key={`${record.id || record.code || record.name}-${index}`} className="border-b border-slate-800 p-4 last:border-b-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-base font-black text-white">{record.code ? `SAP ${record.code}` : record.name}</span>
                  {record.name && record.code ? <span className="text-sm text-slate-300">— {record.name}</span> : null}
                  {record.category ? <span className="rounded-full border border-cyan-800 bg-cyan-950/50 px-2 py-0.5 text-xs font-bold text-cyan-100">{record.category}</span> : null}
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  {[...(record.aliases || []), ...(record.submodules || []), ...(record.countries || [])].slice(0, 18).join(" • ") || "No aliases yet"}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

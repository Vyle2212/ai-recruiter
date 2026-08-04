"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

export default function CandidatesPage() {
  const [candidates, setCandidates] = useState<any[]>([]);
  const [savedMap, setSavedMap] = useState<any>({});
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    fetchCandidates();
    fetchSaved();
  }, []);

  async function fetchCandidates() {
    const res = await fetch("/api/candidates");
    const data = await res.json();

    setCandidates(Array.isArray(data) ? data : []);
  }

  async function fetchSaved() {
    const res = await fetch("/api/all-saved-candidates");
    const data = await res.json();

    const map: any = {};

    if (Array.isArray(data)) {
      data.forEach((item: any) => {
        map[item.candidate_id] = item;
      });
    }

    setSavedMap(map);
  }

  const filteredCandidates = useMemo(() => {
    return candidates.filter((candidate) => {
      const saved = savedMap[candidate.id];

      const matchesSearch =
        candidate.name?.toLowerCase().includes(search.toLowerCase()) ||
        candidate.skills?.join(" ").toLowerCase().includes(search.toLowerCase());

      if (filter === "favorites") {
        return matchesSearch && saved?.is_favorite;
      }

      if (filter === "shortlisted") {
        return matchesSearch && saved?.is_shortlisted;
      }

      return matchesSearch;
    });
  }, [candidates, search, filter, savedMap]);

  return (
    <main className="min-h-screen bg-black text-white p-8">
      <h1 className="text-5xl font-bold mb-8">Candidates</h1>

      <div className="flex gap-4 mb-8">
        <input
          placeholder="Search candidates..."
          className="bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 w-full"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          className="bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">All</option>
          <option value="favorites">Favorites</option>
          <option value="shortlisted">Shortlisted</option>
        </select>
      </div>

      <div className="space-y-6">
        {filteredCandidates.map((candidate) => (
          <div
            key={candidate.id}
            className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6"
          >
            <h2 className="text-3xl font-bold mb-2">{candidate.name}</h2>

            <p className="text-zinc-400 mb-2">{candidate.email}</p>

            <div className="flex flex-wrap gap-2 mb-6">
              {candidate.skills?.map((skill: string) => (
                <div
                  key={skill}
                  className="bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm"
                >
                  {skill}
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2 mb-6 text-xs font-bold text-sky-200">
              <span className="rounded-full bg-zinc-800 px-3 py-2">Visa: {candidate.visa_status || candidate.work_authorization || "Not verified"}</span>
              <span className="rounded-full bg-zinc-800 px-3 py-2">Languages: {Array.isArray(candidate.languages) ? candidate.languages.join(", ") : candidate.languages || "Not verified"}</span>
              <span className="rounded-full bg-zinc-800 px-3 py-2">Salary: {candidate.expected_salary_currency || candidate.salary_currency || ""} {candidate.expected_salary || "Not confirmed"}</span>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href={`/candidates/${candidate.id}`}>
                <button className="bg-blue-600 hover:bg-blue-500 px-5 py-3 rounded-xl font-semibold">
                  View Profile
                </button>
              </Link>
              <Link href={`/candidate-confirmation?id=${candidate.id}`}>
                <button className="bg-green-600 hover:bg-green-500 px-5 py-3 rounded-xl font-semibold">
                  Candidate Confirm
                </button>
              </Link>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import LoadingCard from "@/components/LoadingCard";
import EmptyState from "@/components/EmptyState";

export default function ShortlistedPage() {
  const [candidates, setCandidates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchShortlisted();
  }, []);

  async function fetchShortlisted() {
    try {
      const res = await fetch("/api/shortlisted");

      const data = await res.json();

      setCandidates(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
      setCandidates([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <h1 className="text-5xl font-bold mb-10">
        Shortlisted Candidates
      </h1>

      {loading && (
        <div className="space-y-6">
          <LoadingCard />
          <LoadingCard />
        </div>
      )}

      {!loading && candidates.length === 0 && (
        <EmptyState
          title="No shortlisted candidates yet"
          description="Shortlisted candidates will appear here."
        />
      )}

      {!loading && candidates.length > 0 && (
        <div className="space-y-6">
          {candidates.map((candidate) => (
            <div
              key={candidate.id}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6"
            >
              <h2 className="text-4xl font-bold mb-2">
                {candidate.name}
              </h2>

              <p className="text-zinc-400 mb-4">
                {candidate.email}
              </p>

              <p className="text-green-400 font-bold text-3xl mb-6">
                Match Score: {candidate.match_score || 0}%
              </p>

              <div className="flex flex-wrap gap-2 mb-6">
                {(candidate.skills || []).map(
                  (skill: string, index: number) => (
                    <span
                      key={index}
                      className="bg-blue-900 px-3 py-1 rounded-full text-sm"
                    >
                      {skill}
                    </span>
                  )
                )}
              </div>

              <Link
                href={`/candidates/${candidate.candidate_id}`}
                className="bg-blue-500 hover:bg-blue-600 px-5 py-3 rounded-xl font-semibold inline-block"
              >
                View Candidate
              </Link>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
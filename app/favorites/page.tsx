"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import LoadingCard from "@/components/LoadingCard";
import EmptyState from "@/components/EmptyState";

interface FavoriteCandidate {
  id: string;
  candidate_id: string;
  name: string;
  email: string;
  skills: string[];
}

export default function FavoritesPage() {
  const [candidates, setCandidates] = useState<
    FavoriteCandidate[]
  >([]);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFavorites();
  }, []);

  async function fetchFavorites() {
    try {
      setLoading(true);

      const res = await fetch("/api/favorites");

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
        Favorite Candidates
      </h1>

      {loading && (
        <div className="space-y-6">
          <LoadingCard />
          <LoadingCard />
        </div>
      )}

      {!loading && candidates.length === 0 && (
        <EmptyState
          title="No favorite candidates yet"
          description="Favorite candidates will appear here."
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

              <div className="flex flex-wrap gap-2 mb-6">
                {(candidate.skills || []).map(
                  (skill, index) => (
                    <span
                      key={index}
                      className="bg-yellow-700 px-3 py-1 rounded-full text-sm"
                    >
                      {skill}
                    </span>
                  )
                )}
              </div>

              <Link
                href={`/candidates/${candidate.candidate_id}`}
                className="bg-yellow-500 hover:bg-yellow-600 text-black px-5 py-3 rounded-xl font-semibold inline-block"
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
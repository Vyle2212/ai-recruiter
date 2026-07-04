"use client";

import { use, useEffect, useState } from "react";

type Match = Record<string, any>;

function scoreColor(score: number) {
  if (score >= 85) return "text-green-400";
  if (score >= 70) return "text-lime-400";
  if (score >= 50) return "text-yellow-400";
  return "text-rose-400";
}

function normalizeTextForCompare(value: any) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanDisplayTitle(value: any) {
  let title = String(value || "")
    .replace(/^[-–—•\s]+/, "")
    .replace(/\s+/g, " ")
    .replace(/^(TITLE|POSITION|DESIGNATION|CURRENT POSITION|CURRENT TITLE|ROLE|JOB TITLE)\s*[:\-]\s*/i, "")
    .trim();

  title = title
    .replace(/\s+at\s+over\s+a\s+decade\s+of\s+experience.*$/i, "")
    .replace(/\s+at\s+\d+\+?\s+years\s+of\s+experience.*$/i, "")
    .replace(/\s+with\s+over\s+a\s+decade\s+of\s+experience.*$/i, "")
    .replace(/\s+with\s+\d+\+?\s+years\s+of\s+experience.*$/i, "")
    .replace(/\s+at\s+(.+?)\s+at\s+\1\s*$/i, " - $1")
    .replace(/\s+at\s+([A-Za-z0-9&.,'’() -]{2,60})\s+at\s+\1\s*$/i, " - $1")
    .replace(/\s*-\s*([A-Za-z0-9&.,'’() ]{2,60})\s*-\s*\1\s*$/i, " - $1")
    .replace(/\s+/g, " ")
    .trim();

  const duplicateAt = title.match(/^(.+?)\s+at\s+([A-Za-z0-9&.,'’() -]{2,60})\s+at\s+\2$/i);
  if (duplicateAt) {
    title = `${duplicateAt[1].trim()} - ${duplicateAt[2].trim()}`;
  }

  return title || "No title";
}

function formatDisplayTitle(titleInput: any, companyInput?: any) {
  const title = cleanDisplayTitle(titleInput);
  const company = String(companyInput || "").trim();

  if (!company) return title;

  const titleNorm = normalizeTextForCompare(title);
  const companyNorm = normalizeTextForCompare(company);

  // Prevent "SAP FICO Consultant - PwC at PwC"
  // and "SAP FICO Consultant at PwC at PwC".
  if (companyNorm && titleNorm.includes(companyNorm)) {
    return title;
  }

  return `${title} at ${company}`;
}

export default function MatchesByJobPage({ params }: { params: Promise<{ jobId: string }> }) {
  const resolvedParams = use(params);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMatches() {
      try {
        const response = await fetch(`/api/matches/${resolvedParams.jobId}`, { cache: "no-store" });
        if (!response.ok) throw new Error("Failed to fetch matches");
        setMatches(await response.json());
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }
    fetchMatches();
  }, [resolvedParams.jobId]);

  if (loading) return <div className="min-h-screen bg-black text-white p-10">Loading matches...</div>;

  return (
    <div className="min-h-screen bg-black text-white p-4">
      <h1 className="text-6xl font-bold mb-6">AI Matches</h1>
      <p className="mb-10 text-gray-400">Job ID: {resolvedParams.jobId}</p>
      <div className="space-y-6">
        {matches.map((match) => {
          const score = Number(match.match_score ?? match.score ?? 0);
          const c = match.candidates ?? match;
          const name = c.name || "Candidate Name Not Detected";
          const title = c.current_title || c.title || "SAP Consultant";
          const company = c.current_company || c.company || "";
          const displayTitle = formatDisplayTitle(title, company);
          return (
            <div key={match.id || c.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <h2 className="text-4xl font-bold mb-2">{name}</h2>
              <p className="text-gray-400 mb-2">{displayTitle}</p>
              {c.email && <p className="text-gray-400 mb-4">{c.email}</p>}
              <h3 className={`text-3xl font-bold mb-4 ${scoreColor(score)}`}>Match Score: {score}%</h3>
              <div className="bg-black rounded-xl p-4 mb-4"><h4 className="text-2xl font-bold text-blue-400 mb-2">Why This Candidate Matched</h4><p className="text-gray-300">{match.reason || "See strengths and gaps."}</p></div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";

export default function Home() {
  const [jd, setJd] = useState<File | null>(null);
  const [cvs, setCvs] = useState<File[]>([]);
  const [results, setResults] = useState<any[]>([]);

  const handleSubmit = async () => {
    if (!jd || cvs.length === 0) {
      alert("Upload JD + at least 1 CV");
      return;
    }

    const formData = new FormData();

    formData.append("jd", jd);
    cvs.forEach((cv) => formData.append("cvs", cv));

    const res = await fetch("/api/analyze", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();
    setResults(data.results || []);
  };

  return (
    <div className="p-10 text-white bg-black min-h-screen">
      <h1 className="text-3xl mb-4">🚀 AI Recruiter Pro</h1>

      <div className="mb-4">
        <p>Upload JD:</p>
        <input type="file" onChange={(e) => setJd(e.target.files?.[0] || null)} />
      </div>

      <div className="mb-4">
        <p>Upload CVs:</p>
        <input
          type="file"
          multiple
          onChange={(e) => setCvs(Array.from(e.target.files || []))}
        />
      </div>

      <button onClick={handleSubmit} className="bg-blue-500 px-4 py-2">
        Analyze
      </button>

      <div className="mt-6">
        {results.map((r, i) => (
          <div key={i} className="border p-4 mb-2">
            <h2>{r.name}</h2>
            <p>Score: {r.score}</p>
            <p>Strengths: {r.strengths?.join(", ")}</p>
            <p>Gaps: {r.gaps?.join(", ")}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
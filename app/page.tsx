"use client";

import { useState } from "react";

export default function Home() {
  const [jd, setJd] = useState<File | null>(null);
  const [cv, setCv] = useState<File | null>(null);
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!jd || !cv) return alert("Upload files");

    const formData = new FormData();
    formData.append("jd", jd);
    formData.append("cv", cv);

    setLoading(true);

    const res = await fetch("/api/analyze", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();
    setResult(data.result || "Error");
    setLoading(false);
  };

  return (
    <main className="p-10 max-w-xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">🤖 AI Recruiter</h1>

      <input type="file" onChange={(e) => setJd(e.target.files?.[0] || null)} />
      <br /><br />
      <input type="file" onChange={(e) => setCv(e.target.files?.[0] || null)} />
      <br /><br />

      <button
        onClick={handleSubmit}
        className="bg-blue-500 text-white px-4 py-2 rounded"
      >
        {loading ? "Analyzing..." : "Analyze"}
      </button>

      <pre className="mt-6 bg-gray-100 p-4 whitespace-pre-wrap">
        {result}
      </pre>
    </main>
  );
}
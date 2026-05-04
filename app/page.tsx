"use client";

import { useState } from "react";

export default function Home() {
  const [jdFile, setJdFile] = useState<File | null>(null);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAnalyze = async () => {
    if (!jdFile || !cvFile) {
      alert("Please upload both JD and CV");
      return;
    }

    setLoading(true);
    setResult("");

    try {
      const formData = new FormData();
      formData.append("jd", jdFile);
      formData.append("cv", cvFile);

      const res = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Analyze failed");
        setLoading(false);
        return;
      }

      setResult(data.result);
    } catch (err) {
      alert("Something went wrong");
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6">
      <h1 className="text-3xl font-bold mb-6">🤖 AI Recruiter</h1>

      <div className="space-y-4 w-full max-w-md">
        {/* JD Upload */}
        <div>
          <label className="block mb-1">Job Description (PDF)</label>
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setJdFile(e.target.files?.[0] || null)}
            className="w-full"
          />
          {jdFile && <p className="text-sm mt-1">{jdFile.name}</p>}
        </div>

        {/* CV Upload */}
        <div>
          <label className="block mb-1">CV (PDF)</label>
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setCvFile(e.target.files?.[0] || null)}
            className="w-full"
          />
          {cvFile && <p className="text-sm mt-1">{cvFile.name}</p>}
        </div>

        {/* Button */}
        <button
          onClick={handleAnalyze}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded"
        >
          {loading ? "Analyzing..." : "Analyze"}
        </button>

        {/* Result */}
        {result && (
          <div className="mt-4 p-4 bg-white text-black rounded whitespace-pre-wrap">
            {result}
          </div>
        )}
      </div>
    </div>
  );
}
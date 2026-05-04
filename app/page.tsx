"use client";

import { useState } from "react";

export default function Home() {
  const [file1, setFile1] = useState<File | null>(null);
  const [file2, setFile2] = useState<File | null>(null);
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!file1 || !file2) {
      alert("Upload both files");
      return;
    }

    setLoading(true);
    setResult("");

    const formData = new FormData();
    formData.append("file1", file1);
    formData.append("file2", file2);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (data.error) {
        setResult("❌ " + data.error);
      } else {
        setResult(data.result);
      }
    } catch (err) {
      setResult("❌ Failed to analyze");
    }

    setLoading(false);
  };

  return (
    <div style={{ padding: 40, color: "white", background: "black", minHeight: "100vh" }}>
      <h1>🤖 AI Recruiter</h1>

      <div>
        <input type="file" onChange={(e) => setFile1(e.target.files?.[0] || null)} />
      </div>

      <div style={{ marginTop: 10 }}>
        <input type="file" onChange={(e) => setFile2(e.target.files?.[0] || null)} />
      </div>

      <button
        onClick={handleSubmit}
        disabled={loading}
        style={{ marginTop: 20, padding: "10px 20px" }}
      >
        {loading ? "Analyzing..." : "Analyze"}
      </button>

      <pre
        style={{
          marginTop: 30,
          background: "#eee",
          color: "black",
          padding: 20,
          whiteSpace: "pre-wrap",
        }}
      >
        {result}
      </pre>
    </div>
  );
}
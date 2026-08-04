"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function JobDetailsPage() {
  const params = useParams();

  const jobId = Array.isArray(params.id)
    ? params.id[0]
    : params.id;

  const [job, setJob] = useState<any>(null);

  useEffect(() => {
    if (jobId) {
      fetchJob();
    }
  }, [jobId]);

  const fetchJob = async () => {
    try {
      const res = await fetch(`/api/jobs/${jobId}`);

      const data = await res.json();

      setJob(data);
    } catch (error) {
      console.error(error);
    }
  };

  if (!job) {
    return (
      <main className="min-h-screen bg-black text-white p-6">
        Loading...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <h1 className="text-5xl font-bold mb-4">
        {job.title}
      </h1>

      <p className="text-gray-400 mb-2">
        {job.company}
      </p>

      <p className="text-gray-400 mb-6">
        {job.location}
      </p>

      <div className="bg-zinc-900 p-6 rounded-2xl mb-6">
        <h2 className="text-2xl font-bold mb-4">
          Job Description
        </h2>

        <p className="text-gray-300 whitespace-pre-wrap">
          {job.summary}
        </p>
      </div>

      <a href={`/matches/${jobId}`}>
        <button className="bg-blue-500 px-5 py-3 rounded-xl">
          View AI Matches
        </button>
      </a>
    </main>
  );
}
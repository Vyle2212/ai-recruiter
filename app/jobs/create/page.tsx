"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CreateJobPage() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [skills, setSkills] = useState("");

  const handleCreate = async () => {
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          company,
          location,
          description,
          skills: skills
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      });

      if (!res.ok) {
        alert("Failed to create job");
        return;
      }

      const data = await res.json();

      router.push(`/jobs/${data.id}`);
    } catch (err) {
      console.error(err);
      alert("Something went wrong");
    }
  };

  return (
    <main className="min-h-screen bg-black text-white p-8">
      <h1 className="text-5xl font-bold mb-10">
        Create Job
      </h1>

      <div className="space-y-6 max-w-3xl">
        <input
          type="text"
          placeholder="Job Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full p-4 rounded-xl bg-zinc-900 border border-zinc-700"
        />

        <input
          type="text"
          placeholder="Company"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          className="w-full p-4 rounded-xl bg-zinc-900 border border-zinc-700"
        />

        <input
          type="text"
          placeholder="Location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="w-full p-4 rounded-xl bg-zinc-900 border border-zinc-700"
        />

        <textarea
          placeholder="Job Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={8}
          className="w-full p-4 rounded-xl bg-zinc-900 border border-zinc-700"
        />

        <input
          type="text"
          placeholder="Skills (comma separated)"
          value={skills}
          onChange={(e) => setSkills(e.target.value)}
          className="w-full p-4 rounded-xl bg-zinc-900 border border-zinc-700"
        />

        <button
          onClick={handleCreate}
          className="bg-blue-500 px-6 py-4 rounded-xl font-semibold"
        >
          Create Job
        </button>
      </div>
    </main>
  );
}
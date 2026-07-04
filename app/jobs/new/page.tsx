"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewJobPage() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] =
    useState("");

  const [summary, setSummary] = useState("");
  const [experience, setExperience] =
    useState("");

  const [skills, setSkills] = useState<string[]>(
    []
  );

  const [keywords, setKeywords] = useState<
    string[]
  >([]);

  const [loading, setLoading] = useState(false);

  async function parseJD() {
    try {
      setLoading(true);

      const res = await fetch("/api/parse-jd", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          description,
        }),
      });

      const data = await res.json();

      setTitle(data.title || "");
      setSummary(data.summary || "");
      setExperience(data.experience || "");

      setSkills(
        Array.isArray(data.skills)
          ? data.skills
          : []
      );

      setKeywords(
        Array.isArray(data.keywords)
          ? data.keywords
          : []
      );
    } catch (error) {
      console.error(error);
      alert("Failed to parse JD");
    } finally {
      setLoading(false);
    }
  }

  async function createJob() {
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          description,
          summary,
          experience,
          skills,
          keywords,
        }),
      });

      const data = await res.json();

      router.push(`/jobs/${data.id}`);
    } catch (error) {
      console.error(error);
    }
  }

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <h1 className="text-5xl font-bold mb-10">
        Create Job
      </h1>

      <div className="space-y-6 max-w-4xl">
        <div>
          <label className="block mb-2 font-semibold">
            Job Description
          </label>

          <textarea
            value={description}
            onChange={(e) =>
              setDescription(e.target.value)
            }
            className="w-full h-64 bg-zinc-900 border border-zinc-800 rounded-2xl p-4"
            placeholder="Paste full job description..."
          />
        </div>

        <button
          onClick={parseJD}
          disabled={loading}
          className="bg-blue-500 hover:bg-blue-600 px-6 py-3 rounded-xl font-semibold"
        >
          {loading ? "Parsing..." : "AI Parse JD"}
        </button>

        <div>
          <label className="block mb-2 font-semibold">
            Job Title
          </label>

          <input
            value={title}
            onChange={(e) =>
              setTitle(e.target.value)
            }
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4"
          />
        </div>

        <div>
          <label className="block mb-2 font-semibold">
            AI Summary
          </label>

          <textarea
            value={summary}
            onChange={(e) =>
              setSummary(e.target.value)
            }
            className="w-full h-40 bg-zinc-900 border border-zinc-800 rounded-xl p-4"
          />
        </div>

        <div>
          <label className="block mb-2 font-semibold">
            Experience
          </label>

          <input
            value={experience}
            onChange={(e) =>
              setExperience(e.target.value)
            }
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4"
          />
        </div>

        <div>
          <label className="block mb-2 font-semibold">
            Skills
          </label>

          <div className="flex flex-wrap gap-2">
            {skills.map((skill, index) => (
              <span
                key={index}
                className="bg-blue-900 px-3 py-1 rounded-full"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>

        <div>
          <label className="block mb-2 font-semibold">
            Keywords
          </label>

          <div className="flex flex-wrap gap-2">
            {keywords.map((keyword, index) => (
              <span
                key={index}
                className="bg-green-900 px-3 py-1 rounded-full"
              >
                {keyword}
              </span>
            ))}
          </div>
        </div>

        <button
          onClick={createJob}
          className="bg-green-600 hover:bg-green-700 px-6 py-3 rounded-xl font-semibold"
        >
          Create Job
        </button>
      </div>
    </main>
  );
}
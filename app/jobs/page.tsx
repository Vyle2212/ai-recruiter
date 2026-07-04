"use client";

import { useState } from "react";

export default function JobsPage() {
  const [loading, setLoading] =
    useState(false);

  const [message, setMessage] =
    useState("");

  async function handleUpload(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    try {
      setLoading(true);
      setMessage("");

      const form = e.currentTarget;
      const fileInput =
        form.file as HTMLInputElement;

      const file =
        fileInput.files?.[0];

      if (!file) {
        setMessage("Please choose JD file");
        return;
      }

      const allowedExtensions = [
        ".pdf",
        ".docx",
        ".doc",
        ".txt",
      ];

      const lowerFileName =
        file.name.toLowerCase();

      const isAllowed =
        allowedExtensions.some((ext) =>
          lowerFileName.endsWith(ext)
        );

      if (!isAllowed) {
        setMessage(
          "Only PDF, DOCX, DOC, and TXT JD files are supported"
        );
        return;
      }

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(
        "/api/upload-jd",
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error ||
            "Upload JD failed"
        );
      }

      setMessage(
        "JD uploaded successfully"
      );

      form.reset();
    } catch (err: any) {
      setMessage(
        err?.message ||
          "Upload JD failed"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="bg-zinc-900 p-10 rounded-2xl w-[480px]">
        <h1 className="text-5xl font-bold text-white mb-8">
          Upload JD
        </h1>

        <form
          onSubmit={handleUpload}
          className="space-y-6"
        >
          <input
            type="file"
            name="file"
            accept=".pdf,.docx,.doc,.txt"
            className="text-white"
          />

          <button
            type="submit"
            disabled={loading}
            className="bg-orange-600 hover:bg-orange-700 disabled:opacity-60 px-6 py-3 rounded-lg text-white font-semibold"
          >
            {loading
              ? "Uploading..."
              : "Upload JD"}
          </button>
        </form>

        {message && (
          <p className="text-white mt-6 whitespace-pre-line">
            {message}
          </p>
        )}
      </div>
    </div>
  );
}

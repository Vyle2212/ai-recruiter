"use client";

import { useMemo, useState } from "react";

type UploadResult = {
  fileName: string;
  ok: boolean;
  candidate?: any;
  error?: string;
  ingestionAction?:
    | "create_new"
    | "update_existing"
    | "hold_for_identity_review";
  extractionCoverage?: {
    status: "complete_for_validation" | "incomplete_needs_review";
    coveragePercent: number;
    missedObservedSections: string[];
    missingRequiredFields: string[];
  };
};

type UploadResponse = {
  success: boolean;
  total: number;
  successCount: number;
  failCount: number;
  createdCount?: number;
  updatedCount?: number;
  heldForReviewCount?: number;
  incompleteExtractionCount?: number;
  results: UploadResult[];
  error?: string;
};

const UPLOAD_CHUNK_SIZE = 8;

function chunks<T>(items: T[], size: number) {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, (index + 1) * size),
  );
}

function mergeUploadResponses(responses: UploadResponse[]): UploadResponse {
  const results = responses.flatMap((item) => item.results || []);
  const successCount = results.filter((item) => item.ok).length;
  const failCount = results.length - successCount;
  return {
    success: results.length > 0 && failCount === 0,
    total: results.length,
    successCount,
    failCount,
    createdCount: results.filter(
      (item) => item.ingestionAction === "create_new",
    ).length,
    updatedCount: results.filter(
      (item) => item.ingestionAction === "update_existing",
    ).length,
    heldForReviewCount: results.filter(
      (item) => item.ingestionAction === "hold_for_identity_review",
    ).length,
    incompleteExtractionCount: results.filter(
      (item) => item.extractionCoverage?.status === "incomplete_needs_review",
    ).length,
    results,
  };
}

export default function UploadPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [response, setResponse] = useState<UploadResponse | null>(null);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState({
    completed: 0,
    total: 0,
    batch: 0,
    batches: 0,
  });

  const totalSize = useMemo(() => {
    return files.reduce((sum, file) => sum + file.size, 0);
  }, [files]);

  function onPickFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(event.target.files || []);
    setFiles(picked);
    setResponse(null);
    setProgress({
      completed: 0,
      total: picked.length,
      batch: 0,
      batches: Math.ceil(picked.length / UPLOAD_CHUNK_SIZE),
    });
    setError("");
  }

  async function uploadFiles() {
    if (!files.length) {
      setError("Please select at least one CV file.");
      return;
    }

    setUploading(true);
    setError("");
    setResponse(null);

    try {
      const batches = chunks(files, UPLOAD_CHUNK_SIZE);
      const completedResponses: UploadResponse[] = [];
      setProgress({
        completed: 0,
        total: files.length,
        batch: 0,
        batches: batches.length,
      });

      for (let index = 0; index < batches.length; index += 1) {
        const formData = new FormData();
        for (const file of batches[index]) formData.append("files", file);
        const res = await fetch("/api/upload-cv", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (!res.ok)
          throw new Error(data.error || `Upload batch ${index + 1} failed.`);
        completedResponses.push(data);
        const merged = mergeUploadResponses(completedResponses);
        setResponse(merged);
        setProgress({
          completed: merged.total,
          total: files.length,
          batch: index + 1,
          batches: batches.length,
        });
      }
    } catch (err: any) {
      setError(err?.message || "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  function clearFiles() {
    setFiles([]);
    setResponse(null);
    setError("");
    setProgress({ completed: 0, total: 0, batch: 0, batches: 0 });
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#050505",
        color: "#fff",
        padding: 28,
      }}
    >
      <h1 style={{ fontSize: 36, marginBottom: 8 }}>Bulk Upload CVs</h1>

      <p style={{ color: "#a8b3c7", marginBottom: 28 }}>
        Upload multiple SAP CVs at once. Supported formats: PDF, DOCX, TXT.
      </p>

      <section
        style={{
          background: "#15171c",
          border: "1px solid #2b3038",
          borderRadius: 14,
          padding: 24,
          marginBottom: 24,
        }}
      >
        <label
          style={{
            display: "block",
            fontWeight: 800,
            marginBottom: 12,
          }}
        >
          Select CV files
        </label>

        <input
          type="file"
          multiple
          accept=".pdf,.docx,.txt"
          onChange={onPickFiles}
          disabled={uploading}
          style={{
            width: "100%",
            padding: 14,
            border: "1px solid #384150",
            borderRadius: 10,
            background: "#08090c",
            color: "#fff",
          }}
        />

        <div
          style={{
            display: "flex",
            gap: 12,
            marginTop: 18,
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={uploadFiles}
            disabled={uploading || !files.length}
            style={{
              padding: "12px 20px",
              borderRadius: 10,
              border: "none",
              background: uploading || !files.length ? "#364152" : "#2563eb",
              color: "#fff",
              fontWeight: 800,
              cursor: uploading || !files.length ? "not-allowed" : "pointer",
            }}
          >
            {uploading ? "Uploading..." : `Upload ${files.length || ""} CVs`}
          </button>

          <button
            onClick={clearFiles}
            disabled={uploading}
            style={{
              padding: "12px 20px",
              borderRadius: 10,
              border: "1px solid #384150",
              background: "#0b0d12",
              color: "#fff",
              fontWeight: 800,
              cursor: uploading ? "not-allowed" : "pointer",
            }}
          >
            Clear
          </button>
        </div>

        {files.length > 0 && (
          <div style={{ marginTop: 18, color: "#a8b3c7" }}>
            Selected: <b style={{ color: "#fff" }}>{files.length}</b> files ·
            Total size:{" "}
            <b style={{ color: "#fff" }}>
              {(totalSize / 1024 / 1024).toFixed(2)} MB
            </b>
          </div>
        )}

        {error && (
          <p style={{ color: "#ff6384", marginTop: 18, fontWeight: 700 }}>
            {error}
          </p>
        )}
      </section>

      {files.length > 0 && (
        <section
          style={{
            background: "#15171c",
            border: "1px solid #2b3038",
            borderRadius: 14,
            padding: 24,
            marginBottom: 24,
          }}
        >
          <h2 style={{ fontSize: 20, marginBottom: 14 }}>Selected Files</h2>

          <div style={{ display: "grid", gap: 8 }}>
            {files.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                style={{
                  background: "#090b10",
                  border: "1px solid #252b35",
                  borderRadius: 10,
                  padding: "10px 12px",
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 16,
                }}
              >
                <span>{file.name}</span>
                <span style={{ color: "#a8b3c7" }}>
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {response && (
        <section
          style={{
            background: "#15171c",
            border: "1px solid #2b3038",
            borderRadius: 14,
            padding: 24,
          }}
        >
          <h2 style={{ fontSize: 22, marginBottom: 10 }}>Upload Result</h2>

          <p style={{ color: "#a8b3c7", marginBottom: 18 }}>
            Total: <b style={{ color: "#fff" }}>{response.total}</b> · Success:{" "}
            <b style={{ color: "#33f078" }}>{response.successCount}</b> ·
            Failed: <b style={{ color: "#ff6384" }}>{response.failCount}</b>
            {" · "}Created:{" "}
            <b style={{ color: "#60a5fa" }}>{response.createdCount || 0}</b>
            {" · "}Updated:{" "}
            <b style={{ color: "#c084fc" }}>{response.updatedCount || 0}</b>
            {" · "}Held for identity review:{" "}
            <b style={{ color: "#fbbf24" }}>
              {response.heldForReviewCount || 0}
            </b>
            {" · "}Incomplete extraction:{" "}
            <b style={{ color: "#fb923c" }}>
              {response.incompleteExtractionCount || 0}
            </b>
          </p>

          {uploading && progress.total > 0 && (
            <p style={{ color: "#93c5fd", marginBottom: 18 }}>
              Processing {progress.completed}/{progress.total} files · batch{" "}
              {progress.batch}/{progress.batches}. Keep this page open;
              completed batches will not be sent again.
            </p>
          )}

          <div style={{ display: "grid", gap: 12 }}>
            {(response.results || []).map((item, index) => {
              const candidate = item.candidate || {};

              return (
                <article
                  key={`${item.fileName}-${index}`}
                  style={{
                    border: `1px solid ${item.ok ? "#236b3a" : "#733046"}`,
                    background: item.ok ? "#08130d" : "#16080d",
                    borderRadius: 12,
                    padding: 14,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      alignItems: "center",
                    }}
                  >
                    <strong>{item.fileName}</strong>
                    <span
                      style={{
                        color: item.ok ? "#33f078" : "#ff6384",
                        fontWeight: 900,
                      }}
                    >
                      {item.ok ? "SUCCESS" : "FAILED"}
                    </span>
                  </div>

                  {item.ok ? (
                    <div
                      style={{
                        marginTop: 8,
                        color: "#c7d2e5",
                        fontSize: 14,
                        lineHeight: 1.7,
                      }}
                    >
                      <div>
                        Candidate:{" "}
                        <b style={{ color: "#fff" }}>
                          {candidate.name || "Unknown Candidate"}
                        </b>
                      </div>
                      <div>
                        Title:{" "}
                        <b style={{ color: "#fff" }}>
                          {candidate.current_title || candidate.title || "N/A"}
                        </b>
                      </div>
                      <div>
                        Module:{" "}
                        <b style={{ color: "#fff" }}>
                          {candidate.primary_module || "N/A"}
                        </b>{" "}
                        · Role:{" "}
                        <b style={{ color: "#fff" }}>
                          {candidate.role_type || "N/A"}
                        </b>{" "}
                        · Level:{" "}
                        <b style={{ color: "#fff" }}>
                          {candidate.consulting_level || "N/A"}
                        </b>{" "}
                        · Years:{" "}
                        <b style={{ color: "#fff" }}>{candidate.years || 0}</b>
                      </div>
                      <div>
                        Projects: Implementation{" "}
                        <b style={{ color: "#fff" }}>
                          {candidate.implementation_projects || 0}
                        </b>{" "}
                        · AMS{" "}
                        <b style={{ color: "#fff" }}>
                          {candidate.ams_projects || 0}
                        </b>{" "}
                        · S/4HANA{" "}
                        <b style={{ color: "#fff" }}>
                          {candidate.s4hana_projects || 0}
                        </b>
                      </div>
                      <div>
                        Extraction coverage:{" "}
                        <b
                          style={{
                            color:
                              item.extractionCoverage?.status ===
                              "complete_for_validation"
                                ? "#33f078"
                                : "#fbbf24",
                          }}
                        >
                          {item.extractionCoverage?.coveragePercent ?? 0}%
                        </b>
                        {item.extractionCoverage?.missedObservedSections?.length
                          ? ` · missed source sections: ${item.extractionCoverage.missedObservedSections.join(", ")}`
                          : ""}
                        {item.extractionCoverage?.missingRequiredFields?.length
                          ? ` · required fields missing: ${item.extractionCoverage.missingRequiredFields.join(", ")}`
                          : ""}
                      </div>
                    </div>
                  ) : (
                    <p style={{ color: "#ff9db5", marginTop: 8 }}>
                      {item.error || "Unknown error"}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}

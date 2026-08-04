"use client";

import { useMemo, useState } from "react";

type UploadResult = {
  fileName: string;
  ok: boolean;
  candidate?: any;
  error?: string;
};

type UploadResponse = {
  success: boolean;
  total: number;
  successCount: number;
  failCount: number;
  results: UploadResult[];
  error?: string;
};

export default function UploadPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [response, setResponse] = useState<UploadResponse | null>(null);
  const [error, setError] = useState("");

  const totalSize = useMemo(() => {
    return files.reduce((sum, file) => sum + file.size, 0);
  }, [files]);

  function onPickFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(event.target.files || []);
    setFiles(picked);
    setResponse(null);
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
      const formData = new FormData();

      for (const file of files) {
        formData.append("files", file);
      }

      const res = await fetch("/api/upload-cv", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Upload failed.");
      }

      setResponse(data);
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
            Selected: <b style={{ color: "#fff" }}>{files.length}</b> files · Total size:{" "}
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
            <b style={{ color: "#33f078" }}>{response.successCount}</b> · Failed:{" "}
            <b style={{ color: "#ff6384" }}>{response.failCount}</b>
          </p>

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

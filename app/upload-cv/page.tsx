"use client";

import { useState } from "react";

export default function UploadCVPage() {
  const [file, setFile] =
    useState<File | null>(null);

  const [result, setResult] =
    useState<any>(null);

  const [loading, setLoading] =
    useState(false);

  async function handleUpload() {
    if (!file) return;

    try {
      setLoading(true);

      const formData =
        new FormData();

      formData.append(
        "file",
        file
      );

      /*
        PARSE CV
      */

      const parseRes =
        await fetch(
          "/api/parse-cv",
          {
            method: "POST",
            body: formData,
          }
        );

      const parseData =
        await parseRes.json();

      /*
        MATCH JOBS
      */

      const matchRes =
        await fetch(
          "/api/match-jobs",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              candidate:
                parseData.candidate,
            }),
          }
        );

      const matchData =
        await matchRes.json();

      setResult({
        candidate:
          parseData.candidate,
        matches:
          matchData.matches || [],
      });
    } catch (err: any) {
      alert(
        err.message ||
          "Something went wrong"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        padding: 40,
        background: "#000",
        minHeight: "100vh",
        color: "#fff",
      }}
    >
      <h1
        style={{
          fontSize: 50,
          marginBottom: 30,
        }}
      >
        Upload CV
      </h1>

      <input
        type="file"
        accept=".pdf"
        onChange={(e) =>
          setFile(
            e.target.files?.[0] ||
              null
          )
        }
      />

      <br />
      <br />

      <button
        onClick={handleUpload}
        disabled={loading}
        style={{
          padding:
            "14px 24px",
          background:
            "#2563eb",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          cursor: "pointer",
          fontWeight: "bold",
        }}
      >
        {loading
          ? "Processing..."
          : "Parse & Match CV"}
      </button>

      {result?.matches
        ?.length > 0 && (
        <div
          style={{
            marginTop: 50,
          }}
        >
          <h2
            style={{
              fontSize: 40,
              marginBottom: 20,
            }}
          >
            AI Match Results
          </h2>

          {result.matches.map(
            (
              match: any,
              index: number
            ) => (
              <div
                key={index}
                style={{
                  background:
                    "#052e16",
                  padding: 30,
                  borderRadius: 20,
                  marginBottom: 20,
                  border:
                    "6px solid #166534",
                }}
              >
                <div
                  style={{
                    fontSize: 80,
                    fontWeight:
                      "bold",
                    color:
                      "#4ade80",
                  }}
                >
                  {match.score}%
                </div>

                <h3
                  style={{
                    fontSize: 30,
                  }}
                >
                  {match.title}
                </h3>

                <p>
                  <b>
                    Matched Skills:
                  </b>
                </p>

                <div>
                  {match.matchedSkills?.join(
                    ", "
                  )}
                </div>

                <br />

                <p>
                  <b>
                    AI Insights
                  </b>
                </p>

                <ul>
                  {match.insights?.map(
                    (
                      item: string,
                      i: number
                    ) => (
                      <li key={i}>
                        {item}
                      </li>
                    )
                  )}
                </ul>
              </div>
            )
          )}
        </div>
      )}

      {result?.candidate && (
        <div
          style={{
            marginTop: 50,
          }}
        >
          <h2>
            Parsed Candidate
          </h2>

          <pre
            style={{
              background:
                "#0f172a",
              padding: 20,
              overflow:
                "auto",
            }}
          >
            {JSON.stringify(
              result.candidate,
              null,
              2
            )}
          </pre>
        </div>
      )}
    </div>
  );
}
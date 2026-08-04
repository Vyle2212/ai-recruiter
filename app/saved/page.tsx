"use client";

import { useEffect, useState } from "react";

interface SavedCandidate {
  id: string;
  candidate_data: {
    id?: string;
    name?: string;
    email?: string;
    phone?: string;
    location?: string;
    years?: number;
    skills?: string[];
    summary?: string;
  };
  created_at: string;
}

export default function SavedPage() {
  const [savedCandidates, setSavedCandidates] = useState<
    SavedCandidate[]
  >([]);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSavedCandidates();
  }, []);

  async function fetchSavedCandidates() {
    try {
      setLoading(true);

      const response = await fetch(
        "/api/save-candidate"
      );

      const data = await response.json();

      console.log("SAVED CANDIDATES:", data);

      if (Array.isArray(data)) {
        setSavedCandidates(data);
      } else {
        setSavedCandidates([]);
      }
    } catch (error) {
      console.error(
        "Failed to fetch saved candidates:",
        error
      );

      setSavedCandidates([]);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div
        style={{
          background: "black",
          minHeight: "100vh",
          color: "white",
          padding: "20px",
        }}
      >
        <h1>Saved Candidates</h1>

        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div
      style={{
        background: "black",
        minHeight: "100vh",
        color: "white",
        padding: "20px",
      }}
    >
      <h1
        style={{
          fontSize: "48px",
          fontWeight: "bold",
          marginBottom: "30px",
        }}
      >
        Saved Candidates
      </h1>

      {savedCandidates.length === 0 ? (
        <p
          style={{
            color: "red",
            fontSize: "20px",
          }}
        >
          No saved candidates found
        </p>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "24px",
          }}
        >
          {savedCandidates.map((item) => {
            const candidate =
              item.candidate_data || {};

            return (
              <div
                key={item.id}
                style={{
                  border:
                    "1px solid #1e293b",
                  borderRadius: "16px",
                  padding: "24px",
                  background: "#050505",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent:
                      "space-between",
                    alignItems: "flex-start",
                  }}
                >
                  <div>
                    <h2
                      style={{
                        fontSize: "48px",
                        fontWeight: "bold",
                        marginBottom: "16px",
                      }}
                    >
                      {candidate.name ||
                        "Unknown Candidate"}
                    </h2>

                    <p
                      style={{
                        marginBottom: "8px",
                      }}
                    >
                      <strong>
                        Years Experience:
                      </strong>{" "}
                      {candidate.years || 0}
                    </p>

                    <p
                      style={{
                        marginBottom: "8px",
                      }}
                    >
                      <strong>Email:</strong>{" "}
                      {candidate.email ||
                        "-"}
                    </p>

                    <p
                      style={{
                        marginBottom: "8px",
                      }}
                    >
                      <strong>Phone:</strong>{" "}
                      {candidate.phone ||
                        "-"}
                    </p>

                    <p
                      style={{
                        marginBottom: "24px",
                      }}
                    >
                      <strong>
                        Location:
                      </strong>{" "}
                      {candidate.location ||
                        "-"}
                    </p>
                  </div>

                  <div
                    style={{
                      background:
                        "#15803d",
                      color: "white",
                      padding:
                        "10px 18px",
                      borderRadius:
                        "12px",
                      fontWeight: "bold",
                      fontSize: "24px",
                    }}
                  >
                    SAVED
                  </div>
                </div>

                <h3
                  style={{
                    fontSize: "40px",
                    fontWeight: "bold",
                    marginBottom: "16px",
                  }}
                >
                  Skills
                </h3>

                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "12px",
                    marginBottom: "30px",
                  }}
                >
                  {(
                    candidate.skills ||
                    []
                  ).map(
                    (
                      skill: string,
                      index: number
                    ) => (
                      <div
                        key={index}
                        style={{
                          border:
                            "1px solid #334155",
                          borderRadius:
                            "999px",
                          padding:
                            "10px 18px",
                          background:
                            "#111827",
                        }}
                      >
                        {skill}
                      </div>
                    )
                  )}
                </div>

                <h3
                  style={{
                    fontSize: "40px",
                    fontWeight: "bold",
                    marginBottom: "16px",
                  }}
                >
                  AI Insight
                </h3>

                <p
                  style={{
                    fontSize: "18px",
                    lineHeight: "1.8",
                  }}
                >
                  {candidate.summary ||
                    "No summary available"}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
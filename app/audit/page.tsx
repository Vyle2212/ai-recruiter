"use client";

import { useEffect, useState } from "react";

type AuditCandidate = {
  id: string;
  name: string;
  current_title?: string;
  title?: string;
  email?: string;
  phone?: string;
  primary_module?: string;
  role_type?: string;
  years?: number;
  contact_missing?: boolean;
  name_review_required?: boolean;
  profile_quality_score?: number;
  quality_badge?: string;
  issues?: string[];
};

type AuditResponse = {
  success: boolean;
  stats: {
    totalNeedsReview: number;
    missingContact: number;
    nameReview: number;
    lowQuality: number;
  };
  candidates: AuditCandidate[];
};

export default function AuditPage() {
  const [data, setData] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadAudit() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/audit-candidates", {
        cache: "no-store",
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to load audit queue.");
      }

      setData(json);
    } catch (err: any) {
      setError(err?.message || "Failed to load audit queue.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAudit();
  }, []);

  function badgeStyle(badge?: string) {
    if (badge === "A+" || badge === "A") return "#22c55e";
    if (badge === "B") return "#84cc16";
    if (badge === "C") return "#f59e0b";
    return "#ef4444";
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
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 34, marginBottom: 8 }}>
          Candidate Quality Audit
        </h1>
        <p style={{ color: "#a8b3c7" }}>
          Review profiles with missing contact, low parser confidence, or name
          extraction issues before client submission.
        </p>
      </div>

      {loading && <p>Loading audit queue...</p>}

      {error && (
        <p style={{ color: "#ff6384", fontWeight: 700 }}>{error}</p>
      )}

      {data && (
        <>
          <section
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 14,
              marginBottom: 24,
            }}
          >
            <StatCard label="Needs Review" value={data.stats.totalNeedsReview} />
            <StatCard label="Missing Contact" value={data.stats.missingContact} />
            <StatCard label="Name Review" value={data.stats.nameReview} />
            <StatCard label="Low Quality" value={data.stats.lowQuality} />
          </section>

          <section
            style={{
              background: "#15171c",
              border: "1px solid #2b3038",
              borderRadius: 14,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "16px 18px",
                borderBottom: "1px solid #2b3038",
                fontWeight: 900,
              }}
            >
              Review Queue
            </div>

            {data.candidates.length === 0 ? (
              <p style={{ padding: 18, color: "#22c55e" }}>
                No candidates need review. Database is clean.
              </p>
            ) : (
              <div style={{ display: "grid" }}>
                {data.candidates.map((candidate) => (
                  <article
                    key={candidate.id}
                    style={{
                      padding: 18,
                      borderBottom: "1px solid #252b35",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 16,
                        alignItems: "flex-start",
                      }}
                    >
                      <div>
                        <h2 style={{ margin: 0, fontSize: 20 }}>
                          {candidate.name || "Unknown Candidate"}
                        </h2>
                        <p style={{ margin: "6px 0", color: "#c7d2e5" }}>
                          {candidate.current_title ||
                            candidate.title ||
                            "No title"}
                        </p>
                        <p style={{ margin: 0, color: "#a8b3c7" }}>
                          {candidate.email || "No email"} |{" "}
                          {candidate.phone || "No phone"}
                        </p>
                      </div>

                      <div style={{ textAlign: "right" }}>
                        <div
                          style={{
                            display: "inline-block",
                            background: badgeStyle(candidate.quality_badge),
                            color: "#050505",
                            borderRadius: 999,
                            padding: "5px 10px",
                            fontWeight: 900,
                            marginBottom: 8,
                          }}
                        >
                          {candidate.quality_badge || "Review"}
                        </div>
                        <div style={{ color: "#a8b3c7" }}>
                          Quality: {candidate.profile_quality_score || 0}
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        marginTop: 12,
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 8,
                      }}
                    >
                      {(candidate.issues || []).map((issue) => (
                        <span
                          key={issue}
                          style={{
                            background: "#2a1117",
                            color: "#ff9db5",
                            border: "1px solid #733046",
                            borderRadius: 999,
                            padding: "4px 9px",
                            fontSize: 13,
                            fontWeight: 800,
                          }}
                        >
                          {issue}
                        </span>
                      ))}
                    </div>

                    <div
                      style={{
                        marginTop: 10,
                        color: "#a8b3c7",
                        fontSize: 14,
                      }}
                    >
                      Module: {candidate.primary_module || "N/A"} · Role:{" "}
                      {candidate.role_type || "N/A"} · Years:{" "}
                      {candidate.years || 0}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        background: "#15171c",
        border: "1px solid #2b3038",
        borderRadius: 14,
        padding: 18,
      }}
    >
      <div style={{ color: "#a8b3c7", marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 900 }}>{value}</div>
    </div>
  );
}

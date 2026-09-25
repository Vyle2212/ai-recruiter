"use client";

import { useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  buildAdminCvUploadPlan,
  classifyAdminCvUploadResult,
  parseAdminCvCheckpoint,
  readyAdminCvUploadItems,
  selectionFingerprintMaterial,
  summarizeAdminCvPlan,
  updateAdminCvCheckpoint,
  type AdminCvCheckpoint,
  type AdminCvDescriptor,
  type AdminCvPlanItem,
  type AdminCvUploadOutcome,
  type AdminCvUploadResultLike,
} from "@/lib/adminCvBulkUpload";
import { finalizePossiblyCompletedSignedCvUpload } from "@/lib/signedCvUploadFinalization";

type PreparedItem = AdminCvPlanItem & {
  file: File;
  outcome?: AdminCvUploadOutcome;
  error?: string;
};

const CHECKPOINT_KEY = "ai-recruiter:admin-cv-upload:v1";
const MAX_CV_BYTES = 10 * 1024 * 1024;
const FATAL_UPLOAD_ERROR =
  /Authentication|Access is not permitted|not configured|Private CV storage is unavailable/i;

const cardStyle = {
  background: "#15171c",
  border: "1px solid #2b3038",
  borderRadius: 14,
  padding: 24,
  marginBottom: 24,
} as const;

function bytesLabel(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

async function sha256(input: ArrayBuffer | string) {
  const bytes =
    typeof input === "string" ? new TextEncoder().encode(input) : input;
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

async function readJson(response: Response) {
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      typeof body?.error === "string"
        ? body.error
        : body?.error?.message || `CV upload failed (${response.status}).`,
    );
  }
  return body;
}

function outcomeLabel(outcome?: AdminCvUploadOutcome) {
  const labels: Record<AdminCvUploadOutcome, string> = {
    created: "Created",
    updated: "Updated",
    already_processed: "Already processed",
    incomplete_review: "Incomplete — review",
    identity_review: "Identity review",
    source_review: "OCR/source review",
    non_sap_rejected: "Non-SAP — original held for review",
    failed: "Retry required",
  };
  return outcome ? labels[outcome] : "Ready";
}

export default function UploadPage() {
  const [items, setItems] = useState<PreparedItem[]>([]);
  const [selectionFingerprint, setSelectionFingerprint] = useState("");
  const [checkpoint, setCheckpoint] = useState<AdminCvCheckpoint | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pauseRequested, setPauseRequested] = useState(false);
  const [preparationProgress, setPreparationProgress] = useState({
    completed: 0,
    total: 0,
  });
  const [activeName, setActiveName] = useState("");
  const [error, setError] = useState("");
  const pauseRef = useRef(false);

  const planSummary = useMemo(() => summarizeAdminCvPlan(items), [items]);
  const totalSize = useMemo(
    () => items.reduce((sum, item) => sum + item.size, 0),
    [items],
  );
  const outcomeCounts = useMemo(() => {
    const counts = new Map<AdminCvUploadOutcome, number>();
    for (const item of items) {
      const outcome = item.outcome || item.priorOutcome;
      if (outcome) counts.set(outcome, (counts.get(outcome) || 0) + 1);
    }
    return counts;
  }, [items]);
  const createdCount = outcomeCounts.get("created") || 0;
  const updatedCount = outcomeCounts.get("updated") || 0;
  const heldForReviewCount = outcomeCounts.get("identity_review") || 0;
  const incompleteExtractionCount = outcomeCounts.get("incomplete_review") || 0;

  async function prepareFiles(files: File[]) {
    setPreparing(true);
    setError("");
    setItems([]);
    setPreparationProgress({ completed: 0, total: files.length });
    try {
      const descriptors: AdminCvDescriptor[] = [];
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        descriptors.push({
          digest:
            file.size > MAX_CV_BYTES
              ? "0".repeat(64)
              : await sha256(await file.arrayBuffer()),
          name: file.name,
          size: file.size,
          lastModified: file.lastModified || 0,
          selectionIndex: index,
        });
        setPreparationProgress({ completed: index + 1, total: files.length });
      }
      const fingerprint = await sha256(
        selectionFingerprintMaterial(descriptors.map((item) => item.digest)),
      );
      const restored = parseAdminCvCheckpoint(
        sessionStorage.getItem(CHECKPOINT_KEY),
        fingerprint,
      );
      const plan = buildAdminCvUploadPlan(descriptors, restored);
      setSelectionFingerprint(fingerprint);
      setCheckpoint(restored);
      setItems(
        plan.map((item) => ({
          ...item,
          file: files[item.selectionIndex],
          outcome: item.priorOutcome,
        })),
      );
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Unable to prepare the CV collection.",
      );
    } finally {
      setPreparing(false);
    }
  }

  function onPickFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(event.target.files || []);
    if (!picked.length) return;
    void prepareFiles(picked);
  }

  async function uploadOne(
    file: File,
    contentDigest: string,
    storageClient: ReturnType<typeof createClient>["storage"],
  ): Promise<AdminCvUploadResultLike> {
    const signed = await readJson(
      await fetch("/api/upload-cv/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          size: file.size,
          contentDigest,
        }),
      }),
    );
    const storage = storageClient.from("candidate-original-cvs");
    const { error: uploadError } = await storage.uploadToSignedUrl(
      signed.objectKey,
      signed.token,
      file,
      {
        contentType: signed.contentType,
      },
    );
    const response = await finalizePossiblyCompletedSignedCvUpload({
      uploadError,
      requestProcessing: () =>
        fetch("/api/upload-cv", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            size: file.size,
            objectKey: signed.objectKey,
            contentDigest,
          }),
        }),
      parseResponse: readJson,
      transferFailureMessage: "Private CV transfer failed; retry this file.",
    });
    const result = response?.results?.[0];
    if (!result || response.total !== 1)
      throw new Error("CV upload returned an invalid result.");
    return result;
  }

  async function startOrResume() {
    if (!items.some((item) => item.disposition === "ready")) return;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      setError("Private CV upload is not configured.");
      return;
    }

    setUploading(true);
    setPauseRequested(false);
    pauseRef.current = false;
    setError("");
    const storage = createClient(url, key).storage;
    let nextCheckpoint = checkpoint;

    for (const item of readyAdminCvUploadItems(items)) {
      if (pauseRef.current) break;
      setActiveName(item.name);
      let outcome: AdminCvUploadOutcome = "failed";
      let message = "";
      try {
        outcome = classifyAdminCvUploadResult(
          await uploadOne(item.file, item.digest, storage),
        );
      } catch (failure) {
        message =
          failure instanceof Error ? failure.message : "CV upload failed.";
      }

      nextCheckpoint = updateAdminCvCheckpoint({
        checkpoint: nextCheckpoint,
        selectionFingerprint,
        digest: item.digest,
        outcome,
      });
      sessionStorage.setItem(CHECKPOINT_KEY, JSON.stringify(nextCheckpoint));
      setCheckpoint(nextCheckpoint);
      setItems((current) =>
        current.map((candidate) =>
          candidate.digest === item.digest &&
          candidate.selectionIndex === item.selectionIndex
            ? {
                ...candidate,
                disposition: outcome === "failed" ? "ready" : "completed",
                priorOutcome: outcome === "failed" ? undefined : outcome,
                outcome,
                error: message,
              }
            : candidate,
        ),
      );
      if (message && FATAL_UPLOAD_ERROR.test(message)) {
        setError(`${message} Upload stopped safely.`);
        break;
      }
      if (outcome === "failed") {
        // Later versions must not be committed before a failed older CV.
        setError(
          "This CV needs a retry. Upload stopped to preserve file order.",
        );
        break;
      }
    }

    setActiveName("");
    setUploading(false);
    setPauseRequested(false);
    pauseRef.current = false;
  }

  function requestPause() {
    pauseRef.current = true;
    setPauseRequested(true);
  }

  function clearSession() {
    sessionStorage.removeItem(CHECKPOINT_KEY);
    setItems([]);
    setCheckpoint(null);
    setSelectionFingerprint("");
    setError("");
    setPreparationProgress({ completed: 0, total: 0 });
  }

  const visibleResults = items
    .filter(
      (item) =>
        item.disposition !== "ready" || item.outcome || item.priorOutcome,
    )
    .slice(0, 250);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#050505",
        color: "#fff",
        padding: 28,
      }}
    >
      <h1 style={{ fontSize: 36, marginBottom: 8 }}>Bulk Upload SAP CVs</h1>
      <p style={{ color: "#a8b3c7", marginBottom: 28, maxWidth: 900 }}>
        Select the complete current collection. Files are checked locally, exact
        byte duplicates are skipped, and candidate writes run in source
        modification order so a newer CV is never raced by an older one.
      </p>

      <section style={cardStyle}>
        <label htmlFor="cv-collection" style={{ fontWeight: 800 }}>
          Select all current CV files
        </label>
        <input
          id="cv-collection"
          type="file"
          multiple
          accept=".pdf,.docx,.txt"
          onChange={onPickFiles}
          disabled={preparing || uploading}
          style={{ display: "block", width: "100%", marginTop: 12 }}
        />
        {preparing ? (
          <p aria-live="polite" style={{ color: "#a8b3c7" }}>
            Checking {preparationProgress.completed}/{preparationProgress.total}{" "}
            files…
          </p>
        ) : null}
        {items.length ? (
          <p style={{ color: "#a8b3c7" }}>
            {planSummary.total} selected · {bytesLabel(totalSize)} ·{" "}
            {planSummary.ready} ready · {planSummary.completed} restored ·{" "}
            {planSummary.exactDuplicates} exact duplicates ·{" "}
            {planSummary.invalid} invalid
          </p>
        ) : null}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => void startOrResume()}
            disabled={preparing || uploading || planSummary.ready === 0}
          >
            {checkpoint ? "Resume safe upload" : "Start safe upload"}
          </button>
          {uploading ? (
            <button
              type="button"
              onClick={requestPause}
              disabled={pauseRequested}
            >
              {pauseRequested ? "Pausing…" : "Pause after current CV"}
            </button>
          ) : null}
          <button type="button" onClick={clearSession} disabled={uploading}>
            Clear session
          </button>
        </div>
        {activeName ? (
          <p aria-live="polite" style={{ color: "#7dd3fc" }}>
            Processing: {activeName}
          </p>
        ) : null}
        {error ? (
          <p role="alert" style={{ color: "#ff6384", fontWeight: 700 }}>
            {error}
          </p>
        ) : null}
      </section>

      {items.length ? (
        <section style={cardStyle}>
          <h2 style={{ fontSize: 20 }}>Batch results</h2>
          <p style={{ color: "#a8b3c7" }}>
            Created {createdCount} · Updated {updatedCount} · Incomplete review{" "}
            {incompleteExtractionCount} · Identity review {heldForReviewCount} ·{" "}
            Source review {outcomeCounts.get("source_review") || 0} · Non-SAP
            held for review {outcomeCounts.get("non_sap_rejected") || 0} · Retry
            required {outcomeCounts.get("failed") || 0}
          </p>
          <p style={{ color: "#8da0b8", fontSize: 13 }}>
            The resume checkpoint is session-only and contains content hashes
            plus result codes—never CV names, text, contacts, or candidate IDs.
          </p>
          <div style={{ display: "grid", gap: 8 }}>
            {visibleResults.map((item) => (
              <div
                key={`${item.digest}-${item.selectionIndex}`}
                style={{
                  background: "#090b10",
                  border: "1px solid #252b35",
                  borderRadius: 10,
                  padding: "10px 12px",
                  contentVisibility: "auto",
                }}
              >
                <strong>{item.name}</strong> —{" "}
                {item.disposition === "invalid"
                  ? `Invalid: ${item.reason}`
                  : item.disposition === "exact_duplicate"
                    ? "Exact duplicate skipped"
                    : outcomeLabel(item.outcome || item.priorOutcome)}
                {item.error ? ` — ${item.error}` : ""}
              </div>
            ))}
          </div>
          {visibleResults.length < items.length ? (
            <p style={{ color: "#8da0b8" }}>
              Showing {visibleResults.length} classified items. Aggregate totals
              above cover the full collection.
            </p>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}

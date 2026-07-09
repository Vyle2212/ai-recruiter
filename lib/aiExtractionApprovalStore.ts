import fs from "node:fs";
import path from "node:path";
import type { WorkspaceField } from "./aiExtractionReviewUi";

export type PersistedApprovalDecision =
  | "approve_suggestion"
  | "reject_suggestion"
  | "keep_existing"
  | "mark_for_review"
  | "manual_override_approve";

export type PersistedApprovalRiskLevel = "safe" | "risky" | "rejected" | "conflict";

export type AiExtractionApproval = {
  approvalId: string;
  candidateId: string;
  fieldName: string;
  currentValue: string;
  suggestedValue: string;
  parserValue: string;
  aiEvidence: string;
  aiConfidence: number;
  decision: PersistedApprovalDecision;
  riskLevel: PersistedApprovalRiskLevel;
  reviewerNote: string;
  overrideReason: string;
  createdAt: string;
  updatedAt: string;
};

export type ApprovalStoreFile = {
  mode: string;
  updatedAt: string;
  approvals: AiExtractionApproval[];
};

export type ApprovalStoreResult = {
  ok: boolean;
  approvals: AiExtractionApproval[];
  errors: string[];
};

function clean(value: any) {
  return String(Array.isArray(value) ? value.join(", ") : value ?? "").replace(/\s+/g, " ").trim();
}

export function approvalStorePath(baseDir = process.cwd()) {
  return path.join(baseDir, "reports", "ai-extraction-approvals.json");
}

function approvalIdFor(candidateId: string, fieldName: string) {
  return `${clean(candidateId)}:${clean(fieldName)}`;
}

function ensureReportsDir(filePath: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function emptyStore(): ApprovalStoreFile {
  return {
    mode: "local approval store only; no DB writes; no apply; no delete; no OpenAI calls",
    updatedAt: "",
    approvals: [],
  };
}

export function loadApprovalStore(baseDir = process.cwd()): ApprovalStoreFile {
  const filePath = approvalStorePath(baseDir);
  if (!fs.existsSync(filePath)) return emptyStore();
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return {
      ...emptyStore(),
      ...parsed,
      approvals: Array.isArray(parsed?.approvals) ? parsed.approvals : [],
    };
  } catch {
    return emptyStore();
  }
}

export function saveApprovalStore(approvals: AiExtractionApproval[], baseDir = process.cwd()): ApprovalStoreFile {
  const filePath = approvalStorePath(baseDir);
  ensureReportsDir(filePath);
  const store: ApprovalStoreFile = {
    ...emptyStore(),
    updatedAt: new Date().toISOString(),
    approvals,
  };
  fs.writeFileSync(filePath, `${JSON.stringify(store, null, 2)}\n`);
  return store;
}

export function riskLevelForField(field: Pick<WorkspaceField, "decision">): PersistedApprovalRiskLevel {
  if (field.decision === "reject") return "rejected";
  if (field.decision === "conflict") return "conflict";
  if (field.decision === "safe_accept") return "safe";
  return "risky";
}

export function validateApproval(approval: Partial<AiExtractionApproval>) {
  const errors: string[] = [];
  const candidateId = clean(approval.candidateId);
  const fieldName = clean(approval.fieldName);
  const decision = clean(approval.decision) as PersistedApprovalDecision;
  const suggestedValue = clean(approval.suggestedValue);
  const evidence = clean(approval.aiEvidence);
  const overrideReason = clean(approval.overrideReason);
  const riskLevel = clean(approval.riskLevel);
  const reasonText = clean((approval as any).reason);

  if (!candidateId) errors.push("candidateId required");
  if (!fieldName) errors.push("fieldName required");
  if (!decision) errors.push("decision required");
  if (decision === "approve_suggestion" && !suggestedValue) errors.push("suggestedValue required for approve_suggestion");
  if (decision === "manual_override_approve" && !overrideReason) errors.push("manual_override_approve requires overrideReason");
  if (decision === "approve_suggestion" && riskLevel !== "safe") errors.push("rejected, risky, or conflict fields cannot be approved normally");
  if (decision === "approve_suggestion" && !evidence) errors.push("missing evidence cannot be approved normally");
  if (decision === "approve_suggestion" && /dirty|invalid_identity|fake|placeholder|invalid_employer|project|sentence|email domain/i.test(reasonText)) {
    errors.push("dirty employer or fake identity cannot be approved normally");
  }
  return errors;
}

export function normalizeApproval(input: Partial<AiExtractionApproval>, previous?: AiExtractionApproval): AiExtractionApproval {
  const now = new Date().toISOString();
  const candidateId = clean(input.candidateId);
  const fieldName = clean(input.fieldName);
  return {
    approvalId: clean(input.approvalId) || approvalIdFor(candidateId, fieldName),
    candidateId,
    fieldName,
    currentValue: clean(input.currentValue),
    suggestedValue: clean(input.suggestedValue),
    parserValue: clean(input.parserValue),
    aiEvidence: clean(input.aiEvidence),
    aiConfidence: Number(input.aiConfidence || 0),
    decision: input.decision as PersistedApprovalDecision,
    riskLevel: (input.riskLevel || "risky") as PersistedApprovalRiskLevel,
    reviewerNote: clean(input.reviewerNote),
    overrideReason: clean(input.overrideReason),
    createdAt: previous?.createdAt || clean(input.createdAt) || now,
    updatedAt: now,
  };
}

export function upsertApprovals(inputs: Array<Partial<AiExtractionApproval>>, baseDir = process.cwd()): ApprovalStoreResult {
  const store = loadApprovalStore(baseDir);
  const byId = new Map(store.approvals.map((approval) => [approval.approvalId, approval]));
  const saved: AiExtractionApproval[] = [];
  const errors: string[] = [];

  for (const input of inputs) {
    const id = clean(input.approvalId) || approvalIdFor(clean(input.candidateId), clean(input.fieldName));
    const previous = byId.get(id);
    const normalized = normalizeApproval({ ...input, approvalId: id }, previous);
    const approvalErrors = validateApproval({ ...normalized, reason: (input as any).reason } as any);
    if (approvalErrors.length) {
      errors.push(`${id}: ${approvalErrors.join("; ")}`);
      continue;
    }
    byId.set(id, normalized);
    saved.push(normalized);
  }

  if (!errors.length) saveApprovalStore(Array.from(byId.values()), baseDir);
  return { ok: errors.length === 0, approvals: saved, errors };
}

export function approvalsToLegacyState(approvals: AiExtractionApproval[]) {
  return Object.fromEntries(
    approvals.map((approval) => {
      const action =
        approval.decision === "approve_suggestion" || approval.decision === "manual_override_approve"
          ? "approve"
          : approval.decision === "reject_suggestion"
            ? "reject"
            : approval.decision === "keep_existing"
              ? "keep"
              : "manual_review";
      return [`${approval.candidateId}:${approval.fieldName}`, { action, overrideReason: approval.overrideReason }];
    }),
  );
}

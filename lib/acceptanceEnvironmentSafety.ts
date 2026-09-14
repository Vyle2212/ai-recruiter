import { createHash } from "node:crypto";
import path from "node:path";

export const AUTHENTICATED_ACCEPTANCE_HARNESS_VERSION =
  "production-trust-authenticated-acceptance-v2";

export type AcceptanceEnvironmentInput = {
  acceptanceTestMode?: string;
  appEnvironment?: string;
  baseUrl?: string;
  supabaseUrl?: string;
  projectRef?: string;
  projectRefAllowlist?: string;
  productionProjectRefDenylist?: string;
  runId?: string;
  syntheticNamespace?: string;
  owner?: string;
  expiresAt?: string;
  credentialBundlePath?: string;
  repositoryRoot?: string;
  expectedCommitSha?: string;
};

export type AcceptanceEnvironmentDecision =
  | {
      allowed: true;
      value: {
        baseUrl: string;
        supabaseUrl: string;
        projectRef: string;
        runId: string;
        syntheticNamespace: string;
        ownerHash: string;
        expiresAt: string;
        credentialBundlePath: string;
        expectedCommitSha: string;
      };
    }
  | { allowed: false; blockers: string[] };

const projectRefPattern = /^[a-z0-9][a-z0-9-]{5,62}$/;
const runIdPattern = /^ptf1c2-[a-z0-9][a-z0-9-]{5,70}$/;
const shaPattern = /^[a-f0-9]{40}$/;

const clean = (value: string | undefined) => String(value || "").trim();
const list = (value: string | undefined) =>
  clean(value)
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

export function pseudonymousAcceptanceIdentifier(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

export function projectRefFromSupabaseUrl(value: string) {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    const match = hostname.match(/^([a-z0-9-]+)\.supabase\.(?:co|in)$/);
    return match?.[1] || "";
  } catch {
    return "";
  }
}

function isOutsideRepository(candidatePath: string, repositoryRoot: string) {
  const relative = path.relative(
    path.resolve(repositoryRoot),
    path.resolve(candidatePath),
  );
  return (
    Boolean(relative) &&
    (relative === ".." ||
      relative.startsWith(".." + path.sep) ||
      path.isAbsolute(relative))
  );
}

export function evaluateAcceptanceEnvironment(
  input: AcceptanceEnvironmentInput,
  now = new Date(),
): AcceptanceEnvironmentDecision {
  const blockers: string[] = [];
  const projectRef = clean(input.projectRef).toLowerCase();
  const derivedProjectRef = projectRefFromSupabaseUrl(clean(input.supabaseUrl));
  const allowlist = list(input.projectRefAllowlist);
  const denylist = list(input.productionProjectRefDenylist);
  const runId = clean(input.runId).toLowerCase();
  const namespace = clean(input.syntheticNamespace);
  const expectedNamespace = runId ? `ptf1c2/${runId}` : "";
  const expiresAt = new Date(clean(input.expiresAt));
  const repositoryRoot = clean(input.repositoryRoot);
  const bundlePath = clean(input.credentialBundlePath);
  const expectedSha = clean(input.expectedCommitSha).toLowerCase();

  if (clean(input.acceptanceTestMode) !== "true")
    blockers.push("acceptance_test_mode_not_enabled");
  if (!["local", "test", "acceptance"].includes(clean(input.appEnvironment)))
    blockers.push("non_production_environment_not_confirmed");
  if (!projectRefPattern.test(projectRef))
    blockers.push("acceptance_project_ref_invalid");
  if (!derivedProjectRef || derivedProjectRef !== projectRef)
    blockers.push("supabase_url_project_ref_mismatch");
  if (!allowlist.length || !allowlist.includes(projectRef))
    blockers.push("acceptance_project_ref_not_allowlisted");
  if (!denylist.length)
    blockers.push("production_project_rejection_list_missing");
  if (denylist.includes(projectRef))
    blockers.push("production_project_ref_rejected");
  if (!runIdPattern.test(runId)) blockers.push("acceptance_run_id_invalid");
  if (namespace !== expectedNamespace)
    blockers.push("synthetic_namespace_mismatch");
  if (!clean(input.owner)) blockers.push("cleanup_owner_missing");
  if (
    Number.isNaN(expiresAt.getTime()) ||
    expiresAt.getTime() <= now.getTime() ||
    expiresAt.getTime() > now.getTime() + 24 * 60 * 60 * 1000
  )
    blockers.push("cleanup_expiry_invalid");
  if (
    !repositoryRoot ||
    !bundlePath ||
    !isOutsideRepository(bundlePath, repositoryRoot)
  )
    blockers.push("credential_bundle_must_be_outside_repository");
  if (!shaPattern.test(expectedSha))
    blockers.push("expected_commit_sha_invalid");
  try {
    const base = new URL(clean(input.baseUrl));
    if (
      clean(input.appEnvironment) === "acceptance" &&
      base.protocol !== "https:"
    )
      blockers.push("https_acceptance_url_required");
  } catch {
    blockers.push("acceptance_base_url_invalid");
  }

  if (blockers.length)
    return { allowed: false, blockers: [...new Set(blockers)] };
  return {
    allowed: true,
    value: {
      baseUrl: clean(input.baseUrl).replace(/\/$/, ""),
      supabaseUrl: clean(input.supabaseUrl).replace(/\/$/, ""),
      projectRef,
      runId,
      syntheticNamespace: namespace,
      ownerHash: pseudonymousAcceptanceIdentifier(clean(input.owner)),
      expiresAt: expiresAt.toISOString(),
      credentialBundlePath: path.resolve(bundlePath),
      expectedCommitSha: expectedSha,
    },
  };
}

export function assertAcceptanceEvidenceIsSanitized(value: unknown) {
  const serialized = JSON.stringify(value);
  const forbidden = [
    /password/i,
    /service[_-]?role/i,
    /authorization/i,
    /set-cookie/i,
    /refresh[_-]?token/i,
    /access[_-]?token/i,
    /linkedin\.com\/in\//i,
    /-----BEGIN [A-Z ]+PRIVATE KEY-----/,
  ];
  return forbidden.filter((pattern) => pattern.test(serialized)).map(String);
}

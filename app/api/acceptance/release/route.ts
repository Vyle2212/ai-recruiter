import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  AUTHENTICATED_ACCEPTANCE_HARNESS_VERSION,
  pseudonymousAcceptanceIdentifier,
} from "../../../../lib/acceptanceEnvironmentSafety";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "private, no-store",
  "Content-Type": "application/json",
};

async function buildId() {
  try {
    return (
      await readFile(path.join(process.cwd(), ".next", "BUILD_ID"), "utf8")
    ).trim();
  } catch {
    return "";
  }
}

export async function GET() {
  if (
    process.env.ACCEPTANCE_TEST_MODE !== "true" ||
    process.env.APP_ENV !== "acceptance"
  )
    return Response.json(
      { error: { code: "not_found" } },
      { status: 404, headers },
    );

  const commitSha = String(
    process.env.ACCEPTANCE_DEPLOYED_SHA ||
      process.env.VERCEL_GIT_COMMIT_SHA ||
      "",
  ).trim();
  const environmentId = String(
    process.env.ACCEPTANCE_ENVIRONMENT_ID || "",
  ).trim();
  const projectRef = String(
    process.env.ACCEPTANCE_SUPABASE_PROJECT_REF || "",
  ).trim();
  const deploymentIdentity = String(
    process.env.VERCEL_DEPLOYMENT_ID || process.env.VERCEL_URL || "",
  ).trim();
  if (!/^[a-f0-9]{40}$/.test(commitSha) || !environmentId || !projectRef)
    return Response.json(
      { error: { code: "release_identity_unavailable" } },
      { status: 503, headers },
    );

  return Response.json(
    {
      schemaVersion: "acceptance-release-evidence-v3",
      harnessVersion: AUTHENTICATED_ACCEPTANCE_HARNESS_VERSION,
      commitSha,
      buildId: await buildId(),
      classification: "acceptance",
      environmentHash: pseudonymousAcceptanceIdentifier(environmentId),
      projectRefHash: pseudonymousAcceptanceIdentifier(projectRef),
      deploymentHash: deploymentIdentity
        ? createHash("sha256")
            .update(deploymentIdentity)
            .digest("hex")
            .slice(0, 16)
        : "",
      externalTalentEnabled:
        process.env.EXTERNAL_TALENT_SEARCH_ENABLED === "true",
      externalProviderConfigured:
        process.env.EXTERNAL_TALENT_SEARCH_ENABLED === "true" &&
        process.env.EXTERNAL_TALENT_PROVIDER === "exa" &&
        Boolean(process.env.EXA_API_KEY) &&
        Boolean(process.env.ANTHROPIC_API_KEY),
    },
    { headers },
  );
}

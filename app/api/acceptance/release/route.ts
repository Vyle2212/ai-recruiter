import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

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

  const commitSha = String(process.env.ACCEPTANCE_DEPLOYED_SHA || "").trim();
  const environmentId = String(
    process.env.ACCEPTANCE_ENVIRONMENT_ID || "",
  ).trim();
  if (!/^[a-f0-9]{40}$/.test(commitSha) || !environmentId)
    return Response.json(
      { error: { code: "release_identity_unavailable" } },
      { status: 503, headers },
    );

  return Response.json(
    {
      harnessVersion: "production-trust-authenticated-acceptance-v1",
      commitSha,
      buildId: await buildId(),
      environmentHash: createHash("sha256")
        .update(environmentId)
        .digest("hex")
        .slice(0, 16),
    },
    { headers },
  );
}

import { createHash } from "node:crypto";

import { AUTHENTICATED_ACCEPTANCE_HARNESS_VERSION } from "./acceptanceEnvironmentSafety";

export const VERCEL_PROTECTION_BYPASS_HEADER =
  "x-vercel-protection-bypass" as const;

export type AcceptanceBridgeConfiguration = {
  baseUrl: string;
  appEnvironment: string;
  protectionRequired: boolean;
  bypassSecret?: string;
};

export type AcceptanceReleaseExpectation = {
  commitSha: string;
  environmentId: string;
  projectRef: string;
};

export function acceptanceHash(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function parsedAcceptanceOrigin(config: AcceptanceBridgeConfiguration) {
  let parsed: URL;
  try {
    parsed = new URL(config.baseUrl);
  } catch {
    throw new Error("acceptance_bridge_base_url_invalid");
  }
  if (
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    (parsed.pathname !== "/" && parsed.pathname !== "")
  )
    throw new Error("acceptance_bridge_base_url_must_be_origin");

  const local = ["localhost", "127.0.0.1", "[::1]"].includes(
    parsed.hostname.toLowerCase(),
  );
  if (config.appEnvironment === "acceptance" && parsed.protocol !== "https:")
    throw new Error("acceptance_bridge_https_required");
  if (!config.protectionRequired) {
    if (!local || !["local", "test"].includes(config.appEnvironment))
      throw new Error("acceptance_bridge_unprotected_target_denied");
    return parsed.origin;
  }
  if (!String(config.bypassSecret || "").trim())
    throw new Error("acceptance_bridge_bypass_configuration_missing");
  return parsed.origin;
}

export function acceptanceBridgeConfigurationFromProcess(): AcceptanceBridgeConfiguration {
  return {
    baseUrl: String(process.env.ACCEPTANCE_BASE_URL || "").trim(),
    appEnvironment: String(process.env.APP_ENV || "").trim(),
    protectionRequired:
      process.env.ACCEPTANCE_DEPLOYMENT_PROTECTION_REQUIRED === "true",
    bypassSecret: process.env.ACCEPTANCE_DEPLOYMENT_BYPASS_SECRET,
  };
}

export function acceptanceRequestHeaders(
  target: string | URL,
  config: AcceptanceBridgeConfiguration,
  source: HeadersInit = {},
) {
  const origin = parsedAcceptanceOrigin(config);
  const url = new URL(String(target), `${origin}/`);
  if (url.username || url.password)
    throw new Error("acceptance_bridge_credentialed_url_denied");
  const headers = new Headers(source);
  headers.delete(VERCEL_PROTECTION_BYPASS_HEADER);
  if (url.origin !== origin)
    throw new Error("acceptance_bridge_cross_origin_request_denied");
  if (config.protectionRequired)
    headers.set(
      VERCEL_PROTECTION_BYPASS_HEADER,
      String(config.bypassSecret || "").trim(),
    );
  return { url, headers, origin };
}

export function assertAcceptanceNavigationTarget(
  target: string | URL,
  config: AcceptanceBridgeConfiguration,
) {
  const origin = parsedAcceptanceOrigin(config);
  if (new URL(String(target), `${origin}/`).origin !== origin)
    throw new Error("acceptance_bridge_external_navigation_denied");
}

type ReleaseEvidence = {
  schemaVersion?: unknown;
  harnessVersion?: unknown;
  commitSha?: unknown;
  classification?: unknown;
  environmentHash?: unknown;
  projectRefHash?: unknown;
  buildId?: unknown;
  deploymentHash?: unknown;
};

export async function fetchAcceptanceReleaseEvidence(
  fetcher: typeof fetch,
  config: AcceptanceBridgeConfiguration,
  expected: AcceptanceReleaseExpectation,
) {
  const request = acceptanceRequestHeaders("/api/acceptance/release", config, {
    Accept: "application/json",
  });
  const response = await fetcher(request.url, {
    method: "GET",
    headers: request.headers,
    redirect: "manual",
    cache: "no-store",
  });
  if (response.status >= 300 && response.status < 400)
    throw new Error("acceptance_release_redirect_rejected");
  const contentType = response.headers.get("content-type") || "";
  if (response.status !== 200 || !contentType.includes("application/json"))
    throw new Error("acceptance_release_application_evidence_missing");
  let body: ReleaseEvidence;
  try {
    body = (await response.json()) as ReleaseEvidence;
  } catch {
    throw new Error("acceptance_release_application_evidence_invalid");
  }
  const valid =
    body.schemaVersion === "acceptance-release-evidence-v2" &&
    body.harnessVersion === AUTHENTICATED_ACCEPTANCE_HARNESS_VERSION &&
    body.commitSha === expected.commitSha &&
    body.classification === "acceptance" &&
    body.environmentHash === acceptanceHash(expected.environmentId) &&
    body.projectRefHash === acceptanceHash(expected.projectRef) &&
    typeof body.buildId === "string" &&
    body.buildId.length > 0;
  if (!valid) throw new Error("acceptance_release_identity_mismatch");
  return {
    schemaVersion: body.schemaVersion,
    harnessVersion: body.harnessVersion,
    commitSha: body.commitSha,
    classification: body.classification,
    environmentHash: body.environmentHash,
    projectRefHash: body.projectRefHash,
    buildId: body.buildId,
    deploymentHash:
      typeof body.deploymentHash === "string" ? body.deploymentHash : "",
  };
}

export function sanitizedBridgeEvidence(
  value: unknown,
  secrets: Array<string | undefined> = [
    process.env.ACCEPTANCE_DEPLOYMENT_BYPASS_SECRET,
  ],
) {
  const serialized = JSON.stringify(value);
  if (
    /x-vercel-protection-bypass|bypassSecret|protection-bypass/i.test(
      serialized,
    )
  )
    throw new Error("acceptance_bridge_evidence_contains_secret_metadata");
  if (
    secrets
      .map((secret) => String(secret || "").trim())
      .some((secret) => secret.length >= 8 && serialized.includes(secret))
  )
    throw new Error("acceptance_bridge_evidence_contains_secret_value");
  return value;
}

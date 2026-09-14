import {
  acceptanceBridgeConfigurationFromProcess,
  fetchAcceptanceReleaseEvidence,
  sanitizedBridgeEvidence,
} from "../lib/acceptanceDeploymentBridge";
import { appendFile } from "node:fs/promises";
import { parseAcceptanceExternalMode } from "../lib/acceptanceFixtureLease";

function required(name: string) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error("acceptance_preflight_configuration_missing");
  return value;
}

async function main() {
  if (process.argv[2] !== "release")
    throw new Error("acceptance_preflight_action_invalid");
  const externalMode = parseAcceptanceExternalMode(
    process.env.ACCEPTANCE_EXTERNAL_MODE,
  );
  if (
    externalMode === "required" &&
    (process.env.ACCEPTANCE_EXTERNAL_PROVIDER_APPROVED !== "true" ||
      !String(process.env.ACCEPTANCE_EXTERNAL_SEARCH_QUERY || "").trim())
  )
    throw new Error("acceptance_external_required_configuration_missing");
  const evidence = await fetchAcceptanceReleaseEvidence(
    fetch,
    acceptanceBridgeConfigurationFromProcess(),
    {
      commitSha: required("ACCEPTANCE_EXPECTED_SHA"),
      environmentId: required("ACCEPTANCE_ENVIRONMENT_ID"),
      projectRef: required("ACCEPTANCE_SUPABASE_PROJECT_REF"),
      externalMode,
    },
  );
  if (process.env.GITHUB_ENV)
    await appendFile(
      process.env.GITHUB_ENV,
      `ACCEPTANCE_TESTED_BUILD_ID=${evidence.buildId}\nACCEPTANCE_TESTED_DEPLOYMENT_HASH=${evidence.deploymentHash}\nACCEPTANCE_ENVIRONMENT_HASH=${evidence.environmentHash}\nACCEPTANCE_EXTERNAL_PROVIDER_DISABLED=${evidence.externalTalentEnabled ? "false" : "true"}\n`,
      "utf8",
    );
  console.log(
    JSON.stringify(sanitizedBridgeEvidence({ ok: true, ...evidence })),
  );
}

main().catch((error) => {
  const message =
    error instanceof Error && error.message.startsWith("acceptance_")
      ? error.message
      : "acceptance_release_preflight_failed";
  console.error(message);
  process.exitCode = 1;
});

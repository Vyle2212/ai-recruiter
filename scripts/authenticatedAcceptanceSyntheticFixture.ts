import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  AUTHENTICATED_ACCEPTANCE_HARNESS_VERSION,
  evaluateAcceptanceEnvironment,
  pseudonymousAcceptanceIdentifier,
} from "../lib/acceptanceEnvironmentSafety";
import {
  acceptanceBridgeConfigurationFromProcess,
  fetchAcceptanceReleaseEvidence,
} from "../lib/acceptanceDeploymentBridge";
import {
  ACCEPTANCE_INTERNAL_SEARCH_QUERY,
  ACCEPTANCE_SYNTHETIC_CANDIDATE_ID,
  ACCEPTANCE_SYNTHETIC_CANDIDATE_MARKER,
  ACCEPTANCE_SYNTHETIC_FIXTURE_VERSION,
  acceptanceSyntheticRegistryBlockers,
  acceptanceSyntheticCandidateRecord,
  validateAcceptanceSyntheticCandidate,
} from "../lib/acceptanceSyntheticCandidateFixture";

function required(name: string) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error("acceptance_synthetic_configuration_missing");
  return value;
}

function environmentDecision() {
  return evaluateAcceptanceEnvironment({
    acceptanceTestMode: process.env.ACCEPTANCE_TEST_MODE,
    appEnvironment: process.env.APP_ENV,
    baseUrl: process.env.ACCEPTANCE_BASE_URL,
    supabaseUrl: process.env.ACCEPTANCE_SUPABASE_URL,
    projectRef: process.env.ACCEPTANCE_SUPABASE_PROJECT_REF,
    projectRefAllowlist: process.env.ACCEPTANCE_SUPABASE_PROJECT_REF_ALLOWLIST,
    productionProjectRefDenylist:
      process.env.ACCEPTANCE_PRODUCTION_PROJECT_REF_DENYLIST,
    runId: process.env.ACCEPTANCE_RUN_ID,
    syntheticNamespace: process.env.ACCEPTANCE_SYNTHETIC_NAMESPACE,
    owner: process.env.ACCEPTANCE_CLEANUP_OWNER,
    expiresAt: process.env.ACCEPTANCE_EXPIRES_AT,
    credentialBundlePath: process.env.ACCEPTANCE_CREDENTIAL_BUNDLE_PATH,
    repositoryRoot: process.cwd(),
    expectedCommitSha: process.env.ACCEPTANCE_EXPECTED_SHA,
  });
}

async function verifyDatabaseMarker(
  client: SupabaseClient,
  config: {
    projectRef: string;
    environmentId: string;
  },
) {
  const { data, error } = await client
    .from("acceptance_environment_markers")
    .select(
      "project_ref,environment_id,classification,acceptance_enabled,harness_version",
    )
    .eq("singleton", true)
    .maybeSingle();
  if (
    error ||
    !data ||
    data.project_ref !== config.projectRef ||
    data.environment_id !== config.environmentId ||
    data.classification !== "acceptance" ||
    data.acceptance_enabled !== true ||
    data.harness_version !== AUTHENTICATED_ACCEPTANCE_HARNESS_VERSION
  )
    throw new Error("acceptance_synthetic_database_marker_mismatch");
}

async function verifyFixture(
  client: SupabaseClient,
  expectedSha: string,
  ownerRunId: string,
) {
  if (
    required("ACCEPTANCE_INTERNAL_SEARCH_QUERY") !==
      ACCEPTANCE_INTERNAL_SEARCH_QUERY ||
    required("ACCEPTANCE_SYNTHETIC_CANDIDATE_MARKER") !==
      ACCEPTANCE_SYNTHETIC_CANDIDATE_MARKER
  )
    throw new Error("acceptance_synthetic_marker_or_query_mismatch");
  const { data: registry, error: registryError } = await client
    .from("acceptance_synthetic_candidates")
    .select(
      "marker,candidate_id,fixture_version,synthetic_namespace,owner_run_id,expected_commit_sha,search_query,active",
    )
    .eq("marker", ACCEPTANCE_SYNTHETIC_CANDIDATE_MARKER)
    .maybeSingle();
  if (
    registryError ||
    acceptanceSyntheticRegistryBlockers(registry, expectedSha, ownerRunId)
      .length
  )
    throw new Error("acceptance_synthetic_registry_mismatch");

  const { data: candidates, error: candidateError } = await client
    .from("candidates")
    .select(
      "id,name,email,phone,linkedin_url,title,current_title,current_company,headline,summary,current_location,raw_text,resume_text,location,country,experience,education,skills,sap_modules,primary_module,secondary_modules,status",
    )
    .eq("name", ACCEPTANCE_SYNTHETIC_CANDIDATE_MARKER);
  if (
    candidateError ||
    candidates?.length !== 1 ||
    candidates[0].id !== ACCEPTANCE_SYNTHETIC_CANDIDATE_ID
  )
    throw new Error("acceptance_synthetic_candidate_resolution_failed");
  const validation = validateAcceptanceSyntheticCandidate(candidates[0]);
  if (!validation.valid)
    throw new Error("acceptance_synthetic_candidate_contract_failed");
  const { data: index, error: indexError } = await client
    .from("candidate_search_index")
    .select("candidate_id,search_text")
    .eq("candidate_id", ACCEPTANCE_SYNTHETIC_CANDIDATE_ID)
    .maybeSingle();
  if (
    indexError ||
    !index ||
    !String(index.search_text || "").includes(
      ACCEPTANCE_SYNTHETIC_CANDIDATE_MARKER,
    )
  )
    throw new Error("acceptance_synthetic_search_index_missing");
  return validation.canonical;
}

async function main() {
  const action = process.argv[2];
  if (!["install", "verify", "remove"].includes(action))
    throw new Error("acceptance_synthetic_action_invalid");
  const decision = environmentDecision();
  if (!decision.allowed)
    throw new Error(
      `acceptance_synthetic_environment_blocked:${decision.blockers.join(",")}`,
    );
  const environmentId = required("ACCEPTANCE_ENVIRONMENT_ID");
  const ownerRunId = required("ACCEPTANCE_SYNTHETIC_FIXTURE_OWNER_RUN_ID");
  if (action !== "remove")
    await fetchAcceptanceReleaseEvidence(
      fetch,
      acceptanceBridgeConfigurationFromProcess(),
      {
        commitSha: decision.value.expectedCommitSha,
        environmentId,
        projectRef: decision.value.projectRef,
      },
    );

  // The privileged client is intentionally initialized only after the
  // exact-origin release preflight succeeds (except explicit cleanup/remove).
  const client = createClient(
    decision.value.supabaseUrl,
    required("ACCEPTANCE_SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  await verifyDatabaseMarker(client, {
    projectRef: decision.value.projectRef,
    environmentId,
  });

  if (action === "install") {
    const candidate = acceptanceSyntheticCandidateRecord();
    const validation = validateAcceptanceSyntheticCandidate(candidate);
    if (!validation.valid)
      throw new Error("acceptance_synthetic_candidate_contract_failed");
    const { error: candidateError } = await client
      .from("candidates")
      .upsert(candidate, { onConflict: "id" });
    if (candidateError)
      throw new Error("acceptance_synthetic_candidate_install_failed");
    const { buildCandidateSearchIndexRow } = await import(
      "../lib/candidateSearchIndex"
    );
    const index = buildCandidateSearchIndexRow(candidate);
    if (!index) throw new Error("acceptance_synthetic_index_build_failed");
    const { error: indexError } = await client
      .from("candidate_search_index")
      .upsert(index, { onConflict: "candidate_id" });
    if (indexError)
      throw new Error("acceptance_synthetic_index_install_failed");
    const { error: registryError } = await client
      .from("acceptance_synthetic_candidates")
      .upsert(
        {
          marker: ACCEPTANCE_SYNTHETIC_CANDIDATE_MARKER,
          candidate_id: ACCEPTANCE_SYNTHETIC_CANDIDATE_ID,
          fixture_version: ACCEPTANCE_SYNTHETIC_FIXTURE_VERSION,
          synthetic_namespace: "ptf1c2a/persistent-search-fixture",
          owner_run_id: ownerRunId,
          owner_hash: pseudonymousAcceptanceIdentifier(ownerRunId),
          expected_commit_sha: decision.value.expectedCommitSha,
          search_query: ACCEPTANCE_INTERNAL_SEARCH_QUERY,
          active: true,
        },
        { onConflict: "marker" },
      );
    if (registryError)
      throw new Error("acceptance_synthetic_registry_install_failed");
  }
  if (action === "remove") {
    await client
      .from("candidate_search_index")
      .delete()
      .eq("candidate_id", ACCEPTANCE_SYNTHETIC_CANDIDATE_ID);
    await client
      .from("acceptance_synthetic_candidates")
      .delete()
      .eq("candidate_id", ACCEPTANCE_SYNTHETIC_CANDIDATE_ID);
    await client
      .from("candidates")
      .delete()
      .eq("id", ACCEPTANCE_SYNTHETIC_CANDIDATE_ID);
    console.log(JSON.stringify({ ok: true, action: "remove" }));
    return;
  }
  const canonical = await verifyFixture(
    client,
    decision.value.expectedCommitSha,
    ownerRunId,
  );
  console.log(
    JSON.stringify({
      ok: true,
      action,
      candidateHash: pseudonymousAcceptanceIdentifier(
        ACCEPTANCE_SYNTHETIC_CANDIDATE_ID,
      ),
      canonical,
    }),
  );
}

main().catch((error) => {
  const message =
    error instanceof Error && error.message.startsWith("acceptance_")
      ? error.message
      : "acceptance_synthetic_operation_failed";
  console.error(message);
  process.exitCode = 1;
});

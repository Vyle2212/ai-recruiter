import { appendFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  installAcceptanceComparisonPack,
  removeAcceptanceComparisonPack,
  verifyAcceptanceComparisonPackAbsent,
} from "../lib/acceptanceComparisonPackRuntime";
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
  acceptanceFixtureLeaseRecord,
  acceptanceFixtureState,
  fixtureInstallAllowed,
  fixtureRemovalAllowed,
  parseAcceptanceExternalMode,
  type AcceptanceFixtureLeaseExpectation,
  type AcceptanceFixturePresence,
} from "../lib/acceptanceFixtureLease";
import {
  ACCEPTANCE_INTERNAL_SEARCH_QUERY,
  ACCEPTANCE_SYNTHETIC_CANDIDATE_ID,
  ACCEPTANCE_SYNTHETIC_CANDIDATE_MARKER,
  ACCEPTANCE_SYNTHETIC_REGISTRY_MARKER,
  acceptanceSyntheticCandidateRecord,
  validateAcceptanceSyntheticCandidate,
} from "../lib/acceptanceSyntheticCandidateFixture";

const registrySelect =
  "marker,candidate_id,fixture_version,synthetic_namespace,owner_run_id,owner_hash,environment_id,project_ref,expected_commit_sha,expires_at,search_query,active";

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

async function marker(
  client: SupabaseClient,
  environmentId: string,
  projectRef: string,
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
    data.project_ref !== projectRef ||
    data.environment_id !== environmentId ||
    data.classification !== "acceptance" ||
    data.acceptance_enabled !== true ||
    data.harness_version !== AUTHENTICATED_ACCEPTANCE_HARNESS_VERSION
  )
    throw new Error("acceptance_synthetic_database_marker_mismatch");
}

async function presence(
  client: SupabaseClient,
): Promise<AcceptanceFixturePresence> {
  const [registryResult, idResult, markerResult, indexResult] =
    await Promise.all([
      client
        .from("acceptance_synthetic_candidates")
        .select(registrySelect)
        .eq("marker", ACCEPTANCE_SYNTHETIC_REGISTRY_MARKER)
        .maybeSingle(),
      client
        .from("candidates")
        .select("id")
        .eq("id", ACCEPTANCE_SYNTHETIC_CANDIDATE_ID),
      client
        .from("candidates")
        .select("id")
        .eq("name", ACCEPTANCE_SYNTHETIC_CANDIDATE_MARKER),
      client
        .from("candidate_search_index")
        .select("candidate_id")
        .eq("candidate_id", ACCEPTANCE_SYNTHETIC_CANDIDATE_ID),
    ]);
  if (
    registryResult.error ||
    idResult.error ||
    markerResult.error ||
    indexResult.error
  )
    throw new Error("acceptance_fixture_presence_read_failed");
  return {
    registry: registryResult.data,
    candidateById: (idResult.data || []).length > 0,
    candidateByMarker: (markerResult.data || []).length > 0,
    indexByCandidateId: (indexResult.data || []).length > 0,
  };
}

async function recoverRun66FixtureLease(
  client: SupabaseClient,
  expected: AcceptanceFixtureLeaseExpectation,
) {
  const runId = "ptf1c2-gh-37940009098-1";
  if (
    expected.runId !== runId ||
    expected.syntheticNamespace !== `ptf1c2/${runId}` ||
    expected.environmentId !== "ai-recruiter-acceptance-a0123c9" ||
    expected.projectRef !== "iujucosewivndjpcjbuz"
  )
    throw new Error("acceptance_run66_recovery_scope_invalid");
  const found = await presence(client);
  if (found.registry) {
    // Resume only this recovery revision's intact lease. Never overwrite a
    // foreign lease, or extend its expiry to match a new workflow attempt.
    const resumed = {
      ...expected,
      expiresAt: String(found.registry.expires_at),
    };
    if (
      !["owned_complete", "owned_partial"].includes(
        acceptanceFixtureState(found, resumed),
      )
    )
      throw new Error("acceptance_run66_recovery_lease_conflict");
    await githubFlag("ACCEPTANCE_EXPIRES_AT", resumed.expiresAt);
    return;
  }
  if (!found.candidateById || !found.candidateByMarker)
    throw new Error("acceptance_run66_recovery_candidate_missing");
  const { data: run, error: runError } = await client
    .from("acceptance_test_runs")
    .select(
      "run_id,synthetic_namespace,owner_hash,status,created_at,expires_at",
    )
    .eq("run_id", runId)
    .single();
  if (
    runError ||
    !run ||
    run.status !== "ready" ||
    run.synthetic_namespace !== expected.syntheticNamespace ||
    run.owner_hash !== "86e299fb5e1494bf" ||
    Date.parse(run.created_at) !== Date.parse("2026-10-09T13:55:11.848344Z") ||
    Date.parse(run.expires_at) !== Date.parse("2026-10-09T15:54:53Z")
  )
    throw new Error("acceptance_run66_recovery_run_mismatch");
  const { data: candidate, error: candidateError } = await client
    .from("candidates")
    .select("*")
    .eq("id", ACCEPTANCE_SYNTHETIC_CANDIDATE_ID)
    .single();
  if (
    candidateError ||
    !candidate ||
    !validateAcceptanceSyntheticCandidate(candidate).valid
  )
    throw new Error("acceptance_run66_recovery_candidate_mismatch");
  const { data: profiles, error: profileError } = await client
    .from("acceptance_test_entities")
    .select("entity_id")
    .eq("run_id", runId)
    .eq("entity_type", "user_profile");
  const profileIds = new Set((profiles || []).map((p) => String(p.entity_id)));
  if (profileError || profiles?.length !== 6 || profileIds.size !== 6)
    throw new Error("acceptance_run66_recovery_ledger_mismatch");
  for (const [table, timeField, expectedCount] of [
    ["candidate_chat_contact_consents", "updated_at", 1],
    ["candidate_chat_contact_consent_events", "changed_at", 2],
  ] as const) {
    const { data: rows, error } = await client
      .from(table)
      .select(`candidate_id,user_profile_id,${timeField}`)
      .eq("candidate_id", ACCEPTANCE_SYNTHETIC_CANDIDATE_ID);
    if (
      error ||
      !rows ||
      rows.length !== expectedCount ||
      rows.some((row) => {
        const recordedAt =
          timeField === "updated_at" && "updated_at" in row
            ? row.updated_at
            : timeField === "changed_at" && "changed_at" in row
              ? row.changed_at
              : undefined;
        const timestamp = Date.parse(String(recordedAt));
        return (
          row.candidate_id !== ACCEPTANCE_SYNTHETIC_CANDIDATE_ID ||
          !profileIds.has(String(row.user_profile_id)) ||
          !Number.isFinite(timestamp) ||
          timestamp < Date.parse(run.created_at) ||
          timestamp > Date.parse("2026-10-09T13:55:24Z")
        );
      })
    )
      throw new Error("acceptance_run66_recovery_consent_scope_invalid");
  }
  // Reconstitute only the lost lease for the existing, validated fixture.
  // The recovery revision and expiry bind all subsequent cleanup commands;
  // no candidate, identity, permission, trigger or audit policy is changed.
  const { error: insertError } = await client
    .from("acceptance_synthetic_candidates")
    .insert(acceptanceFixtureLeaseRecord(expected));
  if (insertError)
    throw new Error("acceptance_run66_recovery_lease_create_failed");
}

async function deleteExact(
  client: SupabaseClient,
  expected: AcceptanceFixtureLeaseExpectation,
  protectedExpiredCleanup = false,
  protectedOrphanCleanup = false,
) {
  const found = await presence(client);
  const state = acceptanceFixtureState(found, expected);
  let orphanCandidateVerified = false;
  if (
    protectedOrphanCleanup &&
    state === "orphan_candidate" &&
    found.registry === null &&
    found.candidateById &&
    found.candidateByMarker &&
    !found.indexByCandidateId
  ) {
    const { data, error } = await client
      .from("candidates")
      .select(
        "id,name,email,phone,linkedin_url,title,current_title,current_company,headline,summary,current_location,raw_text,resume_text,location,country,experience,education,skills,sap_modules,primary_module,secondary_modules,status,profile_confirmation_status",
      )
      .eq("id", ACCEPTANCE_SYNTHETIC_CANDIDATE_ID)
      .single();
    orphanCandidateVerified =
      !error && validateAcceptanceSyntheticCandidate(data).valid;
  }
  const permission = fixtureRemovalAllowed({
    state,
    registry: found.registry,
    expected,
    protectedExpiredCleanup,
    protectedOrphanCleanup,
    orphanCandidateVerified,
  });
  if (!permission.allowed)
    throw new Error(`acceptance_fixture_cleanup_ownership_denied:${state}`);
  if (permission.idempotent) return;
  for (const operation of [
    client
      .from("candidate_search_index")
      .delete()
      .eq("candidate_id", ACCEPTANCE_SYNTHETIC_CANDIDATE_ID),
    client
      .from("candidates")
      .delete()
      .eq("id", ACCEPTANCE_SYNTHETIC_CANDIDATE_ID),
    client
      .from("acceptance_synthetic_candidates")
      .delete()
      .eq("marker", ACCEPTANCE_SYNTHETIC_REGISTRY_MARKER)
      .eq("owner_run_id", String(found.registry?.owner_run_id)),
  ]) {
    const { error } = await operation;
    if (error) throw new Error("acceptance_fixture_cleanup_failed");
  }
}

async function verifyCandidate(
  client: SupabaseClient,
  expected: AcceptanceFixtureLeaseExpectation,
) {
  const found = await presence(client);
  if (acceptanceFixtureState(found, expected) !== "owned_complete")
    throw new Error("acceptance_synthetic_registry_mismatch");
  const { data, error } = await client
    .from("candidates")
    .select(
      "id,name,email,phone,linkedin_url,title,current_title,current_company,headline,summary,current_location,raw_text,resume_text,location,country,experience,education,skills,sap_modules,primary_module,secondary_modules,status,profile_confirmation_status",
    )
    .eq("id", ACCEPTANCE_SYNTHETIC_CANDIDATE_ID)
    .single();
  if (error)
    throw new Error("acceptance_synthetic_candidate_resolution_failed");
  const validation = validateAcceptanceSyntheticCandidate(data);
  if (!validation.valid)
    throw new Error("acceptance_synthetic_candidate_contract_failed");
  return validation.canonical;
}

async function githubFlag(name: string, value = "true") {
  if (process.env.GITHUB_ENV)
    await appendFile(process.env.GITHUB_ENV, `${name}=${value}\n`, "utf8");
}

async function sanitizedAdminReport(action: string, state: string) {
  const output = path.resolve(
    process.env.ACCEPTANCE_ADMIN_REPORT_PATH ||
      "artifacts/acceptance-fixture-administration.json",
  );
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(
    output,
    JSON.stringify(
      {
        schemaVersion: AUTHENTICATED_ACCEPTANCE_HARNESS_VERSION,
        action,
        state,
        candidateHash: pseudonymousAcceptanceIdentifier(
          ACCEPTANCE_SYNTHETIC_CANDIDATE_ID,
        ),
        environmentHash: pseudonymousAcceptanceIdentifier(
          required("ACCEPTANCE_ENVIRONMENT_ID"),
        ),
        generatedAt: new Date().toISOString(),
      },
      null,
      2,
    ) + "\n",
  );
}

async function main() {
  const action = process.argv[2];
  const valid = [
    "availability",
    "install",
    "verify",
    "remove",
    "remove-protected-orphan",
    "residue-verify",
    "admin-verify",
    "remove-expired-fixed-fixture",
    "recover-run66-lease",
  ];
  if (!valid.includes(action))
    throw new Error("acceptance_synthetic_action_invalid");
  const decision = environmentDecision();
  if (!decision.allowed)
    throw new Error(
      `acceptance_synthetic_environment_blocked:${decision.blockers.join(",")}`,
    );
  const environmentId = required("ACCEPTANCE_ENVIRONMENT_ID");
  const expected: AcceptanceFixtureLeaseExpectation = {
    runId: decision.value.runId,
    syntheticNamespace: decision.value.syntheticNamespace,
    environmentId,
    projectRef: decision.value.projectRef,
    expectedCommitSha: decision.value.expectedCommitSha,
    expiresAt: decision.value.expiresAt,
  };
  if (
    ![
      "remove",
      "remove-protected-orphan",
      "residue-verify",
      "recover-run66-lease",
    ].includes(action)
  )
    await fetchAcceptanceReleaseEvidence(
      fetch,
      acceptanceBridgeConfigurationFromProcess(),
      {
        commitSha: expected.expectedCommitSha,
        environmentId,
        projectRef: expected.projectRef,
        externalMode: parseAcceptanceExternalMode(
          process.env.ACCEPTANCE_EXTERNAL_MODE,
        ),
      },
    );

  const client = createClient(
    decision.value.supabaseUrl,
    required("ACCEPTANCE_SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  await marker(client, environmentId, expected.projectRef);
  if (action === "recover-run66-lease") {
    await recoverRun66FixtureLease(client, expected);
    console.log(
      JSON.stringify({
        ok: true,
        action,
        runHash: pseudonymousAcceptanceIdentifier(expected.runId),
      }),
    );
    return;
  }
  const found = await presence(client);
  const state = acceptanceFixtureState(found, expected);

  if (action === "availability") {
    if (!fixtureInstallAllowed(state))
      throw new Error(`acceptance_fixture_namespace_unavailable:${state}`);
  } else if (action === "install") {
    if (!fixtureInstallAllowed(state))
      throw new Error(`acceptance_fixture_namespace_unavailable:${state}`);
    const candidate = acceptanceSyntheticCandidateRecord();
    if (!validateAcceptanceSyntheticCandidate(candidate).valid)
      throw new Error("acceptance_synthetic_candidate_contract_failed");
    const lease = acceptanceFixtureLeaseRecord(expected);
    const { error: leaseError } = await client
      .from("acceptance_synthetic_candidates")
      .insert(lease);
    if (leaseError) throw new Error("acceptance_fixture_lease_create_failed");
    const { error: candidateError } = await client
      .from("candidates")
      .insert(candidate);
    if (candidateError)
      throw new Error("acceptance_synthetic_candidate_install_failed");
    const { buildCandidateSearchIndexRow } = await import(
      "../lib/candidateSearchIndex"
    );
    const index = buildCandidateSearchIndexRow(candidate);
    if (!index) throw new Error("acceptance_synthetic_index_build_failed");
    const { error: indexError } = await client
      .from("candidate_search_index")
      .insert(index);
    if (indexError)
      throw new Error("acceptance_synthetic_index_install_failed");
    // Install the complete run dataset before preflight warms the 15-minute
    // Search projection cache. Later tests select their own query and job.
    await installAcceptanceComparisonPack(client, expected);
    await githubFlag("ACCEPTANCE_FIXTURE_INSTALLED");
  } else if (action === "verify") {
    await verifyCandidate(client, expected);
  } else if (action === "remove") {
    await removeAcceptanceComparisonPack(client, expected);
    await deleteExact(client, expected);
    await githubFlag("ACCEPTANCE_FIXTURE_REMOVED");
  } else if (action === "remove-protected-orphan") {
    await removeAcceptanceComparisonPack(client, expected);
    await deleteExact(client, expected, false, true);
    await githubFlag("ACCEPTANCE_FIXTURE_REMOVED");
  } else if (action === "residue-verify") {
    await verifyAcceptanceComparisonPackAbsent(client, expected);
    if (
      acceptanceFixtureState(await presence(client), expected) !== "available"
    )
      throw new Error("acceptance_fixture_residue_detected");
    const { data: entities, error: entityError } = await client
      .from("acceptance_test_entities")
      .select("entity_id")
      .eq("run_id", expected.runId);
    const { data: run, error: runError } = await client
      .from("acceptance_test_runs")
      .select("status")
      .eq("run_id", expected.runId)
      .maybeSingle();
    if (
      entityError ||
      runError ||
      (entities || []).length ||
      (run && run.status !== "cleaned")
    )
      throw new Error("acceptance_run_residue_detected");
    await githubFlag("ACCEPTANCE_CLEANUP_VERIFIED");
  } else if (action === "admin-verify") {
    await sanitizedAdminReport(action, state);
  } else {
    if (state !== "foreign_expired")
      throw new Error(`acceptance_fixture_not_expired:${state}`);
    await deleteExact(client, expected, true);
    await sanitizedAdminReport(action, "removed");
  }
  console.log(
    JSON.stringify({
      ok: true,
      action,
      state,
      runHash: pseudonymousAcceptanceIdentifier(expected.runId),
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

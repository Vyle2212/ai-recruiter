import { randomBytes, randomUUID } from "node:crypto";
import {
  appendFile,
  chmod,
  mkdir,
  readFile,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  AUTHENTICATED_ACCEPTANCE_HARNESS_VERSION,
  evaluateAcceptanceEnvironment,
  pseudonymousAcceptanceIdentifier,
} from "../lib/acceptanceEnvironmentSafety";
import {
  ACCEPTANCE_IDENTITY_CASES,
  type AcceptanceCredentialBundle,
  type AcceptanceIdentityKey,
} from "../lib/acceptanceSyntheticIdentityContract";
import { acceptanceCleanupPlan } from "../lib/acceptanceCleanupPlan";

type SafeConfig = Extract<
  ReturnType<typeof evaluateAcceptanceEnvironment>,
  { allowed: true }
>["value"] & {
  serviceRoleKey: string;
  environmentId: string;
};

type Entity = {
  entity_type: "auth_user" | "user_profile" | "organization";
  entity_id: string;
};

function environmentInput() {
  return {
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
  };
}

function loadConfig(): SafeConfig {
  const decision = evaluateAcceptanceEnvironment(environmentInput());
  if (!decision.allowed)
    throw new Error(
      `acceptance_environment_blocked:${decision.blockers.join(",")}`,
    );
  const serviceRoleKey = String(
    process.env.ACCEPTANCE_SUPABASE_SERVICE_ROLE_KEY || "",
  ).trim();
  const environmentId = String(
    process.env.ACCEPTANCE_ENVIRONMENT_ID || "",
  ).trim();
  if (!serviceRoleKey || !environmentId)
    throw new Error(
      "acceptance_environment_blocked:protected_runtime_configuration_missing",
    );
  return { ...decision.value, serviceRoleKey, environmentId };
}

function adminClient(config: SafeConfig) {
  return createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function verifyDatabaseMarker(
  client: SupabaseClient,
  config: SafeConfig,
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
    !["local", "test", "acceptance"].includes(data.classification) ||
    data.acceptance_enabled !== true ||
    data.harness_version !== AUTHENTICATED_ACCEPTANCE_HARNESS_VERSION
  )
    throw new Error("acceptance_environment_blocked:database_marker_mismatch");
}

async function recordEntity(
  client: SupabaseClient,
  runId: string,
  entity: Entity,
) {
  const { error } = await client
    .from("acceptance_test_entities")
    .insert({ run_id: runId, ...entity });
  if (error) throw new Error("acceptance_entity_ledger_write_failed");
}

function password() {
  return [
    randomBytes(18).toString("base64url"),
    randomBytes(8).toString("hex").toUpperCase(),
    "!9a",
  ].join("-");
}

function email(caseKey: string, runId: string) {
  const compactRun = pseudonymousAcceptanceIdentifier(runId);
  return `ptf1c2+${caseKey}+${compactRun}@acceptance.invalid`;
}

async function createAuthUser(
  client: SupabaseClient,
  config: SafeConfig,
  caseKey: string,
) {
  const generatedPassword = password();
  const generatedEmail = email(caseKey, config.runId);
  const { data, error } = await client.auth.admin.createUser({
    email: generatedEmail,
    password: generatedPassword,
    email_confirm: true,
    user_metadata: {
      synthetic: true,
      acceptance_run_hash: pseudonymousAcceptanceIdentifier(config.runId),
      expires_at: config.expiresAt,
    },
  });
  if (error || !data.user)
    throw new Error("acceptance_auth_user_create_failed");
  await recordEntity(client, config.runId, {
    entity_type: "auth_user",
    entity_id: data.user.id,
  });
  return {
    email: generatedEmail,
    password: generatedPassword,
    authUserId: data.user.id,
  };
}

async function provision(config: SafeConfig, client: SupabaseClient) {
  const { error: runError } = await client.from("acceptance_test_runs").insert({
    run_id: config.runId,
    synthetic_namespace: config.syntheticNamespace,
    owner_hash: config.ownerHash,
    expires_at: config.expiresAt,
    status: "provisioning",
  });
  if (runError) throw new Error("acceptance_run_create_failed");

  const { data: organization, error: organizationError } = await client
    .from("organizations")
    .insert({
      name: `PTF synthetic organization ${pseudonymousAcceptanceIdentifier(config.runId)}`,
      organization_type: "internal",
      status: "active",
    })
    .select("id")
    .single();
  if (organizationError || !organization?.id)
    throw new Error("acceptance_organization_create_failed");
  await recordEntity(client, config.runId, {
    entity_type: "organization",
    entity_id: String(organization.id),
  });

  const identities = {} as AcceptanceCredentialBundle["identities"];
  for (const definition of ACCEPTANCE_IDENTITY_CASES) {
    const auth = await createAuthUser(client, config, definition.key);
    if (definition.profile) {
      const profileShape = {
        auth_user_id: auth.authUserId,
        email: auth.email,
        full_name: `PTF synthetic ${definition.key}`,
        role: definition.role,
        status: definition.status,
        organization_id:
          definition.role === "candidate" ? null : String(organization.id),
        client_id: definition.role === "client" ? randomUUID() : null,
        candidate_id: definition.role === "candidate" ? randomUUID() : null,
      };
      const { data: profile, error: profileError } = await client
        .from("user_profiles")
        .insert(profileShape)
        .select("id")
        .single();
      if (profileError || !profile?.id)
        throw new Error("acceptance_profile_create_failed");
      await recordEntity(client, config.runId, {
        entity_type: "user_profile",
        entity_id: String(profile.id),
      });
    }
    identities[definition.key as AcceptanceIdentityKey] = {
      ...auth,
      role: definition.role,
      status: definition.status,
    };
  }

  const unknown = await createAuthUser(client, config, "unknown_role_control");
  const { error: unknownRoleError } = await client
    .from("user_profiles")
    .insert({
      auth_user_id: unknown.authUserId,
      email: unknown.email,
      full_name: "PTF synthetic unknown role constraint control",
      role: "acceptance_unknown_role",
      status: "active",
      organization_id: organization.id,
    });
  if (!unknownRoleError || unknownRoleError.code !== "23514")
    throw new Error("acceptance_unknown_role_constraint_not_enforced");
  const { error: unknownDeleteError } = await client.auth.admin.deleteUser(
    unknown.authUserId,
  );
  if (unknownDeleteError)
    throw new Error("acceptance_unknown_role_control_cleanup_failed");
  await client
    .from("acceptance_test_entities")
    .delete()
    .eq("run_id", config.runId)
    .eq("entity_type", "auth_user")
    .eq("entity_id", unknown.authUserId);

  const bundle: AcceptanceCredentialBundle = {
    schemaVersion: AUTHENTICATED_ACCEPTANCE_HARNESS_VERSION,
    runId: config.runId,
    expiresAt: config.expiresAt,
    identities,
    unknownRoleControl: { attempted: true, constraintRejected: true },
  };
  await mkdir(path.dirname(config.credentialBundlePath), { recursive: true });
  await writeFile(config.credentialBundlePath, JSON.stringify(bundle), {
    encoding: "utf8",
    mode: 0o600,
    flag: "wx",
  });
  await chmod(config.credentialBundlePath, 0o600).catch(() => undefined);
  const { error: readyError } = await client
    .from("acceptance_test_runs")
    .update({ status: "ready" })
    .eq("run_id", config.runId);
  if (readyError) throw new Error("acceptance_run_ready_failed");
  return bundle;
}

async function cleanup(config: SafeConfig, client: SupabaseClient) {
  const { data, error } = await client
    .from("acceptance_test_entities")
    .select("entity_type,entity_id")
    .eq("run_id", config.runId);
  if (error) throw new Error("acceptance_entity_ledger_read_failed");
  const runHash = pseudonymousAcceptanceIdentifier(config.runId);
  const syntheticEmailSuffix = `+${runHash}@acceptance.invalid`;
  const syntheticOrganizationName = `PTF synthetic organization ${runHash}`;
  const { data: discoveredProfiles, error: profileDiscoveryError } =
    await client
      .from("user_profiles")
      .select("id")
      .like("email", `%${syntheticEmailSuffix}`);
  const { data: discoveredOrganizations, error: organizationDiscoveryError } =
    await client
      .from("organizations")
      .select("id")
      .eq("name", syntheticOrganizationName);
  const { data: authPage, error: authDiscoveryError } =
    await client.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (profileDiscoveryError || organizationDiscoveryError || authDiscoveryError)
    throw new Error("acceptance_partial_provision_discovery_failed");
  const discovered: Entity[] = [
    ...(discoveredProfiles || []).map((item) => ({
      entity_type: "user_profile" as const,
      entity_id: String(item.id),
    })),
    ...(discoveredOrganizations || []).map((item) => ({
      entity_type: "organization" as const,
      entity_id: String(item.id),
    })),
    ...(authPage.users || [])
      .filter(
        (user) =>
          user.user_metadata?.synthetic === true &&
          user.user_metadata?.acceptance_run_hash === runHash,
      )
      .map((user) => ({
        entity_type: "auth_user" as const,
        entity_id: user.id,
      })),
  ];
  const entities = [...((data || []) as Entity[]), ...discovered].filter(
    (entity, index, all) =>
      index ===
      all.findIndex(
        (candidate) =>
          candidate.entity_type === entity.entity_type &&
          candidate.entity_id === entity.entity_id,
      ),
  );
  const plan = acceptanceCleanupPlan(entities);
  const profileIds = plan.profileIds;
  if (profileIds.length) {
    const { error: deleteError } = await client
      .from("user_profiles")
      .delete()
      .in("id", profileIds);
    if (deleteError) throw new Error("acceptance_profile_cleanup_failed");
  }
  for (const userId of plan.authUserIds) {
    const { error: deleteError } = await client.auth.admin.deleteUser(userId);
    if (deleteError) throw new Error("acceptance_auth_cleanup_failed");
  }
  const organizationIds = plan.organizationIds;
  if (organizationIds.length) {
    const { error: deleteError } = await client
      .from("organizations")
      .delete()
      .in("id", organizationIds);
    if (deleteError) throw new Error("acceptance_organization_cleanup_failed");
  }
  // Organization/profile cascades must remove durable controlled mutations too.
  if (organizationIds.length) {
    const { count, error } = await client
      .from("recruiter_runtime_state")
      .select("organization_id", { count: "exact", head: true })
      .in("organization_id", organizationIds);
    if (error || count !== 0)
      throw new Error("acceptance_runtime_state_residue_detected");
  }
  const { count: profileResidue, error: profileResidueError } = await client
    .from("user_profiles")
    .select("id", { count: "exact", head: true })
    .like("email", `%${syntheticEmailSuffix}`);
  const { count: organizationResidue, error: organizationResidueError } =
    await client
      .from("organizations")
      .select("id", { count: "exact", head: true })
      .eq("name", syntheticOrganizationName);
  const { data: remainingAuth, error: authResidueError } =
    await client.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (
    profileResidueError ||
    organizationResidueError ||
    authResidueError ||
    profileResidue !== 0 ||
    organizationResidue !== 0 ||
    (remainingAuth.users || []).some(
      (user) =>
        user.user_metadata?.synthetic === true &&
        user.user_metadata?.acceptance_run_hash === runHash,
    )
  )
    throw new Error("acceptance_identity_table_residue_detected");
  const { error: ledgerDeleteError } = await client
    .from("acceptance_test_entities")
    .delete()
    .eq("run_id", config.runId);
  if (ledgerDeleteError)
    throw new Error("acceptance_entity_ledger_cleanup_failed");
  const { error: runError } = await client
    .from("acceptance_test_runs")
    .update({ status: "cleaned", cleaned_at: new Date().toISOString() })
    .eq("run_id", config.runId);
  if (runError) throw new Error("acceptance_run_cleanup_status_failed");
  await unlink(config.credentialBundlePath).catch(() => undefined);
  return entities.length;
}

async function main() {
  if (typeof window !== "undefined")
    throw new Error("server_only_utility_required");
  const action = process.argv[2];
  if (!["verify", "provision", "cleanup", "cleanup-verify"].includes(action))
    throw new Error(
      "usage: authenticatedAcceptanceProvision <verify|provision|cleanup|cleanup-verify>",
    );
  const config = loadConfig();
  const client = adminClient(config);
  await verifyDatabaseMarker(client, config);
  if (action === "verify" || action === "provision") {
    const { error } = await client
      .from("recruiter_runtime_state")
      .select("revision")
      .limit(0);
    if (error)
      throw new Error(
        "acceptance_environment_blocked:runtime_storage_migration_required",
      );
  }
  if (action === "verify") {
    console.log(
      JSON.stringify({
        ok: true,
        action,
        runHash: pseudonymousAcceptanceIdentifier(config.runId),
        environmentHash: pseudonymousAcceptanceIdentifier(config.environmentId),
      }),
    );
    return;
  }
  if (action === "provision") {
    const bundle = await provision(config, client);
    console.log(
      JSON.stringify({
        ok: true,
        action,
        runHash: pseudonymousAcceptanceIdentifier(config.runId),
        identitiesProvisioned: Object.keys(bundle.identities).length,
        unknownRoleConstraintRejected:
          bundle.unknownRoleControl.constraintRejected,
      }),
    );
    return;
  }
  if (action === "cleanup-verify") {
    const { data, error } = await client
      .from("acceptance_test_entities")
      .select("entity_id")
      .eq("run_id", config.runId);
    if (error || (data || []).length)
      throw new Error("acceptance_cleanup_verification_failed");
    const { data: run, error: runError } = await client
      .from("acceptance_test_runs")
      .select("status")
      .eq("run_id", config.runId)
      .maybeSingle();
    if (runError || (run && run.status !== "cleaned"))
      throw new Error("acceptance_cleanup_status_invalid");
    if (process.env.GITHUB_ENV)
      await appendFile(
        process.env.GITHUB_ENV,
        "ACCEPTANCE_IDENTITY_CLEANUP_VERIFIED=true\n",
        "utf8",
      );
    console.log(
      JSON.stringify({
        ok: true,
        action,
        runHash: pseudonymousAcceptanceIdentifier(config.runId),
        remainingEntities: 0,
      }),
    );
    return;
  }
  const removed = await cleanup(config, client);
  console.log(
    JSON.stringify({
      ok: true,
      action,
      runHash: pseudonymousAcceptanceIdentifier(config.runId),
      entitiesRemoved: removed,
    }),
  );
}

main().catch(async (error) => {
  const message =
    error instanceof Error ? error.message : "acceptance_operation_failed";
  console.error(
    message.startsWith("acceptance_") ? message : "acceptance_operation_failed",
  );
  process.exitCode = 1;
});

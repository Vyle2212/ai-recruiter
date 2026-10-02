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
import { ACCEPTANCE_SYNTHETIC_CANDIDATE_ID } from "../lib/acceptanceSyntheticCandidateFixture";
import {
  ORIGINAL_CV_BUCKET,
  ownedOriginalCvObjectKey,
} from "../lib/originalCvArchiveKey";

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

const MAX_ACCEPTANCE_ORIGINAL_CV_OBJECTS_PER_IDENTITY = 100;

function syntheticUploadCandidateName(runHash: string) {
  if (!/^[0-9a-f]{16}$/.test(runHash))
    throw new Error("acceptance_upload_run_hash_invalid");
  const suffix = [...runHash]
    .map((digit) => String.fromCharCode(97 + parseInt(digit, 16)))
    .join("");
  return `Synthetic ${suffix[0].toUpperCase()}${suffix.slice(1)}`;
}

async function discoverRunOwnedOriginalCvObjectKeys(
  client: SupabaseClient,
  authUserIds: string[],
) {
  const bucket = client.storage.from(ORIGINAL_CV_BUCKET);
  const objectKeys: string[] = [];
  for (const authUserId of authUserIds) {
    const { data, error } = await bucket.list(authUserId, {
      limit: MAX_ACCEPTANCE_ORIGINAL_CV_OBJECTS_PER_IDENTITY + 1,
      offset: 0,
      sortBy: { column: "name", order: "asc" },
    });
    if (error || !Array.isArray(data))
      throw new Error("acceptance_original_cv_discovery_failed");
    const entries = data || [];
    if (entries.length > MAX_ACCEPTANCE_ORIGINAL_CV_OBJECTS_PER_IDENTITY)
      throw new Error("acceptance_original_cv_cleanup_bound_exceeded");
    for (const entry of entries) {
      if (!entry.id)
        throw new Error("acceptance_original_cv_unexpected_layout");
      const objectKey = `${authUserId}/${entry.name}`;
      if (!ownedOriginalCvObjectKey(authUserId, objectKey))
        throw new Error("acceptance_original_cv_ownership_mismatch");
      objectKeys.push(objectKey);
    }
  }
  return objectKeys;
}

async function readRunOwnedOriginalCvLedger(ledgerPath: string) {
  let contents = "";
  try {
    contents = await readFile(ledgerPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw new Error("acceptance_original_cv_ledger_read_failed");
  }
  const objectKeys: string[] = [];
  for (const line of contents.split("\n").filter(Boolean)) {
    let entry: unknown;
    try {
      entry = JSON.parse(line);
    } catch {
      throw new Error("acceptance_original_cv_ledger_invalid");
    }
    if (
      !entry ||
      typeof entry !== "object" ||
      Object.keys(entry).length !== 1 ||
      typeof (entry as { objectKey?: unknown }).objectKey !== "string"
    )
      throw new Error("acceptance_original_cv_ledger_invalid");
    objectKeys.push((entry as { objectKey: string }).objectKey);
  }
  return objectKeys;
}

function mergeRunOwnedOriginalCvObjectKeys(
  discoveredObjectKeys: string[],
  ledgerObjectKeys: string[],
  authUserIds: string[],
) {
  const maximum =
    MAX_ACCEPTANCE_ORIGINAL_CV_OBJECTS_PER_IDENTITY * authUserIds.length;
  if (ledgerObjectKeys.length > maximum)
    throw new Error("acceptance_original_cv_cleanup_bound_exceeded");
  for (const objectKey of ledgerObjectKeys) {
    if (
      !authUserIds.some((authUserId) =>
        ownedOriginalCvObjectKey(authUserId, objectKey),
      )
    )
      throw new Error("acceptance_original_cv_ownership_mismatch");
  }
  for (const authUserId of authUserIds) {
    const ownedLedgerKeys = new Set(
      ledgerObjectKeys.filter((objectKey) =>
        ownedOriginalCvObjectKey(authUserId, objectKey),
      ),
    );
    if (
      ownedLedgerKeys.size > MAX_ACCEPTANCE_ORIGINAL_CV_OBJECTS_PER_IDENTITY
    )
      throw new Error("acceptance_original_cv_cleanup_bound_exceeded");
  }
  const objectKeys = [...new Set([...discoveredObjectKeys, ...ledgerObjectKeys])];
  if (objectKeys.length > maximum)
    throw new Error("acceptance_original_cv_cleanup_bound_exceeded");
  return objectKeys;
}

async function cleanupRunOwnedOriginalCvData(
  client: SupabaseClient,
  authUserIds: string[],
  runHash: string,
  ledgerObjectKeys: string[] = [],
) {
  const discoveredObjectKeys = await discoverRunOwnedOriginalCvObjectKeys(
    client,
    authUserIds,
  );
  const objectKeys = mergeRunOwnedOriginalCvObjectKeys(
    discoveredObjectKeys,
    ledgerObjectKeys,
    authUserIds,
  );
  if (!objectKeys.length) return;
  const references = objectKeys.map(
    (objectKey) => `${ORIGINAL_CV_BUCKET}/${objectKey}`,
  );
  const { data: candidates, error: candidateDiscoveryError } = await client
    .from("candidates")
    .select("id,name,source_file")
    .in("source_file", references)
    .limit(MAX_ACCEPTANCE_ORIGINAL_CV_OBJECTS_PER_IDENTITY + 1);
  if (
    candidateDiscoveryError ||
    !Array.isArray(candidates) ||
    (candidates || []).length >
      MAX_ACCEPTANCE_ORIGINAL_CV_OBJECTS_PER_IDENTITY
  )
    throw new Error("acceptance_original_cv_candidate_discovery_failed");
  const expectedName = syntheticUploadCandidateName(runHash);
  if (
    (candidates || []).some(
      (candidate) =>
        candidate.name !== expectedName ||
        !references.includes(String(candidate.source_file || "")),
    )
  )
    throw new Error("acceptance_original_cv_candidate_ownership_mismatch");
  const candidateIds = (candidates || []).map((candidate) => candidate.id);
  for (const table of [
    "candidate_chat_contact_consent_events",
    "candidate_chat_contact_consents",
    "chat_conversations",
  ]) {
    if (!candidateIds.length) break;
    const { count, error } = await client
      .from(table)
      .select("id", { count: "exact", head: true })
      .in("candidate_id", candidateIds);
    if (error || count !== 0)
      throw new Error("acceptance_original_cv_candidate_dependency_detected");
  }
  const { error: reviewDeleteError } = await client
    .from("candidate_upload_reviews")
    .delete()
    .in("source_file", references);
  if (reviewDeleteError)
    throw new Error("acceptance_original_cv_review_cleanup_failed");
  if (candidateIds.length) {
    const { error: candidateDeleteError } = await client
      .from("candidates")
      .delete()
      .in("id", candidateIds);
    if (candidateDeleteError)
      throw new Error("acceptance_original_cv_candidate_cleanup_failed");
  }
  const [candidateResidue, reviewResidue] = await Promise.all([
    client
      .from("candidates")
      .select("id", { count: "exact", head: true })
      .in("source_file", references),
    client
      .from("candidate_upload_reviews")
      .select("id", { count: "exact", head: true })
      .in("source_file", references),
  ]);
  if (
    candidateResidue.error ||
    reviewResidue.error ||
    candidateResidue.count !== 0 ||
    reviewResidue.count !== 0
  )
    throw new Error("acceptance_original_cv_database_residue_detected");
  const bucket = client.storage.from(ORIGINAL_CV_BUCKET);
  const { error: removeError } = await bucket.remove(objectKeys);
  if (removeError)
    throw new Error("acceptance_original_cv_cleanup_failed");
  for (const authUserId of authUserIds) {
    const { data: remaining, error: residueError } = await bucket.list(
      authUserId,
      { limit: 1, offset: 0 },
    );
    if (residueError || !Array.isArray(remaining) || remaining.length)
      throw new Error("acceptance_original_cv_residue_detected");
  }
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
  const runHash = pseudonymousAcceptanceIdentifier(config.runId);
  const { data: clientOrganization, error: clientOrganizationError } =
    await client
      .from("organizations")
      .insert({
        name: `PTF synthetic client organization ${runHash}`,
        organization_type: "client",
        status: "active",
      })
      .select("id")
      .single();
  if (clientOrganizationError || !clientOrganization?.id)
    throw new Error("acceptance_client_organization_create_failed");
  await recordEntity(client, config.runId, {
    entity_type: "organization",
    entity_id: String(clientOrganization.id),
  });

  const identities = {} as AcceptanceCredentialBundle["identities"];
  let syntheticClient: { profileId: string; clientId: string } | null = null;
  let syntheticRecruiterProfileId: string | null = null;
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
          definition.role === "candidate"
            ? null
            : definition.role === "client"
              ? String(clientOrganization.id)
              : String(organization.id),
        client_id: definition.role === "client" ? randomUUID() : null,
        candidate_id:
          definition.role === "candidate"
            ? ACCEPTANCE_SYNTHETIC_CANDIDATE_ID
            : null,
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
      if (definition.role === "candidate") {
        const { error: accountError } = await client
          .from("candidate_accounts")
          .insert({
            user_profile_id: String(profile.id),
            candidate_id: ACCEPTANCE_SYNTHETIC_CANDIDATE_ID,
            status: "active",
          });
        if (accountError)
          throw new Error("acceptance_candidate_account_create_failed");
      }
      if (definition.key === "client")
        syntheticClient = {
          profileId: String(profile.id),
          clientId: String(profileShape.client_id),
        };
      if (definition.key === "recruiter")
        syntheticRecruiterProfileId = String(profile.id);
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

  if (!syntheticClient || !syntheticRecruiterProfileId)
    throw new Error("acceptance_job_fixture_identity_missing");
  const clientScope: { profileId: string; clientId: string } = syntheticClient;
  const recruiterProfileId: string = syntheticRecruiterProfileId;
  const job = await client
    .from("jobs")
    .insert({
      title: `PTF synthetic job ${runHash}`,
      company: `PTF synthetic organization ${runHash}`,
      status: "active",
      description: "Synthetic SAP role for controlled acceptance only.",
    })
    .select("id")
    .single();
  if (job.error || !job.data?.id)
    throw new Error("acceptance_job_fixture_create_failed");
  const relations = [
    client.from("client_memberships").insert({
      user_profile_id: clientScope.profileId,
      organization_id: clientOrganization.id,
      client_id: clientScope.clientId,
      status: "active",
    }),
    client.from("client_recruiter_assignments").insert({
      client_id: clientScope.clientId,
      recruiter_profile_id: recruiterProfileId,
      assigned_by_profile_id: clientScope.profileId,
      status: "active",
    }),
    client.from("client_feature_entitlements").insert({
      client_id: clientScope.clientId,
      plan_code: "acceptance_synthetic",
      feature: "recruiter_support",
      status: "active",
    }),
    client.from("client_job_ownership").insert({
      client_id: clientScope.clientId,
      job_id: job.data.id,
      status: "active",
    }),
    client.from("client_candidate_access").insert({
      client_id: clientScope.clientId,
      candidate_id: ACCEPTANCE_SYNTHETIC_CANDIDATE_ID,
      status: "active",
    }),
    client.from("client_candidate_shares").insert({
      client_id: clientScope.clientId,
      recruiter_profile_id: recruiterProfileId,
      candidate_id: ACCEPTANCE_SYNTHETIC_CANDIDATE_ID,
      shared_by_profile_id: clientScope.profileId,
      status: "active",
    }),
  ];
  const relationResults = await Promise.all(relations);
  if (relationResults.some((result) => result.error))
    throw new Error("acceptance_job_fixture_relations_failed");

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
  const syntheticClientOrganizationName = `PTF synthetic client organization ${runHash}`;
  const { data: discoveredProfiles, error: profileDiscoveryError } =
    await client
      .from("user_profiles")
      .select("id")
      .like("email", `%${syntheticEmailSuffix}`);
  const { data: discoveredOrganizations, error: organizationDiscoveryError } =
    await client
      .from("organizations")
      .select("id")
      .in("name", [syntheticOrganizationName, syntheticClientOrganizationName]);
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
  // Delete only objects below this run's synthetic auth-user UUID prefixes,
  // verify ownership for every exact key, and prove the prefixes are empty
  // before deleting the identities that establish run ownership.
  const originalCvLedgerPath =
    `${config.credentialBundlePath}.original-cv-ledger.jsonl`;
  const ledgerObjectKeys =
    await readRunOwnedOriginalCvLedger(originalCvLedgerPath);
  await cleanupRunOwnedOriginalCvData(
    client,
    plan.authUserIds,
    runHash,
    ledgerObjectKeys,
  );
  await unlink(originalCvLedgerPath).catch((error) => {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT")
      throw new Error("acceptance_original_cv_ledger_remove_failed");
  });
  const chatProbe = await client
    .from("chat_conversations")
    .select("id", { count: "exact", head: true })
    .limit(0);
  if (!chatProbe.error) {
    const { error: chatCleanupError } = await client.rpc(
      "cleanup_acceptance_chat_run",
      { p_run_id: config.runId },
    );
    if (chatCleanupError)
      throw new Error("acceptance_chat_fixture_cleanup_failed");
  } else if (
    !(["42P01", "PGRST205"] as string[]).includes(chatProbe.error.code)
  ) {
    throw new Error("acceptance_chat_fixture_discovery_failed");
  }
  const { data: syntheticJobs, error: jobsDiscoveryError } = await client
    .from("jobs")
    .select("id")
    .eq("title", `PTF synthetic job ${runHash}`);
  if (jobsDiscoveryError) throw new Error("acceptance_job_discovery_failed");
  const jobIds = (syntheticJobs || []).map((job) => job.id);
  const { data: syntheticClients, error: clientDiscoveryError } = await client
    .from("user_profiles")
    .select("client_id")
    .like("email", `%${syntheticEmailSuffix}`)
    .eq("role", "client");
  if (clientDiscoveryError)
    throw new Error("acceptance_client_discovery_failed");
  const clientIds = [
    ...new Set(
      (syntheticClients || []).map((item) => item.client_id).filter(Boolean),
    ),
  ];
  // Dependent rows use RESTRICT foreign keys. Remove only this run's job and
  // client scope before deleting its profiles and organization.
  for (const [table, key, ids] of [
    ["client_job_shares", "job_id", jobIds],
    ["client_job_ownership", "job_id", jobIds],
    ["client_candidate_shares", "client_id", clientIds],
    ["client_candidate_access", "client_id", clientIds],
    ["client_feature_entitlements", "client_id", clientIds],
    ["client_recruiter_assignments", "client_id", clientIds],
    ["client_memberships", "client_id", clientIds],
    ["jobs", "id", jobIds],
  ] as const) {
    if (!ids.length) continue;
    const { error: deleteError } = await client
      .from(table)
      .delete()
      .in(key, ids);
    if (deleteError) throw new Error("acceptance_job_fixture_cleanup_failed");
  }
  for (const [table, key, ids] of [
    ["client_job_shares", "job_id", jobIds],
    ["client_job_ownership", "job_id", jobIds],
    ["client_candidate_shares", "client_id", clientIds],
    ["client_candidate_access", "client_id", clientIds],
    ["client_feature_entitlements", "client_id", clientIds],
    ["client_recruiter_assignments", "client_id", clientIds],
    ["client_memberships", "client_id", clientIds],
  ] as const) {
    if (!ids.length) continue;
    const { count, error: residueError } = await client
      .from(table)
      .select("*", { count: "exact", head: true })
      .in(key, ids);
    if (residueError || count !== 0)
      throw new Error("acceptance_job_fixture_residue_detected");
  }
  if (profileIds.length) {
    const { error: accountDeleteError } = await client
      .from("candidate_accounts")
      .delete()
      .eq("candidate_id", ACCEPTANCE_SYNTHETIC_CANDIDATE_ID)
      .in("user_profile_id", profileIds);
    if (accountDeleteError)
      throw new Error("acceptance_candidate_account_cleanup_failed");
    const { count: accountResidue, error: accountResidueError } = await client
      .from("candidate_accounts")
      .select("id", { count: "exact", head: true })
      .eq("candidate_id", ACCEPTANCE_SYNTHETIC_CANDIDATE_ID)
      .in("user_profile_id", profileIds);
    if (accountResidueError || accountResidue !== 0)
      throw new Error("acceptance_candidate_account_residue_detected");
  }
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
      .in("name", [syntheticOrganizationName, syntheticClientOrganizationName]);
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
  const { count: jobResidue, error: jobResidueError } = await client
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .eq("title", `PTF synthetic job ${runHash}`);
  if (jobResidueError || jobResidue !== 0)
    throw new Error("acceptance_job_fixture_residue_detected");
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

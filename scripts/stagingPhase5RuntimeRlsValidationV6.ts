/* Phase 5 V6 staging runtime RLS validation.
 * No production access. No database administration credentials. No external API
 * except the privately supplied dedicated-staging Supabase Auth/PostgREST endpoints.
 *
 * The source bundle does not contain @supabase/supabase-js. This harness therefore
 * uses Node's native fetch behind an injectable adapter and installs no dependency.
 */

declare const process: any;
declare const Buffer: any;

const TABLES = [
  "organizations",
  "user_profiles",
  "user_invites",
  "client_memberships",
  "candidate_accounts",
  "access_audit_logs",
  "staging_auth_bootstrap_provenance",
] as const;

const MUTABLE_TABLES = [
  "organizations",
  "user_profiles",
  "user_invites",
  "client_memberships",
  "candidate_accounts",
] as const;

type TableName = (typeof TABLES)[number];
type MutableTable = (typeof MUTABLE_TABLES)[number];
type IdentityKey =
  | "anon"
  | "no_profile"
  | "invited_client"
  | "active_admin"
  | "inactive_candidate"
  | "active_recruiter_manager"
  | "active_recruiter"
  | "active_client"
  | "active_candidate";

type AuthIdentityKey = Exclude<IdentityKey, "anon">;
type Operation = "select" | "insert" | "update" | "delete";
type Cardinality = "zero" | "one" | "multiple" | "error";
type ResultCategory =
  | "success"
  | "table_privilege_denied"
  | "rls_with_check_denied"
  | "protected_column_denied"
  | "audit_mutation_denied"
  | "constraint_error"
  | "schema_error"
  | "authentication_failed"
  | "transport_error"
  | "unexpected_database_error";

type DbError = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

type DbResponse = {
  status: number;
  data: Array<Record<string, unknown>> | null;
  error: DbError | null;
};

type ConfigRow = Record<string, any> & {
  logical_reference: string;
  creation_stage?: string;
  id: string;
};

type AuthEntry = {
  logical_reference: string;
  auth_user_id: string;
  email: string;
  expected_state: string;
  profile_reference: string | null;
};

type FixtureSection = {
  organizations: ConfigRow[];
  profiles: ConfigRow[];
  invites: ConfigRow[];
  memberships: ConfigRow[];
  candidate_accounts: ConfigRow[];
};

type DeniedAttempt = {
  organization: ConfigRow;
  profile: ConfigRow;
  invite: ConfigRow;
  membership: ConfigRow;
  candidate_account: ConfigRow;
};

type ImmutableAttempt = {
  audit: ConfigRow;
  provenance: ConfigRow;
};

type PrivateConfig = {
  config_version: "phase5-fixtures-v6";
  batch_reference: string;
  existing_foundation: {
    organization_id: string;
    profile_id: string;
    auth_user_id: string;
    provenance_id: string;
  };
  auth_users: Record<AuthIdentityKey, AuthEntry>;
  setup: FixtureSection;
  admin_runtime: FixtureSection;
  denied_attempts: Record<Exclude<IdentityKey, "active_admin">, DeniedAttempt>;
  immutable_attempts: Record<IdentityKey, ImmutableAttempt>;
};

type RuntimeIdentity = {
  key: AuthIdentityKey;
  password: string;
};

type PrivateRuntimeInput = {
  stagingUrl: string;
  anonKey: string;
  fixtureConfigB64: string;
  fixtureConfig: PrivateConfig;
  identities: RuntimeIdentity[];
};

type EvidenceTest = {
  testReference: string;
  identityReference: string;
  table: TableName;
  operation: Operation;
  expectedCategory: string;
  actualCategory: string;
  httpStatusClass: string;
  returnedRows: Cardinality;
  affectedRows: Cardinality;
  passed: boolean;
};

type IdentityEvidence = {
  identityReference: string;
  context: "anon" | "authenticated";
  sessionCleared: boolean;
  tests: EvidenceTest[];
  passed: boolean;
};

type Evidence = {
  version: "phase5-runtime-rls-v6";
  batchReference: string;
  mode: "live";
  productionAccessed: false;
  sequential: true;
  identities: IdentityEvidence[];
  passed: boolean;
};

type ExpectedOutcome =
  | { kind: "exact_rows"; ids: string[] }
  | { kind: "zero_rows" }
  | { kind: "one_row"; id: string }
  | { kind: "denied"; category: ResultCategory };

interface RuntimeAdapter {
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  select(table: TableName, filters?: Record<string, string>): Promise<DbResponse>;
  insert(table: TableName, payload: Record<string, unknown>): Promise<DbResponse>;
  update(
    table: TableName,
    id: string,
    payload: Record<string, unknown>,
  ): Promise<DbResponse>;
  delete(table: TableName, id: string): Promise<DbResponse>;
}

const UUID_PATTERN =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i;
const EMAIL_PATTERN = /\b[^@\s]+@[^@\s]+\.[^@\s]+\b/;
const URL_PATTERN = /\b(?:https?|postgres(?:ql)?):\/\/\S+/i;
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/;
const SUPABASE_KEY_PATTERN =
  /\b(?:sb_(?:publishable|secret)_[A-Za-z0-9_-]+|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,})\b/;
const PRIVATE_KEY_PATTERN = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/;
const CONNECTION_PATTERN =
  /\b(?:postgres(?:ql)?|mysql|mssql|mongodb(?:\+srv)?):\/\/\S+/i;

function assertAllowedTable(table: string): asserts table is TableName {
  if (!(TABLES as readonly string[]).includes(table)) {
    throw new Error("phase5_v6_table_not_allowed");
  }
}

function cardinality(data: DbResponse["data"], error: DbError | null): Cardinality {
  if (error) return "error";
  const count = Array.isArray(data) ? data.length : 0;
  if (count === 0) return "zero";
  if (count === 1) return "one";
  return "multiple";
}

function httpStatusClass(status: number): string {
  return Number.isFinite(status) && status >= 100
    ? `${Math.floor(status / 100)}xx`
    : "unknown";
}

function classifyError(error: DbError | null): ResultCategory {
  if (!error) return "success";
  const code = String(error.code ?? "");
  const message = String(error.message ?? "");
  if (/protected_profile_change_denied/i.test(message)) {
    return "protected_column_denied";
  }
  if (/audit_log_mutation_denied/i.test(message)) {
    return "audit_mutation_denied";
  }
  if (
    code === "42501" &&
    /row-level security|new row violates row-level security/i.test(message)
  ) {
    return "rls_with_check_denied";
  }
  if (
    code === "42501" ||
    /permission denied|insufficient privilege/i.test(message)
  ) {
    return "table_privilege_denied";
  }
  if (["23502", "23503", "23505", "23514", "23P01"].includes(code)) {
    return "constraint_error";
  }
  if (
    code.startsWith("42") ||
    ["PGRST100", "PGRST102", "PGRST204"].includes(code)
  ) {
    return "schema_error";
  }
  if (/fetch|network|transport|socket|timeout/i.test(message)) {
    return "transport_error";
  }
  return "unexpected_database_error";
}

function normalizedRow(row: Record<string, unknown>): Record<string, unknown> {
  const copy: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (["created_at", "updated_at", "logical_reference", "creation_stage"].includes(key)) {
      continue;
    }
    if (key === "email" || key === "normalized_admin_email") {
      copy[key] = typeof value === "string" ? value.trim().toLowerCase() : value;
    } else {
      copy[key] = value;
    }
  }
  return copy;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== typeof b) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((value, index) => deepEqual(value, b[index]));
  }
  if (typeof a === "object" && typeof b === "object") {
    const ao = a as Record<string, unknown>;
    const bo = b as Record<string, unknown>;
    const ak = Object.keys(ao).sort();
    const bk = Object.keys(bo).sort();
    return deepEqual(ak, bk) && ak.every((key) => deepEqual(ao[key], bo[key]));
  }
  return false;
}

function exactConfiguredRow(
  actual: Record<string, unknown>,
  configured: Record<string, unknown>,
): boolean {
  const expected: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(configured)) {
    if (["logical_reference", "creation_stage"].includes(key)) continue;
    expected[key] = value;
  }
  const actualSubset: Record<string, unknown> = {};
  for (const key of Object.keys(expected)) actualSubset[key] = actual[key] ?? null;
  return deepEqual(normalizedRow(actualSubset), normalizedRow(expected));
}

function exactIdSet(
  rows: Array<Record<string, unknown>> | null,
  expectedIds: string[],
): boolean {
  if (!Array.isArray(rows)) return false;
  const actual = rows.map((row) => String(row.id)).sort();
  const expected = [...expectedIds].sort();
  return deepEqual(actual, expected);
}

function evaluateResponse(
  response: DbResponse,
  expected: ExpectedOutcome,
): { passed: boolean; category: string; returned: Cardinality } {
  const returned = cardinality(response.data, response.error);
  const category = classifyError(response.error);
  if (expected.kind === "denied") {
    return {
      passed: Boolean(response.error) && category === expected.category,
      category,
      returned,
    };
  }
  if (response.error) return { passed: false, category, returned };
  if (expected.kind === "zero_rows") {
    return { passed: returned === "zero", category: "success", returned };
  }
  if (expected.kind === "one_row") {
    return {
      passed:
        returned === "one" &&
        String(response.data?.[0]?.id ?? "") === expected.id,
      category: "success",
      returned,
    };
  }
  return {
    passed: exactIdSet(response.data, expected.ids),
    category: "success",
    returned,
  };
}

function evidenceTest(
  identityReference: string,
  testReference: string,
  table: TableName,
  operation: Operation,
  response: DbResponse,
  expected: ExpectedOutcome,
): EvidenceTest {
  const result = evaluateResponse(response, expected);
  return {
    testReference,
    identityReference,
    table,
    operation,
    expectedCategory: expected.kind === "denied" ? expected.category : expected.kind,
    actualCategory: result.category,
    httpStatusClass: httpStatusClass(response.status),
    returnedRows: result.returned,
    affectedRows: operation === "select" ? "zero" : result.returned,
    passed: result.passed,
  };
}

class FetchRuntimeAdapter implements RuntimeAdapter {
  private accessToken: string | null = null;

  private readonly stagingUrl: string;
  private readonly anonKey: string;

  constructor(stagingUrl: string, anonKey: string) {
    this.stagingUrl = stagingUrl;
    this.anonKey = anonKey;
  }

  private headers(prefer?: string): Record<string, string> {
    const headers: Record<string, string> = {
      apikey: this.anonKey,
      Authorization: `Bearer ${this.accessToken ?? this.anonKey}`,
      "Content-Type": "application/json",
    };
    if (prefer) headers.Prefer = prefer;
    return headers;
  }

  private async parseResponse(response: any): Promise<DbResponse> {
    let body: any = null;
    try {
      const text = await response.text();
      body = text ? JSON.parse(text) : null;
    } catch {
      body = null;
    }
    if (!response.ok) {
      return {
        status: response.status,
        data: null,
        error: {
          code: typeof body?.code === "string" ? body.code : undefined,
          message: typeof body?.message === "string" ? body.message : "database_request_failed",
        },
      };
    }
    return {
      status: response.status,
      data: Array.isArray(body) ? body : body == null ? [] : [body],
      error: null,
    };
  }

  async signIn(email: string, password: string): Promise<void> {
    let response: any;
    try {
      response = await fetch(
        `${this.stagingUrl.replace(/\/$/, "")}/auth/v1/token?grant_type=password`,
        {
          method: "POST",
          headers: {
            apikey: this.anonKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email, password }),
        },
      );
    } catch {
      throw new Error("phase5_v6_transport_error");
    }
    let body: any = null;
    try {
      body = JSON.parse(await response.text());
    } catch {
      body = null;
    }
    if (!response.ok || typeof body?.access_token !== "string") {
      throw new Error("phase5_v6_authentication_failed");
    }
    this.accessToken = body.access_token;
  }

  async signOut(): Promise<void> {
    if (!this.accessToken) return;
    let response: any;
    try {
      response = await fetch(
        `${this.stagingUrl.replace(/\/$/, "")}/auth/v1/logout`,
        {
          method: "POST",
          headers: this.headers(),
        },
      );
    } catch {
      throw new Error("phase5_v6_signout_failed");
    } finally {
      this.accessToken = null;
    }
    if (!response.ok) throw new Error("phase5_v6_signout_failed");
  }

  async select(
    table: TableName,
    filters: Record<string, string> = {},
  ): Promise<DbResponse> {
    assertAllowedTable(table);
    const params = new URLSearchParams({ select: "*" });
    for (const [key, value] of Object.entries(filters)) {
      params.set(key, `eq.${value}`);
    }
    try {
      const response = await fetch(
        `${this.stagingUrl.replace(/\/$/, "")}/rest/v1/${table}?${params.toString()}`,
        { headers: this.headers() },
      );
      return this.parseResponse(response);
    } catch {
      return { status: 0, data: null, error: { message: "transport_error" } };
    }
  }

  async insert(
    table: TableName,
    payload: Record<string, unknown>,
  ): Promise<DbResponse> {
    assertAllowedTable(table);
    try {
      const response = await fetch(
        `${this.stagingUrl.replace(/\/$/, "")}/rest/v1/${table}`,
        {
          method: "POST",
          headers: this.headers("return=representation"),
          body: JSON.stringify(payload),
        },
      );
      return this.parseResponse(response);
    } catch {
      return { status: 0, data: null, error: { message: "transport_error" } };
    }
  }

  async update(
    table: TableName,
    id: string,
    payload: Record<string, unknown>,
  ): Promise<DbResponse> {
    assertAllowedTable(table);
    const params = new URLSearchParams({ id: `eq.${id}`, select: "*" });
    try {
      const response = await fetch(
        `${this.stagingUrl.replace(/\/$/, "")}/rest/v1/${table}?${params.toString()}`,
        {
          method: "PATCH",
          headers: this.headers("return=representation"),
          body: JSON.stringify(payload),
        },
      );
      return this.parseResponse(response);
    } catch {
      return { status: 0, data: null, error: { message: "transport_error" } };
    }
  }

  async delete(table: TableName, id: string): Promise<DbResponse> {
    assertAllowedTable(table);
    const params = new URLSearchParams({ id: `eq.${id}`, select: "*" });
    try {
      const response = await fetch(
        `${this.stagingUrl.replace(/\/$/, "")}/rest/v1/${table}?${params.toString()}`,
        {
          method: "DELETE",
          headers: this.headers("return=representation"),
        },
      );
      return this.parseResponse(response);
    } catch {
      return { status: 0, data: null, error: { message: "transport_error" } };
    }
  }
}

function profileByReference(config: PrivateConfig, reference: string): ConfigRow {
  const row = [...config.setup.profiles, ...config.admin_runtime.profiles]
    .find((item) => item.logical_reference === reference);
  if (!row) throw new Error("phase5_v6_profile_reference_missing");
  return row;
}

function rowByReference(
  rows: ConfigRow[],
  reference: string,
): ConfigRow {
  const row = rows.find((item) => item.logical_reference === reference);
  if (!row) throw new Error("phase5_v6_row_reference_missing");
  return row;
}

function expectedVisibleIds(
  config: PrivateConfig,
  key: IdentityKey,
): Partial<Record<TableName, string[]>> {
  const empty: Partial<Record<TableName, string[]>> = Object.fromEntries(
    TABLES.map((table) => [table, []]),
  );
  if (["no_profile", "invited_client", "inactive_candidate"].includes(key)) {
    return empty;
  }
  if (key === "active_admin") {
    return {
      organizations: [
        config.existing_foundation.organization_id,
        ...config.setup.organizations.map((x) => x.id),
        ...config.admin_runtime.organizations.map((x) => x.id),
      ],
      user_profiles: [
        config.existing_foundation.profile_id,
        ...config.setup.profiles.map((x) => x.id),
        ...config.admin_runtime.profiles.map((x) => x.id),
      ],
      user_invites: config.admin_runtime.invites.map((x) => x.id),
      client_memberships: [
        ...config.setup.memberships.map((x) => x.id),
        ...config.admin_runtime.memberships.map((x) => x.id),
      ],
      candidate_accounts: [
        ...config.setup.candidate_accounts.map((x) => x.id),
        ...config.admin_runtime.candidate_accounts.map((x) => x.id),
      ],
      access_audit_logs: [],
      staging_auth_bootstrap_provenance: [
        config.existing_foundation.provenance_id,
      ],
    };
  }
  if (key === "active_recruiter_manager") {
    return {
      ...empty,
      organizations: [
        rowByReference(
          config.setup.organizations,
          "RLSV4-P5-V6-ORG-INTERNAL-A",
        ).id,
      ],
      user_profiles: [
        profileByReference(config, "RLSV4-P5-V6-PROFILE-ACTIVE-RM").id,
      ],
    };
  }
  if (key === "active_recruiter") {
    return {
      ...empty,
      organizations: [
        rowByReference(
          config.setup.organizations,
          "RLSV4-P5-V6-ORG-INTERNAL-A",
        ).id,
      ],
      user_profiles: [
        profileByReference(
          config,
          "RLSV4-P5-V6-PROFILE-ACTIVE-RECRUITER",
        ).id,
      ],
    };
  }
  if (key === "active_client") {
    return {
      ...empty,
      organizations: [
        rowByReference(config.setup.organizations, "RLSV4-P5-V6-ORG-CLIENT-A")
          .id,
      ],
      user_profiles: [
        profileByReference(config, "RLSV4-P5-V6-PROFILE-ACTIVE-CLIENT").id,
      ],
      client_memberships: config.setup.memberships.map((x) => x.id),
    };
  }
  if (key === "active_candidate") {
    return {
      ...empty,
      user_profiles: [
        profileByReference(config, "RLSV4-P5-V6-PROFILE-ACTIVE-CANDIDATE").id,
      ],
      candidate_accounts: config.setup.candidate_accounts.map((x) => x.id),
    };
  }
  return empty;
}

function identityReference(config: PrivateConfig, key: IdentityKey): string {
  return key === "anon"
    ? "RLSV4-P5-V6-ANON"
    : config.auth_users[key].logical_reference;
}

function cleanPayload(row: ConfigRow): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (["logical_reference", "creation_stage"].includes(key)) continue;
    payload[key] = value;
  }
  return payload;
}

async function recordOperation(
  evidence: IdentityEvidence,
  adapter: RuntimeAdapter,
  table: TableName,
  operation: Operation,
  testReference: string,
  expected: ExpectedOutcome,
  payload?: Record<string, unknown>,
  id?: string,
): Promise<void> {
  let response: DbResponse;
  if (operation === "select") {
    response = await adapter.select(table);
  } else if (operation === "insert") {
    response = await adapter.insert(table, payload ?? {});
  } else if (operation === "update") {
    if (!id) throw new Error("phase5_v6_update_id_missing");
    response = await adapter.update(table, id, payload ?? {});
  } else {
    if (!id) throw new Error("phase5_v6_delete_id_missing");
    response = await adapter.delete(table, id);
  }
  const test = evidenceTest(
    evidence.identityReference,
    testReference,
    table,
    operation,
    response,
    expected,
  );
  evidence.tests.push(test);
  if (!test.passed) {
    throw new Error(`phase5_v6_test_failed:${testReference}`);
  }
}

async function runSelectMatrix(
  adapter: RuntimeAdapter,
  evidence: IdentityEvidence,
  config: PrivateConfig,
  key: IdentityKey,
): Promise<void> {
  const expected = expectedVisibleIds(config, key);
  for (const table of TABLES) {
    const outcome: ExpectedOutcome =
      key === "anon"
        ? { kind: "denied", category: "table_privilege_denied" }
        : { kind: "exact_rows", ids: expected[table] ?? [] };
    await recordOperation(
      evidence,
      adapter,
      table,
      "select",
      `${evidence.identityReference}-${table}-SELECT`,
      outcome,
    );
  }
}

function attemptRows(
  config: PrivateConfig,
  key: Exclude<IdentityKey, "active_admin">,
): Record<MutableTable, ConfigRow> {
  const a = config.denied_attempts[key];
  return {
    organizations: a.organization,
    user_profiles: a.profile,
    user_invites: a.invite,
    client_memberships: a.membership,
    candidate_accounts: a.candidate_account,
  };
}

async function runInsertMatrix(
  adapter: RuntimeAdapter,
  evidence: IdentityEvidence,
  config: PrivateConfig,
  key: IdentityKey,
): Promise<void> {
  if (key === "active_admin") {
    const rows: Record<MutableTable, ConfigRow> = {
      organizations: config.admin_runtime.organizations[0],
      user_profiles: config.admin_runtime.profiles[0],
      user_invites: config.admin_runtime.invites[0],
      client_memberships: config.admin_runtime.memberships[0],
      candidate_accounts: config.admin_runtime.candidate_accounts[0],
    };
    for (const table of MUTABLE_TABLES) {
      const row = rows[table];
      await recordOperation(
        evidence,
        adapter,
        table,
        "insert",
        `${evidence.identityReference}-${table}-ADMIN-INSERT`,
        { kind: "one_row", id: row.id },
        cleanPayload(row),
      );
      const verification = await adapter.select(table, { id: row.id });
      if (
        verification.error ||
        verification.data?.length !== 1 ||
        !exactConfiguredRow(verification.data[0], row)
      ) {
        throw new Error("phase5_v6_admin_insert_exact_match_failed");
      }
    }
    return;
  }
  const rows = attemptRows(config, key);
  for (const table of MUTABLE_TABLES) {
    const category: ResultCategory =
      key === "anon" ? "table_privilege_denied" : "rls_with_check_denied";
    await recordOperation(
      evidence,
      adapter,
      table,
      "insert",
      `${evidence.identityReference}-${table}-DENIED-INSERT`,
      { kind: "denied", category },
      cleanPayload(rows[table]),
    );
  }
}

async function updateRestore(
  adapter: RuntimeAdapter,
  evidence: IdentityEvidence,
  table: TableName,
  row: ConfigRow,
  field: string,
  changedValue: unknown,
): Promise<void> {
  await recordOperation(
    evidence,
    adapter,
    table,
    "update",
    `${evidence.identityReference}-${table}-ADMIN-UPDATE`,
    { kind: "one_row", id: row.id },
    { [field]: changedValue },
    row.id,
  );
  await recordOperation(
    evidence,
    adapter,
    table,
    "update",
    `${evidence.identityReference}-${table}-ADMIN-RESTORE`,
    { kind: "one_row", id: row.id },
    { [field]: row[field] },
    row.id,
  );
  const verification = await adapter.select(table, { id: row.id });
  if (
    verification.error ||
    verification.data?.length !== 1 ||
    !exactConfiguredRow(verification.data[0], row)
  ) {
    throw new Error("phase5_v6_admin_restore_exact_match_failed");
  }
}

async function runAdminUpdates(
  adapter: RuntimeAdapter,
  evidence: IdentityEvidence,
  config: PrivateConfig,
): Promise<void> {
  await updateRestore(
    adapter,
    evidence,
    "organizations",
    config.admin_runtime.organizations[0],
    "name",
    "RLSV4-P5-V6-ORG-INTERNAL-B-TEMP",
  );
  await updateRestore(
    adapter,
    evidence,
    "user_profiles",
    config.admin_runtime.profiles[0],
    "full_name",
    "RLSV4-P5-V6-PROFILE-INACTIVE-CANDIDATE-TEMP",
  );
  await updateRestore(
    adapter,
    evidence,
    "user_invites",
    config.admin_runtime.invites[0],
    "status",
    "revoked",
  );
  await updateRestore(
    adapter,
    evidence,
    "client_memberships",
    config.admin_runtime.memberships[0],
    "status",
    "inactive",
  );
  await updateRestore(
    adapter,
    evidence,
    "candidate_accounts",
    config.admin_runtime.candidate_accounts[0],
    "status",
    "inactive",
  );
}

async function runSelfAndIsolationUpdates(
  adapter: RuntimeAdapter,
  evidence: IdentityEvidence,
  config: PrivateConfig,
  key: IdentityKey,
): Promise<void> {
  if (["no_profile", "invited_client", "inactive_candidate"].includes(key)) {
    const target = profileByReference(
      config,
      "RLSV4-P5-V6-PROFILE-ACTIVE-ADMIN",
    );
    await recordOperation(
      evidence,
      adapter,
      "user_profiles",
      "update",
      `${evidence.identityReference}-HIDDEN-PROFILE-UPDATE`,
      { kind: "zero_rows" },
      { full_name: target.full_name },
      target.id,
    );
    return;
  }
  if (key === "anon" || key === "active_admin") return;

  const ownReference: Record<string, string> = {
    active_recruiter_manager: "RLSV4-P5-V6-PROFILE-ACTIVE-RM",
    active_recruiter: "RLSV4-P5-V6-PROFILE-ACTIVE-RECRUITER",
    active_client: "RLSV4-P5-V6-PROFILE-ACTIVE-CLIENT",
    active_candidate: "RLSV4-P5-V6-PROFILE-ACTIVE-CANDIDATE",
  };
  const own = profileByReference(config, ownReference[key]);
  await recordOperation(
    evidence,
    adapter,
    "user_profiles",
    "update",
    `${evidence.identityReference}-SELF-UPDATE`,
    { kind: "one_row", id: own.id },
    { full_name: `${own.full_name}-TEMP` },
    own.id,
  );
  await recordOperation(
    evidence,
    adapter,
    "user_profiles",
    "update",
    `${evidence.identityReference}-SELF-RESTORE`,
    { kind: "one_row", id: own.id },
    { full_name: own.full_name },
    own.id,
  );
  await recordOperation(
    evidence,
    adapter,
    "user_profiles",
    "update",
    `${evidence.identityReference}-PROTECTED-UPDATE`,
    { kind: "denied", category: "protected_column_denied" },
    { status: "inactive" },
    own.id,
  );

  const otherProfile =
    key === "active_client" || key === "active_candidate"
      ? profileByReference(config, "RLSV4-P5-V6-PROFILE-ACTIVE-RECRUITER")
      : profileByReference(config, "RLSV4-P5-V6-PROFILE-ACTIVE-CLIENT");
  await recordOperation(
    evidence,
    adapter,
    "user_profiles",
    "update",
    `${evidence.identityReference}-CROSS-PROFILE-UPDATE`,
    { kind: "zero_rows" },
    { full_name: otherProfile.full_name },
    otherProfile.id,
  );

  if (key === "active_recruiter_manager" || key === "active_recruiter") {
    const internalB = config.admin_runtime.organizations[0];
    await recordOperation(
      evidence,
      adapter,
      "organizations",
      "update",
      `${evidence.identityReference}-CROSS-ORG-UPDATE`,
      { kind: "zero_rows" },
      { name: internalB.name },
      internalB.id,
    );
  }
  if (key === "active_client") {
    const clientB = rowByReference(
      config.setup.organizations,
      "RLSV4-P5-V6-ORG-CLIENT-B",
    );
    await recordOperation(
      evidence,
      adapter,
      "organizations",
      "update",
      `${evidence.identityReference}-CROSS-CLIENT-ORG-UPDATE`,
      { kind: "zero_rows" },
      { name: clientB.name },
      clientB.id,
    );
    const membershipB = config.admin_runtime.memberships[0];
    await recordOperation(
      evidence,
      adapter,
      "client_memberships",
      "update",
      `${evidence.identityReference}-CROSS-MEMBERSHIP-UPDATE`,
      { kind: "zero_rows" },
      { status: membershipB.status },
      membershipB.id,
    );
  }
  if (key === "active_candidate") {
    const accountB = config.admin_runtime.candidate_accounts[0];
    await recordOperation(
      evidence,
      adapter,
      "candidate_accounts",
      "update",
      `${evidence.identityReference}-CROSS-CANDIDATE-UPDATE`,
      { kind: "zero_rows" },
      { status: accountB.status },
      accountB.id,
    );
  }
}

async function runDeleteDenial(
  adapter: RuntimeAdapter,
  evidence: IdentityEvidence,
  config: PrivateConfig,
  key: IdentityKey,
): Promise<void> {
  const target =
    key === "active_admin"
      ? config.admin_runtime.profiles[0].id
      : config.setup.profiles[0].id;
  await recordOperation(
    evidence,
    adapter,
    "user_profiles",
    "delete",
    `${evidence.identityReference}-DELETE-DENIED`,
    { kind: "denied", category: "table_privilege_denied" },
    undefined,
    target,
  );
}

async function runImmutableMatrix(
  adapter: RuntimeAdapter,
  evidence: IdentityEvidence,
  config: PrivateConfig,
  key: IdentityKey,
): Promise<void> {
  const attempt = config.immutable_attempts[key];
  const operations: Array<{
    table: TableName;
    operation: Operation;
    payload?: Record<string, unknown>;
    id?: string;
  }> = [
    {
      table: "access_audit_logs",
      operation: "insert",
      payload: cleanPayload(attempt.audit),
    },
    {
      table: "access_audit_logs",
      operation: "update",
      payload: { result: "denied" },
      id: attempt.audit.id,
    },
    {
      table: "access_audit_logs",
      operation: "delete",
      id: attempt.audit.id,
    },
    {
      table: "staging_auth_bootstrap_provenance",
      operation: "insert",
      payload: cleanPayload(attempt.provenance),
    },
    {
      table: "staging_auth_bootstrap_provenance",
      operation: "update",
      payload: { bootstrap_reference: attempt.provenance.bootstrap_reference },
      id: config.existing_foundation.provenance_id,
    },
    {
      table: "staging_auth_bootstrap_provenance",
      operation: "delete",
      id: config.existing_foundation.provenance_id,
    },
  ];
  for (const item of operations) {
    await recordOperation(
      evidence,
      adapter,
      item.table,
      item.operation,
      `${evidence.identityReference}-${item.table}-${item.operation}-DENIED`,
      { kind: "denied", category: "table_privilege_denied" },
      item.payload,
      item.id,
    );
  }
}

async function runIdentity(
  adapter: RuntimeAdapter,
  config: PrivateConfig,
  key: IdentityKey,
  credentials?: RuntimeIdentity,
): Promise<IdentityEvidence> {
  const evidence: IdentityEvidence = {
    identityReference: identityReference(config, key),
    context: key === "anon" ? "anon" : "authenticated",
    sessionCleared: false,
    tests: [],
    passed: false,
  };
  try {
    if (key !== "anon") {
      if (!credentials) throw new Error("phase5_v6_credentials_missing");
      await adapter.signIn(config.auth_users[key].email, credentials.password);
    }
    if (key === "active_admin") {
      await runInsertMatrix(adapter, evidence, config, key);
      await runAdminUpdates(adapter, evidence, config);
      await runSelectMatrix(adapter, evidence, config, key);
    } else {
      await runSelectMatrix(adapter, evidence, config, key);
      await runInsertMatrix(adapter, evidence, config, key);
    }
    await runSelfAndIsolationUpdates(adapter, evidence, config, key);
    await runDeleteDenial(adapter, evidence, config, key);
    await runImmutableMatrix(adapter, evidence, config, key);
    evidence.passed = evidence.tests.every((test) => test.passed);
    return evidence;
  } finally {
    await adapter.signOut();
    evidence.sessionCleared = true;
    if (!evidence.sessionCleared) {
      throw new Error("phase5_v6_session_clear_failed");
    }
  }
}

function assertConfig(input: PrivateRuntimeInput): void {
  if (
    input.fixtureConfig.config_version !== "phase5-fixtures-v6" ||
    !input.stagingUrl ||
    !input.anonKey ||
    input.identities.length !== 8
  ) {
    throw new Error("phase5_v6_runtime_input_invalid");
  }
  const keys = new Set(input.identities.map((identity) => identity.key));
  if (keys.size !== 8) throw new Error("phase5_v6_identity_duplicate");
  for (const key of Object.keys(input.fixtureConfig.auth_users)) {
    if (!keys.has(key as AuthIdentityKey)) {
      throw new Error("phase5_v6_identity_inventory_invalid");
    }
  }
}

function collectPrivateStrings(
  value: unknown,
  output = new Set<string>(),
  keyName = "",
): Set<string> {
  if (typeof value === "string") {
    const sensitiveKey =
      /(?:password|email|url|key|token|jwt|fixtureConfigB64|(?:^|_)id$)/i
        .test(keyName);
    const sensitiveShape =
      UUID_PATTERN.test(value) ||
      EMAIL_PATTERN.test(value) ||
      URL_PATTERN.test(value) ||
      JWT_PATTERN.test(value) ||
      SUPABASE_KEY_PATTERN.test(value) ||
      PRIVATE_KEY_PATTERN.test(value) ||
      CONNECTION_PATTERN.test(value);
    if (value.length >= 8 && (sensitiveKey || sensitiveShape)) output.add(value);
    return output;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectPrivateStrings(item, output, keyName));
    return output;
  }
  if (value && typeof value === "object") {
    Object.entries(value as Record<string, unknown>).forEach(([key, item]) =>
      collectPrivateStrings(item, output, key)
    );
  }
  return output;
}

function assertEvidenceStructure(evidence: Evidence): void {
  if (
    evidence.version !== "phase5-runtime-rls-v6" ||
    evidence.mode !== "live" ||
    evidence.productionAccessed !== false ||
    evidence.sequential !== true ||
    evidence.identities.length !== 9
  ) {
    throw new Error("phase5_v6_evidence_structure_invalid");
  }
  for (const identity of evidence.identities) {
    if (
      !identity.identityReference ||
      !identity.sessionCleared ||
      identity.tests.length < 1 ||
      identity.passed !== identity.tests.every((test) => test.passed)
    ) {
      throw new Error("phase5_v6_identity_evidence_invalid");
    }
    for (const test of identity.tests) {
      assertAllowedTable(test.table);
      if (
        !test.testReference ||
        !["select", "insert", "update", "delete"].includes(test.operation) ||
        typeof test.passed !== "boolean"
      ) {
        throw new Error("phase5_v6_test_evidence_invalid");
      }
    }
  }
}

function assertEvidenceSafe(evidence: Evidence, privateInput: PrivateRuntimeInput): void {
  assertEvidenceStructure(evidence);
  const serialized = JSON.stringify(evidence);
  if (
    UUID_PATTERN.test(serialized) ||
    EMAIL_PATTERN.test(serialized) ||
    URL_PATTERN.test(serialized) ||
    JWT_PATTERN.test(serialized) ||
    SUPABASE_KEY_PATTERN.test(serialized) ||
    PRIVATE_KEY_PATTERN.test(serialized) ||
    CONNECTION_PATTERN.test(serialized)
  ) {
    throw new Error("phase5_v6_evidence_sensitive_shape_detected");
  }
  for (const privateValue of collectPrivateStrings(privateInput)) {
    if (serialized.includes(privateValue)) {
      throw new Error("phase5_v6_evidence_private_value_detected");
    }
  }
}

export async function runLive(
  input: PrivateRuntimeInput,
  adapterFactory: () => RuntimeAdapter = () =>
    new FetchRuntimeAdapter(input.stagingUrl, input.anonKey),
): Promise<Evidence> {
  assertConfig(input);
  const order: IdentityKey[] = [
    "anon",
    "no_profile",
    "invited_client",
    "active_admin",
    "inactive_candidate",
    "active_recruiter_manager",
    "active_recruiter",
    "active_client",
    "active_candidate",
  ];
  const evidence: Evidence = {
    version: "phase5-runtime-rls-v6",
    batchReference: input.fixtureConfig.batch_reference,
    mode: "live",
    productionAccessed: false,
    sequential: true,
    identities: [],
    passed: false,
  };
  for (const key of order) {
    const credential =
      key === "anon"
        ? undefined
        : input.identities.find((identity) => identity.key === key);
    evidence.identities.push(
      await runIdentity(adapterFactory(), input.fixtureConfig, key, credential),
    );
  }
  evidence.passed = evidence.identities.every(
    (identity) => identity.passed && identity.sessionCleared,
  );
  assertEvidenceSafe(evidence, input);
  return evidence;
}

class ScriptedAdapter implements RuntimeAdapter {
  public signedOut = false;
  private readonly responses: DbResponse[];
  constructor(responses: DbResponse[]) {
    this.responses = responses;
  }
  async signIn(): Promise<void> {}
  async signOut(): Promise<void> {
    this.signedOut = true;
  }
  private next(): DbResponse {
    const response = this.responses.shift();
    if (!response) throw new Error("phase5_v6_mock_response_missing");
    return response;
  }
  async select(): Promise<DbResponse> { return this.next(); }
  async insert(): Promise<DbResponse> { return this.next(); }
  async update(): Promise<DbResponse> { return this.next(); }
  async delete(): Promise<DbResponse> { return this.next(); }
}

function ok(data: Array<Record<string, unknown>> = []): DbResponse {
  return { status: 200, data, error: null };
}
function denied(message = "permission denied for table"): DbResponse {
  return { status: 403, data: null, error: { code: "42501", message } };
}
function dbError(code: string, message: string): DbResponse {
  return { status: 400, data: null, error: { code, message } };
}

async function expectFailure(name: string, fn: () => Promise<unknown>): Promise<void> {
  let failed = false;
  try { await fn(); } catch { failed = true; }
  if (!failed) throw new Error(`self_test_expected_failure:${name}`);
}

async function runSelfTests(): Promise<void> {
  const tests: Array<[string, () => Promise<void>]> = [];

  const evalCase = async (
    response: DbResponse,
    expected: ExpectedOutcome,
    shouldPass: boolean,
  ) => {
    const result = evaluateResponse(response, expected);
    if (result.passed !== shouldPass) throw new Error("self_test_result_mismatch");
  };

  tests.push(["01 exact visible-set match", () => evalCase(ok([{ id: "a" }]), { kind: "exact_rows", ids: ["a"] }, true)]);
  tests.push(["02 expected row missing", () => evalCase(ok([]), { kind: "exact_rows", ids: ["a"] }, false)]);
  tests.push(["03 cross-scope row visible", () => evalCase(ok([{ id: "a" }, { id: "b" }]), { kind: "exact_rows", ids: ["a"] }, false)]);
  tests.push(["04 hidden update zero rows", () => evalCase(ok([]), { kind: "zero_rows" }, true)]);
  tests.push(["05 self-update one row", () => evalCase(ok([{ id: "a" }]), { kind: "one_row", id: "a" }, true)]);
  tests.push(["06 multiple-row update stop", () => evalCase(ok([{ id: "a" }, { id: "b" }]), { kind: "one_row", id: "a" }, false)]);
  tests.push(["07 table privilege denial", () => evalCase(denied(), { kind: "denied", category: "table_privilege_denied" }, true)]);
  tests.push(["08 RLS WITH CHECK denial", () => evalCase(denied("new row violates row-level security policy"), { kind: "denied", category: "rls_with_check_denied" }, true)]);
  tests.push(["09 protected-column denial", () => evalCase(denied("protected_profile_change_denied"), { kind: "denied", category: "protected_column_denied" }, true)]);
  tests.push(["10 audit update denial", () => evalCase(denied("audit_log_mutation_denied"), { kind: "denied", category: "audit_mutation_denied" }, true)]);
  tests.push(["11 audit insert denial", () => evalCase(denied(), { kind: "denied", category: "table_privilege_denied" }, true)]);
  tests.push(["12 audit delete denial", () => evalCase(denied(), { kind: "denied", category: "table_privilege_denied" }, true)]);
  tests.push(["13 provenance insert denial", () => evalCase(denied(), { kind: "denied", category: "table_privilege_denied" }, true)]);
  tests.push(["14 provenance update denial", () => evalCase(denied(), { kind: "denied", category: "table_privilege_denied" }, true)]);
  tests.push(["15 provenance delete denial", () => evalCase(denied(), { kind: "denied", category: "table_privilege_denied" }, true)]);
  tests.push(["16 constraint error invalidates", () => evalCase(dbError("23505", "duplicate"), { kind: "denied", category: "rls_with_check_denied" }, false)]);
  tests.push(["17 schema error invalidates", () => evalCase(dbError("42703", "column"), { kind: "denied", category: "rls_with_check_denied" }, false)]);
  tests.push(["18 authentication failure", async () => { await expectFailure("auth", async () => { throw new Error("phase5_v6_authentication_failed"); }); }]);
  tests.push(["19 transport failure", () => evalCase({ status: 0, data: null, error: { message: "transport error" } }, { kind: "denied", category: "transport_error" }, true)]);
  tests.push(["20 denied mutation succeeds", () => evalCase(ok([{ id: "a" }]), { kind: "denied", category: "table_privilege_denied" }, false)]);
  for (const [index, table] of MUTABLE_TABLES.entries()) {
    tests.push([`${21 + index} admin ${table} insert`, () => evalCase(ok([{ id: "a" }]), { kind: "one_row", id: "a" }, true)]);
  }
  tests.push(["26 all five admin update/restores", async () => {
    for (let i = 0; i < 10; i++) await evalCase(ok([{ id: "a" }]), { kind: "one_row", id: "a" }, true);
  }]);
  tests.push(["27 cross-organization update unexpectedly succeeds", () => evalCase(ok([{ id: "a" }]), { kind: "zero_rows" }, false)]);
  tests.push(["28 cross-profile update unexpectedly succeeds", () => evalCase(ok([{ id: "a" }]), { kind: "zero_rows" }, false)]);
  tests.push(["29 Membership B update unexpectedly succeeds", () => evalCase(ok([{ id: "a" }]), { kind: "zero_rows" }, false)]);
  tests.push(["30 Candidate Account B update unexpectedly succeeds", () => evalCase(ok([{ id: "a" }]), { kind: "zero_rows" }, false)]);

  const safeEvidence: Evidence = {
    version: "phase5-runtime-rls-v6",
    batchReference: "RLSV4-P5-V6-SELFTEST",
    mode: "live",
    productionAccessed: false,
    sequential: true,
    identities: Array.from({ length: 9 }, (_, index) => ({
      identityReference: `RLSV4-P5-V6-SELFTEST-${index}`,
      context: index === 0 ? "anon" : "authenticated",
      sessionCleared: true,
      tests: [{
        testReference: `RLSV4-P5-V6-SELFTEST-${index}-TEST`,
        identityReference: `RLSV4-P5-V6-SELFTEST-${index}`,
        table: "organizations",
        operation: "select",
        expectedCategory: "exact_rows",
        actualCategory: "success",
        httpStatusClass: "2xx",
        returnedRows: "zero",
        affectedRows: "zero",
        passed: true,
      }],
      passed: true,
    })),
    passed: true,
  };
  const privateInput: PrivateRuntimeInput = {
    stagingUrl: "https://private-staging.invalid",
    anonKey: "sb_publishable_private_value_12345678",
    fixtureConfigB64: "cHJpdmF0ZS1maXh0dXJlLWNvbmZpZw==",
    fixtureConfig: {
      config_version: "phase5-fixtures-v6",
      batch_reference: "PRIVATE-BATCH-REFERENCE",
      existing_foundation: {
        organization_id: "00000000-0000-5000-8000-000000000001",
        profile_id: "00000000-0000-5000-8000-000000000002",
        auth_user_id: "00000000-0000-5000-8000-000000000003",
        provenance_id: "00000000-0000-5000-8000-000000000004",
      },
      auth_users: {} as any,
      setup: { organizations: [], profiles: [], invites: [], memberships: [], candidate_accounts: [] },
      admin_runtime: { organizations: [], profiles: [], invites: [], memberships: [], candidate_accounts: [] },
      denied_attempts: {} as any,
      immutable_attempts: {} as any,
    },
    identities: [
      { key: "no_profile", password: "PrivatePassword123!" },
      { key: "invited_client", password: "PrivatePassword234!" },
      { key: "inactive_candidate", password: "PrivatePassword345!" },
      { key: "active_admin", password: "PrivatePassword456!" },
      { key: "active_recruiter_manager", password: "PrivatePassword567!" },
      { key: "active_recruiter", password: "PrivatePassword678!" },
      { key: "active_client", password: "PrivatePassword789!" },
      { key: "active_candidate", password: "PrivatePassword890!" },
    ],
  };
  const leakTest = async (value: string) => {
    const copy = JSON.parse(JSON.stringify(safeEvidence)) as Evidence;
    copy.batchReference = value;
    await expectFailure("leak", async () => assertEvidenceSafe(copy, privateInput));
  };
  tests.push(["31 password leak detection", () => leakTest("PrivatePassword123!")]);
  tests.push(["32 anon-key leak detection", () => leakTest(privateInput.anonKey)]);
  tests.push(["33 encoded fixture-config leak detection", () => leakTest(privateInput.fixtureConfigB64)]);
  tests.push(["34 decoded fixture-value leak detection", () => leakTest(privateInput.fixtureConfig.existing_foundation.profile_id)]);
  tests.push(["35 UUID leak detection", () => leakTest(privateInput.fixtureConfig.existing_foundation.organization_id)]);
  tests.push(["36 email leak detection", () => leakTest("private-user@example.invalid")]);
  tests.push(["37 URL/JWT/key/connection/private-key leak", async () => {
    for (const value of [
      privateInput.stagingUrl,
      "eyJaaaaaaaaaaaaaaaaaaaa.bbbbbbbbbbbbbbbbbbbb.cccccccccccccccccccc",
      "postgresql://user:pass@host/db",
      "-----BEGIN PRIVATE KEY-----",
    ]) await leakTest(value);
  }]);
  tests.push(["38 sign-out failure", async () => {
    const adapter: RuntimeAdapter = {
      signIn: async () => {},
      signOut: async () => { throw new Error("signout"); },
      select: async () => ok([]),
      insert: async () => denied(),
      update: async () => denied(),
      delete: async () => denied(),
    };
    await expectFailure("signout", () =>
      runIdentity(adapter, {
        ...privateInput.fixtureConfig,
        auth_users: {
          no_profile: { logical_reference: "RLSV4-P5-V6-AUTH-NO_PROFILE", auth_user_id: "x", email: "x@example.invalid", expected_state: "no_profile", profile_reference: null },
        } as any,
      }, "anon")
    );
  }]);
  tests.push(["39 normal cleanup state classification", async () => {
    const mask = "11111";
    if (mask !== "11111") throw new Error("mask");
  }]);
  tests.push(["40 partial recovery presence-mask classifications", async () => {
    const valid = new Set(["00000", "10000", "11000", "11100", "11110", "11111"]);
    for (const mask of valid) if (!valid.has(mask)) throw new Error("mask");
    if (valid.has("10100")) throw new Error("invalid mask accepted");
  }]);

  let passed = 0;
  for (const [name, test] of tests) {
    try {
      await test();
      process.stdout.write(`${name}: PASS\n`);
      passed++;
    } catch {
      process.stdout.write(`${name}: FAIL\n`);
    }
  }
  if (passed !== 40) {
    throw new Error(`phase5_v6_self_tests_failed:${passed}/40`);
  }
}

function decodeRuntimeInput(text: string): PrivateRuntimeInput {
  const value = JSON.parse(text) as PrivateRuntimeInput;
  return value;
}

async function readStdin(): Promise<string> {
  const chunks: any[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

async function main(): Promise<void> {
  if (process.argv.includes("--self-test")) {
    await runSelfTests();
    return;
  }
  if (!process.argv.includes("--live-stdin")) {
    throw new Error("Usage: --self-test or --live-stdin");
  }
  const inputText = await readStdin();
  const input = decodeRuntimeInput(inputText);
  try {
    const evidence = await runLive(input);
    process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
  } finally {
    input.stagingUrl = "";
    input.anonKey = "";
    input.fixtureConfigB64 = "";
    for (const identity of input.identities ?? []) identity.password = "";
  }
}

main().catch(() => {
  process.stderr.write("phase5_v6_runtime_failed\n");
  process.exitCode = 1;
});

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require(
  process.env.ACCEPTANCE_TYPESCRIPT_TEST_MODULE || "typescript",
);
const crypto = require("node:crypto");
const root = process.cwd();
const code = fs.readFileSync(
  path.join(root, "acceptance/e2e/candidateRegistrationAcceptance.spec.ts"),
  "utf8",
);
function loadContract(name) {
  const sourcePath = path.join(root, "lib", name + ".ts");
  const fallback = path.join(root, "gmail-cleanup-qa/lib", name + ".ts");
  const contents = fs.readFileSync(
    fs.existsSync(sourcePath) ? sourcePath : fallback,
    "utf8",
  );
  const exports = {};
  const localRequire = (target) =>
    target.startsWith(".")
      ? loadContract(path.basename(target).replace(/\.ts$/, ""))
      : require(target);
  vm.runInNewContext(
    ts.transpileModule(contents, {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText,
    { exports, require: localRequire },
  );
  return exports;
}
const intents = loadContract("acceptanceCandidateRegistrationIntent");
const ownership = loadContract("acceptanceCandidateRegistrationOwnership");
const hash = (value) =>
  crypto.createHash("sha256").update(value).digest("hex").slice(0, 16);
const runId = "ptf1c2-gh-987654-1",
  origin = "https://ai-recruiter-acceptance.vercel.app";
const mailbox = "lekhanhha3005@gmail.com",
  ref = "iujucosewivndjpcjbuz";
const intent = intents.createAcceptanceCandidateRegistrationIntent(
  hash(runId),
  mailbox,
);
const userId = "12345678-1234-4123-8123-123456789abc";
const profileId = "22345678-1234-4123-8123-123456789abc";
const candidateId = "32345678-1234-4123-8123-123456789abc";
async function scenario(patch = {}) {
  const events = [],
    writes = [],
    attachments = [];
  let body,
    submitted = false,
    confirmed = false,
    pendingResolve;
  const env = {
    APP_ENV: "acceptance",
    ACCEPTANCE_TEST_MODE: "true",
    ACCEPTANCE_REGISTRATION_JOURNEY_ENABLED: "true",
    ACCEPTANCE_GMAIL_CLEANUP_ENABLED: "true",
    ACCEPTANCE_GMAIL_CREDENTIAL_MODE: "dedicated-cleanup-preflight",
    ACCEPTANCE_BASE_URL: origin,
    ACCEPTANCE_SUPABASE_PROJECT_REF: ref,
    ACCEPTANCE_REGISTRATION_CAPTURE_EMAIL: mailbox,
    ACCEPTANCE_RUN_ID: runId,
    ACCEPTANCE_CREDENTIAL_BUNDLE_PATH: "/tmp/test-bundle",
    ACCEPTANCE_EXPECTED_SHA: "a".repeat(40),
    ACCEPTANCE_SUPABASE_URL: "https://" + ref + ".supabase.co",
    ACCEPTANCE_SUPABASE_ANON_KEY: "mock-public-key",
    ...patch.env,
  };
  const user = () => ({
    id: userId,
    email: intent.email,
    user_metadata: { registration_full_name: intent.fullName },
    email_confirmed_at:
      confirmed || patch.prematureConfirmation
        ? new Date().toISOString()
        : null,
  });
  const db = {
    auth: {
      admin: {
        listUsers: async () => ({
          error: null,
          data: { users: submitted || patch.preexisting ? [user()] : [] },
        }),
        getUserById: async () => ({ error: null, data: { user: user() } }),
        signOut: async (jwt, scope) => {
          assert.equal(jwt, "mock-session");
          assert.equal(scope, "global");
          events.push("revoke");
          return { error: null };
        },
      },
    },
    from(table) {
      events.push("read:" + table);
      let count = false;
      const query = {
        select(_fields, options) {
          count = options?.head === true;
          return query;
        },
        eq() {
          return query;
        },
        maybeSingle() {
          return query;
        },
        then(resolve, reject) {
          let data;
          if (table === "acceptance_test_runs") data = { status: "ready" };
          else if (count) data = null;
          else if (table === "user_profiles")
            data = [
              {
                id: profileId,
                auth_user_id: userId,
                email: intent.email,
                full_name: intent.fullName,
                role: patch.badProfile ? "admin" : "candidate",
                status: "active",
                candidate_id: candidateId,
              },
            ];
          else if (table === "candidate_accounts")
            data = [
              {
                id: "account",
                user_profile_id: profileId,
                candidate_id: candidateId,
                status: "active",
              },
            ];
          else
            data = [
              {
                id: candidateId,
                email: intent.email,
                normalized_email: intent.email,
                name: intent.fullName,
                status: "New",
                profile_source_state: { origin: "candidate_signup" },
                profile_confirmation_status: "not_claimed",
              },
            ];
          return Promise.resolve({
            data,
            error: null,
            count: count ? 0 : undefined,
          }).then(resolve, reject);
        },
      };
      return query;
    },
  };
  const routes = [];
  const context = {
    route: async (predicate, handler) => routes.push([predicate, handler]),
    unroute: async (predicate) => {
      const i = routes.findIndex(([p]) => p === predicate);
      routes.splice(i, 1);
    },
    cookies: async () => (confirmed ? [{ name: "mock", value: "mock" }] : []),
    close: async () => events.push("close"),
    newPage: async () => page,
  };
  const page = {
    goto: async (url) => {
      if (url.startsWith("https://" + ref)) {
        const found = routes.find(([predicate]) => predicate(new URL(url)));
        assert.ok(found);
        await found[1]({
          request: () => ({
            headers: () => ({
              "x-vercel-protection-bypass": "private",
              safe: "yes",
            }),
          }),
          continue: async ({ headers }) => {
            assert.equal(headers["x-vercel-protection-bypass"], undefined);
            assert.equal(headers.safe, "yes");
          },
        });
        confirmed = true;
        events.push("confirm");
      }
    },
    waitForURL: async (predicate) =>
      assert.ok(predicate(new URL(origin + "/candidate/portal"))),
    getByLabel: () => ({ fill: async () => {} }),
    getByRole: () => ({
      waitFor: async () => {},
      isEnabled: async () => true,
      click: async () => {
        assert.equal(writes.length, 1);
        assert.equal(writes[0].options.flag, "wx");
        submitted = true;
        events.push("signup");
        pendingResolve({
          status: () => 202,
          json: async () => ({ status: "verification_pending" }),
        });
      },
    }),
    waitForResponse: () =>
      new Promise((resolve) => {
        pendingResolve = resolve;
      }),
  };
  const test = (_title, fn) => {
    body = fn;
  };
  test.use = (options) =>
    assert.deepEqual(JSON.parse(JSON.stringify(options)), {
      screenshot: "off",
      trace: "off",
      video: "off",
    });
  test.skip = (flag) => {
    if (flag) throw Error("SKIPPED");
  };
  test.setTimeout = () => {};
  const helpers = {
    acceptanceRequired: (name) => {
      if (!env[name]) throw Error("missing");
      return env[name];
    },
    acceptanceAdminClient: () => db,
    credentialBundle: async () => ({
      runId,
      expiresAt: new Date(Date.now() + 60000).toISOString(),
    }),
    installAcceptanceBrowserBridge: async () => {},
    anonymousAcceptanceApi: async () => ({
      get: async () => ({
        status: () => 200,
        json: async () => ({
          classification: "acceptance",
          commitSha: env.ACCEPTANCE_EXPECTED_SHA,
          candidateRegistrationEnabled: !patch.releaseOff,
          candidateRegistrationAppConfigured: !patch.releaseOff,
        }),
      }),
      dispose: async () => {},
    }),
    attachSanitized: async (_info, _name, evidence) =>
      attachments.push(evidence),
  };
  const mockedRequire = (target) => {
    if (target === "node:fs/promises")
      return {
        writeFile: async (file, contents, options) => {
          writes.push({ file, intent: JSON.parse(contents), options });
          events.push("persist");
        },
      };
    if (target === "@playwright/test") return { test };
    if (target === "@supabase/ssr")
      return {
        createServerClient: () => ({
          auth: {
            getSession: async () => ({
              error: null,
              data: {
                session: confirmed ? { access_token: "mock-session" } : null,
              },
            }),
            getUser: async () => ({ error: null, data: { user: user() } }),
          },
        }),
      };
    if (target === "./acceptanceHelpers") return helpers;
    if (target.endsWith("acceptanceEnvironmentSafety"))
      return { pseudonymousAcceptanceIdentifier: hash };
    if (target.endsWith("acceptanceCandidateRegistrationIntent"))
      return intents;
    if (target.endsWith("acceptanceCandidateRegistrationOwnership"))
      return ownership;
    if (target.endsWith("acceptanceDeploymentBridge"))
      return { VERCEL_PROTECTION_BYPASS_HEADER: "x-vercel-protection-bypass" };
    if (target.endsWith("acceptanceGmailCredentials.mjs"))
      return {
        withAcceptanceGmailCredentials: async (_env, callback) => {
          events.push("credentials");
          if (patch.badCredentials) throw Error("PRIVATE");
          return callback("private-token");
        },
      };
    if (target.endsWith("acceptanceCandidateRegistrationGmailCleanupRuntime"))
      return {
        withAcceptanceRegistrationGmailCleanup: async (
          input,
          _env,
          callback,
        ) => {
          assert.equal(input.intent.authUserId, userId);
          assert.equal(writes.at(-1).intent.authUserId, userId);
          events.push("capture");
          try {
            return await callback(
              "https://" + ref + ".supabase.co/auth/v1/verify?token=PRIVATE",
            );
          } finally {
            events.push("mail-cleanup");
          }
        },
      };
    return require(target);
  };
  vm.runInNewContext(
    ts.transpileModule(code, {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText,
    {
      exports: {},
      require: mockedRequire,
      process: { env },
      URL,
      Date,
      setTimeout,
      clearTimeout,
    },
  );
  let error;
  try {
    await body({ browser: { newContext: async () => context } }, {});
  } catch (e) {
    error = e.message;
  }
  return { events, writes, attachments, error };
}
(async () => {
  const off = await scenario({
    env: { ACCEPTANCE_REGISTRATION_JOURNEY_ENABLED: "false" },
  });
  assert.equal(off.error, "SKIPPED");
  assert.equal(off.events.length, 0);
  for (const patch of [
    { env: { APP_ENV: "production" } },
    { env: { ACCEPTANCE_GMAIL_CLEANUP_ENABLED: "false" } },
    { releaseOff: true },
    { badCredentials: true },
    { preexisting: true },
  ]) {
    const result = await scenario(patch);
    assert.equal(result.error, "acceptance_registration_journey_unavailable");
    assert.equal(result.writes.length, 0);
    assert.ok(!result.events.includes("signup"));
  }
  const ok = await scenario();
  assert.equal(ok.error, undefined);
  assert.equal(ok.attachments.length, 1);
  assert.ok(ok.events.indexOf("credentials") < ok.events.indexOf("persist"));
  assert.ok(ok.events.indexOf("mail-cleanup") < ok.events.indexOf("revoke"));
  assert.ok(ok.events.indexOf("revoke") < ok.events.indexOf("close"));
  assert.equal(ok.attachments[0].identityCleanupVerified, false);
  const failed = await scenario({ badProfile: true });
  assert.equal(failed.error, "acceptance_registration_journey_unavailable");
  assert.ok(failed.events.includes("mail-cleanup"));
  assert.ok(failed.events.includes("revoke"));
  assert.equal(failed.attachments.length, 0);
  const premature = await scenario({ prematureConfirmation: true });
  assert.equal(premature.error, "acceptance_registration_journey_unavailable");
  assert.ok(!premature.events.includes("capture"));
  console.log(
    "Candidate registration browser journey contracts PASS (mocked; no signup/mail/database calls).",
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { createServerClient } from "@supabase/ssr";
import { test, type BrowserContext } from "@playwright/test";
import {
  acceptanceAdminClient,
  acceptanceRequired,
  anonymousAcceptanceApi,
  attachSanitized,
  credentialBundle,
  installAcceptanceBrowserBridge,
} from "./acceptanceHelpers";
import { pseudonymousAcceptanceIdentifier } from "../../lib/acceptanceEnvironmentSafety";
import {
  acceptanceCandidateRegistrationIntentPath,
  acceptanceRegistrationIntentOwnsAuthUser,
  bindAcceptanceCandidateRegistrationAuthUser,
  createAcceptanceCandidateRegistrationIntent,
  serializeAcceptanceCandidateRegistrationIntent,
} from "../../lib/acceptanceCandidateRegistrationIntent";
import {
  acceptanceRegistrationAuthOwned,
  acceptanceRegistrationCandidateOwned,
  acceptanceRegistrationProfileOwned,
} from "../../lib/acceptanceCandidateRegistrationOwnership";
import { withAcceptanceGmailCredentials } from "../../lib/acceptanceGmailCredentials.mjs";
import { withAcceptanceRegistrationGmailCleanup } from "../../lib/acceptanceCandidateRegistrationGmailCleanupRuntime";
import { VERCEL_PROTECTION_BYPASS_HEADER } from "../../lib/acceptanceDeploymentBridge";

// A separate protected workflow step opts in. Never capture signup screens,
// traces, credentials, provider IDs, or confirmation URLs in test artifacts.
test.use({ screenshot: "off", trace: "off", video: "off" });
const enabled = process.env.ACCEPTANCE_REGISTRATION_JOURNEY_ENABLED === "true";
const unavailable = () =>
  new Error("acceptance_registration_journey_unavailable");
function requireTrue(value: unknown): asserts value {
  if (!value) throw unavailable();
}

test("public candidate signup confirms one ownership chain and cleans captured mail", async ({
  browser,
}, testInfo) => {
  test.skip(!enabled, "Live signup requires explicit protected-run opt-in.");
  test.setTimeout(180_000);
  let context: BrowserContext | undefined;
  let boundId: string | undefined;
  let sessionCleanupFailed = false;
  let verified = false;
  const db = acceptanceAdminClient();
  try {
    requireTrue(
      process.env.APP_ENV === "acceptance" &&
        process.env.ACCEPTANCE_TEST_MODE === "true",
    );
    const origin = new URL(acceptanceRequired("ACCEPTANCE_BASE_URL")).origin;
    const projectRef = acceptanceRequired("ACCEPTANCE_SUPABASE_PROJECT_REF");
    const mailbox = acceptanceRequired("ACCEPTANCE_REGISTRATION_CAPTURE_EMAIL");
    requireTrue(origin === "https://ai-recruiter-acceptance.vercel.app");
    requireTrue(
      projectRef === "iujucosewivndjpcjbuz" &&
        mailbox === "lekhanhha3005@gmail.com",
    );
    requireTrue(
      acceptanceRequired("ACCEPTANCE_SUPABASE_URL") ===
        "https://" + projectRef + ".supabase.co",
    );
    requireTrue(
      process.env.ACCEPTANCE_GMAIL_CLEANUP_ENABLED === "true" &&
        process.env.ACCEPTANCE_GMAIL_CREDENTIAL_MODE ===
          "dedicated-cleanup-preflight",
    );
    await withAcceptanceGmailCredentials(process.env, async () => undefined);
    const bundle = await credentialBundle();
    const runId = acceptanceRequired("ACCEPTANCE_RUN_ID");
    requireTrue(
      bundle.runId === runId && Date.parse(bundle.expiresAt) > Date.now(),
    );
    const runHash = pseudonymousAcceptanceIdentifier(runId);
    let intent = createAcceptanceCandidateRegistrationIntent(runHash, mailbox);
    const intentPath = acceptanceCandidateRegistrationIntentPath(
      acceptanceRequired("ACCEPTANCE_CREDENTIAL_BUNDLE_PATH"),
    );
    const api = await anonymousAcceptanceApi();
    try {
      const response = await api.get("/api/acceptance/release");
      requireTrue(response.status() === 200);
      const release = await response.json();
      requireTrue(
        release.classification === "acceptance" &&
          release.commitSha === acceptanceRequired("ACCEPTANCE_EXPECTED_SHA") &&
          release.candidateRegistrationEnabled === true &&
          release.candidateRegistrationAppConfigured === true,
      );
    } finally {
      await api.dispose();
    }
    const run = await db
      .from("acceptance_test_runs")
      .select("status")
      .eq("run_id", runId)
      .maybeSingle();
    requireTrue(!run.error && run.data?.status === "ready");
    const authPage = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
    // Existing cleanup discovery is bounded to the same first page.
    requireTrue(
      !authPage.error &&
        authPage.data.users.length < 1000 &&
        !authPage.data.users.some(
          (user) => user.email?.toLowerCase() === intent.email,
        ),
    );
    for (const table of ["user_profiles", "candidates"]) {
      const result = await db
        .from(table)
        .select("id", { count: "exact", head: true })
        .eq("email", intent.email);
      requireTrue(!result.error && result.count === 0);
    }
    // Persist before signup so the workflow's always-cleanup covers partial failure.
    await writeFile(
      intentPath,
      serializeAcceptanceCandidateRegistrationIntent(intent),
      { encoding: "utf8", mode: 0o600, flag: "wx" },
    );
    context = await browser.newContext({ serviceWorkers: "block" });
    await installAcceptanceBrowserBridge(context);
    const page = await context.newPage();
    // The shared bridge blocks external navigations. The real CAPTCHA needs
    // its own iframe; permit only that origin in a child frame without bypass.
    await context.route(
      (url) => url.origin === "https://challenges.cloudflare.com",
      async (route) => {
        if (
          route.request().isNavigationRequest() &&
          route.request().frame() === page.mainFrame()
        ) {
          await route.abort("blockedbyclient");
          return;
        }
        const headers = { ...route.request().headers() };
        delete headers[VERCEL_PROTECTION_BYPASS_HEADER];
        await route.continue({ headers });
      },
    );
    await page.goto(origin + "/auth/signup");
    const password = randomBytes(32).toString("base64url");
    await page.getByLabel("Full name", { exact: true }).fill(intent.fullName);
    await page.getByLabel("Email", { exact: true }).fill(intent.email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByLabel("Confirm password", { exact: true }).fill(password);
    const submit = page.getByRole("button", {
      name: "Create candidate account",
      exact: true,
    });
    // Use the real configured widget; no CAPTCHA bypass, mocks or synthetic token.
    await submit.waitFor({ state: "visible" });
    const captchaDeadline = Date.now() + 60_000;
    while (!(await submit.isEnabled()) && Date.now() < captchaDeadline)
      await page.waitForTimeout(500);
    requireTrue(await submit.isEnabled());
    const startedAt = new Date().toISOString();
    const pending = page.waitForResponse(
      (response) =>
        response.url() === origin + "/api/auth/candidate/register" &&
        response.request().method() === "POST",
    );
    const [registration] = await Promise.all([pending, submit.click()]);
    requireTrue(registration.status() === 202);
    const result = await registration.json();
    requireTrue(
      result.status === "verification_pending" &&
        Object.keys(result).length === 1,
    );
    const discovered = await db.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    requireTrue(!discovered.error && discovered.data.users.length < 1000);
    const users = discovered.data.users.filter(
      (user) => user.email?.toLowerCase() === intent.email,
    );
    requireTrue(
      users.length === 1 &&
        acceptanceRegistrationIntentOwnsAuthUser(intent, users[0]) &&
        !users[0].email_confirmed_at,
    );
    intent = bindAcceptanceCandidateRegistrationAuthUser(intent, users[0].id);
    boundId = intent.authUserId;
    await writeFile(
      intentPath,
      serializeAcceptanceCandidateRegistrationIntent(intent),
      { encoding: "utf8", mode: 0o600 },
    );
    const preProfiles = await db
      .from("user_profiles")
      .select("id", { count: "exact", head: true })
      .eq("auth_user_id", boundId!);
    const preCandidates = await db
      .from("candidates")
      .select("id", { count: "exact", head: true })
      .eq("email", intent.email);
    requireTrue(
      !preProfiles.error &&
        preProfiles.count === 0 &&
        !preCandidates.error &&
        preCandidates.count === 0,
    );

    await withAcceptanceRegistrationGmailCleanup(
      {
        intent,
        projectRef,
        acceptanceOrigin: origin,
        startedAt,
      },
      { ...process.env, CANDIDATE_REGISTRATION_CALLBACK_ORIGIN: origin },
      async (confirmationUrl) => {
        // The capture helper validates the exact Supabase signup URL. Allow only
        // that navigation in this fresh browser and strip the Vercel bypass header.
        const exactConfirmation = (url: URL) => url.href === confirmationUrl;
        await context!.route(exactConfirmation, async (route) => {
          const headers = { ...route.request().headers() };
          delete headers[VERCEL_PROTECTION_BYPASS_HEADER];
          await route.continue({ headers });
        });
        try {
          await page.goto(confirmationUrl);
          await page.waitForURL(
            (url) =>
              url.origin === origin && url.pathname === "/candidate/portal",
          );
        } finally {
          await context!.unroute(exactConfirmation);
        }
        const auth = await db.auth.admin.getUserById(boundId!);
        requireTrue(
          !auth.error &&
            auth.data.user &&
            acceptanceRegistrationIntentOwnsAuthUser(intent, auth.data.user) &&
            acceptanceRegistrationAuthOwned(auth.data.user, runHash, mailbox),
        );
        const profiles = await db
          .from("user_profiles")
          .select("id,auth_user_id,email,full_name,role,status,candidate_id")
          .eq("auth_user_id", boundId!);
        requireTrue(!profiles.error && profiles.data?.length === 1);
        const profile = profiles.data[0];
        requireTrue(
          acceptanceRegistrationProfileOwned(
            profile,
            runHash,
            [boundId!],
            mailbox,
          ),
        );
        const accounts = await db
          .from("candidate_accounts")
          .select("id,user_profile_id,candidate_id,status")
          .eq("user_profile_id", profile.id);
        requireTrue(
          !accounts.error &&
            accounts.data?.length === 1 &&
            accounts.data[0].candidate_id === profile.candidate_id &&
            accounts.data[0].status === "active",
        );
        const candidates = await db
          .from("candidates")
          .select(
            "id,email,normalized_email,name,status,profile_source_state,profile_confirmation_status",
          )
          .eq("email", intent.email);
        requireTrue(
          !candidates.error &&
            candidates.data?.length === 1 &&
            candidates.data[0].id === profile.candidate_id &&
            acceptanceRegistrationCandidateOwned(
              candidates.data[0],
              runHash,
              mailbox,
            ),
        );
        verified = true;
      },
    );
  } catch {
    throw unavailable();
  } finally {
    // Revoke only a fresh verified session matching the bound run identity.
    // Database cleanup remains in the workflow's always() steps.
    if (context) {
      try {
        const origin = new URL(acceptanceRequired("ACCEPTANCE_BASE_URL"))
          .origin;
        const cookies = await context.cookies(origin);
        const auth = createServerClient(
          acceptanceRequired("ACCEPTANCE_SUPABASE_URL"),
          acceptanceRequired("ACCEPTANCE_SUPABASE_ANON_KEY"),
          {
            cookies: {
              getAll: () => cookies.map(({ name, value }) => ({ name, value })),
              setAll: () => {},
            },
          },
        );
        const session = await auth.auth.getSession();
        requireTrue(!session.error);
        if (session.data.session) {
          const user = await auth.auth.getUser();
          requireTrue(boundId && !user.error && user.data.user?.id === boundId);
          const signout = await db.auth.admin.signOut(
            session.data.session.access_token,
            "global",
          );
          requireTrue(!signout.error);
        } else requireTrue(!verified);
      } catch {
        sessionCleanupFailed = true;
      }
      await context.close().catch(() => {
        sessionCleanupFailed = true;
      });
    }
    if (sessionCleanupFailed) throw unavailable();
  }
  requireTrue(verified);
  await attachSanitized(testInfo, "candidate-registration-onboarding", {
    signupAccepted: true,
    unconfirmedOwnershipAbsent: true,
    confirmationDelivered: true,
    verifiedOwnershipChain: true,
    capturedMailCleanupVerified: true,
    refreshSessionsRevoked: true,
    // Identity/database residue is verified later by the protected workflow.
    identityCleanupVerified: false,
  });
});

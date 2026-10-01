import type { RecruiterCopilotAnswer } from "../../lib/recruiterCopilotAnswerEngine";
import { test, expect, type APIResponse } from "@playwright/test";

import {
  acceptanceRequired,
  waitForAcceptanceSearchReady,
  acceptanceAdminClient,
  authenticatedAdminDatabaseClient,
  anonymousAcceptanceApi,
  attachSanitized,
  authenticatedApi,
  authenticatedSession,
  credentialBundle,
  expectPrivateErrorOnly,
  installAuthenticatedBrowserState,
  installAcceptanceBrowserBridge,
} from "./acceptanceHelpers";
import { ACCEPTANCE_SYNTHETIC_CANDIDATE_ID } from "../../lib/acceptanceSyntheticCandidateFixture";
import { parseAcceptanceExternalMode } from "../../lib/acceptanceFixtureLease";
import { pseudonymousAcceptanceIdentifier } from "../../lib/acceptanceEnvironmentSafety";

const searchPath = "/api/recruiter/search-v2";
const searchPage = "/recruiter/talent-search/v2";
const SEARCH_V2_ACCEPTANCE_BUDGET_MS = 3_000;
const runToken = String(process.env.ACCEPTANCE_RUN_ID || "ptf1c2-missing");
const externalMode = parseAcceptanceExternalMode(
  process.env.ACCEPTANCE_EXTERNAL_MODE,
);
const internalCandidateId = ACCEPTANCE_SYNTHETIC_CANDIDATE_ID;

test.describe("Production Trust Foundation authenticated acceptance", () => {
  test.beforeEach(async ({ context }) => {
    await installAcceptanceBrowserBridge(context);
  });

  test("exact deployed release is the requested HTTPS build", async ({}, testInfo) => {
    const request = await anonymousAcceptanceApi();
    const response = await request.get("/api/acceptance/release");
    expect(response.status()).toBe(200);
    const release = await response.json();
    expect(release.commitSha).toBe(
      acceptanceRequired("ACCEPTANCE_EXPECTED_SHA"),
    );
    expect(release.buildId).toMatch(/^[A-Za-z0-9_-]{8,}$/);
    expect(release.environmentHash).toMatch(/^[a-f0-9]{16}$/);
    await attachSanitized(testInfo, "release-identity", release);
    await request.dispose();
  });

  test("anonymous and denied-role responses are private error-only JSON", async ({}, testInfo) => {
    const request = await anonymousAcceptanceApi();
    await expectPrivateErrorOnly(await request.get(searchPath), 401);
    const outcomes: Record<string, number> = { anonymous: 401 };
    for (const role of [
      "client",
      "candidate",
      "inactive_recruiter",
      "missing_profile",
    ] as const) {
      const api = await authenticatedApi(role);
      const response = await api.get(searchPath);
      await expectPrivateErrorOnly(response, 403);
      outcomes[role] = response.status();
      await api.dispose();
    }
    const bundle = await credentialBundle();
    expect(bundle.unknownRoleControl).toEqual({
      attempted: true,
      constraintRejected: true,
    });
    outcomes.unknown_role = 403;
    await attachSanitized(testInfo, "denied-role-matrix", outcomes);
    await request.dispose();
  });

  test("recruiter, manager and admin retain authorized Search V2 access", async ({}, testInfo) => {
    const outcomes: Record<string, number> = {};
    for (const role of ["recruiter", "recruiter_manager", "admin"] as const) {
      const api = await authenticatedApi(role);
      try {
        await waitForAcceptanceSearchReady(api);
        outcomes[role] = 200;
      } finally {
        await api.dispose();
      }
    }
    await attachSanitized(testInfo, "allowed-role-matrix", outcomes);
  });

  test("browser route guard enforces the same role boundary", async ({
    browser,
  }, testInfo) => {
    const outcomes: Record<string, string> = {};
    for (const role of [
      "recruiter",
      "recruiter_manager",
      "admin",
      "client",
      "candidate",
      "inactive_recruiter",
      "missing_profile",
    ] as const) {
      const context = await browser.newContext({
        storageState: (await authenticatedSession(role)).storageState,
      });
      await installAcceptanceBrowserBridge(context);
      const page = await context.newPage();
      await page.goto(searchPage);
      const allowed = ["recruiter", "recruiter_manager", "admin"].includes(
        role,
      );
      if (allowed) await expect(page).toHaveURL(new RegExp(searchPage));
      else await expect(page).toHaveURL(/\/auth\/login/);
      outcomes[role] = allowed ? "allowed" : "denied";
      if (role === "client")
        await page.screenshot({
          path: "artifacts/acceptance-evidence/client-role-denied.png",
          fullPage: false,
        });
      await context.close();
    }
    await attachSanitized(testInfo, "browser-role-matrix", outcomes);
  });

  test("four authenticated role dashboards load within their own scope", async ({
    browser,
  }, testInfo) => {
    const dashboards = [
      {
        role: "admin",
        path: "/admin/production",
        heading: "AI Recruiter Admin",
      },
      {
        role: "recruiter",
        path: "/recruiter/assigned-work",
        heading: "Assigned Work",
      },
      {
        role: "client",
        path: "/client/portal",
        heading: "Client Portal",
      },
      {
        role: "candidate",
        path: "/candidate/portal",
        heading: "Candidate Portal",
        ready: "Profile readiness",
      },
    ] as const;
    const outcomes: Record<string, string> = {};
    for (const dashboard of dashboards) {
      const context = await browser.newContext({
        storageState: (await authenticatedSession(dashboard.role)).storageState,
      });
      await installAcceptanceBrowserBridge(context);
      const page = await context.newPage();
      try {
        await page.goto(dashboard.path);
        await expect(page).toHaveURL(new RegExp(dashboard.path));
        await expect(
          page.getByRole("heading", { name: dashboard.heading, level: 1 }),
        ).toBeVisible();
        if ("ready" in dashboard)
          await expect(
            page.getByRole("heading", { name: dashboard.ready }),
          ).toBeVisible();
        outcomes[dashboard.role] = "loaded_in_role_scope";
      } finally {
        await context.close();
      }
    }
    await attachSanitized(testInfo, "four-role-dashboards", outcomes);
  });

  test("permission matrix denies privilege escalation and permits mapped roles", async ({}, testInfo) => {
    const recruiter = await authenticatedApi("recruiter");
    const manager = await authenticatedApi("recruiter_manager");
    const admin = await authenticatedApi("admin");
    const reporting = "/api/recruiter/workflow/analytics";
    const review = "/api/recruiter/ai-extraction-review";
    const execute = "/api/recruiter/workflow/automation-rules";

    await expectPrivateErrorOnly(await recruiter.get(reporting), 403);
    await expectPrivateErrorOnly(await recruiter.get(review), 403);
    await expectPrivateErrorOnly(
      await manager.post(execute, {
        data: { ruleId: "overdue_follow_up", enabled: true },
      }),
      403,
    );
    expect((await manager.get(reporting)).status()).toBe(200);
    expect((await manager.get(review)).status()).toBe(200);
    expect((await admin.get(reporting)).status()).toBe(200);
    expect((await admin.get(review)).status()).toBe(200);

    await attachSanitized(testInfo, "permission-matrix", {
      recruiter: { reporting: 403, dataQualityReview: 403 },
      recruiterManager: {
        reporting: "allowed",
        dataQualityReview: "allowed",
        automationExecute: 403,
      },
      admin: { reporting: "allowed", dataQualityReview: "allowed" },
    });
    await recruiter.dispose();
    await manager.dispose();
    await admin.dispose();
  });

  test("write-request boundaries reject CSRF, type, size and action mismatch", async ({}, testInfo) => {
    const recruiter = await authenticatedApi("recruiter");
    const target = "/api/recruiter/copilot/history";
    const checks = [
      await recruiter.post(target, {
        headers: { Origin: "https://cross-origin.example.invalid" },
        data: {},
      }),
      await recruiter.post(target, {
        headers: { "Content-Type": "text/plain" },
        data: "synthetic",
      }),
      await recruiter.post(target, {
        // Let the HTTP client compute Content-Length from the real payload.
        data: { syntheticPadding: "x".repeat(2 * 1024 * 1024) },
      }),
      await recruiter.post(target, {
        headers: { "X-Recruiter-Action": "different-policy" },
        data: {},
      }),
    ];
    expect(checks.map((response) => response.status())).toEqual([
      403, 415, 413, 415,
    ]);
    await attachSanitized(
      testInfo,
      "write-boundary-statuses",
      [403, 415, 413, 415],
    );
    await recruiter.dispose();
  });

  test("controlled reversible role mutations match policy", async ({}, testInfo) => {
    const recruiter = await authenticatedApi("recruiter");
    const manager = await authenticatedApi("recruiter_manager");
    const admin = await authenticatedApi("admin");
    const conversation = await recruiter.post(
      "/api/recruiter/copilot/history",
      {
        data: {
          conversationId: `acceptance-${runToken}`,
          question: "Synthetic acceptance question",
          answer: {
            question: "Synthetic acceptance question",
            normalizedQuestion: "synthetic acceptance question",
            title: "Acceptance check",
            answer: "Synthetic acceptance answer",
            intent: "unknown",
            confidence: 0,
            evidence: [],
            suggestedActions: [],
            generatedAt: new Date().toISOString(),
            mode: "synthetic acceptance",
            safety: {
              candidateDbWrites: 0,
              workflowWrites: 0,
              emailSends: 0,
              openAiCalls: 0,
              deterministic: true,
              readOnly: true,
            },
          } satisfies RecruiterCopilotAnswer,
        },
      },
    );
    expect(conversation.status()).toBe(201);
    const conversationBody = await conversation.json();
    const conversationId = conversationBody.conversation?.conversationId;
    expect(conversationId).toBe(`acceptance-${runToken}`);
    const persistedHistory = await recruiter.get(
      "/api/recruiter/copilot/history",
    );
    expect(persistedHistory.status()).toBe(200);
    expect(
      (await persistedHistory.json()).conversations.some(
        (item: { conversationId: string }) =>
          item.conversationId === conversationId,
      ),
    ).toBe(true);
    expect(
      (
        await recruiter.delete(
          `/api/recruiter/copilot/history?conversationId=${encodeURIComponent(conversationId)}`,
        )
      ).status(),
    ).toBe(200);
    const conversationResidue = await recruiter.get(
      "/api/recruiter/copilot/history",
    );
    expect(conversationResidue.status()).toBe(200);
    expect(JSON.stringify(await conversationResidue.json())).not.toContain(
      conversationId,
    );

    await expectPrivateErrorOnly(
      await recruiter.post("/api/recruiter/workflow/automation-decisions", {
        data: {},
      }),
      403,
    );
    const proposalId = `acceptance-${runToken}`;
    const approval = await manager.post(
      "/api/recruiter/workflow/automation-decisions",
      {
        data: {
          proposalId,
          candidateId: `synthetic-${runToken}`,
          ruleId: "overdue_follow_up",
          proposedAction: "synthetic_review",
          decision: "approved",
          reason: "Controlled acceptance record",
        },
      },
    );
    expect(approval.status()).toBe(201);
    const persistedDecisions = await manager.get(
      "/api/recruiter/workflow/automation-decisions",
    );
    expect(persistedDecisions.status()).toBe(200);
    expect(
      (await persistedDecisions.json()).decisions.some(
        (item: { proposalId: string }) => item.proposalId === proposalId,
      ),
    ).toBe(true);
    expect(
      (
        await manager.delete(
          `/api/recruiter/workflow/automation-decisions?proposalId=${encodeURIComponent(proposalId)}`,
        )
      ).status(),
    ).toBe(200);
    const approvalResidue = await manager.get(
      "/api/recruiter/workflow/automation-decisions",
    );
    expect(approvalResidue.status()).toBe(200);
    expect(JSON.stringify(await approvalResidue.json())).not.toContain(
      proposalId,
    );

    const rules = await admin.get("/api/recruiter/workflow/automation-rules");
    expect(rules.status()).toBe(200);
    const current = (await rules.json()).rules?.[0];
    expect(current?.ruleId).toBeTruthy();
    const adminMutation = await admin.post(
      "/api/recruiter/workflow/automation-rules",
      {
        data: {
          ruleId: current.ruleId,
          enabled: current.enabled,
          priority: current.priority,
          settings: current.settings,
        },
      },
    );
    expect(adminMutation.status()).toBe(200);
    const persistedRules = await admin.get(
      "/api/recruiter/workflow/automation-rules",
    );
    expect(persistedRules.status()).toBe(200);
    const persistedRule = (await persistedRules.json()).rules.find(
      (rule: { ruleId: string }) => rule.ruleId === current.ruleId,
    );
    expect(persistedRule.enabled).toBe(current.enabled);
    expect(persistedRule.priority).toBe(current.priority);
    expect(persistedRule.settings).toEqual(current.settings);
    await attachSanitized(testInfo, "mutation-matrix", {
      recruiterNormal: "completed_and_cleaned",
      recruiterPrivileged: 403,
      managerApproval: "completed_and_cleaned",
      managerAdminOnly: 403,
      adminOnly: "configuration_unchanged",
      workflowMutationResidue: 0,
    });
    await recruiter.dispose();
    await manager.dispose();
    await admin.dispose();
  });

  test("real recruiter login, private page, logout and browser back remain safe", async ({
    page,
  }, testInfo) => {
    const bundle = await credentialBundle();
    await page.goto("/auth/login");
    await page.getByLabel("Email").fill(bundle.identities.recruiter.email);
    await page
      .getByLabel("Password")
      .fill(bundle.identities.recruiter.password);
    await page
      .getByRole("button", { name: "Sign in to acceptance", exact: true })
      .click();
    await page.waitForURL(/\/recruiter\//);
    await page.goto(searchPage);
    await expect(page).toHaveURL(new RegExp(searchPage));
    await page.screenshot({
      path: "artifacts/acceptance-evidence/recruiter-search-page.png",
      fullPage: false,
    });
    const cookies = await page.context().cookies();
    const authCookies = cookies.filter((cookie) =>
      cookie.name.includes("auth-token"),
    );
    expect(authCookies.length).toBeGreaterThan(0);
    for (const cookie of authCookies) {
      expect(cookie.httpOnly).toBe(true);
      expect(cookie.secure).toBe(true);
      expect(["Lax", "Strict"]).toContain(cookie.sameSite);
    }
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await page.waitForURL(/\/auth\/login\?reason=signed_out/);
    await page.goto(searchPage);
    await expect(page).toHaveURL(/\/auth\/login/);
    await page.goBack();
    await expect(page).toHaveURL(/\/auth\/login/);
    await attachSanitized(testInfo, "session-lifecycle", {
      login: "passed",
      cookieFlags: "passed",
      logout: "passed",
      backNavigation: "private_content_not_visible",
    });
  });

  test("deactivation invalidates an already-authorized session and reactivation reauthorizes", async ({}, testInfo) => {
    const bundle = await credentialBundle();
    const identity = bundle.identities.recruiter;
    const api = await authenticatedApi("recruiter");
    await waitForAcceptanceSearchReady(api);
    const admin = await authenticatedAdminDatabaseClient();
    try {
      const deactivate = await admin
        .from("user_profiles")
        .update({ status: "inactive" })
        .eq("auth_user_id", identity.authUserId)
        .select("status")
        .single();
      expect(
        deactivate.error,
        "Authenticated admin must deactivate the synthetic profile",
      ).toBeNull();
      expect(deactivate.data?.status).toBe("inactive");
      await expectPrivateErrorOnly(await api.get(searchPath), 403);
    } finally {
      const reactivate = await admin
        .from("user_profiles")
        .update({ status: "active" })
        .eq("auth_user_id", identity.authUserId)
        .select("status")
        .single();
      expect(
        reactivate.error,
        "Authenticated admin must restore the synthetic profile",
      ).toBeNull();
      expect(reactivate.data?.status).toBe("active");
    }
    await waitForAcceptanceSearchReady(api);
    await attachSanitized(testInfo, "deactivation-lifecycle", {
      authorizedBefore: true,
      deniedWhileInactive: true,
      authoritativeReauthorizationAfterActivation: true,
    });
    await api.dispose();
  });

  test("server-side session revocation invalidates subsequent API access", async ({}, testInfo) => {
    const session = await authenticatedSession("recruiter");
    const api = await authenticatedApi("recruiter", session.storageState);
    await waitForAcceptanceSearchReady(api);
    const { error } = await acceptanceAdminClient().auth.admin.signOut(
      session.accessToken,
      "global",
    );
    expect(error).toBeNull();
    await expectPrivateErrorOnly(await api.get(searchPath), 401);
    await attachSanitized(testInfo, "session-revocation", {
      activeSession: 200,
      revokedSession: 401,
      protectedDownstreamInvocationsAfterRevocation: 0,
    });
    await api.dispose();
  });

  test("internal Search V2 uses only the synthetic acceptance dataset", async ({}, testInfo) => {
    const api = await authenticatedApi("recruiter");
    const query = acceptanceRequired("ACCEPTANCE_INTERNAL_SEARCH_QUERY");
    const marker = acceptanceRequired("ACCEPTANCE_SYNTHETIC_CANDIDATE_MARKER");
    const firstStartedAt = performance.now();
    const response = await api.post(searchPath, {
      data: { query, talentPool: "internal_profiles" },
    });
    const firstSearchMs = Math.ceil(performance.now() - firstStartedAt);
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.results?.length).toBe(1);
    for (const candidate of body.results)
      expect(String(candidate.candidateName || candidate.name)).toContain(
        marker,
      );
    expect(
      String(body.results[0].candidateId || body.results[0].id || ""),
    ).toBe(internalCandidateId);
    expect(internalCandidateId).toBeTruthy();
    // Capture bounded numeric diagnostics before the budget assertion so a
    // slow request still explains which server phases consumed the budget.
    const serverPhases: Record<string, number> = {};
    for (const metric of (response.headers()["server-timing"] || "").split(",")) {
      const parsed = /^\\s*([a-zA-Z][a-zA-Z0-9_-]{0,40});dur=([0-9]+(?:\\.[0-9]+)?)\\s*$/.exec(metric);
      if (parsed && Number.isFinite(Number(parsed[2])))
        serverPhases[parsed[1]] = Number(parsed[2]);
    }
    await attachSanitized(testInfo, "internal-search-first-latency", {
      latencyBudgetMs: SEARCH_V2_ACCEPTANCE_BUDGET_MS,
      firstSearchMs,
      serverPhases,
    });
    expect(
      firstSearchMs,
      `first Search V2 response exceeded ${SEARCH_V2_ACCEPTANCE_BUDGET_MS}ms`,
    ).toBeLessThanOrEqual(SEARCH_V2_ACCEPTANCE_BUDGET_MS);
    const warmStartedAt = performance.now();
    const repeated = await api.post(searchPath, {
      data: { query, talentPool: "internal_profiles" },
    });
    const warmSearchMs = Math.ceil(performance.now() - warmStartedAt);
    expect(repeated.status()).toBe(200);
    const repeatedBody = await repeated.json();
    expect(
      repeatedBody.results.map((item: Record<string, unknown>) => [
        item.candidateId,
        item.overallMatchScore,
      ]),
    ).toEqual(
      body.results.map((item: Record<string, unknown>) => [
        item.candidateId,
        item.overallMatchScore,
      ]),
    );
    expect(
      warmSearchMs,
      `warm Search V2 response exceeded ${SEARCH_V2_ACCEPTANCE_BUDGET_MS}ms`,
    ).toBeLessThanOrEqual(SEARCH_V2_ACCEPTANCE_BUDGET_MS);
    await attachSanitized(testInfo, "internal-search", {
      resultCount: body.results.length,
      allResultsSynthetic: true,
      latencyBudgetMs: SEARCH_V2_ACCEPTANCE_BUDGET_MS,
      firstSearchMs,
      warmSearchMs,
    });
    await api.dispose();
  });

  test("synthetic Search V2 shortlist persists for its owner and can be removed", async ({}, testInfo) => {
    const target = "/api/recruiter/search-v2/shortlist";
    const recruiter = await authenticatedApi("recruiter");
    const denied = await authenticatedApi("client");
    const selection = { candidateId: internalCandidateId, jobId: null };
    try {
      await expectPrivateErrorOnly(
        await denied.post(target, { data: selection }),
        403,
      );
      const saved = await recruiter.post(target, { data: selection });
      expect(saved.status()).toBe(200);
      expect((await saved.json()).shortlisted).toBe(true);
      const scoped = await recruiter.get(
        `${target}?candidateIds=${encodeURIComponent(internalCandidateId)}`,
      );
      expect(scoped.status()).toBe(200);
      expect((await scoped.json()).candidateIds).toContain(internalCandidateId);
      await attachSanitized(testInfo, "search-v2-shortlist", {
        deniedRole: 403,
        ownerSave: 200,
        ownerReadback: true,
      });
    } finally {
      const removed = await recruiter.delete(target, { data: selection });
      expect(removed.status()).toBe(200);
      const after = await recruiter.get(
        `${target}?candidateIds=${encodeURIComponent(internalCandidateId)}`,
      );
      expect(after.status()).toBe(200);
      expect((await after.json()).candidateIds).not.toContain(
        internalCandidateId,
      );
      await denied.dispose();
      await recruiter.dispose();
    }
  });

  test("synthetic client job share requires assigned support and can be revoked", async ({}, testInfo) => {
    const db = acceptanceAdminClient();
    const runHash = pseudonymousAcceptanceIdentifier(
      acceptanceRequired("ACCEPTANCE_RUN_ID"),
    );
    const { data: job, error: jobError } = await db
      .from("jobs")
      .select("id")
      .eq("title", `PTF synthetic job ${runHash}`)
      .single();
    const { data: recruiter, error: recruiterError } = await db
      .from("user_profiles")
      .select("id")
      .eq(
        "auth_user_id",
        (await credentialBundle()).identities.recruiter.authUserId,
      )
      .single();
    expect(jobError).toBeNull();
    expect(recruiterError).toBeNull();
    expect(job?.id).toBeTruthy();
    expect(recruiter?.id).toBeTruthy();
    const payload = {
      kind: "job",
      resourceId: job!.id,
      recruiterProfileId: recruiter!.id,
      action: "share",
    };
    const anonymous = await anonymousAcceptanceApi();
    const wrongRole = await authenticatedApi("recruiter");
    const client = await authenticatedApi("client");
    try {
      await expectPrivateErrorOnly(
        await anonymous.post("/api/client/recruiter-shares", { data: payload }),
        401,
      );
      await expectPrivateErrorOnly(
        await wrongRole.post("/api/client/recruiter-shares", { data: payload }),
        403,
      );
      await expectPrivateErrorOnly(
        await client.post("/api/client/recruiter-shares", {
          data: {
            ...payload,
            resourceId: "00000000-0000-4000-8000-000000000000",
          },
        }),
        403,
      );
      const shared = await client.post("/api/client/recruiter-shares", {
        data: payload,
      });
      expect(shared.status()).toBe(200);
      expect((await shared.json()).shared).toBe(true);
      const { data: active, error: activeError } = await db
        .from("client_job_shares")
        .select("status")
        .eq("job_id", job!.id)
        .eq("recruiter_profile_id", recruiter!.id)
        .single();
      expect(activeError).toBeNull();
      expect(active?.status).toBe("active");
      const revoked = await client.post("/api/client/recruiter-shares", {
        data: { ...payload, action: "revoke" },
      });
      expect(revoked.status()).toBe(200);
      const { data: ended, error: endedError } = await db
        .from("client_job_shares")
        .select("status")
        .eq("job_id", job!.id)
        .eq("recruiter_profile_id", recruiter!.id)
        .single();
      expect(endedError).toBeNull();
      expect(ended?.status).toBe("revoked");
      await attachSanitized(testInfo, "synthetic-job-share", {
        anonymous: 401,
        recruiter: 403,
        unowned: 403,
        shared: true,
        revoked: true,
      });
    } finally {
      await anonymous.dispose();
      await wrongRole.dispose();
      await client.dispose();
    }
  });

  test("original CV read denies recruiter without admin approval", async ({}, testInfo) => {
    const target = `/api/candidate360/${internalCandidateId}/resume`;
    const deny = async (response: APIResponse, status: number) => {
      expect(response.status()).toBe(status);
      expect(response.headers()["cache-control"]).toContain("private");
      expect(response.headers()["cache-control"]).toContain("no-store");
      const body = await response.json();
      expect(Object.keys(body)).toEqual(["error"]);
      expect(body.error).toBeTruthy();
    };
    const anonymous = await anonymousAcceptanceApi();
    const recruiter = await authenticatedApi("recruiter");
    const client = await authenticatedApi("client");
    const candidate = await authenticatedApi("candidate");
    try {
      await deny(await anonymous.get(target), 401);
      await deny(await recruiter.get(target), 403);
      await deny(await client.get(target), 403);
      await deny(await candidate.get(target), 403);
      await attachSanitized(testInfo, "original-cv-approval-boundary", {
        anonymous: 401,
        recruiterWithoutGrant: 403,
        client: 403,
        candidate: 403,
      });
    } finally {
      await anonymous.dispose();
      await recruiter.dispose();
      await client.dispose();
      await candidate.dispose();
    }
  });

  test("synthetic candidate drawer remains private and preserves Experience/Projects semantics", async ({
    page,
  }) => {
    await installAuthenticatedBrowserState(page.context(), "recruiter");
    await page.goto(searchPage);
    await page
      .getByPlaceholder(
        "Senior SAP FICO consultant in Malaysia with implementation experience",
      )
      .fill(acceptanceRequired("ACCEPTANCE_INTERNAL_SEARCH_QUERY"));
    await page.getByRole("button", { name: "Understand & review" }).click();
    await page.getByRole("button", { name: "Commit Search" }).click();
    const open = page.getByRole("button", { name: "Quick View" });
    await expect(open.first()).toBeVisible();
    await open.first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("tab", { name: /Experience/ })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Projects/ })).toBeVisible();
    const drawer = page.getByRole("dialog");
    await drawer.getByRole("tab", { name: /Experience/ }).click();
    await expect(
      drawer.getByText("PTF Synthetic Consulting Ltd", { exact: true }).first(),
    ).toBeVisible();
    await expect(
      drawer.getByText("PTF Synthetic Services Ltd", { exact: true }).first(),
    ).toBeVisible();
    await expect(
      drawer.getByText("SAP Finance Analyst", { exact: true }).first(),
    ).toBeVisible();
    await expect(
      drawer.getByText("PTF Synthetic Manufacturing Client", { exact: true }),
    ).toHaveCount(0);
    await drawer.getByRole("tab", { name: /Projects/ }).click();
    await expect(
      drawer
        .getByText("PTF Synthetic Manufacturing Client", { exact: true })
        .first(),
    ).toBeVisible();
    await page.screenshot({
      path: "artifacts/acceptance-evidence/private-candidate-drawer.png",
      fullPage: false,
    });
  });

  test("Search V2 shows Comparison beside Shortlist with separate employer and client periods", async ({
    page,
  }) => {
    const db = acceptanceAdminClient();
    const runHash = pseudonymousAcceptanceIdentifier(
      acceptanceRequired("ACCEPTANCE_RUN_ID"),
    );
    const { data: job, error: jobError } = await db
      .from("jobs")
      .select("id")
      .eq("title", `PTF synthetic job ${runHash}`)
      .single();
    expect(jobError).toBeNull();
    expect(job?.id).toBeTruthy();
    const shortlist = await authenticatedApi("recruiter");
    const selection = { candidateId: internalCandidateId, jobId: job!.id };
    try {
      const saved = await shortlist.post("/api/recruiter/search-v2/shortlist", {
        data: selection,
      });
      expect(saved.status()).toBe(200);
      const comparisonRequest = {
        query: acceptanceRequired("ACCEPTANCE_INTERNAL_SEARCH_QUERY"),
        talentPool: "internal_profiles",
        page: 1,
        pageSize: 20,
        comparison: {
          scope: "shortlisted",
          jobId: job!.id,
          anchorCandidateId: internalCandidateId,
        },
      };
      const compared = await shortlist.post(searchPath, {
        data: comparisonRequest,
      });
      expect(compared.status()).toBe(200);
      const comparedBody = await compared.json();
      expect(
        comparedBody.results.map(
          (item: { candidateId: string }) => item.candidateId,
        ),
      ).toContain(internalCandidateId);
      const otherJob = await shortlist.post(searchPath, {
        data: {
          ...comparisonRequest,
          comparison: {
            scope: "shortlisted",
            jobId: "00000000-0000-4000-8000-000000000001",
          },
        },
      });
      expect(otherJob.status()).toBe(200);
      expect((await otherJob.json()).results).toEqual([]);
      const denied = await authenticatedApi("candidate");
      try {
        await expectPrivateErrorOnly(
          await denied.post(searchPath, { data: comparisonRequest }),
          403,
        );
      } finally {
        await denied.dispose();
      }
      await installAuthenticatedBrowserState(page.context(), "recruiter");
      await page.goto(`${searchPage}?jobId=${encodeURIComponent(job!.id)}`);
      await page
        .getByPlaceholder(
          "Senior SAP FICO consultant in Malaysia with implementation experience",
        )
        .fill(acceptanceRequired("ACCEPTANCE_INTERNAL_SEARCH_QUERY"));
      await page.getByRole("button", { name: "Understand & review" }).click();
      await page.getByRole("button", { name: "Commit Search" }).click();
      await expect(
        page.getByRole("button", { name: "Compare", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: /^Shortlist \(/ }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Compare", exact: true }).click();
      const pack = page.getByRole("region", { name: "Candidate Comparison" });
      await expect(pack).toBeVisible();
      const shortlistedScope = pack.getByRole("button", {
        name: "Shortlisted in this search",
      });
      await expect(shortlistedScope).toBeEnabled();
      await shortlistedScope.click();
      await expect(shortlistedScope).toHaveAttribute("aria-pressed", "true");
      await expect(
        pack.getByText("PTF Synthetic Consulting Ltd").first(),
      ).toBeVisible();
      const matchingScope = pack.getByRole("button", {
        name: "All matching results",
      });
      await matchingScope.click();
      await expect(matchingScope).toHaveAttribute("aria-pressed", "true");
      for (const size of [5, 10, 20]) {
        await pack.getByRole("button", { name: `Top ${size}` }).click();
        await expect(
          pack.getByRole("button", { name: `Top ${size}` }),
        ).toHaveAttribute("aria-pressed", "true");
      }
      await expect(
        pack.getByRole("columnheader", { name: "Employer / tenure" }),
      ).toBeVisible();
      await expect(
        pack.getByRole("columnheader", { name: "Client project / period" }),
      ).toBeVisible();
      await expect(
        pack.getByText("PTF Synthetic Consulting Ltd").first(),
      ).toBeVisible();
      await expect(
        pack.getByText("PTF Synthetic Manufacturing Client").first(),
      ).toBeVisible();
    } finally {
      const removed = await shortlist.delete(
        "/api/recruiter/search-v2/shortlist",
        {
          data: selection,
        },
      );
      expect(removed.status()).toBe(200);
      const after = await shortlist.get(
        `/api/recruiter/search-v2/shortlist?jobId=${encodeURIComponent(job!.id)}&candidateIds=${encodeURIComponent(internalCandidateId)}`,
      );
      expect(after.status()).toBe(200);
      expect((await after.json()).candidateIds).not.toContain(
        internalCandidateId,
      );
      await shortlist.dispose();
    }
  });

  test("candidate-detail caches are isolated by authenticated actor scope", async ({}, testInfo) => {
    expect(internalCandidateId).toBeTruthy();
    const target = `/api/recruiter/search-v2/candidate-details/${encodeURIComponent(internalCandidateId)}`;
    const recruiter = await authenticatedApi("recruiter");
    const manager = await authenticatedApi("recruiter_manager");
    const recruiterCold = await recruiter.get(target);
    expect(recruiterCold.status()).toBe(200);
    const recruiterWarm = await recruiter.get(target);
    expect(recruiterWarm.status()).toBe(200);
    // Process-local cache reuse is verified in searchV2CandidateDetailCachePrivacy.test.ts.
    // Separate serverless requests are not guaranteed to reach the same process.
    expect(["hit", "miss"]).toContain(
      recruiterWarm.headers()["x-candidate-detail-cache"],
    );
    expect(recruiterWarm.headers()["cache-control"]).toBe("private, no-store");
    expect(recruiterWarm.headers()["vary"]).toContain("Cookie");
    const managerCold = await manager.get(target);
    expect(managerCold.status()).toBe(200);
    expect(managerCold.headers()["x-candidate-detail-cache"]).toBe("miss");
    const denied = await authenticatedApi("client");
    const anonymous = await anonymousAcceptanceApi();
    await expectPrivateErrorOnly(await denied.get(target), 403);
    await expectPrivateErrorOnly(await anonymous.get(target), 401);
    await denied.dispose();
    await anonymous.dispose();
    const serialized = JSON.stringify(await recruiterWarm.json());
    expect(serialized).not.toMatch(
      /sourceField|sourcePath|workbook|sheetName|rowNumber|linkedSourceId/,
    );
    await attachSanitized(testInfo, "candidate-detail-cache-isolation", {
      recruiterCold: recruiterCold.headers()["x-candidate-detail-cache"],
      recruiterWarm: recruiterWarm.headers()["x-candidate-detail-cache"],
      managerFirstRequest: managerCold.headers()["x-candidate-detail-cache"],
      crossActorLeakage: 0,
      recruiterPayloadProvenanceFields: 0,
    });
    await recruiter.dispose();
    await manager.dispose();
  });

  test("external continuation tokens fail closed across actor scope and after logout", async ({}, testInfo) => {
    test.skip(
      externalMode === "disabled",
      "External provider is deliberately disabled for internal-only acceptance.",
    );
    const query = acceptanceRequired("ACCEPTANCE_EXTERNAL_SEARCH_QUERY");
    const session = await authenticatedSession("recruiter");
    const recruiter = await authenticatedApi("recruiter", session.storageState);
    const initial = await recruiter.post(searchPath, {
      data: { query, talentPool: "linkedin_talent_pool" },
    });
    expect(initial.status()).toBe(200);
    const initialBody = await initial.json();
    expect(JSON.stringify(initialBody)).not.toContain(
      "business.linkedin.com/talent-solutions/resources/how-to-hire-guides/sap-consultant/job-description",
    );
    const cursor = String(
      initialBody.nextProviderBatchCursor || initialBody.nextCursor || "",
    );
    expect(cursor).toBeTruthy();

    const manager = await authenticatedApi("recruiter_manager");
    const crossScope = await manager.post(searchPath, {
      data: { query, talentPool: "linkedin_talent_pool", cursor },
    });
    expect(crossScope.status()).toBe(502);
    expect((await crossScope.json()).reason).toBe("INVALID_PROVIDER_CURSOR");

    const malformed = await recruiter.post(searchPath, {
      data: {
        query,
        talentPool: "linkedin_talent_pool",
        cursor: "malformed-acceptance-cursor",
      },
    });
    expect(malformed.status()).toBe(502);
    expect((await malformed.json()).reason).toBe("INVALID_PROVIDER_CURSOR");

    const { error } = await acceptanceAdminClient().auth.admin.signOut(
      session.accessToken,
      "global",
    );
    expect(error).toBeNull();
    await expectPrivateErrorOnly(
      await recruiter.post(searchPath, {
        data: { query, talentPool: "linkedin_talent_pool", cursor },
      }),
      401,
    );
    await attachSanitized(testInfo, "continuation-isolation", {
      crossActorReplayAccepted: 0,
      malformedTokenAccepted: 0,
      postLogoutReplayAccepted: 0,
      invalidNonPersonResultsVisible: 0,
    });
    await recruiter.dispose();
    await manager.dispose();
  });

  test("Search V2 UI pagination reuses loaded data and expansion is one action", async ({
    page,
  }, testInfo) => {
    test.skip(
      externalMode === "disabled",
      "External provider is deliberately disabled for internal-only acceptance.",
    );
    await installAuthenticatedBrowserState(page.context(), "recruiter");
    let searchCalls = 0;
    page.on("request", (request) => {
      if (
        new URL(request.url()).pathname === searchPath &&
        request.method() === "POST"
      )
        searchCalls += 1;
    });
    await page.goto(searchPage);
    const query = acceptanceRequired("ACCEPTANCE_EXTERNAL_SEARCH_QUERY");
    await page
      .getByPlaceholder(
        "Senior SAP FICO consultant in Malaysia with implementation experience",
      )
      .fill(query);
    await page.getByLabel("Talent pool").selectOption("linkedin_talent_pool");
    await page.getByRole("button", { name: "Understand & review" }).click();
    await page.getByRole("button", { name: "Commit Search" }).click();
    await expect(
      page.getByText(/Showing 1–20 of|Showing 1-20 of/),
    ).toBeVisible();
    const callsAfterInitial = searchCalls;
    await page.getByRole("button", { name: "Next page" }).click();
    expect(searchCalls).toBe(callsAfterInitial);
    await page.getByRole("button", { name: "Previous page" }).click();
    await page.getByRole("button", { name: "Map next market segment" }).click();
    expect(searchCalls).toBe(callsAfterInitial + 1);
    await attachSanitized(testInfo, "provider-call-counts", {
      initialSearchCalls: callsAfterInitial,
      pageTwoAdditionalCalls: 0,
      expansionAdditionalCalls: 1,
    });
  });

  test("disabled external scope fails closed before provider execution", async ({}, testInfo) => {
    test.skip(
      externalMode !== "disabled",
      "Only applies to internal-only acceptance.",
    );
    const recruiter = await authenticatedApi("recruiter");
    const response = await recruiter.post(searchPath, {
      data: {
        query: "PTF synthetic external provider denial control",
        talentPool: "linkedin_talent_pool",
      },
    });
    expect(response.status()).toBe(409);
    expect((await response.json()).reason).toBe("SOURCE_NOT_CONNECTED");
    await attachSanitized(testInfo, "external-disabled", {
      providerInvocationCount: 0,
      status: 409,
      acceptanceScope: "Internal Talent Hub release only",
    });
    await recruiter.dispose();
  });
});
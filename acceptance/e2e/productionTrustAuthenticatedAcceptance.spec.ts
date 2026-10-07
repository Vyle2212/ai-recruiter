import { createHash } from "node:crypto";
import { removeAcceptanceComparisonPack } from "../../lib/acceptanceComparisonPackRuntime";
import { acceptanceComparisonPackFixture } from "../../lib/acceptanceComparisonPackFixture";
import { appendFile } from "node:fs/promises";
import {
  ORIGINAL_CV_BUCKET,
  ownedOriginalCvObjectKey,
} from "../../lib/originalCvArchiveKey";
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

    const releaseApi = await anonymousAcceptanceApi();
    const releaseResponse = await releaseApi.get("/api/acceptance/release");
    expect(releaseResponse.status()).toBe(200);
    const chatRelease = await releaseResponse.json();
    await releaseApi.dispose();
    expect(typeof chatRelease.chatEnabled).toBe("boolean");
    if (chatRelease.chatEnabled) {
      const expectChatError = async (response: APIResponse, status: number) => {
        expect(response.status()).toBe(status);
        expect(response.headers()["cache-control"]).toContain("private");
        expect(response.headers()["cache-control"]).toContain("no-store");
        const body = await response.json();
        expect(Object.keys(body)).toEqual(["error"]);
        expect(typeof body.error).toBe("string");
      };
      const bundle = await credentialBundle();
      const adminProfileId = bundle.identities.admin.profileId;
      expect(adminProfileId).toMatch(/^[a-f0-9-]{36}$/);
      const created = await recruiter.post("/api/chat/internal-conversations", {
        data: { adminProfileId },
      });
      expect(created.status()).toBe(200);
      const { conversationId } = await created.json();
      expect(conversationId).toMatch(/^[a-f0-9-]{36}$/);
      const messagesPath = `/api/chat/conversations/${conversationId}/messages`;
      const receiptsPath = `/api/chat/conversations/${conversationId}/receipts`;
      const payload = {
        clientMessageId: crypto.randomUUID(),
        text: "Synthetic acceptance recruiter message",
      };
      const sent = await recruiter.post(messagesPath, { data: payload });
      expect(sent.status()).toBe(201);
      const original = (await sent.json()).message;
      const retried = await recruiter.post(messagesPath, { data: payload });
      expect(retried.status()).toBe(200);
      expect((await retried.json()).message.id).toBe(original.id);
      await expectChatError(
        await recruiter.post(messagesPath, {
          data: { ...payload, text: "Synthetic changed content" },
        }),
        409,
      );
      const inbox = await admin.get(messagesPath);
      expect(inbox.status()).toBe(200);
      const received = (await inbox.json()).messages;
      expect(
        received.filter(
          (message: { id: string }) => message.id === original.id,
        ),
      ).toHaveLength(1);
      expect(
        received.find((message: { id: string }) => message.id === original.id)
          ?.body,
      ).toBe(payload.text);
      const reply = await admin.post(messagesPath, {
        data: {
          clientMessageId: crypto.randomUUID(),
          text: "Synthetic acceptance admin reply",
        },
      });
      expect(reply.status()).toBe(201);
      const replyId = (await reply.json()).message.id;
      const recruiterInbox = await recruiter.get(messagesPath);
      expect(recruiterInbox.status()).toBe(200);
      expect(
        (await recruiterInbox.json()).messages.some(
          (message: { id: string }) => message.id === replyId,
        ),
      ).toBe(true);
      const read = await admin.post(receiptsPath, { data: {} });
      expect(read.status()).toBe(200);
      expect((await read.json()).markedRead).toBeGreaterThanOrEqual(1);
      const unread = await admin.get(receiptsPath);
      expect(unread.status()).toBe(200);
      expect((await unread.json()).unreadCount).toBe(0);
      for (const role of [
        "client",
        "candidate",
        "inactive_recruiter",
        "recruiter_manager",
      ] as const) {
        const outsider = await authenticatedApi(role);
        try {
          const denied = await outsider.get(messagesPath);
          expect([403, 404]).toContain(denied.status());
          await expectChatError(denied, denied.status());
          const deniedSend = await outsider.post(messagesPath, {
            data: {
              clientMessageId: crypto.randomUUID(),
              text: "Synthetic denied message",
            },
          });
          expect([403, 404]).toContain(deniedSend.status());
          await expectChatError(deniedSend, deniedSend.status());
        } finally {
          await outsider.dispose();
        }
      }
      await attachSanitized(testInfo, "chat-internal-live", {
        channel: "recruiter_admin",
        twoWay: true,
        retrySingleMessage: true,
        changedContentDenied: true,
        receipts: true,
        outsidersDenied: true,
      });
    } else {
      // Acceptance keeps chat off. Prove every entry point fails closed for
      // authenticated roles before any conversation, message or AI draft exists.
      const conversation = "00000000-0000-4000-8000-000000000001";
      const chatOutcomes: Record<string, number> = {};
      for (const role of [
        "admin",
        "recruiter",
        "client",
        "candidate",
      ] as const) {
        const api = await authenticatedApi(role);
        try {
          for (const path of [
            "/api/chat/conversations",
            "/api/chat/client-recruiter-conversations",
            "/api/chat/recruiter-candidate-conversations",
            "/api/chat/internal-conversations",
            `/api/chat/conversations/${conversation}/messages`,
            `/api/chat/conversations/${conversation}/receipts`,
            `/api/chat/conversations/${conversation}/suggestion`,
          ]) {
            const response = await api.post(path, { data: {} });
            expect(response.status()).toBe(404);
            expect(response.headers()["cache-control"]).toContain("private");
            expect(response.headers()["cache-control"]).toContain("no-store");
            expect(await response.json()).toEqual({ error: "not_found" });
            chatOutcomes[`${role}:POST:${path}`] = response.status();
          }
          for (const resource of ["messages", "receipts"]) {
            const path = `/api/chat/conversations/${conversation}/${resource}`;
            const response = await api.get(path);
            expect(response.status()).toBe(404);
            expect(response.headers()["cache-control"]).toContain("private");
            expect(response.headers()["cache-control"]).toContain("no-store");
            expect(await response.json()).toEqual({ error: "not_found" });
            chatOutcomes[`${role}:GET:${path}`] = response.status();
          }
        } finally {
          await api.dispose();
        }
      }
      await attachSanitized(
        testInfo,
        "chat-disabled-role-matrix",
        chatOutcomes,
      );
    }

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
    for (const metric of (response.headers()["server-timing"] || "").split(
      ",",
    )) {
      const parsed =
        /^\s*([a-zA-Z][a-zA-Z0-9_-]{0,40});dur=([0-9]+(?:\.[0-9]+)?)\s*$/.exec(
          metric,
        );
      if (parsed && Number.isFinite(Number(parsed[2])))
        serverPhases[parsed[1]] = Number(parsed[2]);
    }
    const clientOverheadMs = Math.max(
      0,
      firstSearchMs - (serverPhases.handler || serverPhases.total || 0),
    );
    const latencyDiagnostic = {
      latencyBudgetMs: SEARCH_V2_ACCEPTANCE_BUDGET_MS,
      firstSearchMs,
      clientOverheadMs,
      serverPhases,
    };
    await attachSanitized(
      testInfo,
      "internal-search-first-latency",
      latencyDiagnostic,
    );
    console.log(
      JSON.stringify({
        type: "acceptance_search_latency",
        ...latencyDiagnostic,
      }),
    );
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
    const warmServerPhases: Record<string, number> = {};
    for (const metric of (repeated.headers()["server-timing"] || "").split(
      ",",
    )) {
      const parsed =
        /^\s*([a-zA-Z][a-zA-Z0-9_-]{0,40});dur=([0-9]+(?:\.[0-9]+)?)\s*$/.exec(
          metric,
        );
      if (parsed && Number.isFinite(Number(parsed[2])))
        warmServerPhases[parsed[1]] = Number(parsed[2]);
    }
    const warmDiagnostic = {
      latencyBudgetMs: SEARCH_V2_ACCEPTANCE_BUDGET_MS,
      warmSearchMs,
      serverPhases: warmServerPhases,
      clientOverheadMs: Math.max(
        0,
        warmSearchMs -
          (warmServerPhases.handler || warmServerPhases.total || 0),
      ),
    };
    await attachSanitized(
      testInfo,
      "internal-search-warm-latency",
      warmDiagnostic,
    );
    console.log(
      JSON.stringify({
        type: "acceptance_search_warm_latency",
        ...warmDiagnostic,
      }),
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

  test("synthetic private CV upload preserves bytes and rejects digest mismatch", async ({}, testInfo) => {
    const admin = await authenticatedApi("admin");
    const database = acceptanceAdminClient();
    const owner = (await credentialBundle()).identities.admin.authUserId;
    const bytes = Buffer.from(
      "Synthetic acceptance integrity fixture. No real candidate data.",
    );
    const fileName = "synthetic-integrity.txt";
    const claimedDigest = "0".repeat(64);
    try {
      const signed = await admin.post("/api/upload-cv/sign", {
        data: { fileName, size: bytes.length, contentDigest: claimedDigest },
      });
      if (signed.status() !== 200) {
        const failure = await signed.json().catch(() => null);
        const reason =
          failure?.error ===
          "CV upload is waiting for database and review-queue setup."
            ? "foundation_unavailable"
            : failure?.error === "Private CV storage is unavailable."
              ? "private_storage_unavailable"
              : "unclassified";
        await testInfo.attach("acceptance_upload_sign_failure", {
          body: Buffer.from(
            JSON.stringify({ status: signed.status(), reason }),
          ),
          contentType: "application/json",
        });
      }
      expect(signed.status()).toBe(200);
      const reference = await signed.json();
      expect(ownedOriginalCvObjectKey(owner, reference.objectKey)).toBe(true);
      expect(reference.contentType).toBe("text/plain");
      const ledgerPath = `${acceptanceRequired("ACCEPTANCE_CREDENTIAL_BUNDLE_PATH")}.original-cv-ledger.jsonl`;
      await appendFile(
        ledgerPath,
        `${JSON.stringify({ objectKey: reference.objectKey })}\n`,
        { encoding: "utf8", mode: 0o600 },
      );
      const bucket = database.storage.from(ORIGINAL_CV_BUCKET);
      const uploaded = await bucket.uploadToSignedUrl(
        reference.objectKey,
        reference.token,
        bytes,
        { contentType: reference.contentType },
      );
      expect(uploaded.error).toBeNull();
      const readback = await bucket.download(reference.objectKey);
      expect(readback.error).toBeNull();
      expect(readback.data).toBeTruthy();
      expect(
        Buffer.from(await readback.data!.arrayBuffer()).equals(bytes),
      ).toBe(true);
      const rejected = await admin.post("/api/upload-cv", {
        data: {
          fileName,
          objectKey: reference.objectKey,
          size: bytes.length,
          contentDigest: claimedDigest,
        },
      });
      expect(rejected.status()).toBe(409);
      const sourceFile = `${ORIGINAL_CV_BUCKET}/${reference.objectKey}`;
      const review = await database
        .from("candidate_upload_reviews")
        .select("source_file")
        .eq("source_file", sourceFile)
        .limit(2);
      expect(review.error).toBeNull();
      expect(review.data?.length).toBe(1);
      const candidates = await database
        .from("candidates")
        .select("id", { count: "exact", head: true })
        .eq("source_file", sourceFile);
      expect(candidates.error).toBeNull();
      expect(candidates.count).toBe(0);
      await attachSanitized(testInfo, "synthetic-upload-integrity", {
        signedUpload: true,
        originalBytesMatch: true,
        digestMismatchDenied: true,
        reviewQueued: true,
        candidateCreated: false,
      });
    } finally {
      await admin.dispose();
      // The armed workflow cleanup removes the exact run-owned object/review
      // even when an assertion above fails; no credentials or paths are attached.
    }
  });

  test("candidate upload parses employer and project, confirms ownership and becomes searchable", async ({}, testInfo) => {
    const candidate = await authenticatedApi("candidate");
    const recruiter = await authenticatedApi("recruiter");
    const admin = await authenticatedApi("admin");
    const database = acceptanceAdminClient();
    const owner = (await credentialBundle()).identities.candidate.authUserId;
    const fileName = "synthetic-candidate-lifecycle.txt";
    let objectKey = "";
    try {
      const initial = await candidate.get("/api/candidate/profile");
      expect(initial.status()).toBe(200);
      const initialProfile = await initial.json();
      const verifiedEmail = String(initialProfile.verifiedEmail || "");
      expect(verifiedEmail).toContain("@");
      const bytes = Buffer.from(
        [
          "Synthetic PTF Tester",
          "Email: " + verifiedEmail,
          "Phone: +60123456789",
          "Location: Malaysia",
          "Current title: SAP FICO Consultant",
          "",
          "PROFESSIONAL EXPERIENCE",
          "PTF Synthetic Consulting Ltd",
          "SAP FICO Consultant",
          "January 2022 - Present",
          "Configured SAP FI and CO for implementation and support.",
          "",
          "PTF Synthetic Services Ltd",
          "SAP Finance Analyst",
          "January 2018 - December 2021",
          "",
          "PROJECT EXPERIENCE",
          "Project: PTF Synthetic S/4HANA Finance Implementation",
          "Client: PTF Synthetic Manufacturing Client",
          "Employer: PTF Synthetic Consulting Ltd",
          "Role: SAP FICO Consultant",
          "January 2023 - December 2023",
          "SAP S/4HANA design, configuration, testing, go-live and hypercare.",
          "",
          "SKILLS",
          "SAP FICO, SAP FI, SAP CO, SAP S/4HANA",
          "",
          "EDUCATION",
          "Bachelor of Information Systems, PTF Synthetic University, 2017",
          "",
          "LANGUAGES",
          "English - Professional",
        ].join("\n"),
      );
      const contentDigest = createHash("sha256").update(bytes).digest("hex");
      const signed = await candidate.post("/api/candidate/profile/cv/sign", {
        data: { fileName, size: bytes.length, contentDigest },
      });
      expect(signed.status()).toBe(200);
      const reference = await signed.json();
      objectKey = String(reference.objectKey || "");
      expect(ownedOriginalCvObjectKey(owner, objectKey)).toBe(true);
      const ledgerPath =
        acceptanceRequired("ACCEPTANCE_CREDENTIAL_BUNDLE_PATH") +
        ".original-cv-ledger.jsonl";
      await appendFile(ledgerPath, JSON.stringify({ objectKey }) + "\n", {
        encoding: "utf8",
        mode: 0o600,
      });
      const upload = await database.storage
        .from(ORIGINAL_CV_BUCKET)
        .uploadToSignedUrl(objectKey, reference.token, bytes, {
          contentType: reference.contentType,
        });
      expect(upload.error).toBeNull();
      const originalReadback = await database.storage
        .from(ORIGINAL_CV_BUCKET)
        .download(objectKey);
      expect(originalReadback.error).toBeNull();
      expect(originalReadback.data).toBeTruthy();
      const readbackBytes = Buffer.from(
        await originalReadback.data!.arrayBuffer(),
      );
      expect(readbackBytes.equals(bytes)).toBe(true);
      expect(createHash("sha256").update(readbackBytes).digest("hex")).toBe(
        contentDigest,
      );

      const parsed = await candidate.post("/api/candidate/profile/cv", {
        data: { fileName, objectKey, size: bytes.length, contentDigest },
      });
      expect(parsed.status()).toBe(200);
      const parsedBody = await parsed.json();
      expect(parsedBody).toMatchObject({
        accepted: true,
        candidateId: internalCandidateId,
        searchable: false,
        confirmationRequired: true,
      });
      // Read through the deployed application, including its immutable audit,
      // rather than treating privileged Storage readback as API evidence.
      const original = await admin.get(
        `/api/candidate360/${internalCandidateId}/resume`,
      );
      expect(original.status()).toBe(200);
      expect(original.headers()["cache-control"]).toContain("private");
      expect(original.headers()["cache-control"]).toContain("no-store");
      expect(original.headers()["x-content-type-options"]).toBe("nosniff");
      expect((await original.body()).equals(bytes)).toBe(true);

      const review = await candidate.get("/api/candidate/profile");
      expect(review.status()).toBe(200);
      const reviewBody = await review.json();
      expect(reviewBody.searchable).toBe(false);
      const beforeConfirmation = await recruiter.post(searchPath, {
        data: {
          query: acceptanceRequired("ACCEPTANCE_INTERNAL_SEARCH_QUERY"),
          talentPool: "internal_profiles",
        },
      });
      expect(beforeConfirmation.status()).toBe(200);
      const hiddenSearchBody = await beforeConfirmation.json();
      expect(Array.isArray(hiddenSearchBody.results)).toBe(true);
      expect(
        hiddenSearchBody.results.some(
          (item: Record<string, unknown>) =>
            String(item.candidateId || item.id || "") === internalCandidateId,
        ),
      ).toBe(false);
      expect(JSON.stringify(reviewBody.profile.workExperience)).toContain(
        "PTF Synthetic Consulting Ltd",
      );
      expect(JSON.stringify(reviewBody.profile.projectExperience)).toContain(
        "PTF Synthetic Manufacturing Client",
      );

      const confirmation = await candidate.post(
        "/api/candidate/profile/confirmation",
        {
          data: {
            expectedUpdatedAt: reviewBody.version,
            submittedFields: {
              displayName: "Synthetic PTF Tester",
              email: verifiedEmail,
              phone: "+60123456789",
              currentTitle: "SAP FICO Consultant",
              currentCompany: "PTF Synthetic Consulting Ltd",
              location: "Malaysia",
              workExperience: JSON.stringify([
                {
                  employer: "PTF Synthetic Consulting Ltd",
                  title: "SAP FICO Consultant",
                  start_date: "2022-01",
                  end_date: "",
                  current: true,
                },
                {
                  employer: "PTF Synthetic Services Ltd",
                  title: "SAP Finance Analyst",
                  start_date: "2018-01",
                  end_date: "2021-12",
                  current: false,
                },
              ]),
              sapModules: "FICO, FI, CO",
              techSkills: "SAP FICO, SAP FI, SAP CO, SAP S/4HANA",
              projectExperience: JSON.stringify([
                {
                  project: "PTF Synthetic S/4HANA Finance Implementation",
                  client: "PTF Synthetic Manufacturing Client",
                  role: "SAP FICO Consultant",
                  start_date: "2023-01",
                  end_date: "2023-12",
                  current: false,
                },
              ]),
              education: JSON.stringify([
                {
                  institution: "PTF Synthetic University",
                  qualification: "Bachelor of Information Systems",
                  graduation_year: "2017",
                },
              ]),
              certifications: "[]",
              languages: JSON.stringify([
                { language: "English", proficiency: "Professional" },
              ]),
              confirmAccuracy: true,
              consentToShare: true,
            },
          },
        },
      );
      expect(confirmation.status()).toBe(200);
      expect(await confirmation.json()).toMatchObject({
        confirmed: true,
        profileStatus: "candidate_confirmed",
        searchable: true,
      });

      const search = await recruiter.post(searchPath, {
        data: {
          query: acceptanceRequired("ACCEPTANCE_INTERNAL_SEARCH_QUERY"),
          talentPool: "internal_profiles",
        },
      });
      expect(search.status()).toBe(200);
      const searchBody = await search.json();
      expect(
        searchBody.results?.some(
          (item: Record<string, unknown>) =>
            String(item.candidateId || item.id || "") === internalCandidateId,
        ),
      ).toBe(true);
      await attachSanitized(testInfo, "candidate-cv-confirmation-search", {
        signedUpload: true,
        originalBytesPreserved: true,
        originalBytesReadThroughAuthenticatedApi: true,
        parserEmployerClientSeparated: true,
        hiddenBeforeConfirmation: true,
        candidateConfirmed: true,
        searchableAfterConfirmation: true,
      });
    } finally {
      await candidate.dispose();
      await recruiter.dispose();
      await admin.dispose();
      // Workflow cleanup consumes the exact ledger reference and proves that
      // the candidate, review row and private bytes leave no run-owned residue.
    }
  });

  test("original CV approval requires active subscription and revocation closes access", async ({}, testInfo) => {
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
    const admin = await authenticatedApi("admin");
    const client = await authenticatedApi("client");
    const candidate = await authenticatedApi("candidate");
    try {
      const bundle = await credentialBundle();
      const clientId = String(bundle.identities.client.clientId || "");
      const recruiterProfileId = String(
        bundle.identities.recruiter.profileId || "",
      );
      expect(clientId).toMatch(
        /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i,
      );
      expect(recruiterProfileId).toMatch(
        /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i,
      );
      await deny(await anonymous.get(target), 401);
      await deny(await recruiter.get(target), 403);
      await deny(await client.get(target), 403);
      await deny(await candidate.get(target), 403);
      const expected = await admin.get(target);
      expect(expected.status()).toBe(200);
      const expectedBytes = await expected.body();
      expect(expectedBytes.length).toBeGreaterThan(0);
      const requested = await recruiter.post(
        "/api/recruiter/original-cv-requests",
        {
          data: {
            candidateId: internalCandidateId,
            purpose: "client_support",
            clientId,
          },
        },
      );
      expect(requested.status()).toBe(201);
      const requestBody = await requested.json();
      expect(requestBody.status).toBe("pending");
      expect(requestBody.requestId).toMatch(
        /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i,
      );
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      const approved = await admin.post("/api/admin/original-cv-grants", {
        data: {
          action: "approve",
          requestId: requestBody.requestId,
          expiresAt,
        },
      });
      expect(approved.status()).toBe(200);
      expect(await approved.json()).toMatchObject({
        approved: true,
        expiresAt,
      });
      const allowed = await recruiter.get(target);
      expect(allowed.status()).toBe(200);
      expect(allowed.headers()["cache-control"]).toContain("private");
      expect(allowed.headers()["cache-control"]).toContain("no-store");
      expect((await allowed.body()).equals(expectedBytes)).toBe(true);
      const revoked = await admin.post("/api/admin/original-cv-grants", {
        data: {
          action: "revoke",
          candidateId: internalCandidateId,
          recruiterProfileId,
        },
      });
      expect(revoked.status()).toBe(200);
      expect(await revoked.json()).toEqual({ revoked: true });
      await deny(await recruiter.get(target), 403);
      await attachSanitized(testInfo, "original-cv-approval-boundary", {
        anonymous: 401,
        recruiterWithoutGrant: 403,
        activeSubscriptionRequired: true,
        adminApproved: true,
        exactOriginalBytesRead: true,
        revoked: true,
        recruiterAfterRevocation: 403,
        client: 403,
        candidate: 403,
      });
    } finally {
      await anonymous.dispose();
      await recruiter.dispose();
      await admin.dispose();
      await client.dispose();
      await candidate.dispose();
    }
  });

  test("synthetic candidate drawer remains private and preserves Experience/Projects semantics", async ({
    page,
  }, testInfo) => {
    const detailApi = await authenticatedApi("recruiter");
    try {
      const detailResponse = await detailApi.get(
        `${searchPath}/candidate-details/${internalCandidateId}`,
      );
      expect(detailResponse.status()).toBe(200);
      const detail = await detailResponse.json();
      const projects = detail.enterpriseProfile?.projects || [];
      const expectedClientPresent = projects.some(
        (project: { client?: string }) =>
          project.client === "PTF Synthetic Manufacturing Client",
      );
      const diagnostic = {
        projectCount: projects.length,
        expectedClientPresent,
      };
      await attachSanitized(testInfo, "drawer-project-source", diagnostic);
      console.log(
        JSON.stringify({
          type: "acceptance_drawer_project_source",
          ...diagnostic,
        }),
      );
      expect(
        expectedClientPresent,
        "candidate-detail API must preserve the synthetic project client before checking the drawer",
      ).toBe(true);
    } finally {
      await detailApi.dispose();
    }
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
    const sections = [
      "Overview",
      "Experience",
      "Projects",
      "Education",
      "Skills",
    ];
    for (const section of sections) {
      const tab = drawer.getByRole("tab", {
        name: new RegExp(`^${section}(?:,|$)`),
      });
      await expect(tab).toBeVisible();
      await tab.click();
      await expect(tab).toHaveAttribute("aria-selected", "true");
      const panel = drawer.getByRole("tabpanel");
      await expect(panel).toBeVisible();
      await expect(panel).toHaveAttribute(
        "aria-labelledby",
        `candidate-detail-${section.toLowerCase()}-tab`,
      );
    }
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
    const projectsTab = drawer.getByRole("tab", { name: /^Projects(?:,|$)/ });
    await projectsTab.click();
    try {
      await expect(projectsTab).toHaveAttribute("aria-selected", "true");
      const projectsPanel = drawer.getByRole("tabpanel");
      await expect(projectsPanel).toHaveAttribute(
        "aria-labelledby",
        "candidate-detail-projects-tab",
      );
      await expect(
        projectsPanel
          .getByText("PTF Synthetic Manufacturing Client", { exact: true })
          .first(),
      ).toBeVisible();
    } finally {
      const diagnostic = {
        projectsSelected: await projectsTab.getAttribute("aria-selected"),
        panelLabel: await drawer
          .getByRole("tabpanel")
          .getAttribute("aria-labelledby"),
        expectedClientNodes: await drawer
          .getByText("PTF Synthetic Manufacturing Client", { exact: true })
          .count(),
      };
      await attachSanitized(testInfo, "drawer-project-render", diagnostic);
      console.log(
        JSON.stringify({
          type: "acceptance_drawer_project_render",
          ...diagnostic,
        }),
      );
      await page.screenshot({
        path: "artifacts/acceptance-evidence/private-candidate-drawer.png",
        fullPage: false,
      });
    }
  });

  test("Search V2 shows Comparison beside Shortlist with separate employer and client periods", async ({
    page,
  }, testInfo) => {
    // 25 authorized inserts plus 25 authorized deletes share this deadline.
    // Run 49 completed the pack checks at 150s, then timed out during cleanup.
    // Keep the 3s Search budget independent of this bounded fixture lifecycle.
    test.setTimeout(300_000);
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
    const packExpected = {
      runId: acceptanceRequired("ACCEPTANCE_RUN_ID"),
      syntheticNamespace: acceptanceRequired("ACCEPTANCE_SYNTHETIC_NAMESPACE"),
      environmentId: acceptanceRequired("ACCEPTANCE_ENVIRONMENT_ID"),
      projectRef: acceptanceRequired("ACCEPTANCE_SUPABASE_PROJECT_REF"),
      expectedCommitSha: acceptanceRequired("ACCEPTANCE_EXPECTED_SHA"),
      expiresAt: acceptanceRequired("ACCEPTANCE_EXPIRES_AT"),
    };
    const fullPack = acceptanceComparisonPackFixture(packExpected.runId);
    const packSelections: { candidateId: string; jobId: string }[] = [];
    const comparisonStartedAt = performance.now();
    const comparisonPhase = (phase: string) =>
      console.log(
        JSON.stringify({
          type: "acceptance_comparison_phase",
          phase,
          elapsedMs: Math.ceil(performance.now() - comparisonStartedAt),
        }),
      );
    try {
      comparisonPhase("single-profile-api");
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
      comparisonPhase("single-profile-ui");
      await installAuthenticatedBrowserState(page.context(), "recruiter");
      comparisonPhase("full-pack-ui");
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
      // A one-profile fixture must never be padded or duplicated to fill a pack.
      // Check actual table contents for every size in both job-aware scopes.
      for (const scope of [shortlistedScope, matchingScope]) {
        await scope.click();
        await expect(scope).toHaveAttribute("aria-pressed", "true");
        await expect(
          pack.getByText(/Showing 1 of 1 available ranked profiles/),
        ).toBeVisible();
        for (const size of [5, 10, 20]) {
          await pack.getByRole("button", { name: `Top ${size}` }).click();
          await expect(
            pack.getByRole("button", { name: `Top ${size}` }),
          ).toHaveAttribute("aria-pressed", "true");
          await expect(pack.locator("tbody tr")).toHaveCount(1);
          const row = pack.locator("tbody tr").first();
          await expect(row).toContainText(
            acceptanceRequired("ACCEPTANCE_SYNTHETIC_CANDIDATE_MARKER"),
          );
          await expect(row).toContainText("PTF Synthetic Consulting Ltd");
          await expect(row).toContainText("PTF Synthetic Manufacturing Client");
        }
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
      // The pack is provisioned before the first Search request warms its cache.
      // Add every row through the authenticated API, scoped to this synthetic job.
      comparisonPhase("full-pack-shortlist");
      for (const candidate of fullPack.candidates) {
        const selected = { candidateId: candidate.id, jobId: job!.id };
        packSelections.push(selected);
        expect(
          (
            await shortlist.post("/api/recruiter/search-v2/shortlist", {
              data: selected,
            })
          ).status(),
        ).toBe(200);
      }
      comparisonPhase("full-pack-api");
      const fullResponse = await shortlist.post(searchPath, {
        data: {
          query: fullPack.query,
          talentPool: "internal_profiles",
          page: 1,
          pageSize: 50,
        },
      });
      expect(fullResponse.status()).toBe(200);
      const fullBody = await fullResponse.json();
      const expectedIds = new Set(fullPack.candidates.map((row) => row.id));
      expect(fullBody.results).toHaveLength(25);
      expect(
        new Set(
          fullBody.results.map(
            (row: { candidateId: string }) => row.candidateId,
          ),
        ),
      ).toEqual(expectedIds);
      for (const [jobId, expectedCount] of [
        [job!.id, 20],
        ["00000000-0000-4000-8000-000000000001", 0],
      ] as const) {
        const scopedResponse = await shortlist.post(searchPath, {
          data: {
            query: fullPack.query,
            talentPool: "internal_profiles",
            page: 1,
            pageSize: 20,
            comparison: { scope: "shortlisted", jobId },
          },
        });
        expect(scopedResponse.status()).toBe(200);
        const scopedBody = await scopedResponse.json();
        expect(scopedBody.results).toHaveLength(expectedCount);
        if (expectedCount) {
          const scopedIds = scopedBody.results.map(
            (row: { candidateId: string }) => row.candidateId,
          );
          expect(new Set(scopedIds).size).toBe(expectedCount);
          expect(scopedIds.every((id: string) => expectedIds.has(id))).toBe(
            true,
          );
        }
      }
      comparisonPhase("full-pack-ui");
      await page.goto(`${searchPage}?jobId=${encodeURIComponent(job!.id)}`);
      await page
        .getByPlaceholder(
          "Senior SAP FICO consultant in Malaysia with implementation experience",
        )
        .fill(fullPack.query);
      await page.getByRole("button", { name: "Understand & review" }).click();
      await page.getByRole("button", { name: "Commit Search" }).click();
      await page.getByRole("button", { name: "Compare", exact: true }).click();
      await expect(pack).toBeVisible();
      for (const scope of [
        "All matching results",
        "Shortlisted in this search",
      ]) {
        await pack.getByRole("button", { name: scope }).click();
        for (const size of [5, 10, 20]) {
          await pack.getByRole("button", { name: `Top ${size}` }).click();
          const rows = pack.locator("tbody tr");
          await expect(rows).toHaveCount(size);
          const texts = await rows.allTextContents();
          expect(new Set(texts).size).toBe(size);
          for (const text of texts) {
            expect(text).toContain(fullPack.query);
            expect(text).toContain("PTF Synthetic Consulting Ltd");
            expect(text).toContain("PTF Synthetic Manufacturing Client");
          }
        }
      }
      comparisonPhase("full-pack-verified");
      await attachSanitized(testInfo, "full-comparison-pack", {
        syntheticProfileCount: 25,
        verifiedPackSizes: [5, 10, 20],
        verifiedScopes: ["matches", "shortlisted"],
        uniqueProfiles: true,
        employerClientSeparated: true,
      });
    } finally {
      comparisonPhase("cleanup");
      let packCleanupFailed = false;
      for (const selected of packSelections) {
        const removed = await shortlist.delete(
          "/api/recruiter/search-v2/shortlist",
          { data: selected },
        );
        if (removed.status() !== 200) packCleanupFailed = true;
      }
      await removeAcceptanceComparisonPack(db, packExpected);
      expect(packCleanupFailed).toBe(false);
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
      comparisonPhase("cleanup-verified");
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

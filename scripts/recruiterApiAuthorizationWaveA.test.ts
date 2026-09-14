import assert from "node:assert/strict";
import Module from "node:module";

import {
  authorizeRecruiterApiAccess,
  recruiterApiRoleHasPermission,
  validateRecruiterApiWriteRequest,
  type RecruiterApiAuthAdapter,
} from "../lib/recruiterApiAuthorizationCore";
import {
  RECRUITER_API_ROUTE_POLICIES,
  type RecruiterApiPermission,
} from "../lib/recruiterApiPolicyRegistry";

async function main() {
  const runtime = Module as unknown as {
    _load: (request: string, parent: unknown, isMain: boolean) => unknown;
  };
  const originalLoad = runtime._load;
  runtime._load = function (request, parent, isMain) {
    if (request === "server-only") return {};
    return originalLoad.call(this, request, parent, isMain);
  };
  const profile = (role: string, status = "active") => ({
    id: "authoritative-profile",
    auth_user_id: "authoritative-user",
    role,
    status,
    organization_id: "authoritative-organization",
  });
  const adapter = (
    role: string | null,
    status = "active",
  ): RecruiterApiAuthAdapter => ({
    async getUser() {
      return { user: { id: "authoritative-user" } };
    },
    async getProfile() {
      return { profile: role ? profile(role, status) : null };
    },
  });
  const authorize = (
    permission: RecruiterApiPermission,
    role: string | null,
    status = "active",
  ) =>
    authorizeRecruiterApiAccess({
      adapter: adapter(role, status),
      permission,
      routePolicyId: "test-policy",
      log() {},
    });

  for (const policy of RECRUITER_API_ROUTE_POLICIES) {
    const anonymous = await authorizeRecruiterApiAccess({
      adapter: {
        async getUser() {
          return { user: null };
        },
        async getProfile() {
          throw new Error("Profile lookup must not run for anonymous users");
        },
      },
      permission: policy.requiredPermission,
      routePolicyId: policy.id,
      log() {},
    });
    assert.equal(anonymous.allowed, false);
    if (!anonymous.allowed) assert.equal(anonymous.status, 401);
    for (const deniedRole of ["client", "candidate", "qa", "unknown-role"]) {
      const denied = await authorize(policy.requiredPermission, deniedRole);
      assert.equal(denied.allowed, false, `${deniedRole} reached ${policy.id}`);
      if (!denied.allowed) assert.equal(denied.status, 403);
    }
  }

  for (const role of ["recruiter", "recruiter_manager", "admin"] as const) {
    for (const permission of [
      "recruiter.candidate.read",
      "recruiter.candidate.compare",
      "recruiter.shortlist.manage",
      "recruiter.submission.manage",
      "recruiter.workflow.read",
      "recruiter.workflow.write",
      "recruiter.copilot.use",
    ] as const)
      assert.equal(recruiterApiRoleHasPermission(role, permission), true);
  }
  assert.equal(
    recruiterApiRoleHasPermission("recruiter", "recruiter.data_quality.apply"),
    false,
  );
  assert.equal(
    recruiterApiRoleHasPermission(
      "recruiter_manager",
      "recruiter.data_quality.apply",
    ),
    false,
  );
  assert.equal(
    recruiterApiRoleHasPermission(
      "recruiter_manager",
      "recruiter.automation.execute",
    ),
    false,
  );
  assert.equal(
    recruiterApiRoleHasPermission(
      "recruiter_manager",
      "recruiter.automation.approve",
    ),
    true,
  );

  const inactive = await authorize(
    "recruiter.candidate.read",
    "recruiter",
    "inactive",
  );
  assert.equal(inactive.allowed, false);
  const missing = await authorize("recruiter.candidate.read", null);
  assert.equal(missing.allowed, false);

  const csrf = validateRecruiterApiWriteRequest({
    method: "POST",
    url: "http://localhost/api/recruiter/workflow/move-stage",
    headers: new Headers({
      cookie: "session=secret",
      origin: "https://attacker.example",
      "content-type": "application/json",
      "content-length": "2",
    }),
    policyId: "workflow-move-stage",
    maxRequestBytes: 1024 * 1024,
  });
  assert.deepEqual(csrf, { code: "same_origin_required", status: 403 });

  const unsupported = validateRecruiterApiWriteRequest({
    method: "POST",
    url: "http://localhost/api/recruiter/workflow/move-stage",
    headers: new Headers({
      "content-type": "text/plain",
      "content-length": "4",
    }),
    policyId: "workflow-move-stage",
    maxRequestBytes: 1024 * 1024,
  });
  assert.deepEqual(unsupported, {
    code: "unsupported_content_type",
    status: 415,
  });

  const tooLarge = validateRecruiterApiWriteRequest({
    method: "POST",
    url: "http://localhost/api/recruiter/workflow/move-stage",
    headers: new Headers({
      "content-type": "application/json",
      "content-length": String(1024 * 1024 + 1),
    }),
    policyId: "workflow-move-stage",
    maxRequestBytes: 1024 * 1024,
  });
  assert.deepEqual(tooLarge, { code: "request_too_large", status: 413 });

  let parsedBodies = 0;
  const denialEvents: Record<string, string>[] = [];
  const deniedBeforeWork = await authorizeRecruiterApiAccess({
    adapter: adapter("client"),
    permission: "recruiter.candidate.compare",
    routePolicyId: "candidate-compare",
    log(event) {
      denialEvents.push(event);
    },
  });
  if (deniedBeforeWork.allowed) parsedBodies += 1;
  assert.equal(
    parsedBodies,
    0,
    "Denied authorization must prevent body parsing",
  );
  const serializedAudit = JSON.stringify(denialEvents);
  for (const forbidden of [
    "authoritative-user",
    "authoritative-profile",
    "authoritative-organization",
    "candidate@example.com",
    "sensitive resume body",
    "secret-token",
    "secret-cookie",
  ])
    assert.equal(
      serializedAudit.includes(forbidden),
      false,
      `Audit leaked ${forbidden}`,
    );

  const { setRecruiterApiAuthorizationResolverForTests } =
    await import("../lib/recruiterApiAuthorization");
  setRecruiterApiAuthorizationResolverForTests(async () => ({
    allowed: false,
    status: 403,
    code: "permission_required",
  }));
  const { POST: executeCandidateApply } =
    await import("../app/api/recruiter/ai-extraction-review/candidate-apply-execute/route");
  let handlerBodyParses = 0;
  const handlerResponse = await executeCandidateApply({
    method: "POST",
    url: "http://localhost/api/recruiter/ai-extraction-review/candidate-apply-execute",
    headers: new Headers(),
    async json() {
      handlerBodyParses += 1;
      return { writeCandidateUpdates: true, confirmApply: true };
    },
  } as never);
  assert.equal(handlerResponse.status, 403);
  assert.equal(
    handlerBodyParses,
    0,
    "Service-role candidate apply must deny before parsing the request body",
  );
  setRecruiterApiAuthorizationResolverForTests(null);

  console.log(
    JSON.stringify(
      {
        policiesExercised: RECRUITER_API_ROUTE_POLICIES.length,
        anonymousDenied: true,
        deniedRoles: ["client", "candidate", "qa", "unknown-role"],
        inactiveAndMissingProfilesDenied: true,
        csrfBeforeAuthorization: true,
        contentTypeAndSizeProtected: true,
        privilegedRecruiterDenial: true,
        browserIdentityHeadersIgnored: true,
        auditRedaction: true,
        serviceRoleHandlerDeniedBeforeBodyParsing: true,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

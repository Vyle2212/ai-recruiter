import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import {
  RECRUITER_API_ROUTE_POLICIES,
  recruiterApiPolicyForRequest,
  type RecruiterApiMethod,
} from "../lib/recruiterApiPolicyRegistry";

const root = path.join(process.cwd(), "app", "api", "recruiter");
const files: string[] = [];
function visit(directory: string) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) visit(target);
    else if (entry.name === "route.ts") files.push(target);
  }
}
visit(root);

const routeMethods = files.flatMap((file) => {
  const source = readFileSync(file, "utf8");
  const route =
    "/api/recruiter/" +
    path.relative(root, path.dirname(file)).split(path.sep).join("/");
  return [
    ...source.matchAll(
      /export\s+(?:async\s+function|const)\s+(GET|POST|PUT|PATCH|DELETE)\b/g,
    ),
  ].map((match) => ({
    route,
    method: match[1] as RecruiterApiMethod,
    source,
  }));
});

assert.equal(files.length, 78, "Expected the audited 78 recruiter route files");
assert.ok(routeMethods.length > files.length, "Expected multi-method routes");

for (const item of routeMethods) {
  const policy = recruiterApiPolicyForRequest(item.route, item.method);
  assert.ok(policy, `Missing policy for ${item.method} ${item.route}`);
  assert.ok(policy.requiredPermission, `Missing permission for ${policy.id}`);
  if (policy.persistentMutation)
    assert.notEqual(
      policy.requiredPermission,
      "recruiter.candidate.read",
      `Persistent mutation ${policy.id} needs a mutation permission`,
    );
  if (policy.serviceRoleAccess)
    assert.ok(
      ["recruiter.candidate.read", "recruiter.data_quality.apply"].includes(
        policy.requiredPermission,
      ),
      `Service-role policy ${policy.id} must be explicitly privileged`,
    );
}

for (const policy of RECRUITER_API_ROUTE_POLICIES) {
  for (const method of policy.supportedMethods) {
    const matches = RECRUITER_API_ROUTE_POLICIES.filter(
      (candidate) =>
        candidate.routePattern === policy.routePattern &&
        candidate.supportedMethods.includes(method),
    );
    assert.equal(
      matches.length,
      1,
      `Duplicate policy for ${method} ${policy.routePattern}`,
    );
    assert.ok(
      routeMethods.some(
        (item) => item.route === policy.routePattern && item.method === method,
      ),
      `Policy ${policy.id} does not map to an exported route method`,
    );
  }
}

const previousHighRiskRoutes = routeMethods.filter(
  ({ source, method, route }) => {
    const isWrite = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
    return (
      (isWrite &&
        ![
          "/api/recruiter/search-v2",
          "/api/recruiter/search-v2/external-analysis",
          "/api/recruiter/search-v2/external-profile-import",
          "/api/recruiter/search-v2/guided-intent",
          "/api/recruiter/search-v2/guided-source",
        ].includes(route)) ||
      /createCandidateSupabaseAdminClient|SUPABASE_SERVICE_ROLE|service[_-]?role/i.test(
        source,
      ) ||
      [
        "/api/recruiter/search-v2",
        "/api/recruiter/search-v2/candidate-details/[candidateId]",
      ].includes(route)
    );
  },
);

for (const item of previousHighRiskRoutes) {
  assert.match(
    item.source,
    /requireRecruiterApiRouteAuthorization|requireRecruiterSearchAuthorization/,
    `High-risk handler lacks a local boundary: ${item.method} ${item.route}`,
  );
}

console.log(
  JSON.stringify(
    {
      routeFiles: files.length,
      exportedMethods: routeMethods.length,
      policyEntries: RECRUITER_API_ROUTE_POLICIES.length,
      highRiskHandlerMethods: previousHighRiskRoutes.length,
      missingPolicies: 0,
      duplicatePolicies: 0,
    },
    null,
    2,
  ),
);

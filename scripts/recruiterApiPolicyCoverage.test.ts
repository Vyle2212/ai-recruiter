import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import {
  RECRUITER_API_ROUTE_POLICIES,
  recruiterApiPolicyForRequest,
  type RecruiterApiMethod,
} from "../lib/recruiterApiPolicyRegistry";

const root = path.join(process.cwd(), "app", "api");
const files: string[] = [];
function visit(directory: string) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) visit(target);
    else if (entry.name === "route.ts") files.push(target);
  }
}
visit(root);

const auditedFiles = files.filter((file) => {
  const relative = path.relative(root, file).split(path.sep).join("/");
  const source = readFileSync(file, "utf8");
  const hasLocalBoundary =
    /requireRecruiter(?:ApiRoute|Search)Authorization/.test(source);
  const usesPrivilegedCandidateData =
    /SUPABASE_SERVICE_ROLE|createLazySupabaseServiceClient|createCandidateSupabaseAdminClient|\.from\(["']candidates["']\)/.test(
      source,
    );
  return (
    relative.startsWith("recruiter/") ||
    [
      "admin/audit-search-index/route.ts",
      "admin/rebuild-search-index/route.ts",
      "admin/rebuild-candidate/route.ts",
      "candidate-search-index/rebuild/route.ts",
      "candidate-search-index/sync/route.ts",
    ].includes(relative) ||
    source.includes("@/lib/supabase") ||
    (!hasLocalBoundary && usesPrivilegedCandidateData)
  );
});

const routeMethods = auditedFiles.flatMap((file) => {
  const source = readFileSync(file, "utf8");
  const route =
    "/api/" + path.relative(root, path.dirname(file)).split(path.sep).join("/");
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

const recruiterFiles = auditedFiles.filter((file) =>
  path.relative(root, file).split(path.sep).join("/").startsWith("recruiter/"),
);
const legacyServiceFiles = auditedFiles.filter(
  (file) => !recruiterFiles.includes(file),
);
assert.equal(
  recruiterFiles.length,
  78,
  "Expected the audited 78 recruiter route files",
);
assert.equal(
  legacyServiceFiles.length,
  39,
  "Expected the audited 39 legacy privileged route files",
);
assert.ok(
  routeMethods.length > auditedFiles.length,
  "Expected multi-method routes",
);

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
    assert.match(
      policy.requiredPermission,
      /^recruiter\.(?:candidate|data_quality|workflow|shortlist)\./,
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
      route.startsWith("/api/recruiter/") &&
      ((isWrite &&
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
        ].includes(route))
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

const proxySource = readFileSync(path.join(process.cwd(), "proxy.ts"), "utf8");
assert.match(proxySource, /recruiterApiPolicyForRequest/);
assert.match(proxySource, /"\/api\/:path\*"/);
for (const file of legacyServiceFiles) {
  const source = readFileSync(file, "utf8");
  const route = path.relative(root, file).split(path.sep).join("/");
  if (
    [
      "admin/audit-search-index/route.ts",
      "admin/rebuild-search-index/route.ts",
      "admin/rebuild-candidate/route.ts",
      "candidate-search-index/rebuild/route.ts",
      "candidate-search-index/sync/route.ts",
    ].includes(route)
  ) {
    assert.match(source, /auditSearchIndex|legacyIndexMutationResponse/);
    continue;
  }
  assert.match(
    source,
    /@\/lib\/supabase|SUPABASE_SERVICE_ROLE|createLazySupabaseServiceClient|createCandidateSupabaseAdminClient|\.from\(["']candidates["']\)/,
  );
}

console.log(
  JSON.stringify(
    {
      routeFiles: files.length,
      auditedRouteFiles: auditedFiles.length,
      legacyServiceRouteFiles: legacyServiceFiles.length,
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

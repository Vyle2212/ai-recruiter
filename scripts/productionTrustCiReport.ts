import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  RECRUITER_API_PERMISSIONS,
  RECRUITER_API_ROUTE_POLICIES,
  RECRUITER_API_SECURITY_VERSION,
} from "../lib/recruiterApiPolicyRegistry";

const report = {
  schemaVersion: "production-trust-ci-summary-v1",
  testedCommit: process.env.GITHUB_SHA || "local-worktree",
  securityVersion: RECRUITER_API_SECURITY_VERSION,
  routePolicies: RECRUITER_API_ROUTE_POLICIES.length,
  exportedMethods: RECRUITER_API_ROUTE_POLICIES.reduce(
    (sum, policy) => sum + policy.supportedMethods.length,
    0,
  ),
  persistentMutationMethods: RECRUITER_API_ROUTE_POLICIES.reduce(
    (sum, policy) =>
      sum + (policy.persistentMutation ? policy.supportedMethods.length : 0),
    0,
  ),
  serviceRoleMethods: RECRUITER_API_ROUTE_POLICIES.reduce(
    (sum, policy) =>
      sum + (policy.serviceRoleAccess ? policy.supportedMethods.length : 0),
    0,
  ),
  permissions: [...RECRUITER_API_PERMISSIONS],
  deterministicOnly: true,
  productionCredentialsUsed: false,
  externalProviderCalls: 0,
  candidatePiiIncluded: false,
};

const outputDirectory = path.join(process.cwd(), "artifacts");
mkdirSync(outputDirectory, { recursive: true });
writeFileSync(
  path.join(outputDirectory, "production-trust-ci-summary.json"),
  `${JSON.stringify(report, null, 2)}\n`,
  "utf8",
);
console.log(JSON.stringify(report, null, 2));

import assert from "node:assert/strict";
import fs from "node:fs";

import { buildAuthRlsPolicyPreview } from "../lib/authMigrationPreview";
import {
  buildRlsPolicyPreview,
  buildRlsSqlPolicyDocument,
} from "../lib/rlsPolicyPreview";

const helperNames = [
  "current_user_profile_id",
  "current_user_role",
  "current_user_organization_id",
  "current_user_client_id",
  "current_user_candidate_id",
  "current_user_is_admin",
];
const unqualifiedHelper =
  /(?<![\w.])current_(?:user_)?(?:profile_id|role|organization_id|client_id|candidate_id|is_admin)\(\)/;

const policyPreview = buildRlsPolicyPreview();
const policySql = buildRlsSqlPolicyDocument();
const policyExpressions = policyPreview.tables
  .flatMap((table) => table.rolePolicies)
  .flatMap((policy) => [
    policy.usingExpression,
    policy.withCheckExpression ?? "",
  ])
  .join("\n");

for (const helper of helperNames.slice(0, 5)) {
  assert.match(policySql, new RegExp(`private\\.${helper}\\(\\)`));
}
assert.doesNotMatch(policySql, /public\.current_user_/);
assert.doesNotMatch(policySql, unqualifiedHelper);
assert.doesNotMatch(policyExpressions, /public\.current_user_/);
assert.doesNotMatch(policyExpressions, unqualifiedHelper);

const authExpressions = buildAuthRlsPolicyPreview()
  .flatMap((policy) => [
    policy.usingExpression,
    policy.withCheckExpression ?? "",
  ])
  .join("\n");
assert.match(authExpressions, /private\.current_user_role\(\)/);
assert.doesNotMatch(authExpressions, /public\.current_user_/);
assert.doesNotMatch(authExpressions, unqualifiedHelper);

for (const path of [
  "app/auth/rls/page.tsx",
  "scripts/auditRlsPolicyPreview.ts",
]) {
  const source = fs.readFileSync(path, "utf8");
  assert.doesNotMatch(source, /public\.current_user_/);
  assert.doesNotMatch(source, unqualifiedHelper);
}

console.log("privateRlsPreviewHelpers.test.ts passed");

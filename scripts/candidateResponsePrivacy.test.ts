import assert from "node:assert/strict";
import fs from "node:fs";

const auditRoute = fs.readFileSync(
  new URL("../app/api/audit-candidates/route.ts", import.meta.url),
  "utf8",
);
const validationRoute = fs.readFileSync(
  new URL("../app/api/candidate-validation/route.ts", import.meta.url),
  "utf8",
);

const auditSelection =
  auditRoute.match(/\.select\(\s*"([^"]+)"\s*,?\s*\)/)?.[1] || "";
assert.ok(auditSelection, "audit route keeps an explicit candidate projection");
assert.equal(auditSelection.split(",").includes("email"), false);
assert.equal(auditSelection.split(",").includes("phone"), false);
assert.match(auditRoute, /recruiterSearchPrivateNoStoreHeaders/);

assert.doesNotMatch(validationRoute, /candidate:\s*saved/);
assert.match(
  validationRoute,
  /state:\s*buildCandidateValidationState\(saved\)/,
);
assert.match(validationRoute, /recruiterSearchPrivateNoStoreHeaders/);

console.log("Candidate response privacy tests passed");

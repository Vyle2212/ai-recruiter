import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { assertMojibakeFree } from "../lib/presentationEncoding";

const roots = [
  "app",
  "components",
  "lib",
  "src",
];
const sourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".css", ".md"]);

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(target);
    return sourceExtensions.has(path.extname(entry.name)) ? [target] : [];
  });
}

for (const file of roots.flatMap(sourceFiles)) {
  assertMojibakeFree(readFileSync(file, "utf8"), file);
}

const loginSource = readFileSync("app/auth/login/page.tsx", "utf8");
for (const staleClaim of [
  "Preview only",
  "No Supabase Auth calls",
  "No sessions",
  "Real provider not implemented",
]) {
  assert.equal(loginSource.includes(staleClaim), false, staleClaim);
}

assert.match(loginSource, /StagingRuntimeSignInForm/);
assert.match(loginSource, /showPreviewBadges=\{false\}/);
console.log("presentationEncoding.test.ts passed");

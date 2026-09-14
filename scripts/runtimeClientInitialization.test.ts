import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "..");
const runtimeClients = fs.readFileSync(
  path.join(root, "lib", "runtimeClients.ts"),
  "utf8",
);
const publicClient = fs.readFileSync(
  path.join(root, "lib", "supabase.ts"),
  "utf8",
);
const legacyPublicClient = fs.readFileSync(
  path.join(root, "src", "services", "supabase.ts"),
  "utf8",
);
assert.match(runtimeClients, /import "server-only"/);
assert.match(runtimeClients, /new Proxy/);
assert.match(runtimeClients, /instance \?\?= factory\(\)/);
assert.doesNotMatch(runtimeClients, /console\.(?:log|error|warn)/);
assert.doesNotMatch(
  runtimeClients,
  /throw new Error\([^)]*(?:OPENAI|SUPABASE|SERVICE_ROLE|API_KEY)/,
);
assert.match(publicClient, /new Proxy/);
assert.doesNotMatch(publicClient, /export const supabase\s*=\s*createClient/);
assert.doesNotMatch(legacyPublicClient, /createClient\s*\(/);
assert.match(legacyPublicClient, /@\/lib\/supabase/);

const moduleScopeSources = [
  "app/api/explain-match/route.ts",
  "app/api/generate-email/route.ts",
  "app/api/parse-cv/route.ts",
  "app/api/match-job/route.ts",
  "app/api/match-candidates/route.ts",
  "lib/db.ts",
  "lib/embedding.ts",
  "lib/openai.ts",
  "lib/openrouter.ts",
].map((file) => fs.readFileSync(path.join(root, file), "utf8"));

for (const source of moduleScopeSources) {
  assert.doesNotMatch(source, /new OpenAI\s*\(/);
  assert.doesNotMatch(source, /createClient\s*\(\s*process\.env/);
}

console.log("Lazy runtime client initialization regression passed.");

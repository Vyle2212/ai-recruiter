import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import { buildSearchV2BrowserRequest } from "../lib/searchV2ExecutionProfile";
import { buildSearchExecutionProfile } from "../lib/searchV2ExecutionProfile";
import { searchV2ExecutionProfileHash } from "../lib/searchV2Server";

const root = process.cwd();
const clientEntries = ["app/recruiter/talent-search/v2/CandidateSearchV2Client.tsx", "app/recruiter/talent-search/v2/GuidedSourcingPanel.tsx", "lib/searchV2ExecutionProfile.ts", "lib/guidedSourcingHandoff.ts"];
const forbiddenImport = /^(?:node:crypto|crypto|node:fs|fs)$/;
const forbiddenLocal = /(?:searchV2Dataset|searchV2Server|searchV2Version|guidedSourcingValidation|candidateSupabase)/;
const forbiddenSecret = /(?:SERVICE_ROLE|OPENAI_API_KEY|SUPABASE_SERVICE|process\.env)/;
const importPattern = /(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']/g;

function resolveLocal(from: string, specifier: string) {
  const base = specifier.startsWith("@/") ? path.join(root, specifier.slice(2)) : path.resolve(path.dirname(from), specifier);
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts"), path.join(base, "index.tsx")]) if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  return null;
}
function clientGraph(entry: string) {
  const pending = [path.resolve(root, entry)], visited = new Set<string>();
  while (pending.length) {
    const file = pending.pop()!;
    if (visited.has(file)) continue;
    visited.add(file);
    const source = fs.readFileSync(file, "utf8");
    assert.doesNotMatch(source, forbiddenSecret, `client graph exposes a server environment reference in ${path.relative(root, file)}`);
    for (const match of source.matchAll(importPattern)) {
      const specifier = match[1];
      assert(!forbiddenImport.test(specifier), `forbidden Node import ${specifier} in ${path.relative(root, file)}`);
      assert(!forbiddenLocal.test(specifier), `forbidden server module ${specifier} in ${path.relative(root, file)}`);
      if (specifier.startsWith(".") || specifier.startsWith("@/")) {
        const resolved = resolveLocal(file, specifier);
        assert(resolved, `unresolved local dependency ${specifier} from ${path.relative(root, file)}`);
        pending.push(resolved);
      }
    }
  }
  return [...visited].map((file) => path.relative(root, file).replaceAll("\\", "/"));
}
for (const entry of clientEntries) clientGraph(entry);

async function main() {
const browserBuild = async (entry: string) => build({ entryPoints: [entry], absWorkingDir: root, bundle: true, write: false, platform: "browser", format: "esm", target: "es2022", logLevel: "silent", external: ["react", "react/*", "next", "next/*"] });
await browserBuild(clientEntries[0]);
await browserBuild(clientEntries[1]);
await build({ entryPoints: ["instrumentation.ts"], absWorkingDir: root, bundle: true, write: false, platform: "browser", format: "esm", target: "es2022", logLevel: "silent", define: { "process.env.NEXT_RUNTIME": '"edge"' } });
await build({ entryPoints: ["instrumentation.ts"], absWorkingDir: root, bundle: true, write: false, platform: "node", format: "cjs", target: "node20", logLevel: "silent", external: ["server-only"], define: { "process.env.NEXT_RUNTIME": '"nodejs"' } });

const browserRequest = buildSearchV2BrowserRequest({ query: "SAP OTC Consultant Singapore", matchQuality: "relevant" });
assert.equal("profileHash" in browserRequest, false);
const profile = buildSearchExecutionProfile(browserRequest, { datasetRevision: "fixture-r1", authorizationScopeHash: "scope-a" });
assert.equal(searchV2ExecutionProfileHash(profile), searchV2ExecutionProfileHash(profile));
const route = fs.readFileSync(path.join(root, "app/api/recruiter/search-v2/route.ts"), "utf8");
assert.match(route, /const profile = buildSearchExecutionProfile/);
assert.match(route, /const profileHash = searchV2ExecutionProfileHash\(profile\)/);
assert.doesNotMatch(route, /body\.profileHash|body\[['"]profileHash['"]\]/);
const page = fs.readFileSync(path.join(root, "app/recruiter/talent-search/v2/page.tsx"), "utf8");
assert.match(page, /AI_GUIDED_SOURCING_PHASE1 === "true"/);
console.log("Search V2 client dependency and browser/instrumentation bundle tests passed");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
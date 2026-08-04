import assert from "node:assert/strict";
import fs from "node:fs";
const source=fs.readFileSync(new URL("../lib/quickFixApplySubsetExecutor.ts",import.meta.url),"utf8")+fs.readFileSync(new URL("../lib/quickFixApplySubsetAudit.ts",import.meta.url),"utf8");
assert.equal(/\.delete\(|upsert\(/i.test(source),false,"no delete calls");
assert.equal(/from ["']openai["']|new\s+OpenAI\b/i.test(source),false,"no OpenAI calls");
console.log("Quick fix apply subset audit tests passed");

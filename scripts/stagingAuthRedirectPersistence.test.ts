import assert from "node:assert/strict";
import fs from "node:fs";
import { resolvePostLoginRoute, safeRequestedAuthRoute } from "../lib/stagingAuthRedirect";
import { buildSupabaseServerCookieAdapter } from "../lib/supabaseServerCookieAdapter";

assert.equal(resolvePostLoginRoute("admin", "/recruiter/talent-search/v2"), "/recruiter/talent-search/v2");
assert.equal(resolvePostLoginRoute("recruiter", "/recruiter/talent-search/v2"), "/recruiter/talent-search/v2");
assert.equal(resolvePostLoginRoute("client", "/recruiter/talent-search/v2"), "/client/portal");
for (const unsafe of ["https://evil.invalid/x", "//evil.invalid/x", "/\\evil", "javascript:alert(1)", ""])
  assert.equal(safeRequestedAuthRoute(unsafe), null);

const persisted: Array<{name:string;value:string}> = [];
const adapter = buildSupabaseServerCookieAdapter({ getAll: () => [...persisted], set: (name, value) => { const old=persisted.findIndex(x=>x.name===name); if(old>=0)persisted.splice(old,1); persisted.push({name,value}); } });
adapter.setAll([{name:"session-a",value:"one"},{name:"session-b",value:"two"}]);
assert.deepEqual(adapter.getAll(), [{name:"session-a",value:"one"},{name:"session-b",value:"two"}]);

const server = fs.readFileSync("utils/supabase/server.ts", "utf8");
const proxy = fs.readFileSync("utils/supabase/proxy.ts", "utf8");
const form = fs.readFileSync("app/auth/staging/runtime/StagingRuntimeAuthForms.tsx", "utf8");
assert.match(server, /getAll:\s*adapter\.getAll/);
assert.match(server, /setAll\(cookiesToSet\)/);
assert.doesNotMatch(server, /\n\s*get\(name:/);
assert.match(proxy, /profile\.status !== "active"/);
assert.match(proxy, /area\.allowedRoles\.includes/);
assert.match(form, /resolvePostLoginRoute/);
console.log("staging auth redirect and cookie persistence tests passed");
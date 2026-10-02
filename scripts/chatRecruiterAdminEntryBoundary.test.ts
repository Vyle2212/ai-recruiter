import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync("app/recruiter/assigned-work/page.tsx", "utf8");
const entry = fs.readFileSync(
  "app/recruiter/assigned-work/RecruiterAdminChat.tsx",
  "utf8",
);

assert.match(page, /process\.env\.CHAT_ENABLED === "true"/);
assert.match(
  page,
  /from\("organizations"\)[\s\S]*\.select\("organization_type,status"\)/,
);
assert.match(
  page,
  /organizationResult\.data\?\.organization_type === "internal"/,
);
assert.match(page, /organizationResult\.data\.status === "active"/);
assert.match(page, /from\("user_profiles"\)[\s\S]*\.select\("id,full_name"\)/);
assert.match(page, /\.eq\("role", "admin"\)[\s\S]*\.eq\("status", "active"\)/);
assert.match(entry, /fetch\("\/api\/chat\/internal-conversations"/);
assert.match(entry, /JSON\.stringify\(\{ adminProfileId: adminId \}\)/);
assert.match(entry, /\/\^\[0-9a-f\]\{8\}/);
assert.match(entry, /\.test\([\s\S]*result\.conversationId[\s\S]*\)/);
assert.match(
  entry,
  /router\.push\(`\/chat\/\$\{encodeURIComponent\(result\.conversationId\)\}`\)/,
);

const action = entry.slice(
  entry.indexOf("async function openChat"),
  entry.indexOf("\n  return"),
);
assert.match(action, /Chat is no longer available\./);
assert.doesNotMatch(action, /active admin|organization|your account/i);
assert.doesNotMatch(action, /original.?cv|resume/i);

console.log("Recruiter admin chat entry boundary passed.");

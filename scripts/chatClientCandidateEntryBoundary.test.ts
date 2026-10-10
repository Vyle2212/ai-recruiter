import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync(
  "app/client/candidate-search/[candidateId]/page.tsx",
  "utf8",
);
const detail = fs.readFileSync(
  "app/client/candidate-search/[candidateId]/ClientCandidateDetail.tsx",
  "utf8",
);

assert.match(page, /process\.env\.CHAT_ENABLED === "true"/);
assert.match(detail, /fetch\("\/api\/chat\/conversations"/);
assert.match(detail, /JSON\.stringify\(\{ candidateId \}\)/);
assert.match(detail, /const uuid = \/\^\[0-9a-f\]\{8\}/);
assert.match(detail, /!uuid\.test\(result\.conversationId\)/);
assert.match(
  detail,
  /router\.push\(`\/chat\/\$\{encodeURIComponent\(result\.conversationId\)\}`\)/,
);
assert.doesNotMatch(detail, /verified account|agreed to contact/i);
const chatAction = detail.slice(
  detail.indexOf("async function openChat"),
  detail.indexOf("return <main"),
);
assert.doesNotMatch(chatAction, /original.?cv|resume/i);

console.log("Client candidate chat entry boundary passed.");

import assert from "node:assert/strict";
import fs from "node:fs";

import { POST } from "../app/api/parse-cv/route";

async function main() {
  const response = await POST();
  assert.equal(response.status, 410);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(await response.json(), {
    error: "Use the private CV upload page to process an original CV.",
  });

  const legacyPage = fs.readFileSync("app/upload-cv/page.tsx", "utf8");
  assert.match(legacyPage, /redirect\("\/upload"\)/);
  assert.doesNotMatch(legacyPage, /fetch\(|FormData|parse-cv|match-jobs/);

  const canonicalPage = fs.readFileSync("app/upload/page.tsx", "utf8");
  assert.match(canonicalPage, /uploadToSignedUrl/);
  assert.match(canonicalPage, /\/api\/upload-cv\/sign/);
  assert.match(canonicalPage, /\/api\/upload-cv"/);

  console.log(
    "Legacy CV upload is routed to private original-preserving ingestion",
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

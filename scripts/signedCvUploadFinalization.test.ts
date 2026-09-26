import assert from "node:assert/strict";

import { finalizePossiblyCompletedSignedCvUpload } from "../lib/signedCvUploadFinalization";

async function main() {
  let processingCalls = 0;
  let parseCalls = 0;
  const recovered = await finalizePossiblyCompletedSignedCvUpload({
    uploadError: new Error("browser lost the Storage response"),
    requestProcessing: async () => {
      processingCalls += 1;
      return new Response(JSON.stringify({ accepted: true }), { status: 200 });
    },
    parseResponse: async (response) => {
      parseCalls += 1;
      return response.json();
    },
    transferFailureMessage: "Private CV transfer failed.",
  });
  assert.deepEqual(recovered, { accepted: true });
  assert.equal(
    processingCalls,
    1,
    "an ambiguous upload must reach server verification",
  );
  assert.equal(parseCalls, 1);

  parseCalls = 0;
  await assert.rejects(
    finalizePossiblyCompletedSignedCvUpload({
      uploadError: new Error("definite or ambiguous transfer failure"),
      requestProcessing: async () =>
        new Response(JSON.stringify({ error: "not found" }), { status: 404 }),
      parseResponse: async () => {
        parseCalls += 1;
        return {};
      },
      transferFailureMessage: "Private CV transfer failed.",
    }),
    /Private CV transfer failed/,
  );
  assert.equal(
    parseCalls,
    0,
    "an absent object must not enter the parser path",
  );

  const review = await finalizePossiblyCompletedSignedCvUpload({
    uploadError: new Error("browser lost the Storage response"),
    requestProcessing: async () =>
      new Response(JSON.stringify({ reviewRequired: true }), { status: 422 }),
    parseResponse: async (response) => ({ status: response.status }),
    transferFailureMessage: "Private CV transfer failed.",
  });
  assert.deepEqual(
    review,
    { status: 422 },
    "server review outcomes must win over an ambiguous SDK error",
  );

  console.log("signedCvUploadFinalization.test.ts passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

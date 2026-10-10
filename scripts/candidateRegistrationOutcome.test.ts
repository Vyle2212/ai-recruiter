import assert from "node:assert/strict";
import { candidateRegistrationOutcome } from "../lib/candidateRegistrationOutcome";

async function main() {
  const pending = await candidateRegistrationOutcome(async () => ({
    data: { session: null },
    error: null,
  }));
  assert.deepEqual(pending, {
    status: 202,
    body: { status: "verification_pending" },
  });
  for (const status of [400, 422, 500, 429]) {
    const result = await candidateRegistrationOutcome(async () => ({
      data: { session: null },
      error: { status },
    }));
    assert.equal(result.status, status === 429 ? 429 : 503);
    assert.deepEqual(result.body, {
      error: "candidate_registration_temporarily_unavailable",
    });
  }
  const thrown = await candidateRegistrationOutcome(async () => {
    throw new Error("private provider detail");
  });
  assert.equal(thrown.status, 503);
  assert.equal(
    JSON.stringify(thrown).includes("private provider detail"),
    false,
  );
  const session = await candidateRegistrationOutcome(async () => ({
    data: { session: { access_token: "synthetic-sensitive-value" } },
    error: null,
  }));
  assert.equal(session.status, 503);
  assert.equal(
    JSON.stringify(session).includes("synthetic-sensitive-value"),
    false,
  );
  console.log("Candidate registration outcome PASS (synthetic, no Auth calls)");
}
void main();

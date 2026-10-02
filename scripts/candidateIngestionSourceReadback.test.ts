import assert from "node:assert/strict";
import {
  findCandidateForIngestedSource,
  type CandidateSourceReadback,
} from "../lib/candidateIngestionSourceReadback";

const reference =
  "candidate-original-cvs/00000000-0000-4000-8000-000000000001.txt";
const candidateA = { id: "00000000-0000-4000-8000-000000000101" };
const candidateB = { id: "00000000-0000-4000-8000-000000000102" };

function fixture(input: {
  current?: typeof candidateA | null;
  history?: string[];
  exists?: boolean;
}) {
  const calls: string[] = [];
  const readback: CandidateSourceReadback = {
    current: async () => {
      calls.push("current");
      return input.current ?? null;
    },
    completedCandidateIds: async () => {
      calls.push("history");
      return input.history ?? [];
    },
    candidateById: async (id) => {
      calls.push("candidate");
      return input.exists === false ? null : { id };
    },
  };
  return { calls, readback };
}

async function main() {
  const newSource = fixture({});
  assert.equal(
    await findCandidateForIngestedSource(reference, newSource.readback),
    null,
  );
  assert.deepEqual(newSource.calls, ["current", "history"]);

  const current = fixture({ current: candidateA, history: [candidateA.id] });
  assert.deepEqual(
    await findCandidateForIngestedSource(reference, current.readback),
    candidateA,
  );

  // A newer CV now occupies the candidate's current source_file. An older
  // completed job still links its original to the same candidate.
  const replaced = fixture({ history: [candidateA.id, candidateA.id] });
  assert.deepEqual(
    await findCandidateForIngestedSource(reference, replaced.readback),
    candidateA,
  );
  assert.deepEqual(replaced.calls, ["current", "history", "candidate"]);

  const conflicting = fixture({
    current: candidateA,
    history: [candidateB.id],
  });
  await assert.rejects(
    findCandidateForIngestedSource(reference, conflicting.readback),
    /OWNERSHIP_CONFLICT/,
  );

  const inconsistentHistory = fixture({
    history: [candidateA.id, candidateB.id],
  });
  await assert.rejects(
    findCandidateForIngestedSource(reference, inconsistentHistory.readback),
    /OWNERSHIP_CONFLICT/,
  );

  const deleted = fixture({ history: [candidateA.id], exists: false });
  await assert.rejects(
    findCandidateForIngestedSource(reference, deleted.readback),
    /CANDIDATE_MISSING/,
  );
  console.log("candidateIngestionSourceReadback.test.ts passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

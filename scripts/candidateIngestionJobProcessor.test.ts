import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  processClaimedIngestionJob,
  type ClaimedIngestionJob,
  type IngestionJobDependencies,
} from "../lib/candidateIngestionJobProcessor";

const bytes = Buffer.from(
  "Synthetic SAP implementation CV fixture, no personal data.",
);
const source =
  "candidate-original-cvs/00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000002.txt";
const job: ClaimedIngestionJob = {
  id: "00000000-0000-4000-8000-000000000003",
  actor_user_id: "00000000-0000-4000-8000-000000000001",
  source_file: source,
  original_filename: "synthetic.txt",
  content_sha256: createHash("sha256").update(bytes).digest("hex"),
  parser_revision: "cv-ingestion-v178",
  byte_size: bytes.length,
  lease_token: "00000000-0000-4000-8000-000000000004",
};

function fixture(overrides: Partial<IngestionJobDependencies> = {}) {
  const events: string[] = [];
  const deps: IngestionJobDependencies = {
    download: async () => {
      events.push("download");
      return bytes;
    },
    findBySource: async () => {
      events.push("readback");
      return null;
    },
    prepare: async () => {
      events.push("parse");
      return { accepted: true, candidatePayload: {}, needsReview: false };
    },
    save: async (_payload, reference) => {
      events.push("save");
      return {
        id: "candidate-id",
        source_file: reference,
        ingestion_action: "create_new",
      };
    },
    review: async () => {
      events.push("review");
    },
    renew: async () => {
      events.push("renew");
      return true;
    },
    finish: async (_id, _token, outcome) => {
      events.push(`finish:${outcome.status}`);
      return true;
    },
    ...overrides,
  };
  return { events, deps };
}

async function main() {
  const normal = fixture();
  assert.deepEqual(await processClaimedIngestionJob(job, normal.deps), {
    status: "completed",
    candidateId: "candidate-id",
    outcomeCode: "created",
  });
  assert.equal(normal.events.filter((event) => event === "readback").length, 2);
  assert(normal.events.indexOf("readback") < normal.events.indexOf("save"));

  const tampered = fixture({ download: async () => Buffer.from("changed") });
  assert.equal(
    (await processClaimedIngestionJob(job, tampered.deps)).status,
    "review",
  );
  assert(!tampered.events.includes("save"));

  const committed = fixture({
    findBySource: async () => ({ id: "existing-id" }),
  });
  assert.equal(
    (await processClaimedIngestionJob(job, committed.deps)).outcomeCode,
    "already_processed",
  );
  assert(!committed.events.includes("save"));

  for (const [message, reason] of [
    ["INGESTION_SOURCE_OWNERSHIP_CONFLICT", "source_history_conflict"],
    ["INGESTION_SOURCE_CANDIDATE_MISSING", "source_candidate_missing"],
    ["INGESTION_SOURCE_HISTORY_LIMIT", "source_history_conflict"],
  ]) {
    const flagged = fixture({
      findBySource: async () => {
        throw new Error(message);
      },
      review: async (_job, codes) => {
        assert.deepEqual(codes, [reason]);
      },
    });
    assert.deepEqual(await processClaimedIngestionJob(job, flagged.deps), {
      status: "review",
      outcomeCode: "source_review",
    });
    assert(!flagged.events.includes("save"));
  }

  let reads = 0;
  const wonDuringParse = fixture({
    findBySource: async () => (++reads === 2 ? { id: "other-id" } : null),
  });
  assert.equal(
    (await processClaimedIngestionJob(job, wonDuringParse.deps)).outcomeCode,
    "already_processed",
  );
  assert(!wonDuringParse.events.includes("save"));

  const lostLease = fixture({ renew: async () => false });
  await assert.rejects(
    processClaimedIngestionJob(job, lostLease.deps),
    /LEASE_LOST/,
  );
  assert(!lostLease.events.includes("save"));

  const ambiguousSave = fixture({
    save: async () => {
      throw new Error("ambiguous response");
    },
  });
  assert.equal(
    (await processClaimedIngestionJob(job, ambiguousSave.deps)).status,
    "queued",
  );
  assert(ambiguousSave.events.includes("finish:queued"));

  const badReadback = fixture({
    save: async () => ({ id: "candidate-id", source_file: "wrong-reference" }),
  });
  assert.equal(
    (await processClaimedIngestionJob(job, badReadback.deps)).status,
    "queued",
  );
  assert(!badReadback.events.includes("finish:completed"));

  const deniedAck = fixture({ finish: async () => false });
  await assert.rejects(
    processClaimedIngestionJob(job, deniedAck.deps),
    /ACK_LOST/,
  );
  assert(!deniedAck.events.includes("finish:queued"));

  console.log("candidateIngestionJobProcessor.test.ts passed");
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

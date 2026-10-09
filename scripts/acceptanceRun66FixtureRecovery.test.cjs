const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require(
  process.env.ACCEPTANCE_TYPESCRIPT_TEST_MODULE || "typescript",
);
const source = fs.readFileSync(
  "scripts/authenticatedAcceptanceSyntheticFixture.ts",
  "utf8",
);
const start = source.indexOf("async function recoverRun66FixtureLease");
const end = source.indexOf("async function deleteExact", start);
assert.ok(start >= 0 && end > start);
const runId = "ptf1c2-gh-37940009098-1";
const candidateId = "a11ce000-0000-4000-8000-00000000012a";
const expected = {
  runId,
  syntheticNamespace: "ptf1c2/" + runId,
  environmentId: "ai-recruiter-acceptance-a0123c9",
  projectRef: "iujucosewivndjpcjbuz",
  expectedCommitSha: "a".repeat(40),
  expiresAt: "2026-10-09T16:00:00Z",
};
const baseline = {
  presence: {
    registry: null,
    candidateById: true,
    candidateByMarker: true,
    indexByCandidateId: false,
  },
  run: {
    run_id: runId,
    synthetic_namespace: expected.syntheticNamespace,
    owner_hash: "86e299fb5e1494bf",
    status: "ready",
    created_at: "2026-10-09T13:55:11.848344Z",
    expires_at: "2026-10-09T15:54:53Z",
  },
  candidate: { valid: true },
  profiles: Array.from({ length: 6 }, (_, i) => ({
    entity_id: "profile-" + i,
  })),
  consents: [
    {
      candidate_id: candidateId,
      user_profile_id: "profile-0",
      updated_at: "2026-10-09T13:55:23.351Z",
    },
  ],
  events: [0, 1].map((i) => ({
    candidate_id: candidateId,
    user_profile_id: "profile-0",
    changed_at: "2026-10-09T13:55:2" + (2 + i) + "Z",
  })),
};
async function attempt(change = () => {}, expectation = expected) {
  const data = structuredClone(baseline);
  change(data);
  const inserts = [],
    flags = [];
  const context = {
    Set,
    Date,
    String,
    Number,
    ACCEPTANCE_SYNTHETIC_CANDIDATE_ID: candidateId,
    presence: async () => data.presence,
    validateAcceptanceSyntheticCandidate: (c) => ({ valid: c.valid === true }),
    acceptanceFixtureLeaseRecord: (e) => ({ ...e }),
    acceptanceFixtureState: (p, e) =>
      p.registry &&
      p.registry.run === e.runId &&
      p.registry.sha === e.expectedCommitSha &&
      p.registry.expires_at === e.expiresAt
        ? "owned_partial"
        : "foreign_active",
    githubFlag: async (...args) => flags.push(args),
  };
  vm.createContext(context);
  vm.runInContext(
    ts.transpileModule(source.slice(start, end), {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
      },
    }).outputText + ";globalThis.recover=recoverRun66FixtureLease",
    context,
  );
  const tables = {
    acceptance_test_runs: "run",
    candidates: "candidate",
    acceptance_test_entities: "profiles",
    candidate_chat_contact_consents: "consents",
    candidate_chat_contact_consent_events: "events",
  };
  const client = {
    from(table) {
      const filters = [];
      const query = {
        select() {
          return query;
        },
        eq(column, value) {
          filters.push([column, value]);
          return query;
        },
        single() {
          return query;
        },
        insert(value) {
          inserts.push({ table, value });
          return Promise.resolve({ error: data.insertError || null });
        },
        then(resolve, reject) {
          const key = tables[table];
          assert.ok(key, "unexpected read table");
          if (table === "candidates" || table.startsWith("candidate_chat_"))
            assert.ok(
              filters.some(
                ([c, v]) =>
                  c === (table === "candidates" ? "id" : "candidate_id") &&
                  v === candidateId,
              ),
            );
          else
            assert.ok(filters.some(([c, v]) => c === "run_id" && v === runId));
          if (table === "acceptance_test_entities")
            assert.ok(
              filters.some(
                ([c, v]) => c === "entity_type" && v === "user_profile",
              ),
            );
          return Promise.resolve({
            data: data[key],
            error: data.errorTable === table ? { message: "denied" } : null,
          }).then(resolve, reject);
        },
      };
      return query;
    },
  };
  let error;
  try {
    await context.recover(client, expectation);
  } catch (e) {
    error = e;
  }
  return { error, inserts, flags };
}
async function blocked(change, expectation) {
  const result = await attempt(change, expectation);
  assert.ok(result.error, "unsafe recovery was allowed");
  assert.equal(result.inserts.length, 0, "unsafe recovery mutated lease");
}
(async () => {
  let result = await attempt();
  assert.equal(result.error, undefined);
  assert.equal(result.inserts.length, 1);
  assert.equal(result.inserts[0].table, "acceptance_synthetic_candidates");
  for (const field of [
    "runId",
    "syntheticNamespace",
    "environmentId",
    "projectRef",
  ])
    await blocked(() => {}, { ...expected, [field]: "foreign" });
  for (const field of ["candidateById", "candidateByMarker"])
    await blocked((d) => {
      d.presence[field] = false;
    });
  for (const field of [
    "status",
    "synthetic_namespace",
    "owner_hash",
    "created_at",
    "expires_at",
  ])
    await blocked((d) => {
      d.run[field] = "foreign";
    });
  await blocked((d) => {
    d.candidate.valid = false;
  });
  await blocked((d) => {
    d.profiles.pop();
  });
  await blocked((d) => {
    d.profiles[1] = d.profiles[0];
  });
  for (const table of [
    "acceptance_test_runs",
    "candidates",
    "acceptance_test_entities",
    "candidate_chat_contact_consents",
    "candidate_chat_contact_consent_events",
  ])
    await blocked((d) => {
      d.errorTable = table;
    });
  for (const key of ["consents", "events"]) {
    await blocked((d) => {
      d[key].pop();
    });
    await blocked((d) => {
      d[key][0].user_profile_id = "foreign";
    });
    await blocked((d) => {
      d[key][0].candidate_id = "foreign";
    });
    const time = key === "consents" ? "updated_at" : "changed_at";
    for (const value of [
      "invalid",
      "2026-10-09T13:55:10Z",
      "2026-10-09T13:55:25Z",
    ])
      await blocked((d) => {
        d[key][0][time] = value;
      });
  }
  await blocked((d) => {
    d.presence.registry = {
      run: "foreign",
      sha: expected.expectedCommitSha,
      expires_at: expected.expiresAt,
    };
  });
  result = await attempt((d) => {
    d.presence.registry = {
      run: runId,
      sha: expected.expectedCommitSha,
      expires_at: "2026-10-09T15:30:00Z",
    };
  });
  assert.equal(result.error, undefined);
  assert.equal(result.inserts.length, 0);
  assert.equal(result.flags[0][0], "ACCEPTANCE_EXPIRES_AT");
  assert.equal(result.flags[0][1], "2026-10-09T15:30:00Z");
  result = await attempt((d) => {
    d.insertError = { message: "conflict" };
  });
  assert.ok(result.error);
  // Candidate deletion must complete before the lease can be discarded.
  const deletion = source.slice(
    end,
    source.indexOf("async function verifyCandidate", end),
  );
  assert.ok(
    deletion.indexOf('.from("candidates")') <
      deletion.indexOf('.from("acceptance_synthetic_candidates")'),
  );
  console.log("Run 66 orphan fixture recovery ownership boundaries PASS");
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

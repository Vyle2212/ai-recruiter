const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

const source = fs.readFileSync(
  "scripts/authenticatedAcceptanceProvision.ts",
  "utf8",
);
const start = source.indexOf(
  "async function cleanupAbsentChatFixtureReferences",
);
const end = source.indexOf(
  "async function verifyAbsentOriginalCvApprovalReferences",
  start,
);
assert.ok(start >= 0 && end > start);
const compiled = ts.transpileModule(
  'const ACCEPTANCE_SYNTHETIC_CANDIDATE_ID = "synthetic";\n' +
    source.slice(start, end),
  {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
    },
  },
).outputText;
const context = {};
vm.createContext(context);
vm.runInContext(
  compiled +
    ";globalThis.cleanupAbsentChatFixtureReferences=cleanupAbsentChatFixtureReferences",
  context,
);

function client(options = {}) {
  const events = [];
  const deleted = new Set();
  return {
    events,
    from(table) {
      let operation = "select";
      const filters = {};
      const query = {
        select() {
          return query;
        },
        delete() {
          operation = "delete";
          return query;
        },
        eq(key, value) {
          filters[key] = value;
          return query;
        },
        in(key, value) {
          filters[key] = value;
          return query;
        },
        then(resolve, reject) {
          if (operation === "delete") {
            events.push("delete:" + table);
            if (options.deleteError === table)
              return Promise.resolve({ error: { message: "blocked" } }).then(
                resolve,
                reject,
              );
            deleted.add(table);
            return Promise.resolve({ error: null }).then(resolve, reject);
          }
          if (table === "acceptance_synthetic_candidates")
            return Promise.resolve({
              count: options.fixtureCount ?? 0,
              error: options.fixtureError ? { message: "blocked" } : null,
            }).then(resolve, reject);
          if (options.probeError === table)
            return Promise.resolve({
              count: null,
              error: { message: "blocked" },
            }).then(resolve, reject);
          if (options.dependency === table)
            return Promise.resolve({ count: 1, error: null }).then(
              resolve,
              reject,
            );
          if (table.startsWith("candidate_chat_contact_consent")) {
            if (deleted.has(table))
              return Promise.resolve({
                count: options.residue === table ? 1 : 0,
                error: null,
              }).then(resolve, reject);
            const intersection =
              filters.user_profile_id && filters.candidate_id;
            const count = intersection
              ? (options.intersectionCount ?? 1)
              : filters.user_profile_id
                ? (options.profileCount ?? 1)
                : (options.candidateCount ?? 1);
            return Promise.resolve({ count, error: null }).then(
              resolve,
              reject,
            );
          }
          return Promise.resolve({ count: 0, error: null }).then(
            resolve,
            reject,
          );
        },
      };
      return query;
    },
  };
}

async function main() {
  const profileId = "00000000-0000-4000-8000-000000000001";
  const clean = client();
  await context.cleanupAbsentChatFixtureReferences(
    clean,
    [profileId],
    "owned-run",
  );
  assert.deepEqual(clean.events, [
    "delete:candidate_chat_contact_consent_events",
    "delete:candidate_chat_contact_consents",
  ]);

  const empty = client({
    profileCount: 0,
    candidateCount: 0,
    intersectionCount: 0,
  });
  await context.cleanupAbsentChatFixtureReferences(
    empty,
    [profileId],
    "owned-run",
  );
  assert.deepEqual(empty.events, []);

  for (const options of [
    { fixtureCount: 1 },
    { fixtureError: true },
    { dependency: "chat_messages" },
    { profileCount: 2, candidateCount: 1, intersectionCount: 1 },
    { profileCount: 1, candidateCount: 2, intersectionCount: 1 },
    { probeError: "candidate_chat_contact_consent_events" },
  ]) {
    const blocked = client(options);
    await assert.rejects(
      context.cleanupAbsentChatFixtureReferences(
        blocked,
        [profileId],
        "owned-run",
      ),
    );
    assert.deepEqual(blocked.events, []);
  }

  const deleteFailure = client({
    deleteError: "candidate_chat_contact_consent_events",
  });
  await assert.rejects(
    context.cleanupAbsentChatFixtureReferences(
      deleteFailure,
      [profileId],
      "owned-run",
    ),
  );
  assert.deepEqual(deleteFailure.events, [
    "delete:candidate_chat_contact_consent_events",
  ]);

  const residue = client({
    residue: "candidate_chat_contact_consent_events",
  });
  await assert.rejects(
    context.cleanupAbsentChatFixtureReferences(
      residue,
      [profileId],
      "owned-run",
    ),
  );
  assert.deepEqual(residue.events, [
    "delete:candidate_chat_contact_consent_events",
  ]);

  await assert.rejects(
    context.cleanupAbsentChatFixtureReferences(client(), [], "owned-run"),
  );
  console.log("Missing fixture bounded chat cleanup contracts PASS");
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

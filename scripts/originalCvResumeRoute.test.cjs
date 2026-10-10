const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

const source = fs.readFileSync("app/api/candidate360/[candidateId]/resume/route.ts", "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const candidateId = "11111111-1111-4111-8111-111111111111";
const bytes = Buffer.from("Synthetic original CV bytes\nSAP FICO", "utf8");
const headers = { "Cache-Control": "private, no-store" };

async function invoke(options = {}) {
  const events = [];
  const client = {
    from(table) {
      const query = {
        select() { return query; },
        eq() { return query; },
        async maybeSingle() {
          assert.equal(table, "candidates");
          events.push("candidate-read");
          return { data: { source_file: "candidate-original-cvs/synthetic.txt", status: "active" }, error: null };
        },
        async insert(row) {
          assert.equal(table, "recruiter_original_cv_access_events");
          assert.equal(row.candidate_id, candidateId);
          assert.equal(row.actor_role, "admin");
          assert.equal(row.purpose, "administration");
          assert.equal(row.grant_id, null);
          events.push("audit-insert");
          return { error: options.auditError ? { message: "synthetic failure" } : null };
        },
      };
      return query;
    },
    storage: { from(bucket) {
      assert.equal(bucket, "candidate-original-cvs");
      return { async download(key) {
        assert.equal(key, "synthetic.txt");
        events.push("private-download");
        return { data: options.storageError ? null : new Blob([bytes]), error: options.storageError ? { status: 503 } : null };
      } };
    } },
  };
  const modules = {
    "@/lib/recruiterSearchAuthorization": {
      recruiterSearchPrivateNoStoreHeaders: headers,
      requireRecruiterSearchAuthorization: async () => options.denied
        ? { allowed: false }
        : { allowed: true, scope: { role: "admin", profileId: "synthetic-admin" } },
      recruiterSearchAuthorizationDenied: () => Response.json({ error: "unauthorized" }, { status: 401, headers }),
    },
    "@/lib/runtimeClients": { createLazySupabaseServiceClient: () => client },
    "@/lib/originalCvAccess": { originalCvReadGrant: () => ({ objectKey: "synthetic.txt", contentType: "text/plain; charset=utf-8", disposition: 'inline; filename="candidate-cv.txt"' }) },
    "@/lib/originalCvArchiveKey": { ORIGINAL_CV_BUCKET: "candidate-original-cvs" },
    "@/lib/originalCvStorageRead": { originalCvStorageReadStatus: () => 503 },
    "@/lib/recruiterOriginalCvPolicy": { recruiterOriginalCvAllowed: () => false, recruiterOriginalCvCandidateAvailable: () => true },
  };
  const exports = {};
  const context = { exports, Response, Blob, require(name) {
    assert.ok(modules[name], `Unexpected dependency ${name}`);
    return modules[name];
  } };
  vm.runInNewContext(compiled, context);
  const response = await exports.GET(new Request("https://acceptance.example/api/resume"), {
    params: Promise.resolve({ candidateId: options.invalidId ? "invalid" : candidateId }),
  });
  return { response, events };
}

(async () => {
  const success = await invoke();
  assert.equal(success.response.status, 200);
  assert.deepEqual(Buffer.from(await success.response.arrayBuffer()), bytes);
  assert.equal(success.response.headers.get("content-type"), "text/plain; charset=utf-8");
  assert.equal(success.response.headers.get("content-disposition"), 'inline; filename="candidate-cv.txt"');
  assert.equal(success.response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(success.response.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(success.events, ["candidate-read", "private-download", "audit-insert"]);

  const auditFailure = await invoke({ auditError: true });
  assert.equal(auditFailure.response.status, 503);
  assert.deepEqual(await auditFailure.response.json(), { error: "original_cv_audit_unavailable" });
  assert.equal(auditFailure.response.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(auditFailure.events, ["candidate-read", "private-download", "audit-insert"]);

  const storageFailure = await invoke({ storageError: true });
  assert.equal(storageFailure.response.status, 503);
  assert.deepEqual(await storageFailure.response.json(), { error: "original_cv_storage_unavailable" });
  assert.deepEqual(storageFailure.events, ["candidate-read", "private-download"]);

  for (const [options, status] of [[{ denied: true }, 401], [{ invalidId: true }, 400]]) {
    const result = await invoke(options);
    assert.equal(result.response.status, status);
    assert.deepEqual(result.events, []);
  }
  console.log("Original CV route byte integrity, private headers and audit failure boundaries passed.");
})().catch((error) => { console.error(error); process.exitCode = 1; });

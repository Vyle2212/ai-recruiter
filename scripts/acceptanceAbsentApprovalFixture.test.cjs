const assert = require("node:assert/strict");
const fs = require("node:fs"),
  vm = require("node:vm");
const ts = require(
  process.env.ACCEPTANCE_TYPESCRIPT_TEST_MODULE || "typescript",
);
const src = fs.readFileSync(
  "scripts/authenticatedAcceptanceProvision.ts",
  "utf8",
);
const start = src.indexOf(
  "async function verifyAbsentOriginalCvApprovalReferences",
);
const end = src.indexOf("async function verifyDatabaseMarker", start);
assert.ok(start >= 0 && end > start);
const js = ts.transpileModule(src.slice(start, end), {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.CommonJS,
  },
}).outputText;
const ctx = {};
vm.createContext(ctx);
vm.runInContext(
  js + ";globalThis.verify=verifyAbsentOriginalCvApprovalReferences",
  ctx,
);
function client(bad = -1, kind = "row") {
  let i = -1;
  return {
    from() {
      const q = {
        select() {
          return q;
        },
        eq() {
          return q;
        },
        in() {
          return q;
        },
        then(resolve, reject) {
          i++;
          return Promise.resolve({
            count: i === bad ? (kind === "null" ? null : 1) : 0,
            error:
              i === bad && kind === "error" ? { message: "blocked" } : null,
          }).then(resolve, reject);
        },
      };
      return q;
    },
  };
}
(async () => {
  await ctx.verify(client(), ["owned"], "run");
  await assert.rejects(ctx.verify(client(), [], "run"));
  for (let i = 0; i < 9; i++)
    for (const kind of ["row", "null", "error"])
      await assert.rejects(ctx.verify(client(i, kind), ["owned"], "run"));
  console.log(
    "Missing fixture approval cleanup zero-reference boundaries PASS",
  );
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});

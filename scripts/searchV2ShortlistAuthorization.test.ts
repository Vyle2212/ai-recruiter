import assert from "node:assert/strict";
import Module from "node:module";

const loader = Module as unknown as {
  _load: (request: string, parent: unknown, isMain: boolean) => unknown;
};
const original = loader._load;
loader._load = function (request, parent, isMain) {
  if (request === "server-only") return {};
  return original.call(this, request, parent, isMain);
};

async function main() {
  const { setRecruiterApiAuthorizationResolverForTests } = await import(
    "../lib/recruiterApiAuthorization"
  );
  const {
    GET,
    POST,
    DELETE: remove,
  } = await import("../app/api/recruiter/search-v2/shortlist/route");
  let authorized = 0;
  setRecruiterApiAuthorizationResolverForTests(async () => ({
    allowed: false,
    status: 403,
    code: "permission_required",
  }));
  try {
    const base = "http://localhost/api/recruiter/search-v2/shortlist";
    const get = await GET(new Request(base));
    assert.equal(get.status, 403);
    const body = () => {
      authorized++;
      throw new Error("Denied requests must not parse input");
    };
    for (const [method, handler] of [
      ["POST", POST],
      ["DELETE", remove],
    ] as const) {
      const request = new Request(base, {
        method,
        headers: {
          "content-type": "application/json",
          origin: "http://localhost",
        },
        body: JSON.stringify({
          candidateId: "00000000-0000-4000-8000-000000000001",
        }),
      });
      Object.defineProperty(request, "json", { value: body });
      const response = await handler(request);
      assert.equal(response.status, 403);
    }
    assert.equal(authorized, 0);
  } finally {
    setRecruiterApiAuthorizationResolverForTests(null);
  }
  console.log("Search V2 shortlist authorization boundary passed");
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

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

    // Exercise the real Supabase HTTP adapter with synthetic responses. New
    // inserts need no verification GET, while ignored duplicates must still
    // verify current organization ownership before reporting success.
    const oldFetch = globalThis.fetch;
    const oldUrl = process.env.SUPABASE_URL;
    const oldKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.SUPABASE_URL = "https://shortlist-fixture.invalid";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "synthetic-test-key";
    const candidateId = "00000000-0000-4000-8000-000000000001";
    const organizationId = "00000000-0000-4000-8000-000000000002";
    const { RECRUITER_API_SECURITY_VERSION } = await import(
      "../lib/recruiterApiPolicyRegistry"
    );
    setRecruiterApiAuthorizationResolverForTests(async () => ({
      allowed: true,
      scope: {
        version: RECRUITER_API_SECURITY_VERSION,
        subjectId: "synthetic-user",
        profileId: "synthetic-profile",
        role: "recruiter",
        organizationId,
        cacheKey: "synthetic-scope",
      },
    }));
    let duplicate = false;
    let owned = false;
    const calls: string[] = [];
    globalThis.fetch = async (input, init) => {
      const url = new URL(String(input));
      const method = init?.method || "GET";
      calls.push(`${method} ${url.pathname}`);
      if (url.pathname.endsWith("/candidates"))
        return Response.json([
          { id: candidateId, status: "candidate_confirmed" },
        ]);
      assert.ok(url.pathname.endsWith("/recruiter_search_shortlist_items"));
      if (method === "POST") {
        assert.match(
          new Headers(init?.headers).get("prefer") || "",
          /resolution=ignore-duplicates/,
        );
        return Response.json(
          duplicate
            ? null
            : { candidate_id: candidateId, organization_id: organizationId },
        );
      }
      assert.equal(
        url.searchParams.get("owner_profile_id"),
        "eq.synthetic-profile",
      );
      assert.equal(
        url.searchParams.get("organization_id"),
        `eq.${organizationId}`,
      );
      return Response.json(owned ? [{ candidate_id: candidateId }] : []);
    };
    const saveRequest = () =>
      new Request(base, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost",
        },
        body: JSON.stringify({ candidateId }),
      });
    try {
      assert.equal((await POST(saveRequest())).status, 200);
      assert.equal(
        calls.length,
        2,
        "A new save should use one eligibility read and one insert",
      );
      calls.length = 0;
      duplicate = true;
      assert.equal(
        (await POST(saveRequest())).status,
        409,
        "Old organization duplicates must remain rejected",
      );
      assert.equal(
        calls.length,
        3,
        "Duplicates must retain the scoped ownership read",
      );
      owned = true;
      assert.equal(
        (await POST(saveRequest())).status,
        200,
        "Owned duplicates remain idempotent",
      );
    } finally {
      globalThis.fetch = oldFetch;
      if (oldUrl === undefined) delete process.env.SUPABASE_URL;
      else process.env.SUPABASE_URL = oldUrl;
      if (oldKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      else process.env.SUPABASE_SERVICE_ROLE_KEY = oldKey;
    }
  } finally {
    setRecruiterApiAuthorizationResolverForTests(null);
  }
  console.log("Search V2 shortlist authorization boundary passed");
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

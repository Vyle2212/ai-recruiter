import assert from "node:assert/strict";

import {
  getProtectedPortalArea,
  isPublicPortalRoute,
  shouldProtectPortal,
} from "../utils/supabase/proxy";

const protectedCases = [
  ["/admin", "/admin", ["admin"]],
  ["/admin/portal", "/admin", ["admin"]],
  [
    "/admin/staging-readiness",
    "/admin",
    ["admin"],
  ],
  [
    "/recruiter/dashboard",
    "/recruiter",
    ["admin", "recruiter_manager", "recruiter"],
  ],
  [
    "/recruiter/jobs",
    "/recruiter",
    ["admin", "recruiter_manager", "recruiter"],
  ],
  ["/client/portal", "/client", ["client"]],
  [
    "/client/candidates/example-id",
    "/client",
    ["client"],
  ],
  [
    "/candidate/portal",
    "/candidate",
    ["candidate"],
  ],
] as const;

for (const [pathname, prefix, allowedRoles] of protectedCases) {
  assert.equal(
    shouldProtectPortal(pathname),
    true,
    `${pathname} should be protected`,
  );

  const area = getProtectedPortalArea(pathname);

  assert.ok(area, `${pathname} should resolve a protected area`);
  assert.equal(area.prefix, prefix);
  assert.deepEqual(area.allowedRoles, [...allowedRoles]);
}

const publicCases = [
  "/",
  "/auth/login",
  "/auth/staging/runtime",
  "/client/portal/preview",
  "/client/portal/preview/example",
  "/candidate/self-confirm/example-id",
];

for (const pathname of publicCases) {
  assert.equal(
    shouldProtectPortal(pathname),
    false,
    `${pathname} should remain public`,
  );

  assert.equal(
    getProtectedPortalArea(pathname),
    undefined,
    `${pathname} should not resolve a protected area`,
  );
}

assert.equal(
  isPublicPortalRoute("/client/portal/preview"),
  true,
);

assert.equal(
  isPublicPortalRoute(
    "/candidate/self-confirm/example-id",
  ),
  true,
);

assert.equal(
  isPublicPortalRoute("/client/portal"),
  false,
);

assert.equal(
  isPublicPortalRoute("/candidate/portal"),
  false,
);

console.log("portalRouteGuards.test.ts passed");
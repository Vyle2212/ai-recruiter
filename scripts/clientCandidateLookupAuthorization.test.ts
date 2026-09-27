import assert from "node:assert/strict";
import { activeClientSearchEntitlement } from "../lib/clientCandidateLookupAuthorization";

const now = Date.parse("2026-09-27T08:00:00Z");
const feature = { status: "active", valid_from: "2026-09-26T00:00:00Z", valid_until: "2026-09-28T00:00:00Z" };
assert.equal(activeClientSearchEntitlement(feature, now), true);
assert.equal(activeClientSearchEntitlement({ ...feature, status: "revoked" }, now), false);
assert.equal(activeClientSearchEntitlement({ ...feature, valid_from: "2026-09-28T00:00:00Z" }, now), false);
assert.equal(activeClientSearchEntitlement({ ...feature, valid_until: "2026-09-27T08:00:00Z" }, now), false);
assert.equal(activeClientSearchEntitlement({ ...feature, valid_until: null }, now), true);
assert.equal(activeClientSearchEntitlement({ ...feature, valid_from: "invalid" }, now), false);
assert.equal(activeClientSearchEntitlement({ ...feature, valid_until: "invalid" }, now), false);
assert.equal(activeClientSearchEntitlement(null, now), false);
console.log("Client candidate lookup entitlement boundaries passed");

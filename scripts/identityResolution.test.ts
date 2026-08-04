import { dedupeByCanonicalIdentity } from "../lib/identityResolution";
function assert(condition: unknown, message: string) { if (!condition) throw new Error(message); }
const rows = [
  { id: "a", name: "Lim Soo Ying", email: "lim@example.com", current_company: "Malaysia Airports" },
  { id: "b", name: "Lim So Ying Original", email: "lim@example.com", current_company: "Malaysia Airports" },
];
assert(dedupeByCanonicalIdentity(rows).length === 1, "Email duplicate should merge to one canonical identity");
console.log("Identity resolution tests passed");

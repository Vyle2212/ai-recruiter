import { buildCanonicalCandidateProfile } from "../lib/canonicalCandidateProfile";
function assert(condition: unknown, message: string) { if (!condition) throw new Error(message); }
const profile = buildCanonicalCandidateProfile({ name: "Technology Consulting", current_company: "Current Location" });
assert(!profile.allowedForExecutiveExport, "Invalid parser output must be excluded from client PDF export");
console.log("PDF export quality tests passed");

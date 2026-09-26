import assert from "node:assert/strict";
import { extractCandidateName } from "../lib/cv-parser";

assert.equal(
  extractCandidateName(
    "CURRICULUM VITAE\nMaya Lestari\nSAP MM Consultant\nEmail: alias.123@example.com",
    "cv.pdf",
  ),
  "Maya Lestari",
);
assert.equal(
  extractCandidateName(
    "NINA GARCIA\nSAP FICO Consultant\nEmail: office.team@example.com",
    "cv.pdf",
  ),
  "Nina Garcia",
);
assert.equal(
  extractCandidateName(
    "Candidate Name: Elena Cruz\nEmail: someone.else@example.com",
    "cv.pdf",
  ),
  "Elena Cruz",
);
assert.equal(
  extractCandidateName(
    "Candidate Name\nElena Cruz\nEmail: alias@example.com",
    "cv.pdf",
  ),
  "Elena Cruz",
);

console.log("CV name source boundaries passed");

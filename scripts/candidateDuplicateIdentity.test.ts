import assert from "node:assert/strict";
import { classifyCandidateDuplicate, duplicateDocumentHash, normalizeDuplicatePhone, normalizeDuplicateProfileUrl, resolveConfirmedCandidateIds } from "../lib/candidateDuplicateIdentity";
import { dedupeCandidateSearchV2Documents } from "../lib/candidateSearchV2Projection";
import { isPlausibleCandidateName } from "../lib/candidate360SchemaNormalize";
import { nameRejectReason } from "../lib/cvExtractionValidator";

const record = (id: string, extra: Record<string, unknown> = {}) => ({ id, ...extra });
assert.equal(classifyCandidateDuplicate(record("a", { email: " Person@Example.com " }), record("b", { email: "person@example.com" })).classification, "confirmed");
assert.equal(normalizeDuplicatePhone("+60 12-345 6789"), normalizeDuplicatePhone("0060 (12) 345-6789"));
assert.equal(classifyCandidateDuplicate(record("a", { phone: "+60 12-345 6789" }), record("b", { phone: "0060 (12) 345-6789" })).classification, "confirmed");
assert.notEqual(normalizeDuplicatePhone("012-3456789"), normalizeDuplicatePhone("+60 12-3456789"), "ambiguous local and international numbers must not be equated");
assert.equal(normalizeDuplicateProfileUrl("https://WWW.LinkedIn.com/in/Jane-Doe/?utm_source=x"), "linkedin.com/in/jane-doe");
assert.equal(classifyCandidateDuplicate(record("a", { linkedinUrl: "linkedin.com/in/jane-doe" }), record("b", { profileUrl: "https://www.linkedin.com/in/Jane-Doe/?trk=cv" })).classification, "confirmed");

assert.equal(classifyCandidateDuplicate(record("a", { name: "Alex Tan" }), record("b", { name: "Alex Tan" })).classification, "distinct");
assert.equal(classifyCandidateDuplicate(record("a", { name: "Alex Tan", employment: ["Company A|Engineer"] }), record("b", { name: "Alex Tan", employment: ["Company B|Accountant"] })).classification, "distinct");
assert.equal(classifyCandidateDuplicate(
  record("a", { name: "Alex Tan", employment: ["Acme|Engineer"], education: ["University A|BSc"] }),
  record("b", { name: "Alex Tan", employment: ["Acme|Engineer"], education: ["University A|BSc"] }),
).classification, "probable_review");

const cv1 = "Jane Doe senior engineer at Distinctive Systems from 2018 to 2024 university degree certification cloud architecture delivery leadership migration testing operations stakeholder workshops implementation support integration analytics procurement finance reporting governance";
const cv2 = "Jane Doe senior engineer at Distinctive Systems from 2018 to 2024 university degree certification cloud architecture delivery leadership migration testing operations stakeholder workshops implementation support integration analytics procurement finance reporting governance updated";
const versions = resolveConfirmedCandidateIds([record("cv1", { name: "Jane Doe", rawText: cv1 }), record("cv2", { name: "Jane Doe", rawText: cv2 })]);
assert.deepEqual(versions.canonicalById.get("cv1")?.sourceIds, ["cv1", "cv2"]);
assert.equal(classifyCandidateDuplicate(record("a", { rawText: cv1 }), record("b", { rawText: cv1 })).documentDuplicate, true);
assert.equal(duplicateDocumentHash(cv1), duplicateDocumentHash(cv1));
assert.equal(resolveConfirmedCandidateIds([record("u1", { name: "Name unavailable" }), record("u2", { name: "Name unavailable" })]).canonicalById.get("u1")?.sourceIds.length, 1);

assert.equal(isPlausibleCandidateName("Customer Request"), false);
assert.match(nameRejectReason("Customer Request"), /section_heading/);
for (const heading of ["Accurate Information.", "Enhancements And Reports", "Release Strategy In Procurement..."]) assert.equal(isPlausibleCandidateName(heading), false);

const deduped = dedupeCandidateSearchV2Documents([
  { candidateId: "source-a", canonicalCandidateId: "person-1", candidateName: "Jane Doe", currentTitle: "SAP MM Consultant", skills: ["MM"], evidence: [{ label: "source", value: "a" }] },
  { candidateId: "source-b", canonicalCandidateId: "person-1", candidateName: "Jane Doe", currentTitle: "SAP MM Lead", skills: ["MM", "Ariba"], evidence: [{ label: "source", value: "b" }] },
]);
assert.equal(deduped.documents.length, 1);
assert.deepEqual(deduped.documents[0].sourceCandidateIds, ["source-a", "source-b"]);
assert.equal(deduped.documents[0].evidence?.length, 2, "source provenance must survive suppression");

console.log("candidateDuplicateIdentity.test.ts passed");

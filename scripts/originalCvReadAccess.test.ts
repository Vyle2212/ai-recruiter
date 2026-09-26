import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { originalCvReadGrant } from "../lib/originalCvAccess";

const id = "11111111-1111-4111-8111-111111111111";
const reference = `candidate-original-cvs/${id}.pdf`;
assert.equal(originalCvReadGrant("client", reference), null);
assert.equal(originalCvReadGrant("recruiter", reference), null);
assert.equal(originalCvReadGrant("admin", "https://example.com/cv.pdf"), null);
assert.equal(
  originalCvReadGrant("admin", "candidate-original-cvs/../secret.pdf"),
  null,
);
assert.deepEqual(originalCvReadGrant("admin", reference), {
  objectKey: `${id}.pdf`,
  contentType: "application/pdf",
  disposition: 'inline; filename="candidate-cv.pdf"',
});
assert.equal(
  originalCvReadGrant("admin", `candidate-original-cvs/${id}.docx`)
    ?.disposition,
  'attachment; filename="candidate-cv.docx"',
);

const route = readFileSync(
  "app/api/candidate360/[candidateId]/resume/route.ts",
  "utf8",
);
assert.ok(
  route.indexOf('scope.role !== "admin"') <
    route.indexOf('.from("candidates")'),
);
assert.match(route, /\.select\("source_file"\)/);
assert.match(route, /\.from\(ORIGINAL_CV_BUCKET\)/);
assert.match(route, /"X-Content-Type-Options": "nosniff"/);
assert.doesNotMatch(route, /getPublicUrl|createSignedUrl/);
console.log("originalCvReadAccess.test.ts passed");

import assert from "node:assert/strict";
import { buildGuidedSourceSegments, resolveGuidedEvidenceSegments } from "../lib/guidedSourcingEvidence";
import { GUIDED_SOURCING_SCHEMA_VERSION } from "../lib/guidedSourcingTypes";
import { validateGuidedSourcingPlan } from "../lib/guidedSourcingValidation";

const source = "Role: Senior SAP Finance Consultant\n• Configure FI-GL, AP, AR, AA and SAP S/4HANA.\n• Delivered two end-to-end implementations.\n• Finance data migra-\ntion covered master and transactional data.\n• Japan-specific financial, tax, reporting, legal and statutory requirements.\n• Supported pre-sales, proposal development, solutioning and client presentations.\n• Ofﬁce punctuation uses Unicode — and a soft\u00adhyphen.";
const segments = buildGuidedSourceSegments(source);
assert(segments.length >= 6);
assert(segments.every((segment) => source.slice(segment.start, segment.end) === segment.original));
assert.deepEqual(buildGuidedSourceSegments(source).map((segment) => segment.id), segments.map((segment) => segment.id));
const matching = (pattern: RegExp) => segments.filter((segment) => pattern.test(segment.normalized)).map((segment) => segment.id);
const modelPlan = {
  schemaVersion: GUIDED_SOURCING_SCHEMA_VERSION,
  criteria: [
    { id: "finance", type: "must_have", value: "SAP Finance configuration covering FI-GL, AP, AR, AA and S/4HANA", evidenceSegmentIds: matching(/fi-gl/), reason: "Core finance configuration", confidence: 0.98, status: "proposed", ambiguityExplanation: null, taxonomyConceptId: null },
    { id: "delivery", type: "must_have", value: "End-to-end implementation and finance data migration", evidenceSegmentIds: [...matching(/end-to-end/), ...matching(/migration/)], reason: "Delivery experience", confidence: 0.95, status: "proposed", ambiguityExplanation: null, taxonomyConceptId: null },
    { id: "japan", type: "must_have", value: "Japan-specific financial and statutory requirements", evidenceSegmentIds: matching(/japan-specific/), reason: "Local finance context", confidence: 0.96, status: "proposed", ambiguityExplanation: null, taxonomyConceptId: null },
    { id: "presales", type: "nice_to_have", value: "Pre-sales and proposal experience", evidenceSegmentIds: matching(/pre-sales/), reason: "Client-facing contribution", confidence: 0.93, status: "proposed", ambiguityExplanation: null, taxonomyConceptId: null },
  ],
};
const validated = validateGuidedSourcingPlan(modelPlan, source, segments);
assert.equal(validated.ok, true);
if (!validated.ok) throw new Error("segment evidence validation failed");
assert.equal(validated.plan.criteria.filter((item) => item.status === "unresolved").length, 0);
for (const criterion of validated.plan.criteria) {
  assert(criterion.supportingExcerpt);
  assert(criterion.evidenceSegmentIds?.length);
  for (const excerpt of criterion.supportingExcerpt.split("\n\n")) assert(source.includes(excerpt));
}
const invented = structuredClone(modelPlan);
invented.criteria[0].evidenceSegmentIds = ["S999-deadbe"];
assert.equal(validateGuidedSourcingPlan(invented, source, segments).ok, false);
const otherSegments = buildGuidedSourceSegments("An unrelated selected source.");
assert.equal(resolveGuidedEvidenceSegments(modelPlan.criteria[0].evidenceSegmentIds, otherSegments).ok, false);
const unsupported = structuredClone(modelPlan);
unsupported.criteria[0].value = "Invented BlueBanana payroll requirement";
assert.equal(validateGuidedSourcingPlan(unsupported, source, segments).ok, false);
assert(segments.some((segment) => /migration/.test(segment.normalized)));
assert(segments.some((segment) => /office punctuation uses unicode/.test(segment.normalized)));
assert(segments.some((segment) => /softhyphen/.test(segment.normalized)));
console.log("guided source-segment evidence tests passed");

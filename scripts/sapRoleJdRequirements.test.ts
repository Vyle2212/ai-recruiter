import assert from "node:assert/strict";
import { validateGuidedSourcingPlan } from "../lib/guidedSourcingValidation";
import { GUIDED_SOURCING_SCHEMA_VERSION } from "../lib/guidedSourcingTypes";

// Preserve the separate experience thresholds in the supplied TM lead JD.
const tmBrief =
  "SAP TM Lead - Manager. 8+ years of SAP consulting experience. 5+ years of SAP TM/TMS implementation experience.";
const tmPlan = validateGuidedSourcingPlan(
  {
    schemaVersion: GUIDED_SOURCING_SCHEMA_VERSION,
    criteria: [
      {
        id: "sap-years",
        type: "minimum_years",
        value: "8",
        supportingExcerpt: "8+ years of SAP consulting experience",
        reason: "Overall SAP tenure",
        confidence: 0.98,
        status: "proposed",
      },
      {
        id: "tm-years",
        type: "minimum_years",
        value: "5",
        supportingExcerpt: "5+ years of SAP TM/TMS implementation experience",
        reason: "Module delivery tenure",
        confidence: 0.98,
        status: "proposed",
      },
    ],
  },
  tmBrief,
);
assert.ok(tmPlan.ok);
if (tmPlan.ok) {
  assert.equal(
    tmPlan.plan.criteria.find((x) => x.id === "sap-years")?.value,
    "8",
  );
  const scoped = tmPlan.plan.criteria.find((x) => x.id === "tm-years");
  assert.equal(scoped?.type, "must_have");
  assert.equal(scoped?.value, "SAP TM/TMS implementation — minimum 5 years");
}
const rangeBrief =
  "SAP FSCM Consultant: Minimum 5-8 years of SAP consulting experience.";
const rangePlan = validateGuidedSourcingPlan(
  {
    schemaVersion: GUIDED_SOURCING_SCHEMA_VERSION,
    criteria: [
      {
        id: "range",
        type: "minimum_years",
        value: "5",
        supportingExcerpt: "Minimum 5-8 years of SAP consulting experience",
        reason: "Experience range",
        confidence: 0.9,
        status: "proposed",
      },
    ],
  },
  rangeBrief,
);
assert.ok(rangePlan.ok);
if (rangePlan.ok) assert.equal(rangePlan.plan.criteria[0].status, "unresolved");
const preferredScope = validateGuidedSourcingPlan(
  {
    schemaVersion: GUIDED_SOURCING_SCHEMA_VERSION,
    criteria: [
      {
        id: "pref",
        type: "preferred_years",
        value: "5",
        supportingExcerpt:
          "5 years of SAP TRM implementation experience preferred",
        reason: "Preference",
        confidence: 0.9,
        status: "proposed",
      },
    ],
  },
  "5 years of SAP TRM implementation experience preferred",
);
assert.ok(preferredScope.ok);
if (preferredScope.ok) {
  assert.equal(preferredScope.plan.criteria[0].type, "nice_to_have");
  assert.equal(
    preferredScope.plan.criteria[0].value,
    "SAP TRM implementation — preferred 5 years",
  );
}

console.log("SAP JD requirements: scoped years, ranges and preferences passed");

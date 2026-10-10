import assert from "node:assert/strict";
import { extractSapTaskSpecializations as read } from "../lib/sapTaskSpecializations";
import { enrichCandidateUpload } from "../lib/candidateUploadEnrichment";
assert.deepEqual(
  read("Configured SAP FSCM credit segments and credit exposure using UKM000."),
  [
    {
      module: "FSCM",
      specialization: "Credit Management",
      involvement: "delivery",
    },
  ],
);
assert.deepEqual(
  read("Implemented SAP collections management and dispute cases."),
  [
    {
      module: "FSCM",
      specialization: "Collections Management",
      involvement: "delivery",
    },
    {
      module: "FSCM",
      specialization: "Dispute Management",
      involvement: "delivery",
    },
  ],
);
assert.deepEqual(
  read(
    "Configured SAP TM charge calculation, rate tables and freight settlement documents.",
  ),
  [
    {
      module: "TM",
      specialization: "Charge Calculation",
      involvement: "delivery",
    },
    {
      module: "TM",
      specialization: "Freight Settlement",
      involvement: "delivery",
    },
  ],
);
assert.equal(
  read("Configured SAP TM transportation cockpit and carrier selection.")[0]
    .specialization,
  "Transportation Planning",
);
assert.equal(
  read("Configured SAP TM freight order management.")[0].specialization,
  "Transportation Execution",
);
for (const text of [
  "SAP FICO Consultant",
  "SAP TM Consultant",
  "Credit manager at a bank; used Microsoft Dynamics credit exposure.",
  "Talent management (TM) in SAP SuccessFactors.",
  "No experience in SAP FSCM collections management.",
  "Configured SAP SD pricing rate tables and calculation sheets.",
])
  assert.deepEqual(read(text), []);
assert.equal(
  read(
    "SAP FI consultant integrated accounts receivable with collections management.",
  )[0].involvement,
  "integration",
);
assert.equal(
  read("End-user processed SAP dispute cases.")[0].involvement,
  "end_user",
);
assert.equal(
  read("Completed training in SAP TM freight settlement.")[0].involvement,
  "exposure",
);
const direct = enrichCandidateUpload(
  {},
  "Configured SAP FSCM credit segments.",
);
assert.ok(direct.skills.includes("SAP FSCM: Credit Management"));
const integration = enrichCandidateUpload(
  {},
  "Integrated SAP FI with collections management.",
);
assert.equal(
  integration.skills.includes("SAP FSCM: Collections Management"),
  false,
);
assert.ok(
  integration.sap_task_evidence.some(
    (x: any) => x.involvement === "integration",
  ),
);
console.log(
  "SAP task specialties: delivery vs integration/end-user/training evidence passed",
);

assert.deepEqual(
  read(
    "Configured classic SAP SD credit management using credit control areas and FD32.",
  ),
  [],
);
assert.deepEqual(
  read("SAP TM configuration of freight settlement only.").map(
    (x) => x.specialization,
  ),
  ["Freight Settlement"],
);

assert.equal(
  read(
    "ABAP developer developed a BAdI enhancement for SAP FSCM credit management.",
  )[0].involvement,
  "technical_delivery",
);
assert.equal(
  read("End-user configured personal SAP TM transportation cockpit views.")[0]
    .involvement,
  "end_user",
);
const technical = enrichCandidateUpload(
  {},
  "ABAP developer developed a BAdI enhancement for SAP FSCM credit management.",
);
assert.ok(technical.skills.includes("SAP FSCM: Credit Management (technical)"));
assert.equal(technical.skills.includes("SAP FSCM: Credit Management"), false);

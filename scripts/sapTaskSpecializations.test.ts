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
  "Configured SAP SD credit management.",
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

// JD domain requirements are separate capabilities, never implied by FSCM
// or by working with Finance/Treasury stakeholders alone.
assert.deepEqual(
  read("SAP FSCM consultant working with CFOs and treasurers."),
  [],
);
assert.deepEqual(
  read("Configured SAP TRM debt management and hedge accounting.").map((x) => [
    x.module,
    x.specialization,
    x.involvement,
  ]),
  [
    ["TRM", "Debt and Investment Management", "delivery"],
    ["TRM", "Financial Risk and Hedging", "delivery"],
  ],
);
assert.deepEqual(
  read(
    "Configured SAP Cash Management cash positions and liquidity planning.",
  ).map((x) => [x.module, x.specialization]),
  [
    ["CASH_MANAGEMENT", "Cash Visibility and Bank Accounts"],
    ["CASH_MANAGEMENT", "Liquidity Planning and Forecasting"],
  ],
);
assert.equal(
  read("Integrated SAP Cash Management liquidity planning with SAP TRM.")[0]
    .involvement,
  "integration",
);
assert.equal(
  read("End-user used SAP Cash Management cash positions.")[0].involvement,
  "end_user",
);
assert.deepEqual(
  read("Configured SAP FI hedge accounting and securities."),
  [],
);
assert.deepEqual(
  read(
    "Treasurer managed financial instruments and liquidity forecasting in Excel.",
  ),
  [],
);
assert.deepEqual(read("Configured SAP MM procurement tendering."), []);
assert.ok(
  read("Configured SAP TM carrier management and tendering.").some(
    (x) =>
      x.specialization === "Carrier Management and Tendering" &&
      x.involvement === "delivery",
  ),
);
assert.deepEqual(read("SAP TM Lead - Manager"), []);
assert.equal(
  enrichCandidateUpload(
    {},
    "Configured SAP FSCM credit segments.",
  ).sap_task_evidence.some(
    (x: any) => x.module === "TRM" || x.module === "CASH_MANAGEMENT",
  ),
  false,
);
assert.ok(
  read("SAP TM Consultant\n- Configured freight settlement documents.").some(
    (x) => x.module === "TM" && x.involvement === "delivery",
  ),
);
assert.ok(
  read("SAP TRM Consultant\n- Configured hedge accounting.").some(
    (x) => x.module === "TRM",
  ),
);
assert.ok(
  read("SAP Cash Management\n- Configured liquidity planning.").some(
    (x) => x.module === "CASH_MANAGEMENT",
  ),
);
for (const boundary of [
  "",
  "Employer: Other Company",
  "Project: Microsoft Dynamics",
  "Education",
]) {
  assert.deepEqual(
    read(`SAP TM Consultant\n${boundary}\n- Configured tendering.`),
    [],
  );
}
assert.deepEqual(read("SAP TM Consultant\nConfigured tendering."), []);
assert.deepEqual(
  read("SAP TM Consultant\n- Configured SAP MM procurement tendering."),
  [],
);
assert.deepEqual(
  read("SAP SuccessFactors TM Consultant\n- Configured tendering."),
  [],
);
assert.deepEqual(
  read(
    "SAP TM Consultant\n" +
      Array(8).fill("- Reviewed notes.").join("\n") +
      "\n- Configured tendering.",
  ),
  [],
);
assert.deepEqual(
  read(
    "SAP TM Consultant\n- Configured SAP MM procurement.\n- Configured tendering.",
  ),
  [],
);
assert.deepEqual(
  read(
    "Configured SAP EWM storage control, inbound deliveries and picking.",
  ).map((x) => [x.module, x.specialization]),
  [
    ["EWM", "Warehouse Structure and Storage Control"],
    ["EWM", "Inbound Warehouse Processes"],
    ["EWM", "Outbound Warehouse Processes"],
  ],
);
assert.ok(
  read("SAP EWM Consultant\n- Configured putaway and outbound processes.").some(
    (x) => x.module === "EWM" && x.involvement === "delivery",
  ),
);
assert.deepEqual(read("Configured SAP WM storage types and picking."), []);
assert.deepEqual(read("Configured SAP MM inbound deliveries and packing."), []);
assert.equal(
  read("End-user operated SAP EWM picking.")[0].involvement,
  "end_user",
);
assert.equal(
  read("Integrated SAP EWM inbound deliveries with SAP TM.")[0].involvement,
  "integration",
);
assert.equal(
  enrichCandidateUpload(
    {},
    "Integrated SAP EWM inbound deliveries with SAP TM.",
  ).skills.includes("SAP EWM: Inbound Warehouse Processes"),
  false,
);
assert.equal(
  read("Developed SAPUI5 app for SAP EWM outbound deliveries.")[0].involvement,
  "technical_delivery",
);
assert.equal(
  read("Developed CAP service for SAP EWM inbound deliveries.")[0].involvement,
  "technical_delivery",
);
assert.equal(
  read("Implemented SAP EWM outbound processes using Fiori apps.")[0]
    .involvement,
  "delivery",
);
assert.equal(
  read("Coded RAP service for SAP EWM putaway.")[0].involvement,
  "technical_delivery",
);

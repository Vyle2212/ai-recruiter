import {
  inferSapModulesFromText,
  enrichCandidateWithSapTaxonomy,
} from "../lib/sapTalentTaxonomy";
import assert from "node:assert/strict";
import { sourceSupportsSapModuleClaim as supports } from "../lib/sourceSapModuleClaims";
assert.equal(
  supports(
    "BASIS",
    "Logged functional FI tickets through SAP Solution Manager on a daily basis.",
  ),
  false,
);
assert.equal(supports("BASIS", "SAP BASIS Junior Consultant"), true);
assert.equal(
  supports("BASIS", "NetWeaver administration and SAP system administration"),
  true,
);
assert.equal(
  supports(
    "ABAP",
    "FI consultant prepared functional specifications for RICEFW objects and BAPI interfaces.",
  ),
  false,
);
assert.equal(
  supports("ABAP", "Senior ABAP Developer delivering RICEFW objects"),
  true,
);
assert.equal(
  supports("PP", "FI implementation at a manufacturing client."),
  false,
);
assert.equal(
  supports("PP", "SAP PP consultant delivering Production Planning"),
  true,
);
assert.equal(supports("PP", "Materials Requirement Planning"), true);
assert.equal(supports("FICO", "SAP FI consultant"), true);
console.log("Source-backed module claim regressions passed");

const functionalSource =
  "SAP FI Consultant; functional specifications for RICEFW and BAPI interfaces; tickets in Solution Manager on a daily basis; manufacturing client.";
const inferred = inferSapModulesFromText(functionalSource);
for (const key of ["ABAP", "BASIS", "PP"])
  assert.equal(inferred.modules.includes(key as any), false, key);
assert.ok(inferred.modules.includes("FI"));
const explicit = enrichCandidateWithSapTaxonomy({
  raw_text: functionalSource,
  sap_modules: ["ABAP", "BASIS", "PP"],
});
for (const key of ["ABAP", "BASIS", "PP"])
  assert.ok(
    explicit.sap_modules.includes(key),
    `retain explicit module ${key}`,
  );
for (const source of [
  "SAP ABAP Developer",
  "SAP BASIS Consultant",
  "SAP PP Consultant",
])
  assert.ok(
    inferSapModulesFromText(source).modules.includes(
      source.split(" ")[1] as any,
    ),
  );
assert.equal(
  inferSapModulesFromText(
    "Worked on a contract basis using Solution Manager",
  ).modules.includes("BASIS"),
  false,
);
console.log(
  "Shared taxonomy does not reintroduce unsupported inferred modules: passed",
);

for (const source of [
  "SAP SuccessFactors TM (Talent Management) Consultant",
  "SAP HCM Consultant; TM means Talent Management",
  "Worked at TM telecom; configured SAP FI",
])
  assert.equal(inferSapModulesFromText(source).modules.includes("TM"), false);
for (const source of [
  "SAP TM Consultant",
  "SAP Transportation Management Consultant",
])
  assert.equal(inferSapModulesFromText(source).modules.includes("TM"), true);
assert.equal(
  inferSapModulesFromText(
    "SAP SuccessFactors Talent Management; SAP TM transportation planning",
  ).modules.includes("TM"),
  true,
);
for (const source of [
  "Configured classic SAP SD credit management with FD32",
  "SAP SD Consultant: credit management and credit control areas",
  "Bank collections management and dispute management",
])
  assert.equal(inferSapModulesFromText(source).modules.includes("FSCM"), false);
for (const source of [
  "SAP FSCM Consultant",
  "SAP Financial Supply Chain Management",
  "Configured SAP credit segments using UKM000",
  "SAP S/4HANA Credit Management",
  "Configured SAP collections management and dispute management",
])
  assert.equal(supports("FSCM", source), true);
assert.ok(
  enrichCandidateWithSapTaxonomy({
    raw_text: "SAP SD classic credit management",
    sap_modules: ["FSCM"],
  }).sap_modules.includes("FSCM"),
);

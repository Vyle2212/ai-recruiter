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

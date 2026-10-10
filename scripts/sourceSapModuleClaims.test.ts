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

import assert from "node:assert/strict";
import { hasContextualImplementationProjectEvidence, hasContextualSapModuleEvidence } from "../lib/sapModuleEvidenceContext";
import { candidateSearchV2ProjectionDocument } from "../lib/candidateSearchV2Projection";

assert.equal(hasContextualSapModuleEvidence("The meeting starts at 10 MM local time", "MM"), false);
assert.equal(hasContextualSapModuleEvidence("Microsoft Dynamics project covering purchasing, inventory management and finance", "MM"), false);
assert.equal(hasContextualSapModuleEvidence("SAP functional profile. Worked in the MM module and SD/MM integration.", "MM"), true);
assert.equal(hasContextualSapModuleEvidence("SAP Functional Consultant; junior consultant in the MM Logistic functional module", "MM"), true);
assert.equal(hasContextualSapModuleEvidence("Certified Application Associate - SAP S/4HANA Sourcing and Procurement", "MM"), true);
assert.equal(hasContextualSapModuleEvidence("Configured SAP SD/MM integration for order fulfilment", "MM"), true);
assert.equal(hasContextualSapModuleEvidence("SD card support and distribution reporting", "SD"), false);
assert.equal(hasContextualSapModuleEvidence("SAP implementation covering FI/CO configuration", "FI"), true);
assert.equal(hasContextualSapModuleEvidence("SAP implementation covering FI/CO configuration", "CO"), true);
assert.equal(hasContextualSapModuleEvidence("SAP implementation covering FI/CO configuration", "FICO"), true);
assert.equal(hasContextualImplementationProjectEvidence("Led a full-cycle SAP S/4HANA implementation project."), true);
assert.equal(hasContextualImplementationProjectEvidence("Implemented the ERP system and supported go-live."), true);
assert.equal(hasContextualImplementationProjectEvidence("Preparing commercial facilities by implementing the tender documents."), false);

const quarantined = candidateSearchV2ProjectionDocument({
  candidate_id: "ambiguous-mm", display_name: "Dynamics Consultant", display_title: "Microsoft Dynamics Consultant",
  all_modules: ["MM"], project_types: ["DOMAIN_CLASS_MM_EXPOSURE"], _invalid_ambiguous_modules: ["MM"],
});
assert.equal(quarantined.sapModules?.includes("MM"), false);
assert.equal(quarantined.domainEvidence?.MM, "UNVERIFIED");

const unrelatedImplementation = candidateSearchV2ProjectionDocument({
  candidate_id: "ambiguous-implementation", display_name: "Commercial Executive",
  project_types: ["IMPLEMENTATION_EXPLICIT_SOURCE_TEXT_SUPPORTED"], _invalid_ambiguous_implementation: true,
});
assert.equal(unrelatedImplementation.skills?.includes("Implementation"), false);
assert.equal(unrelatedImplementation.implementationEvidenceLevel, "unverified");

console.log("sapModuleEvidenceContext.test.ts passed");

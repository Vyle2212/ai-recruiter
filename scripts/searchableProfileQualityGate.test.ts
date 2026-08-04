import assert from "node:assert/strict";
import path from "node:path";
import { classifySearchableProfileQuality, auditSearchableProfileQuality } from "../lib/searchableProfileQualityGate";
import { buildSearchableProfileQualityReview, SEARCHABLE_PROFILE_QUALITY_REVIEW_PATH } from "./exportSearchableProfileQualityReview";

const base = {
  id: "base",
  name: "Aina Rahman",
  current_title: "SAP FICO Consultant",
  current_company: "Accenture Malaysia",
  primary_module: "FICO",
  location: "Malaysia",
  email: "aina@example.com",
  phone: "+60123456789",
  profile_quality_score: 85,
  raw_text: "Aina Rahman SAP FICO Consultant Accenture Malaysia S/4HANA ECC implementation rollout support AMS migration",
};

const fico = classifySearchableProfileQuality(base);
assert.equal(fico.status, "searchable_high_quality", "valid SAP FICO profile is searchable_high_quality");
assert.equal(fico.reviewCategory, "search_ready", "valid SAP FICO profile is search_ready");
assert.equal(fico.recommendedAction, "keep_searchable", "search-ready profile should remain searchable");
assert.equal(fico.searchableFields.name, "Aina Rahman", "exact candidate name remains searchable");
assert.equal(fico.searchableFields.modules.includes("FICO"), true, "SAP module keyword remains searchable");
assert.equal(fico.searchableFields.skills.includes("S/4HANA"), true, "SAP skill keyword remains searchable");

const abap = classifySearchableProfileQuality({ ...base, id: "abap", name: "Ravi Kumar", current_title: "SAP ABAP Developer", primary_module: "ABAP", raw_text: "Ravi Kumar SAP ABAP Developer WRICEF IDoc BAPI OData CDS Fiori implementation support" });
assert.equal(abap.status, "searchable_high_quality", "valid SAP ABAP profile is searchable_high_quality");
assert.equal(abap.searchableFields.modules.includes("ABAP"), true, "ABAP module should be searchable");
assert.equal(abap.searchableFields.skills.includes("WRICEF"), true, "ABAP skill keyword should be searchable");

const placeholder = classifySearchableProfileQuality({ ...base, id: "placeholder", name: "Candidate profile pending validation" });
assert.equal(placeholder.status, "blocked_validation_queue", "placeholder name is blocked_validation_queue");

const unknownModuleCandidate = { ...base, id: "unknown", primary_module: "UNKNOWN", raw_primary_module: "FICO", sap_modules: [], raw_text: "Aina Rahman SAP consultant implementation support" };
const unknownModule = classifySearchableProfileQuality(unknownModuleCandidate);
assert.notEqual(unknownModule.status, "searchable_high_quality", "UNKNOWN module is not searchable_high_quality");
assert.equal(unknownModule.reviewCategory, "must_repair_before_search", "currently searchable UNKNOWN module must be repaired before search");
assert.equal(unknownModule.recommendedAction, "remove_from_search_until_repaired", "UNKNOWN module becomes remove_from_search_until_repaired");

const longTitle = classifySearchableProfileQuality({ ...base, id: "long-title", current_title: "Experienced consultant responsible for end to end business process improvements and enterprise transformation delivery across multiple stakeholders" });
assert.notEqual(longTitle.status, "searchable_high_quality", "invalid long title is not searchable_high_quality");
assert.equal(longTitle.recommendedAction, "remove_from_search_until_repaired", "invalid long title should be removed from search until repaired");

const badCompany = classifySearchableProfileQuality({ ...base, id: "bad-company", current_company: "where as my goal in the world" });
assert.notEqual(badCompany.status, "searchable_high_quality", "invalid company fragment is not searchable_high_quality");

const nonSap = classifySearchableProfileQuality({ ...base, id: "non-sap", status: "non_sap" });
assert.equal(nonSap.status, "blocked_validation_queue", "non-SAP profile is blocked_validation_queue");
assert.equal(nonSap.recommendedAction, "remove_from_search_until_repaired", "currently searchable non-SAP status should be removed from search until repaired");

const missingCompanyOnlyCandidate = { ...base, id: "missing-company", current_company: "Not disclosed" };
const missingCompanyOnly = classifySearchableProfileQuality(missingCompanyOnlyCandidate);
assert.equal(missingCompanyOnly.status, "searchable_needs_enrichment", "missing company only does not become critical block");
assert.equal(missingCompanyOnly.reviewCategory, "searchable_but_needs_enrichment", "missing company only remains enrichment");
assert.equal(missingCompanyOnly.recommendedAction, "enrich_company_before_market_release", "missing company only should enrich company before market release");

const missingLocationCandidate = { ...base, id: "missing-location", location: "" };
const missingLocation = classifySearchableProfileQuality(missingLocationCandidate);
assert.equal(missingLocation.status, "searchable_needs_enrichment", "missing location is enrichment, not high quality");
assert.equal(missingLocation.recommendedAction, "enrich_before_market_release", "missing location becomes enrich_before_market_release");

const badIdentityCandidate = { ...base, id: "bad-identity", raw_exact_display_name: "Aina Rahman", name: "Profile Under Review", current_company: "Not disclosed", location: "" };
const badIdentity = classifySearchableProfileQuality(badIdentityCandidate);
assert.equal(badIdentity.reviewCategory, "must_repair_before_search", "current searchable bad identity must repair before search");
assert.equal(badIdentity.recommendedAction, "remove_from_search_until_repaired", "invalid name becomes remove_from_search_until_repaired");

const audit = auditSearchableProfileQuality([base, { ...base, id: "placeholder", name: "Candidate profile pending validation" }, unknownModuleCandidate, missingCompanyOnlyCandidate, missingLocationCandidate, badIdentityCandidate]);
assert.equal(audit.totalCandidates, 6, "audit should include total candidates");
assert.equal(audit.currentRecruiterSearchable >= 1, true, "audit should include current recruiter-searchable count");
assert.equal(audit.searchableHighQuality >= 1, true, "audit should count high-quality profiles");
assert.equal(audit.groupedBreakdown.currentSearchableMissingCompany >= 1, true, "audit should group missing company among current searchable profiles");
assert.equal(audit.groupedBreakdown.currentSearchableMissingLocation >= 1, true, "audit should group missing location among current searchable profiles");
assert.equal(audit.groupedBreakdown.currentSearchableMissingSapModule >= 1, true, "audit should group missing SAP module among current searchable profiles");
assert.equal(audit.groupedBreakdown.currentSearchableInvalidOrLongTitle >= 0, true, "audit should expose invalid/long title group");
assert.equal(typeof audit.missingFieldCounts, "object", "audit should include missing field counts");
assert.equal(typeof audit.riskFlagCounts, "object", "audit should include risk flag counts");

const review = buildSearchableProfileQualityReview([base, missingCompanyOnlyCandidate, missingLocationCandidate, badIdentityCandidate]);
assert.equal(review.items.length, 3, "export payload includes current searchable but not high quality");
assert.equal(review.items.some((item) => item.candidateId === "missing-company"), true, "export includes enrichment item");
assert.equal(review.items.some((item) => item.recommendedAction === "remove_from_search_until_repaired"), true, "export includes remove-until-repaired item");
assert.equal(review.items[0].profileHref.includes("/candidates/"), true, "export item includes profileHref");
assert.equal(review.outputPath, SEARCHABLE_PROFILE_QUALITY_REVIEW_PATH, "report path is generated but not required to be committed");
assert.equal(path.basename(SEARCHABLE_PROFILE_QUALITY_REVIEW_PATH), "searchable-profile-quality-review.json", "report filename should be stable");

console.log("Searchable profile quality gate tests passed");
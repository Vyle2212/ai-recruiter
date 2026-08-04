import assert from "node:assert/strict";
import { recommendQuickFixApplyDecision } from "../lib/quickFixApplyReviewValidator";
assert.equal(recommendQuickFixApplyDecision({ fieldName: "currentCompany", suggestedValue: "EY Consulting", evidence: "EY Consulting Sdn Bhd", confidence: 88, eligible: true, preserved: false, blocked: false }).decision, "approve_for_apply", "clean company suggested approve");
assert.equal(recommendQuickFixApplyDecision({ fieldName: "currentCompany", suggestedValue: "Under Accenture Technology", evidence: "Under Accenture Technology", confidence: 88, eligible: true, preserved: false, blocked: false }).decision, "hold_for_review", "Under Accenture Technology held for review");
assert.equal(recommendQuickFixApplyDecision({ fieldName: "currentCompany", suggestedValue: "Organization Chemical Company of Malaysia Berhad", evidence: "Company", confidence: 88, eligible: true, preserved: false, blocked: false }).decision, "hold_for_review", "Organization Chemical Company held for review");
assert.equal(recommendQuickFixApplyDecision({ fieldName: "currentCompany", suggestedValue: "EY Consulting", evidence: "EY", confidence: 88, eligible: false, preserved: true, blocked: false }).decision, "keep_existing", "already applied item keep_existing");
assert.equal(recommendQuickFixApplyDecision({ fieldName: "currentCompany", suggestedValue: "", evidence: "", confidence: 0, eligible: false, preserved: false, blocked: true }).decision, "reject_from_apply", "blocked item reject");
console.log("Quick fix apply review validator tests passed");

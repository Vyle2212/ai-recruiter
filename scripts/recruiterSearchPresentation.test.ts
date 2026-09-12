import assert from "node:assert/strict";
import { evidenceSafeMatchLabel, matchQualityMinimumScore, parseRecruiterSearchIntent, recruiterCandidateEvidenceChips, recruiterCriticalGap, recruiterMatchLabel, recruiterMatchTier, recruiterProfileConfidence, recruiterQueryEvidence, recruiterQueryStatements, recruiterRankingReasons, recruiterSearchChips, removeRecruiterSearchIntent } from "../lib/recruiterSearchPresentation";

assert.deepEqual(parseRecruiterSearchIntent("Senior SAP FICO consultant in Malaysia with implementation experience"), {
  seniority: ["Senior"], countries: ["Malaysia"], skills: ["FICO", "Implementation"], sapModules: ["FI", "CO", "FICO"], roleConcepts: ["FICO"], expandedConcepts: ["FICO", "FI", "CO", "GL", "AP", "AR", "AA", "FI/CO", "Finance & Controlling"], lifecycle: ["Implementation"],
});
assert.deepEqual(recruiterSearchChips(["sap fico", "SAP", "fico", "FI", "CO", "Malaysia"]), ["FICO", "FI", "CO", "Malaysia"]);
assert.equal(matchQualityMinimumScore("any"), 0);
assert.equal(matchQualityMinimumScore("relevant"), 50);
assert.equal(matchQualityMinimumScore("strong"), 85);
assert.equal(removeRecruiterSearchIntent("Senior SAP FICO consultant in Malaysia", "Malaysia"), "Senior SAP FICO consultant in");
assert.equal(removeRecruiterSearchIntent("SAP EWM Consultant Malaysia", "EWM"), "Consultant Malaysia");
assert.equal(recruiterMatchLabel(70), "Strong Match");
assert.equal(recruiterMatchLabel(50), "Good Match");
const sparse = { currentTitle:"Senior SAP FICO Consultant",location:"Malaysia",country:"Malaysia",verifiedSkills:["FICO"],verifiedSapModules:["FICO"],domainEvidence:{FICO:"PRIMARY" as const},seniorityEvidenceLevel:"verified_structured_evidence" as const,score:{skillScore:90,titleScore:75,locationScore:100,recencyScore:100,finalScore:70}, explanation:{matchedSkills:["SAP FICO"],matchedSapModules:["FI","CO"],matchedTerms:[],missingSkills:[],warnings:[]}, profileEvidence:{name:true,title:true,employer:true,location:true,experienceDuration:false,employmentHistory:false,projectHistory:false,education:false,certifications:false,skills:true} };
const rich = { ...sparse, profileEvidence:{name:true,title:true,employer:true,location:true,experienceDuration:true,employmentHistory:true,projectHistory:true,education:true,certifications:true,skills:true} };
assert.equal(recruiterProfileConfidence(sparse), "limited");
assert.equal(evidenceSafeMatchLabel(70, recruiterProfileConfidence(sparse)), "Strong Match");
assert.equal(recruiterProfileConfidence(rich), "high");
assert.equal(evidenceSafeMatchLabel(70, recruiterProfileConfidence(rich)), "Strong Match");
assert.deepEqual(recruiterRankingReasons(sparse), ["Module match: FI, CO", "Relevant current title", "Location match"]);
assert.doesNotMatch(recruiterRankingReasons(sparse).join(" "), /recent/i);
assert.deepEqual(recruiterQueryEvidence(sparse, parseRecruiterSearchIntent("Senior SAP FICO Malaysia")), { confirmed:["Senior-level role evidence","Malaysia","FICO"], unverified:["FI","CO"] });
assert.deepEqual(recruiterQueryStatements(sparse, parseRecruiterSearchIntent("Senior SAP FICO Malaysia")), { supported:["SAP FICO title","Malaysia","Seniority role evidence"], gaps:[] });
assert.deepEqual(recruiterCandidateEvidenceChips({ ...sparse, queryRelevantSkills:[] }), []);
const ficoIntent=parseRecruiterSearchIntent("Senior SAP FICO Malaysia");
assert.equal(recruiterMatchTier(sparse,ficoIntent),"Potential Match");
assert.equal(recruiterMatchTier({...sparse,score:{...sparse.score,finalScore:50}},ficoIntent),"Potential Match");
assert.equal(recruiterMatchTier({...sparse,currentTitle:"SAP Consultant",location:"",country:"",score:{...sparse.score,finalScore:50}},ficoIntent),"Potential Match");
assert.equal(recruiterCriticalGap({ score:{skillScore:90,titleScore:75,locationScore:100,recencyScore:30,finalScore:70}, explanation:{matchedSkills:[],matchedSapModules:[],matchedTerms:[],missingSkills:["S/4HANA"],warnings:["Candidate data confidence is low."]} }), "Required skill not confirmed: S/4HANA");
console.log("recruiterSearchPresentation.test.ts passed");

import assert from "node:assert/strict";
import fs from "node:fs";
import { buildCommittedSearchRequirements, canonicalHardRequirementCounts, evaluateCommittedCandidate } from "../lib/searchV2CommittedRequirements";
import { rankCandidatesV2 } from "../lib/candidateSearchV2Engine";
import type { CandidateSearchCriterion, CandidateSearchV2Document, TrustedCandidateEvidenceValue } from "../lib/candidateSearchV2Types";

const query="Senior SAP FICO Consultant in Malaysia with Mandarin and at least 8 years of experience";
const criteria:CandidateSearchCriterion[]=[
 {id:"criterion:stakeholders",label:"Stakeholder leadership",importance:"important",source:"filter"},
 {id:"criterion:delivery",label:"Regional delivery",importance:"most_important",source:"filter"},
];
const committed=buildCommittedSearchRequirements({query,criteria,clarificationAnswers:{delivery:["Implementation"]},talentPool:"internal_profiles"});
assert.equal(canonicalHardRequirementCounts(committed).total,7);
assert.equal(committed.requirements.length,7);
assert.equal(committed.criteria.length,2);
assert.equal(canonicalHardRequirementCounts(buildCommittedSearchRequirements({query:"Engineer in Malaysia OR Singapore"})).counts.location,1,"OR alternatives are one group");

function candidate(id:string,values:Array<[TrustedCandidateEvidenceValue["sourceType"],string,string]>):CandidateSearchV2Document{
 return{candidateId:id,candidateName:id,currentTitle:"Senior SAP FICO Consultant",currentEmployer:"Example",country:"Malaysia",location:"Malaysia",locationEvidenceState:"VERIFIED",totalYearsExperience:12,skills:[],sapModules:[],industries:[],languages:["Mandarin"],searchableText:values.map(item=>item[1]).join(" "),trustedCandidateEvidence:{candidateId:id,values:values.map(([sourceType,value,sourceField])=>({sourceType,value,sourceField,sourceRecordId:id,provenance:"candidate_record_raw",trusted:true}))},domainEvidence:{},profileQualityScore:90,dataConfidenceScore:90,profileEvidence:{name:true,title:true,employer:true,location:true,experienceDuration:true,employmentHistory:true,projectHistory:true,education:false,certifications:false,skills:true},talentPool:"internal_profiles"};
}
const passing=candidate("passing",[["raw_title","Senior SAP FICO Consultant","candidates.current_title"],["raw_professional_text","Mandarin","candidate_profile.language_section"],["raw_project","SAP FICO Implementation with stakeholder leadership and regional delivery","candidates.projects"]]);
const rawLanguageOnly=candidate("raw-language",[["raw_title","Senior SAP FICO Consultant","candidates.current_title"],["raw_professional_text","Mandarin mentioned in a paragraph","candidates.raw_text"],["raw_project","SAP FICO Implementation","candidates.projects"]]);
assert.equal(evaluateCommittedCandidate(passing,committed).eligible,true);
assert.equal(evaluateCommittedCandidate(rawLanguageOnly,committed).eligible,false);
const withoutCriteria=rankCandidatesV2([passing],{query,minimumScore:0,clarificationAnswers:{delivery:["Implementation"]}});
const withCriteria=rankCandidatesV2([passing],{query,minimumScore:0,clarificationAnswers:{delivery:["Implementation"]},criteria});
assert.equal(withoutCriteria.length,withCriteria.length,"Criteria remain ranking-only");
assert.equal(withCriteria[0].criteriaDiagnostic?.criteria.length,2);

const client=fs.readFileSync("app/recruiter/talent-search/v2/CandidateSearchV2Client.tsx","utf8");
const filters=fs.readFileSync("app/recruiter/talent-search/v2/SearchFiltersPanel.tsx","utf8");
const criteriaUi=fs.readFileSync("app/recruiter/talent-search/v2/SearchCriteriaPanel.tsx","utf8");
const review=fs.readFileSync("app/recruiter/talent-search/v2/SearchPreparationReview.tsx","utf8");
const drawer=fs.readFileSync("app/recruiter/talent-search/v2/CandidateDetailsDrawer.tsx","utf8");
const route=fs.readFileSync("app/api/recruiter/search-v2/route.ts","utf8");
const transactional=fs.readFileSync("app/recruiter/talent-search/v2/TransactionalDrawer.tsx","utf8");
for(const source of [client,filters,review])assert.match(source,/canonicalHardRequirementCounts/);
assert.match(filters,/Candidate filters/);assert.match(filters,/Apply filters/i);assert.match(criteriaUi,/Criteria rank only candidates who passed all Required Filters/);assert.match(criteriaUi,/window\.confirm/);
assert.match(transactional,/aria-modal="true"/);assert.match(transactional,/event\.key==="Escape"/);assert.match(transactional,/document\.activeElement===last/);
for(const field of ["criteria","clarificationAnswers","talentPool","includeRelocationRemote"])assert.match(route,new RegExp(`body\\.${field}`));
assert.match(client,/requestCriteria/);assert.match(client,/requestTalentPool/);assert.match(client,/Review the requirements and select Commit Search/);assert.doesNotMatch(client,/Start guided search/i);
assert.match(drawer,/Evidence sources/);assert.match(drawer,/Found in:/);assert.match(drawer,/Show source excerpt/);assert.match(drawer,/Functional areas \/ business processes/);assert.match(drawer,/Meets requirement — supported evidence/);assert.doesNotMatch(drawer,/Anonymized project context/);assert.doesNotMatch(drawer,/Evidence provenance/);assert.doesNotMatch(drawer,/Partially meets/);
console.log("Search V2 premium product-integrity tests passed");

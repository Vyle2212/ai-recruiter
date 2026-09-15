import assert from 'node:assert/strict';
import { validateAiEmploymentEvidence } from '../lib/aiEmploymentEvidence';
import { emptyRawAiExtraction } from '../lib/openAiCandidateExtractionProvider';
import { validateAiCandidateExtraction } from '../lib/cvExtractionValidator';
const evidence = 'Company: Example Systems Position: SAP Consultant January 2020 - January 2022';
const row = {company:'Example Systems',title:'SAP Consultant',start:'January 2020',end:'January 2022',evidence};
assert.equal(validateAiEmploymentEvidence([row],evidence).accepted.length,1);
for (const bad of [{...row,company:'Invented Employer'}, {...row,evidence:'invented'}, {...row,current:true}, {...row,start:'January 2022',end:'January 2020'}, null]) {
 assert.equal(validateAiEmploymentEvidence([bad],evidence).accepted.length,0);
}
const client = evidence.replace('Company:', 'Client:');
assert.equal(validateAiEmploymentEvidence([{...row,evidence:client}],client).accepted.length,0);
const raw=emptyRawAiExtraction();raw.employer.employerHistory=[row];
const output=validateAiCandidateExtraction(raw,{id:'synthetic'},evidence,'openai-compatible',false,{mode:'openai',providerUsed:'openai',model:'synthetic'});
assert.equal(output.employmentHistory.length,1,'Empty primary array must not hide employerHistory');
raw.experience.employmentHistory=[{...row,evidence:'invented'}];
const rejected=validateAiCandidateExtraction(raw,{id:'synthetic'},evidence,'openai-compatible',false,{mode:'openai',providerUsed:'openai',model:'synthetic'});
assert.equal(rejected.employmentHistory.length,0);
assert.equal(rejected.safeToApply,false);
assert.ok(rejected.reviewReasons.some(r=>r.includes('evidence_not_in_source')));
console.log('AI employment evidence gating and alternate history recovery: passed');

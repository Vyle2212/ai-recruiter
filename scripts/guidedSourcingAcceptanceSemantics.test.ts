import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildConfirmedGuidedSearchHandoff, resolveGuidedSapConcept, splitGuidedSapConcepts } from '../lib/guidedSourcingHandoff';
import { buildCompactGuidedReview } from '../lib/guidedSourcingReview';
import { validateGuidedSourcingPlan, verifyGuidedSourceExcerpt } from '../lib/guidedSourcingValidation';
import { GUIDED_SOURCING_SCHEMA_VERSION, type GuidedCriterion } from '../lib/guidedSourcingTypes';

assert.deepEqual(resolveGuidedSapConcept('SAP Sales and Distribution').status,'approved');
assert.equal(resolveGuidedSapConcept('Sales and Distribution').status,'approved');
assert.equal(resolveGuidedSapConcept('S/4 HANA').status,'approved');
assert.equal(resolveGuidedSapConcept('S4HANA').status,'approved');
assert.equal(resolveGuidedSapConcept('FI/CO').status,'approved');
assert.deepEqual(splitGuidedSapConcepts('SAP S/4HANA and Fiori'),['SAP S/4HANA','fiori']);
assert.deepEqual(splitGuidedSapConcepts('SAP Sales and Distribution, including Sales and TM/Shipment modules'),['SAP SD','sales','tm','shipment modules']);

const source='• SAP Finance functional con-\nsulting, including FI–GL, AP, AR, AA and S/4HANA\n• Finance data migration covering master and transactional data\n• Japan-specific ﬁnance regulations and Japanese client/project experience';
const financeExcerpt='SAP Finance functional consulting, including FI-GL, AP, AR, AA and S/4HANA';
const matched=verifyGuidedSourceExcerpt(source,financeExcerpt);
assert.match(matched,/con-\nsulting/);
assert.match(verifyGuidedSourceExcerpt(source,'Japan-specific finance regulations and Japanese client/project experience'),/ﬁnance/);

const row=(id:string,type:GuidedCriterion['type'],value:string,excerpt:string):GuidedCriterion=>({id,type,value,supportingExcerpt:excerpt,reason:'Supported by source',confidence:.9,status:'proposed'});
const otc=buildCompactGuidedReview([
 row('role','target_role','Senior SAP OTC Consultant','Senior SAP OTC Consultant'),
 row('loc','location','Singapore','Singapore'),
 row('years','minimum_years','5','Minimum 5 years of hands-on SAP Order-to-Cash experience'),
 row('otc','must_have','Order-to-Cash','Minimum 5 years of hands-on SAP Order-to-Cash experience'),
 row('process','must_have','Sales order management, Pricing, Delivery, Billing, Credit Management, Returns, ATP','Sales order management, Pricing, Delivery, Billing, Credit Management, Returns, ATP'),
]);
assert.equal(otc.mustHave[0].value,'Order-to-Cash — minimum 5 years');
assert.deepEqual(otc.mustHave[0].capabilityChips,['Sales order','Pricing','Delivery','Billing','Credit','Returns','ATP']);
assert.equal(otc.summary.some(item=>item.type==='minimum_years'),false);
assert.match(otc.countBreakdown,/Role, Location, 1 reviewed criterion/);
assert.equal(otc.includedCount,3);

const omittedYearsBrief='Senior SAP OTC Consultant in Singapore. Minimum 5 years of hands-on Order-to-Cash experience covering sales order management, pricing, delivery, billing, credit management, returns and ATP.';
const repairedYears=validateGuidedSourcingPlan({schemaVersion:GUIDED_SOURCING_SCHEMA_VERSION,criteria:[{id:'otc',type:'must_have',value:'Order-to-Cash',supportingExcerpt:'Order-to-Cash experience',reason:'Core process',confidence:.9,status:'proposed',ambiguityExplanation:null,taxonomyConceptId:null}]},omittedYearsBrief);
assert(repairedYears.ok);const repairedReview=buildCompactGuidedReview(repairedYears.plan.criteria);assert.equal(repairedReview.mustHave[0].value,'Order-to-Cash — minimum 5 years');
if(repairedYears.ok){const confirmed={...repairedYears.plan,criteria:repairedYears.plan.criteria.map(item=>({...item,status:'confirmed' as const}))};const handoff=buildConfirmedGuidedSearchHandoff(confirmed);assert.match(handoff.query,/Order-to-Cash — minimum 5 years/);assert.doesNotMatch(handoff.query,/(?:^|, )minimum 5 years experience/);}

const compositeBrief='Requires SAP S/4HANA and Fiori plus SAP Sales and Distribution.';
const composite=validateGuidedSourcingPlan({schemaVersion:GUIDED_SOURCING_SCHEMA_VERSION,criteria:[
 {id:'composite',type:'sap_concept',value:'SAP S/4HANA and Fiori',supportingExcerpt:'SAP S/4HANA and Fiori',reason:'Core platforms',confidence:.9,status:'proposed',ambiguityExplanation:null,taxonomyConceptId:null},
 {id:'sd',type:'sap_concept',value:'SAP Sales and Distribution',supportingExcerpt:'SAP Sales and Distribution',reason:'Core module',confidence:.9,status:'proposed',ambiguityExplanation:null,taxonomyConceptId:null},
]},compositeBrief);
assert(composite.ok);
assert(composite.plan.criteria.some(item=>item.value==='SAP S/4HANA'&&item.status==='proposed'));
assert(composite.plan.criteria.some(item=>item.value==='SAP Fiori / UI5'&&item.status==='proposed'));
assert(composite.plan.criteria.some(item=>item.value==='SAP SD'&&item.status==='proposed'));

const unknown=validateGuidedSourcingPlan({schemaVersion:GUIDED_SOURCING_SCHEMA_VERSION,criteria:[{id:'unknown',type:'sap_concept',value:'SAP XYZ',supportingExcerpt:'SAP XYZ',reason:'Unknown',confidence:.7,status:'proposed',ambiguityExplanation:null,taxonomyConceptId:null}]},'Requires SAP XYZ');
assert(unknown.ok);assert.equal(unknown.plan.criteria[0].status,'unresolved');

const numeric=validateGuidedSourcingPlan({schemaVersion:GUIDED_SOURCING_SCHEMA_VERSION,criteria:[{id:'years',type:'unresolved',value:'5',supportingExcerpt:'5',reason:'May be years',confidence:.5,status:'unresolved',ambiguityExplanation:null,taxonomyConceptId:null}]},'SAP SD consultant. Capacity: 5.');
assert(numeric.ok);assert.doesNotMatch(numeric.plan.criteria[0].value,/^5$/);assert.match(numeric.plan.criteria[0].value,/Does ‘5’ mean a minimum of 5 years of SAP SD experience\?/);

const pdfPlan=validateGuidedSourcingPlan({schemaVersion:GUIDED_SOURCING_SCHEMA_VERSION,criteria:[
 {id:'fi',type:'must_have',value:'SAP Finance functional consulting, including FI-GL, AP, AR, AA and S/4HANA',supportingExcerpt:financeExcerpt,reason:'Core finance',confidence:.9,status:'proposed',ambiguityExplanation:null,taxonomyConceptId:null},
 {id:'migration',type:'must_have',value:'Finance data migration covering master and transactional data',supportingExcerpt:'Finance data migration covering master and transactional data',reason:'Migration',confidence:.9,status:'proposed',ambiguityExplanation:null,taxonomyConceptId:null},
 {id:'japan',type:'must_have',value:'Japan-specific finance regulations and Japanese client/project experience',supportingExcerpt:'Japan-specific finance regulations and Japanese client/project experience',reason:'Japan',confidence:.9,status:'proposed',ambiguityExplanation:null,taxonomyConceptId:null},
]},source);
assert(pdfPlan.ok);assert.equal(pdfPlan.plan.criteria.filter(item=>item.status==='unresolved').length,0);

const ui=fs.readFileSync('app/recruiter/talent-search/v2/GuidedSourcingPanel.tsx','utf8');
const search=fs.readFileSync('app/recruiter/talent-search/v2/CandidateSearchV2Client.tsx','utf8');
assert.match(ui,/compact\.countBreakdown/);
assert.match(ui,/Resolve \{compact\.attention\.length\}/);
assert.match(ui,/Review issues/);
assert.match(search,/Search plan prepared\. Review it, then click Search\./);
assert.doesNotMatch(search,/applyGuidedHandoff[\s\S]{0,500}runSearch\(/);
console.log('guided sourcing acceptance semantic tests passed');

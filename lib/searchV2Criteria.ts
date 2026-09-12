import type {
  CandidateSearchCriterion,
  CandidateSearchV2Document,
  TrustedCandidateEvidenceValue,
} from "./candidateSearchV2Types";
import {
  canonicalSearchConcept,
  conceptsInText,
  searchConcept,
} from "./candidateSearchConcepts";
import { identityBoundTrustedCandidateValues } from "./nicheTargetEvidence";
import { redactSearchV2VisibleEvidence } from "./searchV2VisibleEvidence";
import {
  assignmentSupportsLifecycle,
  canonicalLifecycleAssignmentId,
  lifecycleScopeFromCriterion,
  readableLifecycleEvidenceLabel,
  targetModuleDeliveryEvidence,
} from "./searchV2Lifecycle";

export const SEARCH_V2_CRITERIA_SCORING_VERSION = "search-v2-criteria-v9-lifecycle-scoped-assignment-counts";
export type CriterionEvaluation = Readonly<{ id:string;label:string;importance:CandidateSearchCriterion["importance"];state:"verified"|"supported"|"not_verified"|"conflicting";score:number;weight:number;reason:string;provenance:Readonly<{candidateId:string;sourceRecordId:string;sourceType:TrustedCandidateEvidenceValue["sourceType"];sourceField:string;excerpt:string;talentPool:"internal_profiles"|"linkedin_talent_pool"}>|null;assignmentEvidence?:Readonly<{totalGroundedProjects:number;directTargetAssignments:number;directTargetLifecycleAssignments:number;requestedLifecycleTypes:readonly string[];adjacentAssignments:number;unsupportedAssignments:number}> }>;
export type CriteriaDiagnostic = Readonly<{version:typeof SEARCH_V2_CRITERIA_SCORING_VERSION;scorePercent:number;matchedWeight:number;totalWeight:number;criteria:readonly CriterionEvaluation[]}>;
const weight=(importance:CandidateSearchCriterion["importance"])=>importance==="most_important"?5:importance==="important"?3:1;
const normalize=(value:unknown)=>String(value||"").normalize("NFKC").toLowerCase().replace(/\s+/g," ").trim();
const excerpt=(value:string)=>redactSearchV2VisibleEvidence(value).slice(0,220);
const terms=(criterion:CandidateSearchCriterion)=>{const conceptId=criterion.conceptId||canonicalSearchConcept(criterion.label),concept=conceptId?searchConcept(conceptId):null;return[...new Set([criterion.label,...(concept?[concept.label,...concept.aliases,...(concept.contextAliases||[])]:[])].map(normalize).filter(value=>value.length>=2))]};
const contains=(source:string,term:string)=>new RegExp(`(?:^|[^a-z0-9])${term.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}(?:$|[^a-z0-9])`,"i").test(normalize(source));
const isDeliveryCriterion=(label:string)=>/\b(?:delivery depth|full[- ]?lifecycle|implementation|rollout|migration|delivery ownership|stakeholder leadership)\b/i.test(label);
const criterionDimension=(criterion:CandidateSearchCriterion)=>/\b(?:stakeholder|leadership|ownership|lead|manager)\b/i.test(criterion.label)?"leadership":/\b(?:implementation|full[- ]?lifecycle|delivery depth|rollout|migration)\b/i.test(criterion.label)?"delivery-depth":`concept:${criterion.conceptId||canonicalSearchConcept(criterion.label)||normalize(criterion.label)}`;
const importanceRank=(value:CandidateSearchCriterion["importance"])=>value==="most_important"?3:value==="important"?2:1;
export function dedupeSearchCriteria(criteria:readonly CandidateSearchCriterion[]){
 const byDimension=new Map<string,CandidateSearchCriterion>();
 for(const criterion of criteria){const dimension=criterionDimension(criterion),current=byDimension.get(dimension);if(!current){byDimension.set(dimension,{...criterion});continue}const specific=criterion.label.length>current.label.length?criterion:current;byDimension.set(dimension,{...specific,importance:importanceRank(criterion.importance)>importanceRank(current.importance)?criterion.importance:current.importance});}
 return [...byDimension.values()];
}

export function evaluateSearchCriteria(candidate:CandidateSearchV2Document,criteria:readonly CandidateSearchCriterion[]):CriteriaDiagnostic{
 criteria=dedupeSearchCriteria(criteria);
 const evidence=identityBoundTrustedCandidateValues(candidate);
 const evaluations=criteria.map((criterion):CriterionEvaluation=>{
   const importanceWeight=weight(criterion.importance);
   if(isDeliveryCriterion(criterion.label)){
    const targetConcept=criterion.conceptId||canonicalSearchConcept(criterion.label);
    const classified=targetConcept?targetModuleDeliveryEvidence(candidate,targetConcept):null;
   const genericAssignments = new Map<string, NonNullable<CandidateSearchV2Document["lifecycleEvidence"]>[number]>();
   if (!targetConcept) {
    for (const item of candidate.lifecycleEvidence || []) {
     const assignmentId = canonicalLifecycleAssignmentId(item);
     const current = genericAssignments.get(assignmentId);
     if (!current || (current.evidenceLevel !== "verified" && item.evidenceLevel === "verified")) genericAssignments.set(assignmentId, item);
    }
   }
   const requestedLifecycleTypes=lifecycleScopeFromCriterion(criterion.label);
   const directAcrossLifecycles=classified?.directTargetAssignments||[...genericAssignments.entries()].map(([assignmentId,evidence])=>({assignmentId,evidence,lifecycleEvidence:[evidence],classification:"direct" as const,reasonCode:"direct_target_delivery" as const,lifecycleTypes:[evidence.lifecycleType]}));
   const direct=requestedLifecycleTypes.length
    ? directAcrossLifecycles.filter(item=>assignmentSupportsLifecycle(item,requestedLifecycleTypes))
    : directAcrossLifecycles;
   const directTypes=new Set(
    requestedLifecycleTypes.length
     ? direct.flatMap(item=>item.lifecycleTypes.filter(actual=>requestedLifecycleTypes.some(required=>normalize(required)===normalize(actual))))
     : direct.map(item=>item.evidence.lifecycleType),
   );
   const qualifies=direct.length>0;
   const strongest=direct.find(item=>["Implementation","Project leadership","Delivery responsibility"].includes(item.evidence.lifecycleType))||direct[0]||null;
   const strongestEvidence=strongest
    ? strongest.lifecycleEvidence.find(item=>requestedLifecycleTypes.some(required=>normalize(required)===normalize(item.lifecycleType)))||strongest.evidence
    : null;
   const state:CriterionEvaluation["state"]=qualifies?(direct.length>=2||strongestEvidence?.evidenceLevel==="verified"?"verified":"supported"):"not_verified";
   const depthScore=!qualifies?0:direct.length>=3?100:direct.length===2?85:directTypes.has("Implementation")?72:directTypes.has("Rollout")||directTypes.has("Migration")||directTypes.has("Go-live")?62:directTypes.has("Configuration")?55:45;
   const targetLabel=targetConcept ? (searchConcept(targetConcept)?.label || targetConcept) : "delivery";
   const adjacentReason=classified?.adjacentAssignments.some(item=>item.reasonCode==="security_authorization_context")?`${targetLabel} mentioned only in Security/authorization work; no direct grounded ${targetLabel} assignment.`:classified?.adjacentAssignments.some(item=>item.reasonCode==="cross_module_integration_touchpoint")?`${targetLabel} integration touchpoint — not direct ${targetLabel} delivery.`:targetConcept?`No grounded ${targetLabel} assignment found; no direct target-module delivery was established.`:"No grounded delivery assignment was found.";
   const lifecycleLabel=requestedLifecycleTypes.length===1?requestedLifecycleTypes[0].toLowerCase():requestedLifecycleTypes.map(value=>value.toLowerCase()).join(" or ");
   const scopedTargetLabel=lifecycleLabel?`${targetLabel} ${lifecycleLabel}`:targetLabel;
   const directReason=requestedLifecycleTypes.length
    ? (direct.length===1?`Supported by exactly 1 direct grounded ${scopedTargetLabel} assignment.`:`Supported by exactly ${direct.length} direct grounded ${scopedTargetLabel} assignments.`)
    : targetConcept
      ? (direct.length===1?`Supported by 1 grounded ${targetLabel} assignment (1 direct).`:`Supported by multiple grounded ${targetLabel} assignments — ${direct.length} direct grounded ${targetLabel} assignments.`)
      : (direct.length===1?"Supported by 1 grounded delivery assignment.":`Supported by ${direct.length} grounded delivery assignments.`);
   const noScopedEvidenceReason=requestedLifecycleTypes.length&&directAcrossLifecycles.length
    ? `${directAcrossLifecycles.length} direct grounded ${targetLabel} ${directAcrossLifecycles.length===1?"assignment was":"assignments were"} found, but none satisfied the requested ${lifecycleLabel} lifecycle.`
    : adjacentReason;
   return{id:criterion.id,label:criterion.label,importance:criterion.importance,state,score:depthScore,weight:importanceWeight,reason:!qualifies?noScopedEvidenceReason:directReason,provenance:strongest&&strongestEvidence?{candidateId:candidate.candidateId,sourceRecordId:strongest.assignmentId,sourceType:"raw_project",sourceField:strongestEvidence.sourceField,excerpt:excerpt(readableLifecycleEvidenceLabel(strongestEvidence,targetLabel)),talentPool:candidate.talentPool||"internal_profiles"}:null,assignmentEvidence:classified?{totalGroundedProjects:classified.totalGroundedProjects,directTargetAssignments:directAcrossLifecycles.length,directTargetLifecycleAssignments:direct.length,requestedLifecycleTypes,adjacentAssignments:classified.adjacentAssignments.length,unsupportedAssignments:classified.unsupportedAssignments.length}:{totalGroundedProjects:genericAssignments.size,directTargetAssignments:directAcrossLifecycles.length,directTargetLifecycleAssignments:direct.length,requestedLifecycleTypes,adjacentAssignments:0,unsupportedAssignments:0}};
  }
  const criterionTerms=terms(criterion);
  const conflict=evidence.find(entry=>criterionTerms.some(term=>contains(entry.value,term)&&/\b(?:no|not|without|lacks?|never)\b/i.test(entry.value.slice(Math.max(0,normalize(entry.value).indexOf(term)-45),normalize(entry.value).indexOf(term)+term.length+10))))||null;
  const match=conflict?null:evidence.find(entry=>criterionTerms.some(term=>contains(entry.value,term)))||null;
  const state:CriterionEvaluation["state"]=conflict?"conflicting":match?(["raw_project","raw_certification"].includes(match.sourceType)?"verified":"supported"):"not_verified";
  const criterionScore=state==="verified"?100:state==="supported"?72:0,evidenceEntry=conflict||match;
  return{id:criterion.id,label:criterion.label,importance:criterion.importance,state,score:criterionScore,weight:importanceWeight,reason:conflict?"Candidate-owned evidence conflicts with this ranking criterion.":match?"Candidate-owned evidence supports this ranking criterion.":"Candidate-owned evidence for this ranking criterion was not found.",provenance:evidenceEntry?{candidateId:candidate.candidateId,sourceRecordId:evidenceEntry.sourceRecordId,sourceType:evidenceEntry.sourceType,sourceField:evidenceEntry.sourceField,excerpt:excerpt(evidenceEntry.value),talentPool:candidate.talentPool||"internal_profiles"}:null};
 });
 const totalWeight=evaluations.reduce((sum,item)=>sum+item.weight,0),matchedWeight=evaluations.reduce((sum,item)=>sum+(item.weight*item.score)/100,0);
 return{version:SEARCH_V2_CRITERIA_SCORING_VERSION,scorePercent:totalWeight?Math.round((matchedWeight/totalWeight)*100):0,matchedWeight,totalWeight,criteria:evaluations};
}

export function overallRecruiterMatch(input:{requiredCoverage:number;criteriaScore:number;evidenceConfidence:number}){return Math.round(input.requiredCoverage*0.5+input.criteriaScore*0.3+input.evidenceConfidence*0.2)}
export function generatedCriteriaForRequirementLabels(labels:readonly string[]){const text=labels.join(" ").toLowerCase(),suggestions:CandidateSearchCriterion[]=[];const add=(id:string,label:string,importance:CandidateSearchCriterion["importance"],conceptId?:string)=>suggestions.push({id,label,importance,conceptId,source:"ai_suggestion"});if(/\b(?:lead|leader|leadership|manag(?:e|er|ing)|own(?:ed|ership)?|supervis(?:e|or|ing)|stakeholder management|team leadership)\b/.test(text))add("criterion:leadership","Delivery ownership and stakeholder leadership","important");const target=[...new Set(conceptsInText(labels.join(" ")))][0];if(/implementation|rollout|migration|upgrade/.test(text)){const concept=target?searchConcept(target):null;add("criterion:delivery-depth",concept?`Demonstrated ${concept.label} implementation depth`:"Demonstrated implementation depth","most_important",target)}else if(target){const concept=searchConcept(target);if(concept)add(`criterion:depth:${target.toLowerCase()}`,`Demonstrated ${concept.label} delivery depth`,"important",target)}return dedupeSearchCriteria(suggestions)}

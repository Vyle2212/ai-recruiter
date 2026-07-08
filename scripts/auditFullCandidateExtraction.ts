import { auditFullCandidateExtraction } from "../lib/fullCandidateExtractionEngine";
import { loadRealTalentPoolCandidates } from "../lib/candidateAudit";

function top(counts: Record<string, number>, limit = 12) { return Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0, limit); }
function short(v: any) { const s = String(Array.isArray(v) ? v.join(", ") : v || "empty").replace(/\s+/g," ").trim(); return s.length > 120 ? `${s.slice(0,117)}...` : s; }
export function formatFullCandidateExtractionAudit(report: ReturnType<typeof auditFullCandidateExtraction>) {
  const s = report.summary;
  const lines = [
    "==================================================",
    "PRIMUS AI Recruiter",
    "Full Candidate CV Extraction Audit v2",
    "==================================================",
    "",
    "Mode: read-only; no Supabase update/insert/delete",
    `Total candidates: ${s.totalCandidates}`,
    `Raw CV available: ${s.rawCvAvailable}`,
    `Successfully extracted: ${s.successfullyExtracted}`,
    `Likely SAP profiles: ${s.likelySapProfiles}`,
    `Search ready after extraction: ${s.searchReadyAfterExtraction}`,
    `Search-ready before quality gate: ${s.searchReadyBeforeQualityGate}`,
    `Search-ready after quality gate: ${s.searchReadyAfterQualityGate}`,
    `Downgraded from search-ready due to title quality: ${s.downgradedFromSearchReadyDueToTitleQuality}`,
    `Title suspicious but still search-ready count: ${s.titleSuspiciousButStillSearchReadyCount}`,
    `Downgraded from search-ready due to module mismatch: ${s.downgradedFromSearchReadyDueToModuleMismatch}`,
    `Downgraded from search-ready due to company quality: ${s.downgradedFromSearchReadyDueToCompanyQuality}`,
    `Primary module corrected from title count: ${s.primaryModuleCorrectedFromTitleCount}`,
    `Title normalized from certification count: ${s.titleNormalizedFromCertificationCount}`,
    `Parser recoverable: ${s.parserRecoverable}`,
    `Manual review required: ${s.manualReviewRequired}`,
    `Likely reupload required: ${s.likelyReuploadRequired}`,
    `Blocked identity: ${s.blockedIdentity}`,
    `Blocked identity before: ${s.blockedIdentityBefore}`,
    `Blocked identity after: ${s.blockedIdentityAfter}`,
    `Blocked identity before deep recovery: ${s.blockedIdentityBeforeDeepRecovery}`,
    `Blocked identity after deep recovery: ${s.blockedIdentityAfterDeepRecovery}`,
    `Deep recovered identities count: ${s.deepRecoveredIdentitiesCount}`,
    `High confidence recovered identities: ${s.highConfidenceRecoveredIdentities}`,
    `Medium confidence possible identities: ${s.mediumConfidencePossibleIdentities}`,
    `Rejected placeholders count: ${s.rejectedPlaceholdersCount}`,
    `Rejected source/module-prefix names count: ${s.rejectedSourceOrModulePrefixNamesCount}`,
    `Rejected section-heading names count: ${s.rejectedSectionHeadingNamesCount}`,
    `Insufficient identity evidence count: ${s.insufficientIdentityEvidenceCount}`,
    `Likely reupload due to identity raw text issue count: ${s.likelyReuploadDueToIdentityRawTextIssueCount}`,
    `Names recovered from blocked identity: ${s.namesRecoveredFromBlockedIdentity}`,
    `Names recovered via raw identity evidence: ${s.namesRecoveredViaRawIdentityEvidence || 0}`,
    `Suspicious names rejected: ${s.suspiciousNamesRejected}`,
    `Search ready after identity recovery: ${s.searchReadyAfterIdentityRecovery}`,
    `Parser recoverable after identity recovery: ${s.parserRecoverableAfterIdentityRecovery}`,
    `Blocked title: ${s.blockedTitle}`,
    `Blocked contact/location: ${s.blockedContactLocation}`,
    `Clean name extracted: ${s.cleanNameExtracted}`,
    `Clean title extracted: ${s.cleanTitleExtracted}`,
    `Clean company extracted: ${s.cleanCompanyExtracted}`,
    `SAP module extracted: ${s.sapModuleExtracted}`,
    `Contact extracted: ${s.contactExtracted}`,
    `Location extracted: ${s.locationExtracted}`,
    `Expected salary extracted: ${s.expectedSalaryExtracted}`,
    `Current employer extracted: ${s.currentEmployerExtracted}`,
    `Invalid current employer rejected count: ${s.invalidCurrentEmployerRejectedCount || 0}`,
    `Current employer tenure extracted: ${s.currentEmployerTenureExtracted || 0}`,
    `Current employer tenure removed due to invalid employer count: ${s.currentEmployerTenureRemovedDueToInvalidEmployerCount || 0}`,
    `Previous employer extracted: ${s.previousEmployerExtracted}`,
    `Invalid previous employer rejected count: ${s.invalidPreviousEmployerRejectedCount || 0}`,
    `Previous employer tenure extracted: ${s.previousEmployerTenureExtracted || 0}`,
    `Previous employer tenure removed due to invalid employer count: ${s.previousEmployerTenureRemovedDueToInvalidEmployerCount || 0}`,
    `YOE rejected due to weak evidence count: ${s.yoeRejectedDueToWeakEvidenceCount || 0}`,
    `Explicit total YOE extracted count: ${s.explicitTotalYoeExtractedCount || 0}`,
    `Calculated total YOE count: ${s.calculatedTotalYoeCount || 0}`,
    `Explicit SAP YOE extracted count: ${s.explicitSapYoeExtractedCount || 0}`,
    `Calculated SAP YOE count: ${s.calculatedSapYoeCount || 0}`,
    `Total YOE extracted count: ${s.totalYoeExtracted || 0}`,
    `SAP YOE extracted count: ${s.sapYoeExtracted || 0}`,
    "",
    "Primary SAP Module Distribution",
  ];
  for (const [k,v] of top(report.distributions.primarySapModuleDistribution, 20)) lines.push(`- ${k}: ${v}`);
  lines.push("", "Review Classification Distribution");
  for (const [k,v] of top(report.distributions.reviewClassificationDistribution, 20)) lines.push(`- ${k}: ${v}`);
  lines.push("", "Top Missing/Recovered Fields");
  for (const [k,v] of top(report.distributions.topMissingRecoveredFields, 20)) lines.push(`- ${k}: ${v}`);
  lines.push("", "Top 30 Current Employer Tenure Examples");
  for (const i of (report.suspiciousExamples.currentEmployerTenure || []).slice(0,30)) lines.push(`- ${i.candidateId}: ${short(i.name)} | ${short(i.company)} | ${short(i.startDate)} - ${short(i.endDate)} | ${short(i.tenureText)} (${short(i.years)} yrs)`);
  if (!(report.suspiciousExamples.currentEmployerTenure || []).length) lines.push("- None");
  lines.push("", "Top 30 Previous Employer Tenure Examples");
  for (const i of (report.suspiciousExamples.previousEmployerTenure || []).slice(0,30)) lines.push(`- ${i.candidateId}: ${short(i.name)} | ${short(i.company)} | ${short(i.startDate)} - ${short(i.endDate)} | ${short(i.tenureText)} (${short(i.years)} yrs)`);
  if (!(report.suspiciousExamples.previousEmployerTenure || []).length) lines.push("- None");
  lines.push("", "Top 30 Total YOE Examples");
  for (const i of (report.suspiciousExamples.totalYoe || []).slice(0,30)) lines.push(`- ${i.candidateId}: ${short(i.name)} | total=${short(i.totalYearsExperience)} | sap=${short(i.sapYearsExperience)} | evidence=${short(i.evidence)}`);
  if (!(report.suspiciousExamples.totalYoe || []).length) lines.push("- None");
  lines.push("", "Top 30 Failed Employer Tenure Extraction Examples");
  for (const i of (report.suspiciousExamples.failedEmployerTenure || []).slice(0,30)) lines.push(`- ${i.candidateId}: ${short(i.name)} | ${short(i.company)} | evidence=${short(i.evidence)}`);
  if (!(report.suspiciousExamples.failedEmployerTenure || []).length) lines.push("- None");
  lines.push("", "Top 30 Rejected Current Employer Examples");
  for (const i of (report.suspiciousExamples.rejectedCurrentEmployer || []).slice(0,30)) lines.push(`- ${i.candidateId}: ${short(i.name)} | company=${short(i.company)} | reason=${short(i.reason)} | evidence=${short(i.evidence)}`);
  if (!(report.suspiciousExamples.rejectedCurrentEmployer || []).length) lines.push("- None");
  lines.push("", "Top 30 Rejected Previous Employer Examples");
  for (const i of (report.suspiciousExamples.rejectedPreviousEmployer || []).slice(0,30)) lines.push(`- ${i.candidateId}: ${short(i.name)} | company=${short(i.company)} | reason=${short(i.reason)}`);
  if (!(report.suspiciousExamples.rejectedPreviousEmployer || []).length) lines.push("- None");
  lines.push("", "Top 30 YOE Rejected Examples");
  for (const i of (report.suspiciousExamples.yoeRejected || []).slice(0,30)) lines.push(`- ${i.candidateId}: ${short(i.name)} | reason=${short(i.reason)} | evidence=${short(i.evidence)}`);
  if (!(report.suspiciousExamples.yoeRejected || []).length) lines.push("- None");
  lines.push("", "Top 20 Downgraded Search-ready Examples");
  for (const i of (report.suspiciousExamples.downgraded || []).slice(0,20)) lines.push(`- ${i.candidateId}: ${short(i.name)} | ${short(i.title)} | ${short(i.module)} | company=${short(i.company)} | reasons=${short(i.reasons)}`);
  if (!(report.suspiciousExamples.downgraded || []).length) lines.push("- None");
  lines.push("", "Top Title Suspicious But Still Search-ready Examples");
  for (const i of (report.suspiciousExamples.titleSuspiciousStillSearchReady || []).slice(0,20)) lines.push(`- ${i.candidateId}: ${short(i.name)} | ${short(i.title)} | module=${short(i.module)} | reason=${short(i.reason)}`);
  if (!(report.suspiciousExamples.titleSuspiciousStillSearchReady || []).length) lines.push("- None");
  lines.push("", "Top 20 Corrected Title/Module Examples");
  for (const i of (report.suspiciousExamples.correctedTitleModule || []).slice(0,20)) lines.push(`- ${i.candidateId}: ${short(i.name)} | ${short(i.title)} | module=${short(i.module)} | reason=${short(i.reason)}`);
  if (!(report.suspiciousExamples.correctedTitleModule || []).length) lines.push("- None");
  lines.push("", "Top 20 Search-ready Examples");
  for (const i of report.searchReadyItems.slice(0,20)) lines.push(`- ${i.candidateId}: ${short(i.extractedFullName)} | ${short(i.extractedCurrentTitle)} | ${short(i.primarySapModule)} | company=${short(i.extractedCurrentCompany)}`);
  if (!report.searchReadyItems.length) lines.push("- None");
  lines.push("", "Top 20 Parser-recoverable Examples");
  for (const i of report.parserRecoverableItems.slice(0,20)) lines.push(`- ${i.candidateId}: ${short(i.extractedFullName)} | reasons=${short(i.reviewReasons)}`);
  if (!report.parserRecoverableItems.length) lines.push("- None");
  lines.push("", "Top 20 Manual-review Examples");
  for (const i of report.manualReviewItems.slice(0,20)) lines.push(`- ${i.candidateId}: ${short(i.extractedFullName || i.existingDisplayName)} | reasons=${short(i.reviewReasons)}`);
  if (!report.manualReviewItems.length) lines.push("- None");
  lines.push("", "Top 20 Likely-reupload-required Examples");
  for (const i of report.likelyReuploadRequiredItems.slice(0,20)) lines.push(`- ${i.candidateId}: ${short(i.rawTextQualityReason)}`);
  if (!report.likelyReuploadRequiredItems.length) lines.push("- None");
  lines.push("", "Top 30 Deep Recovered Identity Examples");
  for (const i of (report.suspiciousExamples.deepRecoveredIdentity || []).slice(0,30)) lines.push(`- ${i.candidateId}: ${short(i.value)} (${short(i.source)}, ${short(i.confidence)}, ${short(i.decision)}) evidence=${short(i.evidence)}`);
  if (!(report.suspiciousExamples.deepRecoveredIdentity || []).length) lines.push("- None");
  lines.push("", "Top 30 Possible Review-only Identity Examples");
  for (const i of (report.suspiciousExamples.possibleReviewOnlyIdentity || []).slice(0,30)) lines.push(`- ${i.candidateId}: ${short(i.value)} (${short(i.source)}, ${short(i.confidence)}, ${short(i.decision)}) evidence=${short(i.evidence)}`);
  if (!(report.suspiciousExamples.possibleReviewOnlyIdentity || []).length) lines.push("- None");
  lines.push("", "Top 30 Still Blocked Identity Examples");
  for (const i of (report.suspiciousExamples.stillBlockedIdentity || []).slice(0,30)) lines.push(`- ${i.candidateId}: ${short(i.value)} (${short(i.reason)}, ${short(i.decision)}) evidence=${short(i.evidence)}`);
  if (!(report.suspiciousExamples.stillBlockedIdentity || []).length) lines.push("- None");
  lines.push("", "Top 20 Recovered Identity Examples");
  for (const i of (report.suspiciousExamples.identityRecovered || []).slice(0,20)) lines.push(`- ${i.candidateId}: ${short(i.value)} (${short(i.source)}, ${short(i.bucket)}, ${short(i.confidence)}) evidence=${short(i.evidence)}`);
  if (!(report.suspiciousExamples.identityRecovered || []).length) lines.push("- None");
  lines.push("", "Top 20 Rejected Identity Examples");
  for (const i of (report.suspiciousExamples.identityRejected || []).slice(0,20)) lines.push(`- ${i.candidateId}: ${short(i.value)} (${short(i.reason)}, ${short(i.bucket)}) evidence=${short(i.evidence)}`);
  if (!(report.suspiciousExamples.identityRejected || []).length) lines.push("- None");
  lines.push("", "Top Suspicious Name Examples");
  for (const i of report.suspiciousExamples.names.slice(0,20)) lines.push(`- ${i.candidateId}: ${short(i.value)} (${short(i.reason)})`);
  if (!report.suspiciousExamples.names.length) lines.push("- None");
  lines.push("", "Top Suspicious Title Examples");
  for (const i of report.suspiciousExamples.titles.slice(0,20)) lines.push(`- ${i.candidateId}: ${short(i.value)} (${short(i.reason)})`);
  if (!report.suspiciousExamples.titles.length) lines.push("- None");
  lines.push("", "Top Suspicious Company Examples");
  for (const i of report.suspiciousExamples.companies.slice(0,20)) lines.push(`- ${i.candidateId}: ${short(i.value)} (${short(i.reason)})`);
  if (!report.suspiciousExamples.companies.length) lines.push("- None");
  lines.push("", "Top Client/Project Company Examples");
  for (const i of report.suspiciousExamples.clientCompanies.slice(0,20)) lines.push(`- ${i.candidateId}: ${short(i.values)}`);
  if (!report.suspiciousExamples.clientCompanies.length) lines.push("- None");
  return lines.join("\n");
}
async function main(){ const { candidates } = await loadRealTalentPoolCandidates(); console.log(formatFullCandidateExtractionAudit(auditFullCandidateExtraction(candidates))); }
main().catch(e=>{ console.error(e instanceof Error ? e.message : e); process.exitCode=1; });





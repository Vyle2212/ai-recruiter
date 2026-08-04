"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, Download, FileText, Mail, Save, Send, Sparkles } from "lucide-react";
import { jsPDF } from "jspdf";
import {
  normalizeCompareCandidate,
  rankCompareCandidates,
  type AnyRecord,
  type CandidateCompareSignal,
} from "@/lib/candidateCompareEngine";
import { calculateSubmissionConfidence, type SubmissionConfidenceResult } from "@/lib/submissionConfidence";

const MATCHES_CACHE_KEY = "sapTalentHub.matches.pageState.v1";
const SEARCH_SESSION_PREFIX = "sapTalentHub.searchSession.v1.";
const NOTES_KEY = "primus.submission.notes.v1";
const DRAFT_KEY = "primus.submission.drafts.v1";

type SubmissionDrafts = Record<string, { notes: string; email: string; updatedAt: string }>;

type Snapshot = {
  matches: AnyRecord[];
  candidateIds: string[];
  primaryModule: string;
  searchSessionId: string;
};

function emptySnapshot(): Snapshot {
  return { matches: [], candidateIds: [], primaryModule: "", searchSessionId: "" };
}

function clean(value: any, fallback = "To confirm") {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text || fallback;
}

function raw(candidate: CandidateCompareSignal | undefined, keys: string[], fallback = "To confirm") {
  if (!candidate) return fallback;
  for (const key of keys) {
    const value = candidate.raw?.[key];
    if (value !== null && value !== undefined && clean(value, "") !== "") return clean(value, fallback);
  }
  return fallback;
}

function rawList(candidate: CandidateCompareSignal | undefined, keys: string[], fallback = "To confirm") {
  if (!candidate) return fallback;
  for (const key of keys) {
    const value = candidate.raw?.[key];
    if (Array.isArray(value) && value.length) return value.map((item) => clean(item, "")).filter(Boolean).join(", ");
    if (value !== null && value !== undefined && clean(value, "") !== "") return clean(value, fallback);
  }
  return fallback;
}

function textOf(value: any): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map(textOf).join(" ");
  if (typeof value === "object") return Object.values(value).map(textOf).join(" ");
  return String(value);
}

function hasText(candidate: CandidateCompareSignal | undefined, terms: string[]) {
  const blob = textOf(candidate?.raw || {}) + " " + (candidate?.text || "");
  const lower = blob.toLowerCase();
  return terms.some((term) => lower.includes(term.toLowerCase()));
}

function numberValue(candidate: CandidateCompareSignal | undefined, keys: string[]) {
  if (!candidate) return 0;
  for (const key of keys) {
    const value = Number(candidate.raw?.[key]);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return 0;
}

function sentenceLimit(value: string, maxWords: number) {
  const words = value.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  return words.length <= maxWords ? words.join(" ") : words.slice(0, maxWords).join(" ").replace(/[,.]$/, "") + ".";
}

function readSnapshot(searchId: string) {
  if (typeof window === "undefined") return emptySnapshot();
  const stores = [window.localStorage, window.sessionStorage];
  for (const store of stores) {
    const direct = searchId ? store.getItem(SEARCH_SESSION_PREFIX + searchId) : "";
    const fallback = store.getItem(MATCHES_CACHE_KEY);
    for (const rawState of [direct, fallback]) {
      if (!rawState) continue;
      try {
        const parsed = JSON.parse(rawState);
        const matches = Array.isArray(parsed.matches) ? parsed.matches : Array.isArray(parsed.candidates) ? parsed.candidates : Array.isArray(parsed.results) ? parsed.results : [];
        const ids = Array.isArray(parsed.candidateIds) ? parsed.candidateIds : matches.map((item: AnyRecord) => String(item.id || item.candidate_id || item.email || item.name || "")).filter(Boolean);
        return { matches, candidateIds: ids, primaryModule: clean(parsed.primaryModule || parsed.module || parsed.filters?.module, ""), searchSessionId: clean(parsed.searchSessionId || parsed.searchId || searchId, "") };
      } catch {}
    }
  }
  return emptySnapshot();
}

function submissionInput(candidate: CandidateCompareSignal): AnyRecord {
  return {
    ...candidate.raw,
    name: candidate.name,
    current_title: candidate.title,
    title: candidate.title,
    primary_module: candidate.module,
    module: candidate.module,
    current_company: candidate.company,
    company: candidate.company,
    location: candidate.location,
    search_fit: candidate.score,
    text: candidate.text,
  };
}

function commercialReadinessLabel(result: SubmissionConfidenceResult | null | undefined) {
  if (!result) return "Commercial Validation Required";
  if (result.score >= 85 && !result.pending.length) return "Ready for Release";
  if (result.score >= 70) return "Pending Validation";
  return "Commercial Validation Required";
}

function recommendationLevel(candidate: CandidateCompareSignal | undefined, index: number) {
  if (!candidate) return "Select Candidate";
  if (index <= 0) return "Recommended for First Submission";
  if (index === 1) return "Backup Candidate";
  return "Hold for Validation";
}

function shortValidation(item: string) {
  if (/salary|compensation|package/i.test(item)) return "Salary";
  if (/availability|start/i.test(item)) return "Availability";
  if (/notice/i.test(item)) return "Notice Period";
  if (/architecture/i.test(item)) return "Architecture ownership";
  if (/implementation/i.test(item)) return "Implementation ownership";
  if (/client/i.test(item)) return "Client-facing delivery";
  return item.replace(/ Confirmation$/i, "").trim();
}

function years(candidate: CandidateCompareSignal | undefined) {
  const value = numberValue(candidate, ["sap_years", "years", "experience_years", "total_years", "years_experience"]);
  return value ? `${value}+ years` : "To confirm";
}

function implementationCount(candidate: CandidateCompareSignal | undefined) {
  return numberValue(candidate, ["implementation_project_count", "implementationProjects", "implementation_projects", "implementation_count", "implementations"]);
}

function s4Count(candidate: CandidateCompareSignal | undefined) {
  return numberValue(candidate, ["s4hana_project_count", "s4_implementation_count", "s4hanaProjects", "s4hana_projects", "s4_count", "s4hana_count"]);
}

function executiveConfidence(candidate: CandidateCompareSignal | undefined, confidence: SubmissionConfidenceResult | null) {
  if (!candidate) return 0;
  return Math.round(candidate.score * 0.72 + (confidence?.score || 0) * 0.28);
}

function evidenceBullets(candidate: CandidateCompareSignal | undefined) {
  const bullets: string[] = [];
  if (implementationCount(candidate) || hasText(candidate, ["implementation", "go-live", "full cycle", "rollout"])) bullets.push("Delivery ramp-up risk is lower because implementation accountability is evidenced");
  if (s4Count(candidate) || hasText(candidate, ["s/4hana", "s4hana", "s4 hana"])) bullets.push("Transformation mis-hire risk is lower because S/4HANA relevance is evidenced");
  if (/architect|solution design|lead consultant|design authority/i.test(candidate?.title || "") || hasText(candidate, ["solution architect", "architecture", "solution design"])) bullets.push("Design governance risk is lower because architecture accountability is evidenced");
  if (hasText(candidate, ["workshop", "stakeholder", "client-facing", "client facing", "presentation"])) bullets.push("Stakeholder confidence is higher because client-facing delivery is evidenced");
  if (hasText(candidate, ["regional", "rollout", "multi-country", "global template", "transformation"])) bullets.push("Enterprise rollout relevance is stronger than support-only delivery");
  return bullets.length ? bullets.slice(0, 5) : ["Client decision risk cannot be reduced until delivery evidence is validated", "Recruiter validation required before release"];
}
function retainedSearchQualityGate(value: string) {
  const consequencePattern = /risk|decision|commercial|delivery|governance|confidence|validation|release|onboarding|stakeholder|transformation|mandate|client|business|interview|offer|joining|accountability/i;
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) return true;
      if (/^[A-Z][A-Za-z\s()]+:?$/.test(line)) return true;
      if (/^[-0-9.\s]*$/.test(line)) return true;
      return consequencePattern.test(line);
    })
    .join("\n")
    .replace(/\bstrong candidate\b/gi, "lower-risk interview option")
    .replace(/\bgood communication\b/gi, "stakeholder confidence signal")
    .replace(/\bexcellent experience\b/gi, "evidence that changes the client decision")
    .replace(/\bsuitable profile\b/gi, "defensible first-interview option")
    .trim();
}

function executiveSummary(candidate: CandidateCompareSignal | undefined, confidence: SubmissionConfidenceResult | null, module: string) {
  if (!candidate) return "Select a candidate to generate the executive recommendation.";
  const evidence = evidenceBullets(candidate);
  const pending = considerationItems(confidence, candidate).slice(0, 3);
  return retainedSearchQualityGate([
    `Decision: If the client interviews only one person today, it should be ${candidate.name}. The decision is driven by ${evidence.slice(0, 2).map((item) => item.toLowerCase()).join(" and ")} for the current SAP ${module || candidate.module || "mandate"}.`,
    `Decision consequence: Long tenure alone is not the recommendation. The recommendation is driven by evidence that reduces delivery and transformation risk.`,
    `Business consequence: Faster onboarding, sharper design decisions and higher stakeholder confidence during the first phase of client evaluation.`,
    `Commercial consequence: ${pending.length ? pending.join(", ").toLowerCase() + " remain pending." : "commercial validation is substantially complete."}`,
    `Recommended action: ${pending.length ? "Proceed after " + pending[0].toLowerCase() + " confirmation." : "Proceed to client submission."}`,
  ].join("\n\n"));
}

function considerationItems(confidence: SubmissionConfidenceResult | null, candidate: CandidateCompareSignal | undefined) {
  const pending = confidence?.pending?.map(shortValidation) || [];
  const items = Array.from(new Set(pending));
  if (hasText(candidate, ["greenfield"]) && !items.includes("Greenfield ownership")) items.push("Greenfield ownership partially evidenced");
  return (items.length ? items : ["Final recruiter confirmation before release"]).slice(0, 5);
}

function interviewFocus(candidate: CandidateCompareSignal | undefined, confidence: SubmissionConfidenceResult | null) {
  const items = ["Architecture ownership", "Transformation accountability", "Team leadership", "Workshop facilitation", "Stakeholder management"];
  if (confidence?.pending?.some((item) => /salary|availability|notice/i.test(item))) items.push("Commercial alignment");
  if (!hasText(candidate, ["team", "lead", "managed"])) items.push("Leadership scope");
  return Array.from(new Set(items)).slice(0, 6);
}

function chipTone(value: string) {
  return /confirm|pending|unknown|not disclosed|to confirm|required/i.test(value) ? "bg-amber-500/10 text-amber-100 ring-amber-500/20" : "bg-cyan-500/10 text-cyan-100 ring-cyan-500/20";
}

function executiveInsights(candidate: CandidateCompareSignal | undefined, ranked: CandidateCompareSignal[], confidence: SubmissionConfidenceResult | null, module: string) {
  if (!candidate) return ["Ownership requires further validation before any executive insight can be asserted.", "Commercial readiness cannot be interpreted until validation data is available.", "Delivery confidence remains unproven without accountable implementation evidence.", "The shortlist cannot be sequenced without comparable business-positioning signals.", "Client interview strategy should remain paused until evidence quality improves."];
  const evidence = evidenceBullets(candidate).join(" ");
  const pending = considerationItems(confidence, candidate);
  const backup = ranked.find((item) => item.id !== candidate.id);
  const qualityGap = Math.max(0, Math.round((candidate.score || 0) - (backup?.score || 0)));
  const hasArchitecture = /architecture|governance/i.test(evidence) || hasText(candidate, ["architecture", "solution architect", "solution design", "design authority"]);
  const hasTransformation = /transformation|s\/4hana|rollout/i.test(evidence) || hasText(candidate, ["transformation", "s/4hana", "greenfield", "rollout", "migration"]);
  const hasStakeholder = /stakeholder|client/i.test(evidence) || hasText(candidate, ["stakeholder", "workshop", "client-facing", "presentation"]);
  return [
    hasArchitecture ? "Architecture ownership reduces early programme ambiguity because design accountability is less likely to sit with the client after onboarding." : "A weaker architecture signal increases downstream design governance risk; ownership requires further validation before executive positioning.",
    pending.length ? `Commercial validation is the remaining release constraint; until ${pending.slice(0, 3).map((item) => item.toLowerCase()).join(", ")} close, the recommendation should be positioned as conditional.` : "Commercial validation is not the gating issue, so the client conversation can focus on delivery confidence and mandate fit.",
    qualityGap > 0 ? `The quality gap to the next shortlisted option is ${qualityGap} points, which means the first interview decision is driven by risk reduction rather than cosmetic profile preference.` : "A technically comparable alternative does not automatically create equal delivery confidence; the decision should remain anchored to ownership and validation quality.",
    hasTransformation ? "Transformation evidence indicates suitability for enterprise rollout work, reducing the risk of hiring a support-oriented profile into a change programme." : "Limited transformation evidence raises implementation-context risk; the interview should test whether this is delivery ownership or adjacent participation.",
    hasStakeholder ? `Stakeholder-facing evidence improves interview confidence because the candidate is more likely to withstand CIO, delivery and business-user scrutiny; Executive Confidence is ${executiveConfidence(candidate, confidence)}%.` : `Stakeholder governance remains a validation point; match signal is ${Math.round(candidate.score || 0)}%, but client-facing confidence should not be assumed.`,
  ];
}
function positioningMatrix(candidateList: CandidateCompareSignal[], module: string) {
  if (!candidateList.length) return "POSITIONING MATRIX\nNo shortlisted candidates selected.";
  return candidateList.map((candidate, index) => {
    const confidence = calculateSubmissionConfidence(submissionInput(candidate), { requiredModule: module || candidate.module });
    const evidence = evidenceBullets(candidate);
    const pending = considerationItems(confidence, candidate);
    const primary = evidence[0] || "Ownership requires further validation.";
    const weakest = pending[0] ? `${pending[0]} requires validation before client release.` : "Commercial release still requires final recruiter confirmation.";
    const businessPosition = index === 0 ? "Lowest-risk first interview" : pending.length ? "Commercially conditional alternative" : evidence.some((item) => /architecture|governance/i.test(item)) ? "Architecture validation alternative" : "Delivery validation alternative";
    const persona = evidence.some((item) => /architecture|governance/i.test(item)) ? "CIO / Enterprise Architect" : evidence.some((item) => /delivery|implementation/i.test(item)) ? "Delivery Director" : evidence.some((item) => /stakeholder|client/i.test(item)) ? "Hiring Manager / Programme Sponsor" : "Recruiter / Account Manager";
    const stage = index === 0 && !pending.length ? "First client interview" : pending.some((item) => /salary|availability|notice|package/i.test(item)) ? "Recruiter commercial validation" : index <= 1 ? "Client shortlist calibration" : "Backup validation stage";
    const threat = index === 0 ? "Sets the benchmark for delivery-risk reduction across the shortlist." : confidence.score >= 70 ? "Could challenge the first submission if validation closes quickly." : "Threat is limited until validation improves.";
    const priority = index === 0 ? "1 - Interview first" : index === 1 ? "2 - Backup if release risk changes" : pending.length ? "3 - Hold pending validation" : "3 - Keep warm for calibration";
    return [
      candidate.name,
      `Primary Selling Point: ${primary}`,
      `Weakest Selling Point: ${weakest}`,
      `Business Position: ${businessPosition}`,
      `Client Persona: ${persona}`,
      `Best Interview Stage: ${stage}`,
      `Competitive Threat: ${threat}`,
      `Decision Priority: ${priority}`,
    ].join("\n");
  }).join("\n\n");
}
function whyInterviewFirst(candidate: CandidateCompareSignal | undefined, ranked: CandidateCompareSignal[], confidence: SubmissionConfidenceResult | null, module: string) {
  if (!candidate) return "Decision\nOwnership requires further validation.\n\nBusiness Consequence\nEvidence is insufficient to present a first-interview recommendation.\n\nCommercial Consequence\nCommercial readiness requires validation.\n\nDelivery Consequence\nOwnership requires further validation.\n\nRisk if Not Selected\nNo defensible risk trade-off can be asserted until evidence is confirmed.\n\nRecommended Action\nValidate ownership, commercial alignment and availability before client positioning.\n\nConfidence\nPending validation.";
  const evidence = evidenceBullets(candidate);
  const pending = considerationItems(confidence, candidate);
  const execConfidence = executiveConfidence(candidate, confidence);
  const alternativeCount = Math.max(0, ranked.length - 1);
  const comparison = alternativeCount ? `Compared with ${alternativeCount} alternative shortlisted profile${alternativeCount > 1 ? "s" : ""}, this is the most defensible first interview because the match signal is ${Math.round(candidate.score || 0)}% and the evidence lowers delivery risk.` : `Match signal is ${Math.round(candidate.score || 0)}%; recruiter calibration is required because no alternative slate is available.`;
  const commercial = pending.length ? `Commercial release is not unconditional. ${pending.slice(0, 3).join(", ")} must be confirmed before final client release.` : "Commercial risk is not the current gating issue; final recruiter confirmation remains required.";
  return [
    "Decision",
    `Interview ${candidate.name} first if the client wants the lowest-risk decision today. ${comparison}`,
    "",
    "Business Consequence",
    evidence.slice(0, 2).join(" "),
    "",
    "Commercial Consequence",
    commercial,
    "",
    "Delivery Consequence",
    evidence.find((item) => /delivery|implementation|architecture|governance/i.test(item)) || "Ownership requires further validation.",
    "",
    "Risk if Not Selected",
    "Passing on this candidate first may delay the most defensible interview path identified by the current comparison and validation signals.",
    "",
    "Recommended Action",
    pending.length ? `Confirm ${pending[0].toLowerCase()} before client release.` : "Proceed to first interview review after final recruiter confirmation.",
    "",
    "Confidence",
    `${execConfidence}% Executive Confidence. Commercial Readiness: ${confidence?.score || 0}%.`,
  ].join("\n");
}
function positioningStrategy(candidate: CandidateCompareSignal | undefined, ranked: CandidateCompareSignal[], confidence: SubmissionConfidenceResult | null, module: string) {
  if (!candidate) return "POSITIONING STRATEGY\n\nPrimary Positioning\nOwnership requires further validation.\n\nSecondary Positioning\nPending validation.\n\nAvoid Positioning\nDo not position on tenure, certifications or generic SAP experience.\n\nCompetitive Advantage\nPending validation.\n\nBusiness Narrative\nPending validation.\n\nExecutive Soundbite (30 words)\nOwnership requires further validation before this candidate should be positioned as the lowest-risk first interview.";
  const evidence = evidenceBullets(candidate);
  const pending = considerationItems(confidence, candidate);
  const coverage = Math.round(candidate.score || 0);
  const alternativeCount = Math.max(0, ranked.length - 1);
  const primary = `Position ${candidate.name} as the lowest-risk first interview for SAP ${module || candidate.module || "the mandate"}: the story is delivery-risk reduction, not resume breadth.`;
  const secondary = evidence[1] || "Ownership requires further validation before secondary positioning is asserted.";
  const avoid = pending.length ? `Do not oversell commercial readiness. Lead with transparent validation on ${pending.slice(0, 3).map((item) => item.toLowerCase()).join(", ")}. Avoid tenure-led positioning.` : "Do not position on tenure, certifications or generic SAP capability. Keep the narrative anchored to delivery risk and mandate fit.";
  const advantage = alternativeCount ? `Compared with ${alternativeCount} alternative shortlisted profile${alternativeCount > 1 ? "s" : ""}, this candidate creates the clearest path to a defensible first interview because match signal is ${coverage}%.` : `Match signal is ${coverage}%; use this only after recruiter calibration because no alternative slate is available.`;
  const narrative = `${evidence.slice(0, 3).join(" ")} The client conversation should connect these outcomes to faster onboarding, stronger governance and reduced transformation execution risk.`;
  const soundbite = sentenceLimit(`${candidate.name} should be positioned as the first interview because the evidence reduces delivery risk, improves governance confidence and keeps commercial validation explicit before client release.`, 30);
  return [
    "POSITIONING STRATEGY",
    "",
    "Primary Positioning",
    primary,
    "",
    "Secondary Positioning",
    secondary,
    "",
    "Avoid Positioning",
    avoid,
    "",
    "Competitive Advantage",
    advantage,
    "",
    "Business Narrative",
    narrative,
    "",
    "Executive Soundbite (30 words)",
    soundbite,
  ].join("\n");
}
function executiveEmail(candidate: CandidateCompareSignal | undefined, confidence: SubmissionConfidenceResult | null, module: string) {
  if (!candidate) return "";
  const highlights = evidenceBullets(candidate).slice(0, 4).map((item) => "- " + item).join("\n");
  const commercial = considerationItems(confidence, candidate).slice(0, 3).join(", ").toLowerCase();
  return [
    "Hi Sarah,",
    "",
    `After reviewing the shortlisted market, I would prioritise ${candidate.name} if the client can only interview one person today.`,
    "",
    `The recommendation is based on business consequence rather than capability labels: ${evidenceBullets(candidate).slice(0, 2).map((item) => item.toLowerCase()).join(" ")} Compared with the remaining shortlist, this creates the most defensible first interview decision.`,
    "",
    "Why this reduces hiring risk",
    highlights,
    "",
    `The only remaining validation relates to ${commercial || "final commercial alignment"}, which we are confirming before release.`,
    "",
    "Recommended next step: confirm commercial alignment, then proceed to first interview review.",
    "",
    "Best regards,",
    "Vy",
  ].join("\n");
}

function downloadFile(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function fileName(candidate: CandidateCompareSignal | undefined, ext: string) {
  const base = (candidate?.name || "candidate-submission").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${base || "candidate-submission"}-${new Date().toISOString().slice(0, 10)}.${ext}`;
}

function exportClientReport(candidate: CandidateCompareSignal | undefined, ranked: CandidateCompareSignal[], notes: string, module: string) {
  if (!candidate) return;
  const confidence = calculateSubmissionConfidence(submissionInput(candidate), { requiredModule: module || candidate.module });
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const margin = 42;
  const width = doc.internal.pageSize.getWidth() - margin * 2;
  const write = (text: string, x: number, y: number, size = 10, bold = false, maxWidth = width) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(15, 23, 42);
    const lines = doc.splitTextToSize(text, maxWidth);
    doc.text(lines, x, y);
    return lines.length * (size + 3);
  };
  const section = (title: string, body: string, y: number) => {
    y += write(title, margin, y, 10, true);
    y += 6;
    y += write(body, margin, y, 9, false);
    return y + 16;
  };
  const header = (title: string) => {
    doc.setFillColor(5, 7, 10);
    doc.rect(0, 0, doc.internal.pageSize.getWidth(), 68, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(17);
    doc.text(title, margin, 42);
    doc.setTextColor(15, 23, 42);
  };

  header("Executive Recommendation");
  let y = 100;
  y = section("Executive Recommendation", executiveSummary(candidate, confidence, module), y);
  y = section("Commercial Readiness", `${confidence.score}% ${commercialReadinessLabel(confidence)}`, y);
  y = section("Decision Confidence", `${executiveConfidence(candidate, confidence)}% generated from implementation, architecture, transformation, commercial and coverage signals.`, y);
  y = section("Why This Candidate Now", evidenceBullets(candidate).map((item) => "- " + item).join("\n"), y);
  y = section("Commercial Considerations", considerationItems(confidence, candidate).map((item) => "- " + item).join("\n"), y);
  y = section("Immediate Recruiter Action", confidence.pending.length ? `Proceed after ${shortValidation(confidence.pending[0]).toLowerCase()} confirmation.` : "Proceed with client submission.", y);

  doc.addPage();
  header("Alternative Candidate Assessment");
  y = 100;
  y = section("Decision Matrix", ranked.slice(0, 5).map((item, index) => `${index + 1}. ${item.name} - ${index === 0 ? "Recommended" : index === 1 ? "Backup" : "Hold for validation"}`).join("\n"), y);
  y = section("Commercial Differences", ranked.slice(0, 5).map((item) => `${item.name}: ${commercialReadinessLabel(calculateSubmissionConfidence(submissionInput(item), { requiredModule: module || item.module }))}`).join("\n"), y);
  y = section("Why This Candidate", evidenceBullets(candidate).join("; "), y);
  y = section("Why Not Others", ranked.filter((item) => item.id !== candidate.id).slice(0, 4).map((item) => { const itemConfidence = calculateSubmissionConfidence(submissionInput(item), { requiredModule: module || item.module }); const reason = considerationItems(itemConfidence, item)[0]; return `${item.name}: credible alternative, but ${reason.toLowerCase()} keeps hiring risk higher until validated.`; }).join("\n"), y);
  y = section("Validation Remaining", considerationItems(confidence, candidate).join("; "), y);

  doc.addPage();
  header("Candidate Snapshot");
  y = 100;
  y = section("Decision Context", `The client decision should focus on delivery-risk reduction, transformation fit and commercial validation rather than resume chronology.`, y);
  y = section("Transformation Experience", evidenceBullets(candidate).filter((item) => /implementation|transformation|s\/4hana/i.test(item)).join("; ") || "Ownership requires further validation.", y);
  y = section("Architecture", raw(candidate, ["architecture", "architecture_role", "solution_architecture"], hasText(candidate, ["architect", "solution design"]) ? "Architecture accountability signal present" : "To confirm"), y);
  y = section("Leadership", raw(candidate, ["team_size", "leadership", "managed_team_size"], hasText(candidate, ["lead", "team", "managed"]) ? "Stakeholder governance signal present" : "To confirm"), y);
  y = section("Industries", rawList(candidate, ["industry", "industries", "sector"]), y);
  y = section("Regional Coverage", rawList(candidate, ["regional_experience", "countries", "coverage", "location"], candidate.location), y);
  y = section("Languages", rawList(candidate, ["languages", "language"]), y);
  y = section("Commercial Validation", considerationItems(confidence, candidate).join("; "), y);
  y = section("Recruiter Notes", notes || "No recruiter notes recorded.", y);
  section("Immediate Next Action", confidence.pending.length ? `Confirm ${shortValidation(confidence.pending[0]).toLowerCase()} before client release.` : "Release profile to client.", y);
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text("Confidential recommendation prepared for recruiter review and client submission.", margin, 820);
  doc.save(fileName(candidate, "pdf"));
}

function RichNotes({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (ref.current && ref.current.innerText !== value) ref.current.innerText = value;
  }, [value]);
  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      onInput={(event) => onChange(event.currentTarget.innerText)}
      className="min-h-[132px] rounded-2xl bg-[#05070A] p-4 text-sm leading-6 text-slate-200 outline-none ring-1 ring-slate-800/70 focus:ring-cyan-500/30"
    />
  );
}

export function SubmissionGeneratorWorkspace() {
  const [candidates, setCandidates] = useState<CandidateCompareSignal[]>([]);
  const [activeId, setActiveId] = useState("");
  const [module, setModule] = useState("");
  const [notes, setNotes] = useState("");
  const [email, setEmail] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const searchId = params.get("searchId") || params.get("searchSessionId") || "";
    const requestedId = params.get("candidateId") || params.get("id") || "";
    const ids = (params.get("ids") || "").split(",").map((item) => item.trim()).filter(Boolean);
    const snapshot = readSnapshot(searchId);
    const normalized = snapshot.matches.map((item: AnyRecord) => normalizeCompareCandidate(item));
    const byId = new Map(normalized.map((candidate: CandidateCompareSignal) => [candidate.id, candidate]));
    const ordered = ids.length ? ids.map((id: string) => byId.get(id)).filter(Boolean) as CandidateCompareSignal[] : rankCompareCandidates(normalized);
    setCandidates(ordered);
    setModule(params.get("module") || snapshot.primaryModule || ordered[0]?.module || "");
    setActiveId(requestedId || ordered[0]?.id || "");
    try {
      const saved = JSON.parse(window.localStorage.getItem(NOTES_KEY) || "{}");
      const id = requestedId || ordered[0]?.id || "";
      setNotes(saved[id] || "");
      const drafts: SubmissionDrafts = JSON.parse(window.localStorage.getItem(DRAFT_KEY) || "{}");
      setEmail(drafts[id]?.email || "");
    } catch {}
  }, []);

  const candidate = useMemo(() => candidates.find((item) => item.id === activeId) || candidates[0], [candidates, activeId]);
  const ranked = useMemo(() => rankCompareCandidates(candidates), [candidates]);
  const confidence = candidate ? calculateSubmissionConfidence(submissionInput(candidate), { requiredModule: module || candidate.module }) : null;
  const candidateIndex = candidate ? ranked.findIndex((item) => item.id === candidate.id) : -1;
  const generatedEmail = email || executiveEmail(candidate, confidence, module);
  const summary = executiveSummary(candidate, confidence, module);
  const considerations = considerationItems(confidence, candidate);
  const positioning = positioningStrategy(candidate, ranked, confidence, module);
  const interviewFirst = whyInterviewFirst(candidate, ranked, confidence, module);
  const matrix = positioningMatrix(ranked, module);
  const insights = executiveInsights(candidate, ranked, confidence, module);

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  }

  function persistNotes(value = notes) {
    if (!candidate) return;
    const saved = JSON.parse(window.localStorage.getItem(NOTES_KEY) || "{}");
    saved[candidate.id] = value;
    window.localStorage.setItem(NOTES_KEY, JSON.stringify(saved));
  }

  async function copy(value: string, message: string) {
    await navigator.clipboard.writeText(value);
    notify(message);
  }

  function saveDraft() {
    if (!candidate) return;
    persistNotes();
    const drafts: SubmissionDrafts = JSON.parse(window.localStorage.getItem(DRAFT_KEY) || "{}");
    drafts[candidate.id] = { notes, email: generatedEmail, updatedAt: new Date().toISOString() };
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts));
    notify("Draft saved");
  }

  function exportDoc() {
    if (!candidate) return;
    const html = `<html><body><h1>${candidate.name}</h1><h2>Executive Recommendation</h2><p>${summary}</p><h2>Why This Candidate</h2><ul>${evidenceBullets(candidate).map((item) => `<li>${item}</li>`).join("")}</ul><h2>Commercial Considerations</h2><ul>${considerations.map((item) => `<li>${item}</li>`).join("")}</ul><h2>Recruiter Notes</h2><p>${notes || "No recruiter notes recorded."}</p></body></html>`;
    downloadFile(fileName(candidate, "doc"), html, "application/msword");
  }

  if (!candidate) {
    return <main className="min-h-screen bg-[#05070A] p-6 text-white"><section className="mx-auto max-w-3xl rounded-[24px] bg-[#0B1118] p-8 ring-1 ring-slate-800/60"><div className="text-sm text-slate-300">No candidate found. Open this page from a current search or comparison shortlist.</div></section></main>;
  }

  const headerFacts = [
    ["Current Title", candidate.title],
    ["Current Employer", candidate.company],
    ["Location", candidate.location],
    ["Availability", raw(candidate, ["availability", "available_from", "openStatus", "open_status"])],
    ["Notice Period", raw(candidate, ["notice_period", "noticePeriod", "notice", "available_notice"])],
    ["Expected Salary", raw(candidate, ["expected_salary", "expectedSalary", "salary_expectation", "expectedPackage"])],
  ];
  const snapshot = [
    ["Experience", years(candidate)],
    ["Industries", rawList(candidate, ["industry", "industries", "sector"])],
    ["Modules", rawList(candidate, ["primary_module", "module", "sap_module"], candidate.module)],
    ["Architecture", hasText(candidate, ["architect", "solution design"]) ? "Validated signal" : "To confirm"],
    ["Leadership", hasText(candidate, ["lead", "team", "managed"]) ? "Validated signal" : "To confirm"],
    ["Languages", rawList(candidate, ["languages", "language"])],
    ["Travel", raw(candidate, ["travel", "travel_readiness", "travelReadiness"])],
    ["Visa", raw(candidate, ["visa", "work_authorization", "work_rights", "workRights"])],
    ["Relocation", raw(candidate, ["relocation", "relocate", "relocation_status"])],
    ["Availability", raw(candidate, ["availability", "available_from", "openStatus", "open_status"])],
  ];
  const commercial = [
    ["Package", raw(candidate, ["expected_salary", "expectedSalary", "salary_expectation", "expectedPackage"])],
    ["Availability", raw(candidate, ["availability", "available_from", "openStatus", "open_status"])],
    ["Notice", raw(candidate, ["notice_period", "noticePeriod", "notice", "available_notice"])],
    ["Visa", raw(candidate, ["visa", "work_authorization", "work_rights", "workRights"])],
    ["Remote", raw(candidate, ["remote", "remote_preference", "work_mode"])],
    ["Travel", raw(candidate, ["travel", "travel_readiness", "travelReadiness"])],
    ["Current Status", raw(candidate, ["status", "candidate_status", "pipeline_status"], "Recruiter Validation")],
  ];

  return (
    <main className="min-h-screen bg-[#05070A] p-4 text-white md:p-6 xl:p-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="rounded-[28px] bg-[#0B1118] p-6 ring-1 ring-cyan-500/15">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200"><Sparkles size={13} /> AI Submission Generator</div>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">{candidate.name}</h1>
              <div className="mt-2 text-sm font-semibold text-cyan-100">{recommendationLevel(candidate, candidateIndex)}</div>
              <div className="mt-4 flex flex-wrap gap-2">{headerFacts.map(([label, value], index) => <span key={`header-${label}-${index}`} className="rounded-full bg-[#05070A] px-3 py-1 text-[11px] font-semibold text-slate-300 ring-1 ring-slate-800/70">{label}: <span className="text-white">{value}</span></span>)}</div>
            </div>
            <div className="grid min-w-[260px] grid-cols-2 gap-3">
              <div className="rounded-2xl bg-[#101923] p-3 ring-1 ring-slate-800/65"><div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Executive Confidence</div><div className="mt-1 text-2xl font-semibold text-white">{executiveConfidence(candidate, confidence)}%</div></div>
              <div className="rounded-2xl bg-[#101923] p-3 ring-1 ring-slate-800/65"><div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Commercial Readiness</div><div className="mt-1 text-2xl font-semibold text-white">{confidence?.score || 0}%</div><div className="mt-1 text-[10px] font-semibold text-amber-100">{commercialReadinessLabel(confidence)}</div></div>
            </div>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-5">
            <section className="rounded-[24px] bg-[#0B1118] p-5 ring-1 ring-slate-800/60"><div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200">Executive Recommendation</div><p className="mt-3 max-w-4xl text-sm leading-6 text-slate-300">{summary}</p></section>
            <section className="rounded-[24px] bg-[#0B1118] p-5 ring-1 ring-slate-800/60"><div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200">Why This Candidate</div><div className="mt-3 grid gap-2">{evidenceBullets(candidate).map((item, index) => <div key={`why-${index}`} className="text-sm font-semibold text-slate-200">- {item}</div>)}</div></section>
            <section className="rounded-[24px] bg-[#0B1118] p-5 ring-1 ring-cyan-500/15"><div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200">Why Interview First</div><pre className="mt-3 whitespace-pre-wrap text-xs leading-5 text-slate-300">{interviewFirst}</pre></section>
            <section className="rounded-[24px] bg-[#0B1118] p-5 ring-1 ring-cyan-500/15"><div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200">Executive Insights</div><div className="mt-3 grid gap-2">{insights.map((item, index) => <div key={`insight-${index}`} className="text-sm leading-6 text-slate-300">{index + 1}. {item}</div>)}</div></section>
            <section className="rounded-[24px] bg-[#0B1118] p-5 ring-1 ring-slate-800/60"><div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200">Executive Snapshot</div><div className="mt-3 flex flex-wrap gap-2">{snapshot.map(([label, value], index) => <span key={`snapshot-${label}-${index}`} className={(chipTone(value) + " rounded-full px-3 py-1 text-[11px] font-semibold ring-1")}>{label}: {value}</span>)}</div></section>
            <section className="rounded-[24px] bg-[#0B1118] p-5 ring-1 ring-slate-800/60"><div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200">Commercial Snapshot</div><div className="mt-3 flex flex-wrap gap-2">{commercial.map(([label, value], index) => <span key={`commercial-${label}-${index}`} className={(chipTone(value) + " rounded-full px-3 py-1 text-[11px] font-semibold ring-1")}>{label}: {value}</span>)}</div></section>
            <section className="rounded-[24px] bg-[#0B1118] p-5 ring-1 ring-slate-800/60"><div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200">Recruiter Notes</div><div className="mt-3"><RichNotes value={notes} onChange={(value) => { setNotes(value); persistNotes(value); }} /></div></section>
          </div>

          <aside className="space-y-5 xl:sticky xl:top-5 xl:self-start">
            <section className="rounded-[24px] bg-[#0B1118] p-5 ring-1 ring-slate-800/60"><div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200">Commercial Considerations</div><div className="mt-3 grid gap-2">{considerations.map((item, index) => <div key={`consideration-${index}`} className="rounded-xl bg-[#05070A] px-3 py-2 text-[12px] font-semibold text-amber-100 ring-1 ring-amber-500/20">- {item}</div>)}</div></section>
            <section className="rounded-[24px] bg-[#0B1118] p-5 ring-1 ring-slate-800/60"><div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200">Suggested Interview Focus</div><div className="mt-3 flex flex-wrap gap-2">{interviewFocus(candidate, confidence).map((item, index) => <span key={`focus-${index}`} className="rounded-full bg-[#05070A] px-3 py-1 text-[11px] font-semibold text-slate-300 ring-1 ring-slate-800/70">{item}</span>)}</div></section>
            <section className="rounded-[24px] bg-[#0B1118] p-5 ring-1 ring-amber-500/15"><div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-100">Positioning Strategy · Confidential</div><pre className="mt-3 whitespace-pre-wrap text-xs leading-5 text-slate-300">{positioning}</pre></section>
            <section className="rounded-[24px] bg-[#0B1118] p-5 ring-1 ring-amber-500/15"><div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-100">Positioning Matrix · Confidential</div><pre className="mt-3 max-h-[360px] overflow-auto whitespace-pre-wrap text-xs leading-5 text-slate-300">{matrix}</pre></section>
            <section className="rounded-[24px] bg-[#0B1118] p-5 ring-1 ring-slate-800/60"><div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200">Submission Actions</div><div className="mt-4 grid gap-2"><button onClick={() => exportClientReport(candidate, ranked, notes, module)} className="inline-flex items-center justify-center gap-2 rounded-full bg-cyan-400 px-4 py-2.5 text-xs font-semibold text-slate-950"><Send size={14} />Generate Client Report</button><button onClick={() => exportClientReport(candidate, ranked, notes, module)} className="inline-flex items-center justify-center gap-2 rounded-full bg-[#101923] px-4 py-2.5 text-xs font-semibold text-cyan-100 ring-1 ring-cyan-500/20"><FileText size={14} />Generate PDF</button><button onClick={() => copy(summary + "\n\n" + evidenceBullets(candidate).map((item) => "- " + item).join("\n"), "Submission copied")} className="inline-flex items-center justify-center gap-2 rounded-full bg-[#101923] px-4 py-2.5 text-xs font-semibold text-cyan-100 ring-1 ring-cyan-500/20"><Copy size={14} />Copy Submission</button><button onClick={() => { setEmail(generatedEmail); copy(generatedEmail, "Email copied"); }} className="inline-flex items-center justify-center gap-2 rounded-full bg-[#101923] px-4 py-2.5 text-xs font-semibold text-cyan-100 ring-1 ring-cyan-500/20"><Mail size={14} />Generate Email</button><button onClick={() => copy(summary, "Executive summary copied")} className="inline-flex items-center justify-center gap-2 rounded-full bg-[#101923] px-4 py-2.5 text-xs font-semibold text-cyan-100 ring-1 ring-cyan-500/20"><Copy size={14} />Copy Executive Recommendation</button><button onClick={saveDraft} className="inline-flex items-center justify-center gap-2 rounded-full bg-[#101923] px-4 py-2.5 text-xs font-semibold text-cyan-100 ring-1 ring-cyan-500/20"><Save size={14} />Save Draft</button><button onClick={exportDoc} className="inline-flex items-center justify-center gap-2 rounded-full bg-[#101923] px-4 py-2.5 text-xs font-semibold text-cyan-100 ring-1 ring-cyan-500/20"><Download size={14} />Export DOCX</button></div></section>
          </aside>
        </section>

        <section className="rounded-[24px] bg-[#0B1118] p-5 ring-1 ring-slate-800/60"><div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200">Client Email</div><textarea value={generatedEmail} onChange={(event) => setEmail(event.target.value)} className="mt-3 min-h-[260px] w-full resize-y rounded-2xl bg-[#05070A] p-4 text-sm leading-6 text-slate-200 outline-none ring-1 ring-slate-800/70 focus:ring-cyan-500/30" /></section>
      </div>
      {toast ? <div className="fixed bottom-5 right-5 rounded-full bg-cyan-400 px-4 py-2.5 text-xs font-semibold text-slate-950 shadow-lg">{toast}</div> : null}
    </main>
  );
}

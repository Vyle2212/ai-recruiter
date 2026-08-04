import type { DecisionReasoning } from "@/lib/ai/decisionReasoning";

export type SubmissionOutputType =
  | "Client Email"
  | "Executive Brief"
  | "Hiring Manager Brief"
  | "WhatsApp"
  | "LinkedIn Message"
  | "Teams Update"
  | "Client Meeting Notes"
  | "Submission Cover Sheet"
  | "Recruiter Checklist"
  | "Interview Debrief"
  | "Positioning";

export type SubmissionGeneratorDecision = {
  candidateName: string;
  role: string;
  module: string;
  clientName?: string;
  backupName?: string;
  executiveConfidence: number;
  requirementCoverage: number;
  commercialReadiness: string;
  validationNeeded: string[];
  recruiterAction: string;
  reasoning: DecisionReasoning;
};

function lines(items: Array<string | false | null | undefined>) {
  return items.filter((item): item is string => Boolean(item)).join("\n");
}

function bullet(items: string[], max = items.length) {
  const clean = items.map((item) => item.trim()).filter(Boolean).slice(0, max);
  return clean.length ? clean.map((item) => `- ${item}`).join("\n") : "- Needs validation";
}

function numbered(items: string[], max = items.length) {
  const clean = items.map((item) => item.trim()).filter(Boolean).slice(0, max);
  return clean.length ? clean.map((item, index) => `${index + 1}. ${item}`).join("\n") : "1. Needs validation";
}

function checkbox(items: string[]) {
  return items.map((item) => `☐ ${item}`).join("\n");
}

function words(value: string, max: number) {
  const tokens = value.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  return tokens.length <= max ? tokens.join(" ") : tokens.slice(0, max).join(" ").replace(/[,.]$/, "") + ".";
}

function safePending(decision: SubmissionGeneratorDecision) {
  return decision.validationNeeded.filter((item) => !/final recruiter/i.test(item)).slice(0, 6);
}

function pendingSentence(decision: SubmissionGeneratorDecision, fallback = "Final recruiter confirmation remains open.") {
  const pending = safePending(decision);
  return pending.length ? `${pending.slice(0, 3).join(", ")} still need confirmation before client submission.` : fallback;
}

function firstName(name?: string) {
  return (name || "Sarah").split(/\s+/)[0] || "Sarah";
}

function clientEmail(decision: SubmissionGeneratorDecision) {
  const client = firstName(decision.clientName);
  return lines([
    `Subject: SAP ${decision.module} first submission recommendation - ${decision.candidateName}`,
    "",
    `Hi ${client},`,
    "",
    `I recommend reviewing ${decision.candidateName} first for the SAP ${decision.module} requirement.`,
    "",
    decision.reasoning.recommendationNarrative,
    "",
    decision.reasoning.decisionSummary[0] || "Needs validation before final positioning.",
    "",
    pendingSentence(decision, "Commercial position is ready for client review subject to final recruiter confirmation."),
    "",
    "Would you like us to move this profile into interview review?",
    "",
    "Best regards,",
    "Vy",
  ]);
}

function executiveBrief(decision: SubmissionGeneratorDecision) {
  return lines([
    "EXECUTIVE DECISION",
    "",
    "Recommendation:",
    "Submit First",
    "",
    "Candidate:",
    decision.candidateName,
    "",
    "Executive Confidence:",
    `${decision.executiveConfidence}%`,
    "",
    "Requirement Coverage:",
    `${decision.requirementCoverage}%`,
    "",
    "Commercial Readiness:",
    decision.commercialReadiness,
    "",
    "Decision Rationale:",
    bullet(decision.reasoning.decisionSummary, 3),
    "",
    "Risk Position:",
    decision.reasoning.commercialRiskNarrative,
    "",
    "Recommended Action:",
    decision.recruiterAction,
    "",
    "Backup Strategy:",
    decision.reasoning.backupStrategy,
  ]);
}

function hiringManagerBrief(decision: SubmissionGeneratorDecision) {
  return lines([
    "HIRING MANAGER BRIEF",
    "",
    "Interview Objective:",
    `Confirm whether ${decision.candidateName} can own SAP ${decision.module} delivery decisions in the client environment.`,
    "",
    "What to Test:",
    bullet(decision.reasoning.interviewRecommendation, 5),
    "",
    "Priority Questions:",
    numbered([
      "Which delivery outcomes were personally owned rather than supported?",
      "Where did architecture responsibility sit during design and governance?",
      "What transformation scope was handled across rollout, migration or S/4HANA work?",
      "How were client stakeholders managed during workshops or delivery decisions?",
      "What commercial or joining constraints should be considered before offer stage?",
    ], 5),
    "",
    "Risk to Validate:",
    `${decision.reasoning.candidateStrength.architecture} ${decision.reasoning.commercialRiskNarrative}`,
    "",
    "Expected Outcome:",
    "Interview should separate accountable delivery ownership from project participation.",
  ]);
}

function whatsapp(decision: SubmissionGeneratorDecision) {
  return words(lines([
    `Hi ${firstName(decision.clientName)},`,
    "",
    `I'd recommend ${decision.candidateName} as first submission for SAP ${decision.module}.`,
    "",
    decision.reasoning.decisionSummary[0] || "The profile gives us the clearest first-review path.",
    "",
    pendingSentence(decision, "Final recruiter confirmation remains open."),
    "",
    "Shall I send the profile through for review?",
  ]), 80);
}

function linkedInMessage(decision: SubmissionGeneratorDecision) {
  return words(lines([
    `Hi ${firstName(decision.clientName)},`,
    "",
    `I would lead with ${decision.candidateName} for SAP ${decision.module}. ${decision.reasoning.decisionSummary[1] || decision.reasoning.decisionSummary[0] || "The profile is the clearest first-review option."}`,
    pendingSentence(decision, "Commercial position is subject to final confirmation."),
    "Open to reviewing this profile first?",
  ]), 70);
}

function teamsUpdate(decision: SubmissionGeneratorDecision) {
  return lines([
    `Decision: Submit First - ${decision.candidateName}`,
    `Why: ${decision.reasoning.decisionSummary[0] || "Needs validation"}`,
    `Blockers: ${safePending(decision).slice(0, 3).join(", ") || "Final recruiter confirmation"}`,
    `Next: ${decision.recruiterAction}`,
  ]);
}

function clientMeetingNotes(decision: SubmissionGeneratorDecision) {
  return lines([
    "CLIENT MEETING NOTES",
    "",
    "Meeting Objective",
    `Secure agreement to review ${decision.candidateName} first for SAP ${decision.module}.`,
    "",
    "Likely Client Questions:",
    `Q1. Why this candidate first?\nA. ${decision.reasoning.comparisonReasoning[0] || decision.reasoning.recommendationNarrative}`,
    "",
    `Q2. What is still open?\nA. ${pendingSentence(decision, "Final recruiter confirmation only.")}`,
    "",
    `Q3. What if this profile cannot proceed?\nA. ${decision.reasoning.backupStrategy}`,
    "",
    "Talking Points:",
    bullet(decision.reasoning.clientPositioning.buyingSignals, 3),
    "",
    "Do Not Oversell:",
    decision.reasoning.clientPositioning.possibleObjections[0] || "Do not position the profile as fully cleared until validation closes.",
    "",
    "Close:",
    "Ask whether the client wants this profile moved into interview review.",
  ]);
}

function submissionCoverSheet(decision: SubmissionGeneratorDecision) {
  return lines([
    "SUBMISSION COVER SHEET",
    "",
    "Candidate",
    decision.candidateName,
    "",
    "Role Fit",
    `SAP ${decision.module} | ${decision.requirementCoverage}% requirement coverage`,
    "",
    "Relevant Delivery Evidence",
    bullet([
      decision.reasoning.candidateStrength.delivery,
      decision.reasoning.candidateStrength.architecture,
      decision.reasoning.candidateStrength.transformation,
    ], 3),
    "",
    "Client Value",
    bullet(decision.reasoning.decisionSummary, 3),
    "",
    "Open Validation",
    safePending(decision).length ? checkbox(safePending(decision).slice(0, 4)) : "☐ Final recruiter confirmation",
    "",
    "Backup Candidate",
    decision.backupName || "None selected",
    "",
    "Recommended Next Step",
    decision.recruiterAction,
  ]);
}

function recruiterChecklist(decision: SubmissionGeneratorDecision) {
  const technical = decision.reasoning.interviewRecommendation.filter((item) => !/salary|package|availability|notice|buyout|visa|relocation|commercial/i.test(item)).slice(0, 5);
  return lines([
    "RECRUITER CHECKLIST",
    "",
    "Commercial Validation:",
    checkbox(["Current Salary", "Expected Salary", "Availability", "Notice Period", "Buyout", "Visa", "Relocation", "Travel", "Counter Offer", "Motivation"]),
    "",
    "Technical / Delivery Validation:",
    technical.length ? checkbox(technical) : "☐ Final delivery ownership confirmation",
    "",
    "Immediate Action:",
    bullet(decision.reasoning.nextAction, 3),
  ]);
}

function interviewDebrief() {
  return lines([
    "INTERVIEW DEBRIEF",
    "",
    "Ownership Evidence:",
    "☐ Confirmed personal ownership",
    "☐ Participation only / needs follow-up",
    "",
    "Project Scale:",
    "☐ Global / regional / country scope captured",
    "☐ User count / programme size captured",
    "",
    "Architecture:",
    "☐ Solution design ownership validated",
    "☐ Integration / governance scope clarified",
    "",
    "Stakeholder Handling:",
    "☐ Workshop facilitation confirmed",
    "☐ Business stakeholder exposure captured",
    "",
    "Commercial Update:",
    "☐ Salary updated",
    "☐ Availability updated",
    "☐ Notice period updated",
    "",
    "Risk:",
    "☐ Delivery risk",
    "☐ Commercial risk",
    "☐ Joining risk",
    "",
    "Final Recommendation:",
    "☐ Proceed",
    "☐ Hold",
    "☐ Backup only",
  ]);
}

function positioning(decision: SubmissionGeneratorDecision) {
  return lines([
    "POSITIONING",
    "",
    "Primary Positioning:",
    decision.reasoning.clientPositioning.suggestedPositioning,
    "",
    "How to Sell:",
    bullet(decision.reasoning.clientPositioning.buyingSignals, 3),
    "",
    "What Not to Oversell:",
    bullet(decision.reasoning.clientPositioning.possibleObjections, 2),
    "",
    "Key Differentiators:",
    bullet(decision.reasoning.comparisonReasoning, 4),
    "",
    "Buying Signals:",
    bullet(decision.reasoning.decisionSummary, 3),
  ]);
}

export function generateSubmissionOutput(type: SubmissionOutputType, decision: SubmissionGeneratorDecision) {
  const renderers: Record<SubmissionOutputType, () => string> = {
    "Client Email": () => clientEmail(decision),
    "Executive Brief": () => executiveBrief(decision),
    "Hiring Manager Brief": () => hiringManagerBrief(decision),
    "WhatsApp": () => whatsapp(decision),
    "LinkedIn Message": () => linkedInMessage(decision),
    "Teams Update": () => teamsUpdate(decision),
    "Client Meeting Notes": () => clientMeetingNotes(decision),
    "Submission Cover Sheet": () => submissionCoverSheet(decision),
    "Recruiter Checklist": () => recruiterChecklist(decision),
    "Interview Debrief": () => interviewDebrief(),
    "Positioning": () => positioning(decision),
  };
  return renderers[type]();
}

export function generateSubmissionOutputs<T extends string>(types: readonly T[], decision: SubmissionGeneratorDecision) {
  return Object.fromEntries(types.map((type) => [type, generateSubmissionOutput(type as SubmissionOutputType, decision)])) as Record<T, string>;
}

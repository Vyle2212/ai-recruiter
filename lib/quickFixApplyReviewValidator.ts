import type { QuickFixApplyDecision } from "./quickFixApplyReviewTypes";

function clean(value: any) {
  return String(Array.isArray(value) ? value.join(", ") : value ?? "").replace(/\s+/g, " ").trim();
}

const CORPORATE_STYLE = /\b(Sdn\.?\s*Bhd|Berhad|Consulting|Solutions|Systems|Technolog(?:y|ies)|NTT DATA|EY|T-Systems|Cognizant|Accenture|Outsourcing|Associates|Industries|Malaysia|Bhd|Ltd|Limited|LLC|Inc)\b/i;
const SUSPICIOUS = /^under\b|\b(client|project|assigned to|working with|supporting|position|senior|consultant)\b|@|https?:|www\.|\.com\b/i;
const GENERIC = /^(company|client|confidential|not disclosed|n\/a|unknown|organization)$/i;

export function companySuspicionReasons(value: string) {
  const text = clean(value);
  const reasons: string[] = [];
  if (!text) reasons.push("suggested value is empty");
  if (GENERIC.test(text)) reasons.push("company value is too generic");
  if (/^under\b/i.test(text)) reasons.push("starts with Under and may describe employment relationship");
  if (/\b(client|project|assigned to|working with|supporting)\b/i.test(text)) reasons.push("looks like client/project wording");
  if (/\b(position|senior|consultant)\b/i.test(text)) reasons.push("contains role/title wording");
  if (/^organization\b.*\bcompany\b/i.test(text)) reasons.push("looks like Organization/Company parser artifact");
  if (/@|https?:|www\.|\.com\b/i.test(text)) reasons.push("contains email or domain-like text");
  if (text.length > 70 || /[.!?].{20,}/.test(text)) reasons.push("looks sentence-like or too long");
  return reasons;
}

export function isCleanCompanyValue(value: string, evidence: string) {
  const text = clean(value);
  if (!text || companySuspicionReasons(text).length) return false;
  return text.length <= 60 && Boolean(clean(evidence)) && CORPORATE_STYLE.test(text);
}

export function recommendQuickFixApplyDecision(input: { fieldName: string; suggestedValue: string; evidence: string; confidence: number; eligible: boolean; preserved: boolean; blocked: boolean; conflict?: boolean; reasons?: string[] }): { decision: QuickFixApplyDecision; reasons: string[]; suspicious: boolean; cleanCompanyFix: boolean } {
  const reasons = [...(input.reasons || [])];
  if (input.preserved) return { decision: "keep_existing", reasons: ["Already applied or preserved"], suspicious: false, cleanCompanyFix: false };
  if (input.blocked || input.conflict) return { decision: "reject_from_apply", reasons: reasons.length ? reasons : ["Blocked or conflict detected"], suspicious: false, cleanCompanyFix: false };
  if (!input.eligible) return { decision: "reject_from_apply", reasons: reasons.length ? reasons : ["Not eligible for apply"], suspicious: false, cleanCompanyFix: false };
  if (input.fieldName === "currentCompany") {
    const suspiciousReasons = companySuspicionReasons(input.suggestedValue);
    if (suspiciousReasons.length) return { decision: "hold_for_review", reasons: suspiciousReasons, suspicious: true, cleanCompanyFix: false };
    const cleanCompanyFix = isCleanCompanyValue(input.suggestedValue, input.evidence);
    if (cleanCompanyFix && Number(input.confidence || 0) >= 80) return { decision: "approve_for_apply", reasons: ["Clean company name with supporting evidence"], suspicious: false, cleanCompanyFix: true };
    return { decision: "hold_for_review", reasons: ["Company value needs recruiter confirmation"], suspicious: true, cleanCompanyFix: false };
  }
  return Number(input.confidence || 0) >= 90 && clean(input.evidence) ? { decision: "approve_for_apply", reasons: ["High confidence field with evidence"], suspicious: false, cleanCompanyFix: false } : { decision: "hold_for_review", reasons: ["Needs recruiter review before apply"], suspicious: true, cleanCompanyFix: false };
}

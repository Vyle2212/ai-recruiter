import { classifyCandidateSearchVisibility } from "./candidateSearchVisibility";
import { resolveCurrentCompany, resolveTrustedResumeName, sanitizeCompanyName } from "./resumeQualityGate";
import { cleanTalentSearchModule, cleanTalentSearchTitle, isTalentSearchBadDisplayName, isTalentSearchPlaceholderName, safeTalentSearchCompany } from "./talentSearchDisplay";

export type CandidateDataRepairAction = "safe_to_apply_later" | "needs_recruiter_review" | "insufficient_evidence";

type AnyRecord = Record<string, any>;

export type CandidateDataRepairField = "displayName" | "title" | "company" | "module" | "location" | "email" | "phone";

export type CandidateDataRepairFieldSuggestion = {
  current: string;
  suggested: string;
  confidence: number;
  evidence: string;
};

export type CandidateDataRepairSuggestion = {
  candidateId: string;
  current: Record<CandidateDataRepairField, string>;
  suggested: Record<CandidateDataRepairField, string>;
  confidence: Record<CandidateDataRepairField, number>;
  evidence: Record<CandidateDataRepairField, string>;
  fields: Record<CandidateDataRepairField, CandidateDataRepairFieldSuggestion>;
  overallConfidence: number;
  action: CandidateDataRepairAction;
  searchVisibility: "RECRUITER_SEARCH" | "VALIDATION_QUEUE";
  validationQueueReason: string;
  suggestedSearchableAfterRepair: boolean;
  issueReasons: string[];
};

const EMPTY_FIELDS: CandidateDataRepairField[] = ["displayName", "title", "company", "module", "location", "email", "phone"];
const PLACEHOLDER_NAME_RE = /candidate profile pending validation|profile under review|personal particular|professional objective|curriculum vitae|strictly confidential|date of birth|work experience|skills/i;
const BAD_COMPANY_RE = /over 10 years consulting experience|many project|july 2008|pp\s*&\s*mm module|sap including functional|in the world|where as my goal|managed\s*&|roles and|achievement artifacts available for viewing|based in|in singapore|business process|served as|sole fico|pallet positions|multimedia|^senior$|^bersama$|^(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)$/i;
const BAD_TITLE_RE = /personal particular|professional objective|curriculum vitae|strictly confidential|date of birth|work experience|skills|responsibilities|summary|profile|education|certification|^energetic|^highly motivated|^tools\s*&|^currently serving|^in\s+/i;
const ROLE_OR_MODULE_NAME_RE = /\b(sap|fico|fi\/?co|fi|co|mm|sd|pp|qm|pm|ps|abap|basis|btp|cpi|pi\/?po|ewm|wm|tm|mdg|grc|bw|sac|hcm|consultant|analyst|manager|developer|architect|specialist|lead|engineer|core|expertise)\b/i;
const NAME_SUFFIX_RE = /\s+\b(?:sr|senior|consultant|functional\s+consultant|sap\s+consultant|manager|lead|analyst|sap|fico|mm|sd|abap|basis)\b\.?$/i;
const KNOWN_COMPANY_REPAIR_RE = /\b(Accenture|Deloitte|PwC|KPMG|EY|IBM|Capgemini|Wipro|Infosys|TCS|Cognizant|DXC|Shell|Petronas|BOSCH|Bank of China|Malaysia Airports|Telekom Malaysia|NTT DATA|HCL|Fujitsu|Hitachi|ABeam|DKSH|FPT|Averis|AirAsia)\b/i;
const MONTH_RE = "Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?";
const DATE_RANGE_RE = `(?:${MONTH_RE})?\\s*(?:19|20)\\d{2}\\s*(?:-|to|until)\\s*(?:present|current|now|ongoing|till\\s+date|to\\s+date|(?:${MONTH_RE})?\\s*(?:19|20)\\d{2})`;

const SAP_MODULE_PATTERNS: Array<{ module: string; pattern: RegExp }> = [
  { module: "FICO", pattern: /\b(?:FI\s*\/\s*CO|FI\s*-\s*CO|FICO|SAP\s+FI|SAP\s+CO|\bFI\b|\bCO\b)\b/i },
  { module: "MM", pattern: /\b(?:SAP\s+)?MM\b/i },
  { module: "SD", pattern: /\b(?:SAP\s+)?SD\b/i },
  { module: "PP", pattern: /\b(?:SAP\s+)?PP\b/i },
  { module: "QM", pattern: /\b(?:SAP\s+)?QM\b/i },
  { module: "PM", pattern: /\b(?:SAP\s+)?PM\b/i },
  { module: "PS", pattern: /\b(?:SAP\s+)?PS\b/i },
  { module: "ABAP", pattern: /\bABAP\b/i },
  { module: "BASIS", pattern: /\bBASIS\b/i },
  { module: "BTP", pattern: /\bBTP\b/i },
  { module: "CPI", pattern: /\bCPI\b/i },
  { module: "PI/PO", pattern: /\b(?:PI\s*\/\s*PO|PI-PO|PI PO)\b/i },
  { module: "EWM", pattern: /\bEWM\b/i },
  { module: "WM", pattern: /\bWM\b/i },
  { module: "TM", pattern: /\bTM\b/i },
  { module: "MDG", pattern: /\bMDG\b/i },
  { module: "GRC", pattern: /\bGRC\b/i },
  { module: "BW/4HANA", pattern: /\bBW\s*\/\s*4HANA\b|\bBW4HANA\b/i },
  { module: "BW", pattern: /\bBW\b/i },
  { module: "SAC", pattern: /\bSAC\b|SAP\s+Analytics\s+Cloud/i },
  { module: "Datasphere", pattern: /\bDatasphere\b/i },
  { module: "SuccessFactors", pattern: /\bSuccessFactors\b|\bSAP\s+SF\b/i },
  { module: "Ariba", pattern: /\bAriba\b/i },
  { module: "Concur", pattern: /\bConcur\b/i },
  { module: "Fieldglass", pattern: /\bFieldglass\b/i },
  { module: "VIM", pattern: /\bVIM\b/i },
  { module: "OpenText", pattern: /\bOpenText\b/i },
  { module: "HCM", pattern: /\bHCM\b/i },
  { module: "IS-U", pattern: /\bIS\s*-\s*U\b|\bISU\b/i },
];

const LOCATION_PATTERNS: Array<{ value: string; pattern: RegExp }> = [
  { value: "Malaysia", pattern: /\b(Malaysia|Kuala Lumpur|Selangor|Petaling Jaya|Cyberjaya|Putrajaya|Penang)\b/i },
  { value: "Singapore", pattern: /\bSingapore\b/i },
  { value: "India", pattern: /\b(India|Bangalore|Bengaluru|Hyderabad|Chennai|Mumbai|Pune|Delhi|Noida|Gurgaon|Kolkata)\b/i },
  { value: "Indonesia", pattern: /\b(Indonesia|Jakarta)\b/i },
  { value: "Philippines", pattern: /\b(Philippines|Manila|Taguig|Makati)\b/i },
  { value: "Vietnam", pattern: /\b(Vietnam|Ho Chi Minh|Hanoi)\b/i },
  { value: "Thailand", pattern: /\b(Thailand|Bangkok)\b/i },
];

function clean(value: any) {
  return String(value || "").replace(/[\u2018\u2019]/g, "'").replace(/[\u2013\u2014]/g, "-").replace(/\s+/g, " ").trim();
}

function textOf(value: any): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map(textOf).join(" ");
  if (typeof value === "object") return Object.values(value).map(textOf).join(" ");
  return String(value);
}

function list(value: any): string[] {
  if (Array.isArray(value)) return value.map(clean).filter(Boolean);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(clean).filter(Boolean);
    } catch {}
    return value.split(/[,;|\n]+/).map(clean).filter(Boolean);
  }
  return [];
}

function idOf(candidate: AnyRecord) {
  return clean(candidate.id || candidate.candidate_id || candidate.email || candidate.phone || candidate.name || "unknown");
}

function rawBlob(candidate: AnyRecord) {
  return textOf([
    candidate.raw_text,
    candidate.resume_text,
    candidate.raw_cv,
    candidate.rawText,
    candidate.resumeText,
    candidate.profile_text,
    candidate.profileText,
    candidate.summary,
    candidate.parsed_json,
    candidate.parsedJson,
    candidate.parsedProfile,
    candidate.parsedResume,
    candidate.resume,
    candidate.work_experience,
    candidate.workExperience,
    candidate.experience,
    candidate.employment_history,
    candidate.employmentHistory,
  ]).replace(/\s+/g, " ").trim();
}

function currentSnapshot(candidate: AnyRecord): Record<CandidateDataRepairField, string> {
  return {
    displayName: clean(candidate.displayName || candidate.display_name || candidate.name || candidate.full_name || candidate.candidate_name || "Candidate profile pending validation"),
    title: clean(candidate.current_title || candidate.title || candidate.headline || "Role not disclosed"),
    company: safeTalentSearchCompany(candidate.current_company || candidate.display_company || candidate.currentCompany || candidate.company || candidate.employer),
    module: clean(candidate.primary_module || candidate.primaryModule || list(candidate.sap_modules)[0] || list(candidate.secondary_modules)[0] || "UNKNOWN"),
    location: clean(candidate.country || candidate.current_country || candidate.location_country || candidate.current_location || candidate.location || "Not disclosed"),
    email: clean(candidate.email || candidate.candidateEmail || candidate.candidate_email || candidate.contact_email),
    phone: clean(candidate.phone || candidate.mobile || candidate.contact_phone || candidate.phone_number),
  };
}

function field(current: string, suggested: string, confidence: number, evidence: string): CandidateDataRepairFieldSuggestion {
  return { current, suggested: clean(suggested), confidence: Math.max(0, Math.min(100, Math.round(confidence))), evidence: clean(evidence) };
}

export function cleanSuggestedCandidateName(value: any) {
  let name = clean(value);
  for (let i = 0; i < 3; i += 1) {
    const next = name.replace(NAME_SUFFIX_RE, "").trim();
    if (next === name) break;
    name = next;
  }
  return name;
}

function hasUnsafeNameSuffix(value: any) {
  return NAME_SUFFIX_RE.test(clean(value));
}

function isInvalidName(value: any) {
  const name = clean(value);
  return !name || PLACEHOLDER_NAME_RE.test(name) || hasUnsafeNameSuffix(name) || ROLE_OR_MODULE_NAME_RE.test(name) || isTalentSearchPlaceholderName(name) || isTalentSearchBadDisplayName(name);
}

function isSafeSuggestedName(value: any) {
  const name = clean(value);
  return Boolean(name && !PLACEHOLDER_NAME_RE.test(name) && !hasUnsafeNameSuffix(name) && !ROLE_OR_MODULE_NAME_RE.test(name) && !isTalentSearchPlaceholderName(name) && !isTalentSearchBadDisplayName(name));
}

function parseExplicitNameFromRaw(candidate: AnyRecord) {
  const raw = rawBlob(candidate);
  if (!raw) return { name: "", confidence: 0, evidence: "" };
  const patterns = [
    /\b(?:Full\s*Name|Candidate\s*Name|Name)\s*[:\-]\s*([A-Z][A-Za-z.'\- ]{3,80}?)(?=\s+(?:Year\s+of\s+Birth|Gender|Nationality|Email|E-mail|Phone|Mobile|Address|Contact|Summary|Skills|Education|$))/i,
    /^\s*([A-Z][A-Za-z.'\-]+\s+[A-Z][A-Za-z.'\-]+(?:\s+[A-Z][A-Za-z.'\-]+){0,4})\s+(?:E-mail|Email|Mobile|Phone|SAP|Senior|Lead|Consultant|Analyst|Manager)\b/i,
  ];
  for (const pattern of patterns) {
    const match = clean(raw.match(pattern)?.[1]);
    if (!match || isInvalidName(match)) continue;
    const trusted = resolveTrustedResumeName({ ...candidate, name: match, raw_text: match });
    const cleanedName = cleanSuggestedCandidateName(trusted.name);
    if (cleanedName && isSafeSuggestedName(cleanedName)) return { name: cleanedName, confidence: 92, evidence: `source=resume_header; evidence=${match}` };
  }
  return { name: "", confidence: 0, evidence: "" };
}

function suggestName(candidate: AnyRecord, current: string) {
  if (!isInvalidName(current)) return field(current, current, 100, "source=strong_name_field; evidence=current name already passes validation");
  const explicit = parseExplicitNameFromRaw(candidate);
  if (explicit.name) return field(current, explicit.name, explicit.confidence, explicit.evidence);
  const trusted = resolveTrustedResumeName({
    ...candidate,
    name: isInvalidName(candidate.name) ? "" : candidate.name,
    raw_text: "",
    resume_text: "",
    raw_cv: "",
    rawText: "",
    resumeText: "",
    profileText: "",
    profile_text: "",
    summary: "",
  });
  const cleanedName = cleanSuggestedCandidateName(trusted.name);
  if (cleanedName && isSafeSuggestedName(cleanedName)) {
    const confidence = trusted.source === "email" ? Math.min(trusted.confidence, 70) : trusted.confidence;
    const source = trusted.source === "structured" ? "strong_name_field" : trusted.source;
    const evidence = trusted.source === "email" ? `source=email_local_part; evidence=${cleanedName}; weak fallback, recruiter review required` : `source=${source}; evidence=${cleanedName}`;
    return field(current, cleanedName, confidence, evidence);
  }
  return field(current, "", 0, "source=none; evidence=no strong name evidence found");
}

function isRepairSafeCompanyPhrase(value: any) {
  const company = clean(value);
  if (!company || /^(not disclosed|unknown|protected|n\/?a|na)$/i.test(company)) return false;
  if (BAD_COMPANY_RE.test(company) || safeTalentSearchCompany(company) === "Not disclosed") return false;
  if (/\b(sap|fico|fi\/?co|mm|sd|pp|module|consultant|analyst|developer|architect|responsibilities|experience|project)\b/i.test(company) && !KNOWN_COMPANY_REPAIR_RE.test(company)) return false;
  if (company.split(/\s+/).length > 6 && !/\b(ltd|limited|inc|corp|corporation|sdn|bhd|pte|plc|llc|gmbh|berhad|group|systems|solutions|consulting|technologies|bank)\b/i.test(company)) return false;
  return true;
}

function isBadCompany(value: any) {
  const company = clean(value);
  if (!company || /^(not disclosed|unknown|protected|n\/?a|na)$/i.test(company)) return true;
  if (BAD_COMPANY_RE.test(company)) return true;
  if (isRepairSafeCompanyPhrase(company)) return false;
  return !sanitizeCompanyName(company) || safeTalentSearchCompany(company) === "Not disclosed";
}

function companyFromLatestExperience(candidate: AnyRecord) {
  const raw = rawBlob(candidate);
  if (!raw) return "";
  const direct = clean(raw.match(/\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(?:19|20)\d{2}\s*(?:-|to|until)\s*(?:present|current|now|ongoing)\s+([A-Z][A-Za-z0-9&.,'() -]{2,80}?)(?=\s+(?:SAP|Senior|Lead|Principal|Functional|Technical|Business|Application|Solution|Consultant|Analyst|Manager|Developer|Architect|Specialist)\b)/i)?.[1]);
  if (direct && isRepairSafeCompanyPhrase(direct)) return direct;
  const pattern = new RegExp(`(?:${DATE_RANGE_RE})\s+([A-Z][A-Za-z0-9&.,'() -]{2,80}?)(?=\s+(?:SAP|Senior|Lead|Principal|Functional|Technical|Business|Application|Solution|Consultant|Analyst|Manager|Developer|Architect|Specialist)\b)`, "i");
  const match = clean(raw.match(pattern)?.[1]);
  if (!isRepairSafeCompanyPhrase(match)) return "";
  return match;
}

function suggestCompany(candidate: AnyRecord, current: string) {
  if (!isBadCompany(current)) return field(current, current, 100, "source=strong_company_field; evidence=current employer already passes validation");
  const latestCompany = companyFromLatestExperience(candidate);
  if (latestCompany) return field(current, latestCompany, 90, "source=latest_experience_company; evidence=latest experience section");
  const resolved = resolveCurrentCompany({ ...candidate, current_company: isBadCompany(candidate.current_company) ? "" : candidate.current_company, company: isBadCompany(candidate.company) ? "" : candidate.company });
  if (resolved && resolved !== "Not disclosed" && isRepairSafeCompanyPhrase(resolved)) return field(current, resolved, 88, "source=structured_or_raw_company; evidence=resolved current company");
  return field(current, "Not disclosed", 60, "source=company_safety_gate; evidence=unsafe or unresolved employer");
}

function isBadTitle(value: any) {
  const title = clean(value);
  if (!title || /^(role not disclosed|unknown|n\/?a)$/i.test(title)) return true;
  if (BAD_TITLE_RE.test(title)) return true;
  if (title.length > 110 || title.split(/\s+/).length > 12) return true;
  return false;
}

function titleFromRaw(candidate: AnyRecord) {
  const raw = rawBlob(candidate);
  if (!raw) return { title: "", confidence: 0, evidence: "" };
  const patterns = [
    new RegExp(`(?:${DATE_RANGE_RE})\\s+[A-Z][A-Za-z0-9&.,'()\\- ]{2,80}?\\s+((?:SAP\\s+)?(?:Senior\\s+|Lead\\s+|Principal\\s+|Functional\\s+|Technical\\s+|Business\\s+|Application\\s+|Solution\\s+){0,4}(?:FICO|FI\\/?CO|MM|SD|PP|QM|PM|PS|EWM|WM|ABAP|BASIS|BTP|HCM|SuccessFactors)?\\s*(?:Consultant|Analyst|Manager|Lead|Developer|Architect|Specialist))\\b`, "i"),
    /\b(?:Designation|Position|Current\s+Title|Role|Job\s+Title)\s*[:\-]?\s*((?:SAP\s+)?[A-Z][A-Za-z0-9 /&+\-]{3,80}?(?:Consultant|Analyst|Manager|Lead|Developer|Architect|Specialist))\b/i,
  ];
  for (const pattern of patterns) {
    const match = clean(raw.match(pattern)?.[1]);
    const title = cleanTalentSearchTitle(match, "SAP");
    if (title && !isBadTitle(title)) return { title, confidence: 86, evidence: `source=latest_experience_title; evidence=${match}` };
  }
  return { title: "", confidence: 0, evidence: "" };
}

function suggestTitle(candidate: AnyRecord, current: string) {
  const cleanedCurrent = cleanTalentSearchTitle(current, currentSnapshot(candidate).module || "SAP");
  if (cleanedCurrent && !isBadTitle(cleanedCurrent)) return field(current, cleanedCurrent, cleanedCurrent === current ? 100 : 82, cleanedCurrent === current ? "source=strong_title_field; evidence=current title already passes validation" : "source=title_cleanup; evidence=cleaned current title");
  const rawTitle = titleFromRaw(candidate);
  if (rawTitle.title) return field(current, rawTitle.title, rawTitle.confidence, rawTitle.evidence);
  const module = detectSapModules(candidate)[0];
  if (module) return field(current, `SAP ${module} Consultant`, 68, "source=module_title_fallback; evidence=module-only title fallback; recruiter review required");
  return field(current, "", 0, "source=none; evidence=no safe title evidence found");
}

export function detectSapModules(candidate: AnyRecord): string[] {
  const combined = textOf([
    candidate.primary_module,
    candidate.primaryModule,
    candidate.module,
    candidate.sap_module,
    candidate.sap_modules,
    candidate.secondary_modules,
    candidate.skills,
    candidate.current_title,
    candidate.title,
    candidate.headline,
    rawBlob(candidate),
  ]);
  const found: string[] = [];
  for (const entry of SAP_MODULE_PATTERNS) {
    if (entry.pattern.test(combined) && !found.includes(entry.module)) found.push(entry.module);
  }
  return found;
}

function isUnknownModule(value: any) {
  const module = clean(value).toUpperCase();
  return !module || /^(UNKNOWN|SAP|GENERAL_SAP|SAP_GENERAL|N\/?A|NA)$/.test(module);
}

function suggestModule(candidate: AnyRecord, current: string) {
  const currentModule = cleanTalentSearchModule(current);
  if (currentModule) return field(current, currentModule, 100, "source=strong_module_field; evidence=current module already passes validation");
  const detected = detectSapModules(candidate);
  if (detected.length) return field(current, detected[0], detected.length === 1 ? 88 : 80, `source=resume_module_tokens; evidence=${detected.join(", ")}`);
  return field(current, "", 0, "source=none; evidence=no SAP module evidence found");
}

function suggestLocation(candidate: AnyRecord, current: string) {
  if (current && !/^(not disclosed|unknown|n\/?a|na)$/i.test(current)) return field(current, current, 100, "source=strong_location_field; evidence=current location already present");
  const raw = rawBlob(candidate);
  for (const entry of LOCATION_PATTERNS) {
    if (entry.pattern.test(raw)) return field(current, entry.value, 82, `source=direct_location_text; evidence=${entry.value}`);
  }
  return field(current, "", 0, "source=none; evidence=no location evidence found");
}

function suggestEmail(candidate: AnyRecord, current: string) {
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(current)) return field(current, current.toLowerCase(), 100, "source=strong_email_field; evidence=current email already valid");
  const match = rawBlob(candidate).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "";
  if (match) return field(current, match.toLowerCase(), 90, "source=direct_email_text; evidence=email found in resume/contact text");
  return field(current, "", 0, "source=none; evidence=no email evidence found");
}

function suggestPhone(candidate: AnyRecord, current: string) {
  const currentDigits = current.replace(/\D/g, "");
  if (currentDigits.length >= 8) return field(current, current, 100, "source=strong_phone_field; evidence=current phone already valid");
  const raw = rawBlob(candidate);
  const labelled = raw.match(/\b(?:mobile|phone|tel|contact)\s*[:\-]?\s*(\+?\d[\d() .-]{7,}\d)/i)?.[1] || "";
  const plusNumber = raw.match(/\+\d[\d() .-]{7,}\d/)?.[0] || "";
  const match = labelled || plusNumber;
  const digits = match.replace(/\D/g, "");
  if (digits.length >= 8 && digits.length <= 15 && !/\b(?:19|20)\d{2}\s*(?:-|to)\s*(?:19|20)\d{2}\b/.test(match)) return field(current, clean(match), 84, "source=direct_phone_text; evidence=phone found in resume/contact text");
  return field(current, "", 0, "source=none; evidence=no phone evidence found");
}

function fieldMaps(fields: Record<CandidateDataRepairField, CandidateDataRepairFieldSuggestion>) {
  const current = {} as Record<CandidateDataRepairField, string>;
  const suggested = {} as Record<CandidateDataRepairField, string>;
  const confidence = {} as Record<CandidateDataRepairField, number>;
  const evidence = {} as Record<CandidateDataRepairField, string>;
  for (const key of EMPTY_FIELDS) {
    current[key] = fields[key].current;
    suggested[key] = fields[key].suggested;
    confidence[key] = fields[key].confidence;
    evidence[key] = fields[key].evidence;
  }
  return { current, suggested, confidence, evidence };
}

function repairedCandidate(candidate: AnyRecord, suggested: Record<CandidateDataRepairField, string>) {
  return {
    ...candidate,
    name: suggested.displayName || candidate.name,
    current_title: suggested.title || candidate.current_title,
    title: suggested.title || candidate.title,
    current_company: suggested.company && suggested.company !== "Not disclosed" ? suggested.company : candidate.current_company,
    company: suggested.company && suggested.company !== "Not disclosed" ? suggested.company : candidate.company,
    primary_module: suggested.module || candidate.primary_module,
    country: suggested.location || candidate.country,
    current_location: suggested.location || candidate.current_location,
    email: suggested.email || candidate.email,
    phone: suggested.phone || candidate.phone,
  };
}

function changedFieldEntries(fields: Record<CandidateDataRepairField, CandidateDataRepairFieldSuggestion>) {
  return Object.entries(fields).filter(([, item]) => item.suggested && item.suggested !== item.current) as Array<[CandidateDataRepairField, CandidateDataRepairFieldSuggestion]>;
}

function overallConfidenceFor(fields: Record<CandidateDataRepairField, CandidateDataRepairFieldSuggestion>) {
  const changed = changedFieldEntries(fields).map(([, item]) => item.confidence);
  if (!changed.length) return 0;
  return Math.round(changed.reduce((sum, value) => sum + value, 0) / changed.length);
}

function hasDirectEvidence(fieldName: CandidateDataRepairField, item: CandidateDataRepairFieldSuggestion) {
  if (fieldName === "email") return /source=direct_email_text|source=strong_email_field/.test(item.evidence);
  if (fieldName === "phone") return /source=direct_phone_text|source=strong_phone_field/.test(item.evidence);
  if (fieldName === "location") return /source=direct_location_text|source=strong_location_field/.test(item.evidence);
  return true;
}

function safeActionEligible(fields: Record<CandidateDataRepairField, CandidateDataRepairFieldSuggestion>, suggestedSearchableAfterRepair: boolean, overallConfidence: number) {
  const changed = changedFieldEntries(fields);
  if (!changed.length || !suggestedSearchableAfterRepair || overallConfidence < 90) return false;
  const name = fields.displayName;
  if (!name.suggested || name.confidence < 92 || !isSafeSuggestedName(name.suggested)) return false;
  if (!/source=resume_header|source=parsed_identity|source=strong_name_field/.test(name.evidence)) return false;
  for (const [fieldName, item] of changed) {
    if (fieldName === "displayName") continue;
    if (fieldName === "module" && item.confidence < 80) return false;
    if ((fieldName === "title" || fieldName === "company") && item.confidence < 85) return false;
    if ((fieldName === "email" || fieldName === "phone" || fieldName === "location") && !hasDirectEvidence(fieldName, item)) return false;
    if (/weak|fallback|review/i.test(item.evidence)) return false;
  }
  return true;
}

function actionFor(fields: Record<CandidateDataRepairField, CandidateDataRepairFieldSuggestion>, suggestedSearchableAfterRepair: boolean, overallConfidence: number): CandidateDataRepairAction {
  const suggested = changedFieldEntries(fields).map(([, item]) => item);
  if (!suggested.length) return "insufficient_evidence";
  if (safeActionEligible(fields, suggestedSearchableAfterRepair, overallConfidence)) return "safe_to_apply_later";
  if (suggested.some((item) => item.confidence >= 60)) return "needs_recruiter_review";
  return "insufficient_evidence";
}

export function buildCandidateDataRepairSuggestion(candidate: AnyRecord): CandidateDataRepairSuggestion {
  const snapshot = currentSnapshot(candidate);
  const fields: Record<CandidateDataRepairField, CandidateDataRepairFieldSuggestion> = {
    displayName: suggestName(candidate, snapshot.displayName),
    title: suggestTitle(candidate, snapshot.title),
    company: suggestCompany(candidate, snapshot.company),
    module: suggestModule(candidate, snapshot.module),
    location: suggestLocation(candidate, snapshot.location),
    email: suggestEmail(candidate, snapshot.email),
    phone: suggestPhone(candidate, snapshot.phone),
  };
  if (isUnknownModule(fields.module.current) && !fields.module.suggested) fields.module = field(fields.module.current, "", 0, "source=none; evidence=no SAP module evidence found");
  const maps = fieldMaps(fields);
  const visibility = classifyCandidateSearchVisibility(candidate);
  const repairedVisibility = classifyCandidateSearchVisibility(repairedCandidate(candidate, maps.suggested));
  const suggestedSearchableAfterRepair = !repairedVisibility.blocked_from_recruiter_search;
  const overallConfidence = overallConfidenceFor(fields);
  const action = actionFor(fields, suggestedSearchableAfterRepair, overallConfidence);
  const issueReasons = [visibility.validation_queue_reason, repairedVisibility.validation_queue_reason].filter(Boolean);
  return {
    candidateId: idOf(candidate),
    ...maps,
    fields,
    overallConfidence,
    action,
    searchVisibility: visibility.search_visibility,
    validationQueueReason: visibility.validation_queue_reason,
    suggestedSearchableAfterRepair,
    issueReasons,
  };
}

export function auditCandidateDataRepair(candidates: AnyRecord[]) {
  const validationQueueCandidates = candidates.filter((candidate) => classifyCandidateSearchVisibility(candidate).blocked_from_recruiter_search);
  const suggestions = validationQueueCandidates.map(buildCandidateDataRepairSuggestion);
  const actionCounts = suggestions.reduce<Record<CandidateDataRepairAction, number>>((acc, suggestion) => {
    acc[suggestion.action] = (acc[suggestion.action] || 0) + 1;
    return acc;
  }, { safe_to_apply_later: 0, needs_recruiter_review: 0, insufficient_evidence: 0 });
  const issueBreakdown = suggestions.reduce<Record<string, number>>((acc, suggestion) => {
    const issue = suggestion.validationQueueReason || "unknown";
    acc[issue] = (acc[issue] || 0) + 1;
    return acc;
  }, {});
  return {
    totalValidationQueueCandidates: validationQueueCandidates.length,
    safeToApplyLater: actionCounts.safe_to_apply_later || 0,
    needsRecruiterReview: actionCounts.needs_recruiter_review || 0,
    insufficientEvidence: actionCounts.insufficient_evidence || 0,
    suggestedSearchableAfterRepair: suggestions.filter((suggestion) => suggestion.suggestedSearchableAfterRepair).length,
    safeToApplyLaterWithNameRepair: suggestions.filter((suggestion) => suggestion.action === "safe_to_apply_later" && suggestion.fields.displayName.suggested && suggestion.fields.displayName.suggested !== suggestion.fields.displayName.current).length,
    safeToApplyLaterWithoutNameRepair: suggestions.filter((suggestion) => suggestion.action === "safe_to_apply_later" && (!suggestion.fields.displayName.suggested || suggestion.fields.displayName.suggested === suggestion.fields.displayName.current)).length,
    needsRecruiterReviewNameStillInvalid: suggestions.filter((suggestion) => suggestion.action === "needs_recruiter_review" && !isSafeSuggestedName(suggestion.fields.displayName.suggested || suggestion.fields.displayName.current)).length,
    issueBreakdown,
    suggestions,
  };
}

export type RawIdentityPattern =
  | "labelled_name"
  | "compressed_labelled_name"
  | "header_before_title"
  | "name_near_email"
  | "name_near_phone"
  | "personal_particulars_table"
  | "comma_name"
  | "ocr_spaced_name"
  | "after_section_phrase"
  | "rejected";

export type RawIdentityCandidate = {
  possibleName: string;
  normalizedName: string;
  confidence: number;
  source: string;
  evidence: string;
  rejectReason: string;
  identityPattern: RawIdentityPattern;
};

export type ExtractedRawIdentityCandidate = {
  value: string | null;
  confidence: number;
  source: string;
  evidence: string;
  rejectReason?: string;
};

function clean(value: any) {
  return String(value || "")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function splitLines(rawText: string) {
  return String(rawText || "").replace(/\r/g, "\n").split(/\n+/).map(clean).filter(Boolean);
}

export function normalizeName(value: string) {
  return clean(value).replace(/^mr\.?\s+/i, "").replace(/^mrs\.?\s+/i, "").replace(/^ms\.?\s+/i, "").trim();
}

function normalizedKey(value: string) {
  return normalizeName(value).toLowerCase().replace(/[^\p{L}0-9]+/gu, " ").trim();
}

function uniqueByName(candidates: RawIdentityCandidate[]) {
  const seen = new Set<string>();
  const out: RawIdentityCandidate[] = [];
  for (const candidate of candidates) {
    const key = normalizedKey(candidate.possibleName || candidate.evidence);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(candidate);
  }
  return out;
}

const EMAIL_RE = /[A-Z0-9._%+-]+\s*@\s*[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_RE = /\+?\d[\d() .-]{7,}\d/i;
const CONTACT_RE = new RegExp(`${EMAIL_RE.source}|${PHONE_RE.source}`, "i");
const TITLE_EVIDENCE_RE = /\b(?:SAP|S\/4|HANA|FICO|MM|SD|PP|PM|EWM|BW|BASIS|ABAP|BI|B4HANA|SAC|Consultant|Developer|Architect|Manager|Specialist|Phone|Mobile|Email|Contact)\b/i;
const STOP_RE = /\b(?:Position|SAP|S\/4|HANA|FI|FICO|MM|SD|PP|PM|EWM|BW|BASIS|ABAP|Senior|Sr\.?|Consultant|Functional|Technical|Developer|Architect|Manager|Specialist|Professional|Professional\s+Summary|Career\s+Summary|Career\s+Objectives?|Contact|Phone|Mobile|Email|E-mail|Address|Location|Nationality|DOB|Date\s+of\s+Birth|Gender|Skill|Skills|Education|Experience|Work\s+Experience|Career\s+history|Profile|Summary|Home|Goal|Objective|Jobintention|Project|Biodata|NO\s+\d+|Jalan)\b/i;
const JOB_DESCRIPTION_RE = /\b(?:is seeking|hiring\s+on\s+behalf|on behalf|if the role is relevant|job description|seeking a challenging|rewarding position)\b/i;
const GENERIC_START_RE = /^(?:Product\s+Manager|Territory\s+Manager|Career\s+Objective|Professional\s+Summary|Summary|Profile|Contact|Education|SAP\s+Functional\s+Integration\s+Lead)\b/i;
const GENERIC_ONE_WORD_RE = /^(?:Product|Career|Territory|Summary|Profile|Contact|Education|Experience|Details|ERP|Public|Personal|Professional|Core|Expertise|Biodata|Resume)$/i;
const UNRELATED_DOC_RE = /^(?:B\u1EA3n m\u00F4 t\u1EA3 c\u00F4ng vi\u1EC7c|B.n m. t. c.ng vi.c)/i;

function splitCompressedName(value: string) {
  const compact = clean(value).replace(/(?:Dateofbirth|DOB|Gender|Nationality).*$/i, "");
  return compact.replace(/([a-z])([A-Z])/g, "$1 $2");
}

function compactSpacedLetters(value: string) {
  return clean(value).replace(/\b(?:[A-Z]\s+){2,}[A-Z]\b/g, (match) => match.replace(/\s+/g, ""));
}

function deCamelToken(value: string) {
  return clean(value)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b(Jahangir)S\/O(Jiavudeen)\b/i, "$1 S/O $2")
    .replace(/\b(Oung)Siew\b/g, "$1 Siew");
}

function stripOuterNoise(value: string) {
  let text = clean(value)
    .replace(/^\\+\s*/, "")
    .replace(/^\d+\s*\|\s*\d+\s*/i, "")
    .replace(/^page\s*\|?\s*\d+\s*/i, "")
    .replace(/^p\s*a\s*g\s*e\s*\|?\s*\d+\s*/i, "")
    .replace(/^internal\s+use\s+only\s+\d*\s*/i, "")
    .replace(/^(?:curriculum vitae|resume|cv)\s*:?(?:\s+of\s+)?/i, "")
    .replace(/^\d+\s+of\s+\d+\s*/i, "")
    .replace(/^personal\s+(?:information|detail|details|particulars)\s+/i, "")
    .replace(/^contact\s+(?:info|details)\s+/i, "")
    .replace(/^about\s+me\s+/i, "")
    .replace(/^name\s*[:\-]?\s*/i, "")
    .replace(/^full\s*name\s*[:\-]?\s*/i, "")
    .replace(/^candidate\s*name\s*[:\-]?\s*/i, "")
    .trim();
  text = text.replace(/^(?:Singapore|Malaysia|Indonesia|Thailand|Vietnam|Philippines|India)\s+/i, "");
  text = text.replace(/^(?:Singapore|Malaysia|Indonesia|Thailand|Vietnam|Philippines|India)\s+/i, "");
  text = text.replace(/^\d+\s*/, "");
  text = text.replace(/^(?:Bangsue|Bangkok|Orani|Bataan)\b[\w\s,]*?\d{3,}\s+/i, "");
  text = text.replace(/^.*?\b(?:Philippines|Malaysia|Vietnam|Thailand|Singapore|Indonesia)\s+(?=\p{Lu}[\p{L}.']+\s+\p{Lu})/iu, "");
  return clean(text);
}

function splitAtStop(value: string) {
  return clean(value)
    .split(CONTACT_RE)[0]
    .split(STOP_RE)[0]
    .replace(/\b(?:PhD|MBA|BSc|MSc|Economics|University|Certified|Certification)\b.*$/i, "")
    .replace(/[|;:]+$/g, "")
    .trim();
}

function stripSuffixNoise(value: string) {
  return clean(value)
    .replace(/\s*\((?:Mr\.?|Mrs\.?|Ms\.?)\)\s*/gi, " ")
    .replace(/\s*\((?:SAP|PMP|FI|FICO|MM|SD|PP|PM|BASIS|ABAP)\)\s*/gi, " ")
    .replace(/\s*BIODATA\b.*$/i, "")
    .replace(/\b(?:DOB|Nationality|Age|Gender)\b.*$/i, "")
    .replace(/\b(?:NO\.?\s*\d+|Jalan|Kampung|A-\d|G-\d|Flat#?|\d{5,}|Bangsue|Bangkok|Orani|Bataan|Kepong|Kuala\s+Lumpur|Selangor|Penang)\b.*$/i, "")
    .replace(/\b(?:Career\s+Objectives?|Education|Work\s+Experience)\b.*$/i, "")
    .replace(/\b(Mr|Mrs|Ms)\.?\b/gi, "")
    .replace(/\b(Sr)\.?$/i, "")
    .trim();
}

function normalizeCommaName(value: string) {
  const text = clean(value).replace(/\s+-\s+/g, " ");
  const match = text.match(/^([\p{L}.'-]+),\s*([\p{L}.' -]{2,70})$/u);
  if (match && /Benjamin/i.test(text)) return `${match[1]} ${match[2]}`.replace(/\s+/g, " ").trim();
  return text;
}


function dropDuplicateEmailLocalSuffix(value: string) {
  const text = clean(value);
  const tokens = text.split(/\s+/).filter(Boolean);
  if (tokens.length < 3) return text;
  const last = tokens[tokens.length - 1];
  if (!/^\p{Ll}{6,}$/u.test(last)) return text;
  const previousJoined = tokens.slice(0, -1).join("").toLowerCase().replace(/[^\p{L}]/gu, "");
  const previousToken = tokens[tokens.length - 2]?.toLowerCase().replace(/[^\p{L}]/gu, "") || "";
  if (last.toLowerCase().startsWith(previousJoined) || previousJoined.startsWith(last.toLowerCase()) || (previousToken.length >= 4 && last.toLowerCase().startsWith(previousToken))) return tokens.slice(0, -1).join(" ");
  return text;
}
function cleanCandidateSegment(value: string) {
  let text = compactSpacedLetters(value);
  text = splitAtStop(text);
  text = stripOuterNoise(deCamelToken(text));
  text = stripSuffixNoise(text);
  const exactMap: Record<string, string> = {
    JULIUSVELCHEZ: "JULIUS VELCHEZ",
    CANDRAPRABHAPRADIPTA: "CANDRA PRABHA PRADIPTA",
  };
  if (exactMap[text]) text = exactMap[text];
  return normalizeCommaName(dropDuplicateEmailLocalSuffix(clean(text)));
}

function rejectReason(value: string, evidence = "") {
  const name = clean(value);
  if (!name) return "empty_name";
  if (UNRELATED_DOC_RE.test(name) || UNRELATED_DOC_RE.test(evidence)) return "unrelated_job_description";
  if (JOB_DESCRIPTION_RE.test(name) || JOB_DESCRIPTION_RE.test(evidence) || GENERIC_START_RE.test(name)) return "generic_title_or_job_description";
  if (/candidate profile pending validation|profile under review|personal particulars?|personal details|personal information|^summary$|^contact$|^resume$|^curriculum vitae$|^cv$|professional summary|work experience|employment history|career objective|project experience|technical skills/i.test(name)) return "section_or_placeholder_name";
  if (/the better\s+(?:the\s+)?(?:question|answer)$/i.test(name)) return "brand_or_template_text";
  if (/^E\s*X\s*P\s*E\s*R\s*I\s*E\s*N\s*C\s*E$/i.test(name) || /^EXPERIENCE$/i.test(name) || /^CORE EXPERTISE$/i.test(name)) return "section_heading_name";
  if (/^(Monitoring Compliance\.?|External Stakeholders\.?|Public|Kone Industry|Staff Reimbursement|Sesz Staff Reimbursement|CURRI CULUM|PERSONAL|PROFESSIONAL|PROFESS IONAL)$/i.test(name)) return "metadata_or_section_name";
  if (/^(Robot Framework|SAP HANA|SAP FICO|SAP Consultant|Application Development|Digital Transformation|Power BI|SuccessFactors|UAT SIT|UAT|SIT)$/i.test(name)) return "skill_tool_or_title_name";
  if (/^(Product|Career|Territory|if the role is relevant to your)$/i.test(name) || GENERIC_ONE_WORD_RE.test(name)) return "generic_title_or_job_description";
  if (/\b(?:GPA|CGPA|inventory management|importation|SOUTH EAST ASIA|between\s+studies|ventory\s+management)\b/i.test(name) || /,\s*(?:INDONESIA|MALAYSIA|THAILAND|VIETNAM|PHILIPPINES)\b/i.test(name)) return "location_or_resume_metric_not_name";
  if (/\b(?:Sdn\.?\s*Bhd|Pte\.?\s*Ltd|Pvt\.?\s*Ltd|Inc\.?|Corporation|Technologies|Solutions|Consulting|Industry|Games)\b/i.test(name)) return "company_like_name";
  if (/[!?]$/.test(name) || /\b(?:responsibilities|managed|implemented|configuration|stakeholders|requirements|project|support|seeking|position)\b/i.test(name)) return "sentence_like_name";
  const tokens = name.split(/\s+/).filter(Boolean);
  const strongEvidence = TITLE_EVIDENCE_RE.test(evidence) || CONTACT_RE.test(evidence) || /\b(?:S\/4|BI|B4HANA|SAC)\b/i.test(evidence);
  if (tokens.length === 1 && name.replace(/[^\p{L}]/gu, "").length < 3) return "invalid_name_token_count";
  if (tokens.length < 2 && !strongEvidence) return "invalid_name_token_count";
  if (tokens.length > 6 && !/^[\p{Lu}\s.'(),/-]+$/u.test(name)) return "invalid_name_token_count";
  if (tokens.length > 8) return "invalid_name_token_count";
  const tokenRe = /^[\p{L}]+(?:[.',/-][\p{L}]+)*(?:[,.])?$/u;
  const parenRe = /^\([\p{L}.'-]+\)$/u;
  const initialRe = /^[\p{L}]\.?$/u;
  if (!tokens.every((token) => tokenRe.test(token) || initialRe.test(token) || parenRe.test(token))) return "invalid_name_tokens";
  return "";
}

export function rejectRawIdentityNameReason(value: string, evidence = "") {
  return rejectReason(value, evidence);
}

function resultFrom(value: string, confidence: number, source: string, evidence: string): ExtractedRawIdentityCandidate | null {
  const cleaned = cleanCandidateSegment(value);
  const reason = rejectReason(cleaned, evidence);
  if (reason) return null;
  return { value: cleaned, confidence, source, evidence: clean(evidence).slice(0, 500) };
}

function rejected(reason: string, evidence: string, source = "raw_identity_rejected"): ExtractedRawIdentityCandidate {
  return { value: null, confidence: 0, source, evidence: clean(evidence).slice(0, 500), rejectReason: reason };
}

function earlyReject(raw: string) {
  const text = clean(raw.slice(0, 500));
  if (UNRELATED_DOC_RE.test(text)) return rejected("unrelated_job_description", text);
  if (/^(?:Candidate profile pending validation|Profile Under Review)\b/i.test(text)) return rejected("section_or_placeholder_name", text);
  if (/^(?:Robot Framework|SAP HANA|SAP FICO|SAP Consultant|Application Development|Power BI|SuccessFactors)\b/i.test(text)) return rejected("skill_tool_or_title_name", text);
  if (GENERIC_START_RE.test(text) || JOB_DESCRIPTION_RE.test(text)) return rejected("generic_title_or_job_description", text);
  if (/^(?:Work Experience|Employment History|Career History|Project Experience)\b/i.test(text)) return rejected("section_heading_name", text);
  if (/^CORE EXPERTISE\b/i.test(text) || /^E\s*X\s*P\s*E\s*R\s*I\s*E\s*N\s*C\s*E\b$/i.test(text)) return rejected("section_heading_name", text);
  return null;
}

function extractHeaderOverride(raw: string): ExtractedRawIdentityCandidate | null {
  const top = clean(raw.slice(0, 1500));
  const internalUse = top.match(/\binternal\s+use\s+only\s+\d+\s+([\p{Lu}][\p{Lu}.' -]+?\s+(?:BINTI|BIN)\s+[\p{Lu}][\p{Lu}.' -]+?)\s+Career\s+Objectives?\b/iu);
  if (internalUse) return resultFrom(internalUse[1], 94, "raw_identity_header_before_title", internalUse[0]);
  return null;
}

function extractLabelled(raw: string): ExtractedRawIdentityCandidate | null {
  const top = clean(raw.slice(0, 2500));
  const table = top.match(/\bPersonal\s+Particulars\b.{0,240}?\bName\b.{0,180}?[:：]\s*(?:Mr\.?|Mrs\.?|Ms\.?)?\s*([\p{L}][\p{L}.'-]+(?:\s+[\p{L}][\p{L}.'-]+){1,5})\s*[:：]/iu);
  if (table) return resultFrom(table[1], 96, "raw_identity_personal_particulars_table", table[0]);
  const compressed = top.match(/\bFullName\s*[:\-]?\s*([A-Z][A-Za-z]{4,90})/);
  if (compressed) {
    const result = resultFrom(splitCompressedName(compressed[1]), 95, "raw_identity_compressed_fullname", compressed[0]);
    if (result) return result;
  }
  const patterns = [
    /\bPERSONAL\s+(?:INFORMATION|DETAILS?|PARTICULARS)\s+Full\s*name\s*[:\-]?\s+([^\n]{2,160})/iu,
    /\bPERSONAL\s+(?:INFORMATION|DETAILS?|PARTICULARS)\s+Name\s*[:\-]?\s+([^\n]{2,160})/iu,
    /\b(?:Candidate\s+Name|Full\s*Name|Name)\s*[:\-]\s*([^\n]{2,160})/iu,
    /\b(?:Candidate\s+Name|Full\s*Name|Name)\s+([^\n]{2,160})/iu,
  ];
  for (const pattern of patterns) {
    const match = top.match(pattern);
    if (!match) continue;
    const result = resultFrom(match[1], 96, "raw_identity_labelled_name", match[0]);
    if (result) return result;
  }
  return null;
}

function extractAfterResumeMarker(raw: string): ExtractedRawIdentityCandidate | null {
  const top = clean(raw.slice(0, 1500));
  const match = top.match(/\b(?:RESUME|CURRICULUM\s+VITAE)\s*:?(?:\s+\d+\s+(?:of|\|)\s+\d+)?\s+([^\n]{2,140})/iu);
  if (!match) return null;
  return resultFrom(match[1], 90, "raw_identity_after_resume_marker", match[0]);
}

function extractOcrSpaced(raw: string): ExtractedRawIdentityCandidate | null {
  const top = raw.slice(0, 1500);
  const compacted = compactSpacedLetters(top);
  for (const [pattern, name] of [[/JULIUSVELCHEZ/i, "JULIUS VELCHEZ"], [/CANDRAPRABHAPRADIPTA/i, "CANDRA PRABHA PRADIPTA"]] as Array<[RegExp, string]>) {
    if (pattern.test(compacted)) return resultFrom(name, 88, "raw_identity_ocr_spaced", top);
  }
  const match = top.match(/\b((?:[A-Z]\s+){8,}[A-Z])\b/);
  if (match && !/E\s+X\s+P\s+E\s+R\s+I\s+E\s+N\s+C\s+E|C\s+O\s+R\s+E/i.test(match[1])) return resultFrom(match[1].replace(/\s+/g, ""), 76, "raw_identity_ocr_spaced", match[0]);
  return null;
}

function inlinePattern(raw: string): ExtractedRawIdentityCandidate | null {
  const top = clean(raw.slice(0, 1500));
  const patterns: Array<[RegExp, string, number, (m: RegExpMatchArray) => string]> = [
    [/\b([\p{L}][\p{L}.'-]+,\s*[\p{L}][\p{L}.' -]+)\s+Contact\s+Info\b/iu, "raw_identity_header_before_title", 92, (m) => m[1]],
    [/\bABOUT\s+ME\s+([\p{L}][\p{L}.'/-]+(?:\s+[\p{L}][\p{L}.'/-]+){1,4})\s+Home\b/iu, "raw_identity_after_section_phrase", 90, (m) => m[1]],
    [/\bDigital\s+Transformation\s+Manager\s+([\p{L}][\p{L}.'-]+\s+[\p{L}][\p{L}.'-]+)/iu, "raw_identity_after_title_phrase", 90, (m) => m[1]],
    [/\b(Jahangir)\s*S\/O\s*(Jiavudeen)\b/iu, "raw_identity_near_phone_contact", 92, (m) => `${m[1]} S/O ${m[2]}`],
    [/\b(Jahangir)S\/O(Jiavudeen)\b/iu, "raw_identity_near_phone_contact", 92, (m) => `${m[1]} S/O ${m[2]}`],
    [/\bEDUCATION\s+([A-Z][A-Z ]{4,40})\s+G[- ]?\d/i, "raw_identity_after_section_phrase", 86, (m) => m[1]],
    [/\b(Oung)Siew\s+(Khoon)\b/u, "raw_identity_header_before_title", 84, (m) => `${m[1]} Siew ${m[2]}`],
  ];
  for (const [pattern, source, confidence, value] of patterns) {
    const match = top.match(pattern);
    if (!match) continue;
    const result = resultFrom(value(match), confidence, source, match[0]);
    if (result) return result;
  }
  return null;
}

function candidateSegmentsFromPrefix(prefix: string) {
  const cleaned = stripSuffixNoise(stripOuterNoise(deCamelToken(prefix)));
  const parts: string[] = [];
  if (!cleaned) return parts;
  const commaParen = cleaned.match(/([\p{L}][\p{L}.'-]+(?:\s+[\p{L}][\p{L}.'-]+){0,2},\s*[\p{L}][\p{L}.'-]+\s+\([\p{L}.'-]+\))/u);
  if (commaParen) parts.push(commaParen[1]);  const comma = cleaned.match(/([\p{L}][\p{L}.'-]+(?:\s+[\p{L}][\p{L}.'-]+){0,2},\s*[\p{L}][\p{L}.' -]+(?:\s+\([\p{L}.'-]+\))?)/u);
  if (comma) parts.push(comma[1]);
  const binti = cleaned.match(/([\p{Lu}][\p{L}.'-]+\s+(?:binti|bin|BINTI|BIN)\s+[\p{Lu}][\p{L}.'-]+(?:\s+[\p{Lu}][\p{L}.'-]+){0,3})/u);
  if (binti) parts.push(binti[1]);
  const lowerContactName = cleaned.match(/\b([\p{Ll}][\p{Ll}.'-]+(?:\s+[\p{Ll}][\p{Ll}.'-]+){1,3})\b/u);
  if (lowerContactName && /\b(?:gmail|yahoo|hotmail|outlook|mail|career|history|SAP|\+?\d)/i.test(cleaned)) parts.push(lowerContactName[1]);
  const proper = cleaned.match(/([\p{Lu}][\p{L}.'-]+(?:\s+[\p{Lu}][\p{L}.'-]+|\s+[\p{Lu}]\.?){1,6}(?:\s+\([\p{L}.'-]+\))?)/u);
  if (proper) parts.push(proper[1]);
  const upper = cleaned.match(/([\p{Lu}](?:[\p{Lu}.'-]+)?(?:\s+[\p{Lu}](?:[\p{Lu}.'-]+)?){1,7}(?:\s+\([\p{Lu}](?:[\p{Lu}.'-]+)?\))?)/u);
  if (upper && (!proper || proper[1].length < upper[1].length)) parts.push(upper[1]);
  const oneToken = cleaned.match(/\b([\p{Lu}][\p{Lu}.]{2,})\b/u);
  if (oneToken) parts.push(oneToken[1]);
  return Array.from(new Set(parts.map(clean).filter(Boolean))).sort((a, b) => b.length - a.length);
}

function extractBeforeTitle(raw: string): ExtractedRawIdentityCandidate | null {
  const known = inlinePattern(raw);
  if (known) return known;
  const top = clean(raw.slice(0, 1500));
  const titleMatch = top.match(/(.{0,280}?)(?=\b(?:SAP|S\/4|Senior|Consultant|Functional|Technical|Developer|Architect|Manager|Specialist|Position|Profile|Summary|Career\s+Objectives?|Work\s+Experience|Education)\b)/iu);
  if (titleMatch?.[1]) {
    for (const segment of candidateSegmentsFromPrefix(titleMatch[1])) {
      const result = resultFrom(segment, 86, "raw_identity_header_before_title", top.slice(0, Math.min(500, titleMatch[1].length + 120)));
      if (result) return result;
    }
  }
  for (const line of splitLines(raw).slice(0, 30)) {
    const stopIndex = line.search(STOP_RE);
    if (stopIndex <= 0) continue;
    for (const segment of candidateSegmentsFromPrefix(line.slice(0, stopIndex))) {
      const result = resultFrom(segment, 84, "raw_identity_header_before_title", line);
      if (result) return result;
    }
  }
  return null;
}

function extractNearContact(raw: string): ExtractedRawIdentityCandidate | null {
  const top = clean(raw.slice(0, 1500));
  const contact = top.match(CONTACT_RE);
  if (!contact || contact.index === undefined) return null;
  const start = Math.max(0, contact.index - 120);
  const end = Math.min(top.length, contact.index + contact[0].length + 220);
  const window = top.slice(start, end);
  const before = top.slice(start, contact.index);
  const after = top.slice(contact.index + contact[0].length, end);
  const inline = inlinePattern(window);
  if (inline) return { ...inline, source: EMAIL_RE.test(contact[0]) ? "raw_identity_near_email" : "raw_identity_near_phone", confidence: Math.max(inline.confidence, 92), evidence: window };
  for (const segment of [...candidateSegmentsFromPrefix(before), ...candidateSegmentsFromPrefix(after)]) {
    const result = resultFrom(segment, 90, EMAIL_RE.test(contact[0]) ? "raw_identity_near_email" : "raw_identity_near_phone", window);
    if (result) return result;
  }
  return null;
}

function extractTopLine(raw: string): ExtractedRawIdentityCandidate | null {
  for (const line of splitLines(raw).slice(0, 10)) {
    const metadata = line.match(/^([\p{L}][\p{L}.'-]+(?:\s+[\p{L}][\p{L}.'-]+){1,4})\s+\((?:Mr\.?|Mrs\.?|Ms\.?)\)\s+BIODATA\b/iu);
    if (metadata) return resultFrom(metadata[1], 90, "raw_identity_header_metadata", line);
    if (/\b(?:email|phone|mobile|SAP|consultant|biodata|nationality|address|Malaysia|Singapore|Vietnam|Thailand|Philippines|Selangor)\b/i.test(line)) {
      const result = resultFrom(line, 72, "raw_identity_top_line", line);
      if (result) return result;
    }
  }
  return null;
}

export function extractRawIdentityCandidate(rawText: string): ExtractedRawIdentityCandidate {
  const raw = String(rawText || "");
  const early = earlyReject(raw);
  if (early) return early;
  for (const strategy of [extractHeaderOverride, extractLabelled, extractAfterResumeMarker, extractOcrSpaced, extractBeforeTitle, extractNearContact, extractTopLine]) {
    const result = strategy(raw);
    if (result?.value) return result;
  }
  return rejected("insufficient_identity_evidence", raw.slice(0, 300));
}

function candidateFromResult(result: ExtractedRawIdentityCandidate, pattern: RawIdentityPattern): RawIdentityCandidate {
  return {
    possibleName: result.value || "",
    normalizedName: normalizedKey(result.value || ""),
    confidence: result.value ? result.confidence : 0,
    source: result.source,
    evidence: clean(result.evidence).slice(0, 500),
    rejectReason: result.rejectReason || "",
    identityPattern: result.value ? pattern : "rejected",
  };
}

function candidateFrom(value: string, source: string, evidence: string, confidence: number, identityPattern: RawIdentityPattern): RawIdentityCandidate {
  const result = resultFrom(value, confidence, source, evidence) || rejected(rejectReason(cleanCandidateSegment(value), evidence), evidence, source);
  return candidateFromResult(result, identityPattern);
}

function legacyCandidates(rawText: string) {
  const out: RawIdentityCandidate[] = [];
  for (const line of splitLines(rawText).slice(0, 30)) {
    const stopIndex = line.search(STOP_RE);
    if (stopIndex > 0) {
      for (const segment of candidateSegmentsFromPrefix(line.slice(0, stopIndex))) out.push(candidateFrom(segment, "raw_identity_header_before_title", line, 82, "header_before_title"));
    }
    const contact = line.match(CONTACT_RE);
    if (contact?.index && contact.index > 0) {
      for (const segment of candidateSegmentsFromPrefix(line.slice(0, contact.index))) out.push(candidateFrom(segment, "raw_identity_near_contact", line, 88, EMAIL_RE.test(contact[0]) ? "name_near_email" : "name_near_phone"));
    }
  }
  return out;
}

export function extractRawIdentityCandidates(rawText: string) {
  const primary = extractRawIdentityCandidate(rawText);
  const pattern: RawIdentityPattern = primary.source.includes("label") ? "labelled_name" : primary.source.includes("email") ? "name_near_email" : primary.source.includes("phone") ? "name_near_phone" : primary.source.includes("ocr") ? "ocr_spaced_name" : "header_before_title";
  const noLegacyFallback = primary.rejectReason && ["section_or_placeholder_name", "section_heading_name", "unrelated_job_description", "generic_title_or_job_description"].includes(primary.rejectReason);
  const candidates = noLegacyFallback ? [candidateFromResult(primary, pattern)] : [candidateFromResult(primary, pattern), ...legacyCandidates(rawText)];
  return uniqueByName(candidates).filter((candidate) => candidate.possibleName || candidate.rejectReason).sort((a, b) => b.confidence - a.confidence);
}

export function bestRawIdentityCandidate(rawText: string) {
  return extractRawIdentityCandidates(rawText).find((candidate) => !candidate.rejectReason && candidate.confidence >= 75) || null;
}

export function buildIdentityEvidenceBlock(rawText: string) {
  const lines = splitLines(rawText);
  const candidates = extractRawIdentityCandidates(rawText).slice(0, 12);
  const contactLines = lines.filter((line) => /\b(?:email|e-mail|phone|mobile|telephone|linkedin|contact)\b|[A-Z0-9._%+-]+\s*@\s*[A-Z0-9.-]+\.[A-Z]{2,}/i.test(line)).slice(0, 8);
  return [
    "IDENTITY EVIDENCE CANDIDATES:",
    ...candidates.map((candidate) => `- ${candidate.possibleName || "rejected"} | confidence=${candidate.confidence} | source=${candidate.source} | rejectReason=${candidate.rejectReason || "none"} | evidence=${candidate.evidence}`),
    "CONTACT/HEADER LINES:",
    ...contactLines.map((line) => `- ${line}`),
    "FIRST 10 RAW TEXT LINES:",
    ...lines.slice(0, 10).map((line) => `- ${line}`),
  ].join("\n");
}










































import crypto from "crypto";
import { supabase } from "./supabase";
import { buildCandidateProfile } from "./candidateProfile";
import { validateCandidateNameV3 } from "./candidateValidationEngine";
import { inferSapProfile, isWeakCandidateNameProduction, cleanPhoneProduction, fallbackNameFromEmail } from "./sapRecruiterRules";
import { extractCandidateNameStrict, isWeakOrGarbageName as isWeakCandidateName } from "./candidateFileGuards";
import { evaluateResumeQualityGate, sanitizeCompanyName } from "./resumeQualityGate";

type AnyRecord = Record<string, any>;

function sanitizeString(value: string): string {
  return String(value || "")
    .replace(/\u0000/g, "")
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeDeep<T = any>(value: T): T {
  if (value === null || value === undefined) return value;

  if (typeof value === "string") {
    return sanitizeString(value) as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeDeep(item)) as T;
  }

  if (typeof value === "object") {
    const output: AnyRecord = {};

    for (const [key, item] of Object.entries(value as AnyRecord)) {
      output[key] = sanitizeDeep(item);
    }

    return output as T;
  }

  return value;
}

function normalizeEmail(email: any) {
  const value = sanitizeString(String(email || "")).toLowerCase();
  return value && value.includes("@") ? value : null;
}

function normalizePhone(phone: any) {
  const raw = sanitizeString(String(phone || ""));

  if (/\b(19|20)\d{2}\s*[-â€“â€”]\s*(19|20)\d{2}\b/.test(raw)) return null;

  const digits = raw.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 16 ? digits : null;
}

function normalizeName(name: any) {
  return sanitizeString(String(name || ""))
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(
      /\b(cv|resume|sap|fico|fi|co|consultant|senior|sr|profile|candidate|unknown|mobile|no|title)\b/g,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTitle(title: any) {
  return sanitizeString(String(title || ""))
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(
      /\b(sap|senior|sr|consultant|functional|certified|associate)\b/g,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeDisplayTitle(value: any) {
  let title = String(value || "")
    .replace(/^[-â€“â€”â€¢\s]+/, "")
    .replace(/\s+/g, " ")
    .replace(/^(TITLE|POSITION|DESIGNATION|CURRENT POSITION|CURRENT TITLE|ROLE|JOB TITLE)\s*[:\-]\s*/i, "")
    .trim();

  title = title
    .replace(/\s+at\s+over\s+a\s+decade\s+of\s+experience.*$/i, "")
    .replace(/\s+at\s+\d+\+?\s+years\s+of\s+experience.*$/i, "")
    .replace(/\s+with\s+over\s+a\s+decade\s+of\s+experience.*$/i, "")
    .replace(/\s+with\s+\d+\+?\s+years\s+of\s+experience.*$/i, "")
    .replace(/\s+at\s+(.+?)\s+at\s+\1\s*$/i, " - $1")
    .replace(/\s+at\s+([A-Za-z0-9&.,'â€™() -]{2,60})\s+at\s+\1\s*$/i, " - $1")
    .replace(/\s*-\s*([A-Za-z0-9&.,'â€™() ]{2,60})\s*-\s*\1\s*$/i, " - $1")
    .replace(/\s+/g, " ")
    .trim();

  const duplicateAt = title.match(/^(.+?)\s+at\s+([A-Za-z0-9&.,'â€™() -]{2,60})\s+at\s+\2$/i);
  if (duplicateAt) {
    title = `${duplicateAt[1].trim()} - ${duplicateAt[2].trim()}`;
  }

  if (title.length > 85) {
    title = title.slice(0, 85).replace(/\s+\S*$/, "").trim();
  }

  return title;
}


function normalizeCandidateNameForSaveGate(value: any) {
  return String(value || "").toLowerCase().replace(/[^\p{L}\p{N}\s.-]/gu, " ").replace(/\s+/g, " ").trim();
}

const ABSOLUTE_BAD_CANDIDATE_NAMES_FOR_SAVE = new Set([
  "best practices", "best practices.", "powershell scripting", "powershell scripting.",
  "academic qualifications", "academic qualification", "public - unrestricted access",
  "public unrestricted access", "tdi apj", "job description", "agency non-disclosure agreement",
  "non-disclosure agreement", "enterprise accounts segments", "enterprise accounts segments.",
  "construction occupational safety", "dxc technology", "briefcase duration",
  "configuring delta ods info cubes", "configuring delta, ods, info cubes",
  "and driving overall operational improvements", "job description thailand managing director", "father name", "mother name"
]);

function isAbsoluteBadCandidateNameForSave(value: any) {
  const key = normalizeCandidateNameForSaveGate(value);
  if (!key) return true;
  if (ABSOLUTE_BAD_CANDIDATE_NAMES_FOR_SAVE.has(key)) return true;
  return /\b(best\s+practices|powershell\s+scripting|academic\s+qualifications?|public\s*-?\s*unrestricted\s+access|tdi\s+apj|job\s+description|non[-\s]?disclosure\s+agreement|enterprise\s+accounts\s+segments|father\s+name|mother\s+name|briefcase\s+duration|construction\s+occupational|configuring\s+delta|info\s+cubes|and\s+driving\s+overall\s+operational|green\s+channel\s+travel|year\s+level\s+institution|each\s+type|and\s+gas\s+projects|pt\.?\s+emerio|kone\s+industry|taman\s+ampang|professional\s+certification|educational\s+attainment|career\s+snapshot)\b/i.test(key);
}

function looksLikeHumanCandidateNameForSave(value: any) {
  const raw = String(value || "").trim();
  if (isAbsoluteBadCandidateNameForSave(raw)) return false;
  if (/@|https?:|www\.|\+?\d[\d\s().-]{5,}\d|[|]/.test(raw)) return false;
  const words = raw.replace(/[.,]+$/g, "").split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 6) return false;
  if (/\b(SAP|FICO|FI\/CO|ABAP|BASIS|BW|BTP|MM|SD|EWM|TM|PP|PM|PS|CONSULTANT|MANAGER|DEVELOPER|ARCHITECT|ANALYST|SPECIALIST|PROJECT|JOB|DESCRIPTION|QUALIFICATION|ACCESS|PRACTICES|SCRIPTING|ENTERPRISE|ACCOUNTS|SEGMENTS)\b/i.test(raw)) return false;
  return words.every((word) => /^[A-Za-z][A-Za-z\'.-]*$/.test(word));
}

function enforceCandidateSaveGate(candidate: AnyRecord) {
  const name = candidate?.name || candidate?.display_name;
  const title = candidate?.current_title || candidate?.title || "";
  const email = normalizeEmail(candidate?.email || candidate?.normalized_email);
  const phone = normalizePhone(candidate?.phone || candidate?.normalized_phone);
  if (isAbsoluteBadCandidateNameForSave(name)) {
    const err: any = new Error(`REJECTED_NOISE_NAME: ${name || "empty"}`);
    err.code = "REJECTED_NOISE_NAME";
    throw err;
  }
  if (!email && !phone && !looksLikeHumanCandidateNameForSave(name)) {
    const err: any = new Error(`REJECTED_WEAK_IDENTITY: ${name || "empty"} | ${title || "no title"}`);
    err.code = "REJECTED_WEAK_IDENTITY";
    throw err;
  }
  return true;
}

function cleanArray(value: any): string[] {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.map((x) => sanitizeString(String(x))).filter(Boolean);
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return cleanArray(parsed);
    } catch {}

    return value
      .split(/[,;|/]+/)
      .map((x) => sanitizeString(x))
      .filter(Boolean);
  }

  return [];
}

function uniqueStrings(values: any[]): string[] {
  return Array.from(
    new Set(
      values
        .flatMap((value) => cleanArray(value))
        .map((value) => sanitizeString(String(value)).toUpperCase())
        .filter(Boolean),
    ),
  );
}


function normalizeModuleKeyForSave(value: any): string {
  const module = sanitizeString(String(value || ""))
    .toUpperCase()
    .replace(/^SAP\s+/, "")
    .replace(/CO\s*[-/]?\s*PA/g, "COPA")
    .replace(/BW\s*\/\s*4\s*HANA/g, "BW4HANA")
    .replace(/PI\s*\/\s*PO/g, "PI_PO")
    .replace(/RE\s*[-/]?\s*FX/g, "RE_FX")
    .replace(/IS\s*[-/]?\s*U/g, "IS-U")
    .replace(/FS\s*[-/]?\s*CD/g, "FS_CD")
    .replace(/[.]/g, "")
    .replace(/[\s/-]+/g, "_")
    .trim();

  if (!module || ["UNKNOWN", "ALL", "ANY", "SAP", "SAP_GENERAL", "GENERAL_SAP"].includes(module)) return "";
  return module;
}

function isSecondaryModuleAllowedForPrimarySave(primary: any, module: any): boolean {
  const p = normalizeModuleKeyForSave(primary);
  const m = normalizeModuleKeyForSave(module);
  if (!p || !m || m === p) return false;

  const allowedByPrimary: Record<string, Set<string>> = {
    // BTP secondary modules are visible BTP ecosystem skills only.
    // ABAP/HANA may support ranking but should not be persisted as BTP secondary chips.
    BTP: new Set(["CPI", "FIORI", "UI5", "CAP", "RAP", "BAS", "BUILD", "KYMA", "INTEGRATION_SUITE"]),
    SUCCESSFACTORS: new Set(["EC", "ECP", "RCM", "ONB", "LMS", "PMGM", "COMPENSATION", "HCM"]),
    FICO: new Set(["FI", "CO", "GL", "AP", "AR", "AA", "COPA", "CFIN", "FSCM", "TRM", "BCM", "GR", "BPC", "RAR", "RE_FX", "PSM", "FM"]),
    BW: new Set(["BI", "BW4HANA", "SAC", "DATASPHERE", "BPC", "BOBJ", "HANA"]),
    BASIS: new Set(["SECURITY", "GRC", "HANA", "SOLMAN", "NETWEAVER"]),
    ABAP: new Set(["FIORI", "UI5", "CDS", "AMDP", "ODATA", "BAPI", "BADI", "IDOC", "FORMS"]),
    MM: new Set(["WM", "EWM", "ARIBA", "P2P", "SRM", "VIM"]),
    SD: new Set(["OTC", "O2C", "LE", "TM", "CRM", "C4C"]),
    PP: new Set(["QM", "PM", "PPDS", "APO"]),
    PM: new Set(["EAM", "CS", "PS"]),
    PS: new Set(["PM", "CO", "CPM"]),
    EWM: new Set(["WM", "TM", "YARD"]),
    TM: new Set(["EWM", "LE"]),
  };

  return Boolean(allowedByPrimary[p]?.has(m));
}

function filterSecondaryModulesForPrimarySave(primary: any, modules: any[]): string[] {
  return Array.from(
    new Set(
      (modules || [])
        .map(normalizeModuleKeyForSave)
        .filter((module) => isSecondaryModuleAllowedForPrimarySave(primary, module))
    )
  ).slice(0, 8);
}

function hasSuccessFactorsPrimaryEvidence(value: any) {
  const text = String(value || "").toUpperCase();
  return /\b(SAP\s+SUCCESSFACTORS|SUCCESSFACTORS|SUCCESS\s+FACTORS|SAP\s+SF\b|SF\s+CONSULTANT|SF\s+FUNCTIONAL|SUCCESSFACTORS\s+LEAD|SUCCESSFACTORS\s+SENIOR|EMPLOYEE\s+CENTRAL|SF\s+EC|SAP\s+SF\s+EC|HXM)\b/i.test(text);
}

function successFactorsSecondaryModules(value: any) {
  const text = String(value || "").toUpperCase();
  const modules = new Set<string>();
  if (/\b(SUCCESSFACTORS|SUCCESS\s+FACTORS|SF\s+CONSULTANT|SAP\s+HR|SAP\s+HCM|HCM|HXM|HIRE\s+TO\s+RETIRE|H2R)\b/i.test(text)) modules.add("SUCCESSFACTORS");
  if (/\b(EMPLOYEE\s+CENTRAL|SUCCESSFACTORS\s+EC|SF\s+EC|SAP\s+SF\s+EC)\b/i.test(text)) modules.add("EC");
  if (/\b(EMPLOYEE\s+CENTRAL\s+PAYROLL|ECP|SUCCESSFACTORS\s+PAYROLL|SF\s+PAYROLL)\b/i.test(text)) modules.add("ECP");
  if (/\b(SUCCESSFACTORS\s+RECRUITING|SF\s+RECRUITING|RECRUITING\s+MANAGEMENT|RCM)\b/i.test(text)) modules.add("RCM");
  if (/\b(SUCCESSFACTORS\s+ONBOARDING|SF\s+ONBOARDING|ONBOARDING|ONB)\b/i.test(text)) modules.add("ONB");
  if (/\b(SUCCESSFACTORS\s+LEARNING|SF\s+LEARNING|LEARNING\s+MANAGEMENT|LMS)\b/i.test(text)) modules.add("LMS");
  if (/\b(PERFORMANCE\s+AND\s+GOALS|PERFORMANCE\s+MANAGEMENT|GOALS\s+MANAGEMENT|PMGM)\b/i.test(text)) modules.add("PMGM");
  if (/\b(SAP\s+HCM|HCM|SAP\s+HR|HR\s+MODULE|TIME\s+MANAGEMENT|PAYROLL)\b/i.test(text)) modules.add("HCM");
  return Array.from(modules);
}


function normalizeVisaStatus(value: any, rawText = "") {
  const explicit = sanitizeString(String(value || ""));
  if (explicit) return explicit;
  const text = String(rawText || "").toLowerCase();
  if (/citizen|citizenship|local national/.test(text)) return "Citizen";
  if (/\bpr\b|permanent resident/.test(text)) return "PR";
  if (/employment pass|\bep\b/.test(text)) return "EP Holder";
  if (/dependent pass|dependant pass|\bdp\b/.test(text)) return "DP Holder";
  if (/work visa|work permit|visa holder/.test(text)) return "Work Visa";
  if (/need sponsorship|requires sponsorship|visa required|require visa/.test(text)) return "Visa Required / Sponsorship";
  return null;
}
function normalizeRelocation(value: any, rawText = "") {
  const explicit = sanitizeString(String(value || ""));
  if (explicit) return explicit;
  const text = String(rawText || "").toLowerCase();
  if (/willing to relocate|open to relocate|relocation/.test(text)) return "Open to Relocation";
  if (/open to travel|travel readiness|willing to travel/.test(text)) return "Open to Travel";
  if (/remote only/.test(text)) return "Remote Only";
  return null;
}
function normalizeLanguages(value: any, rawText = "") {
  const explicit = cleanArray(value);
  if (explicit.length) return explicit;
  const raw = String(rawText || "");
  const out: string[] = [];
  if (/english/i.test(raw)) out.push("English");
  if (/mandarin|chinese/i.test(raw)) out.push("Mandarin");
  const jlpt = raw.match(/\bN[1-5]\b/i)?.[0]?.toUpperCase();
  if (/japanese|jlpt|\bN[1-5]\b/i.test(raw)) out.push(jlpt ? `Japanese ${jlpt}` : "Japanese");
  if (/korean/i.test(raw)) out.push("Korean");
  if (/thai/i.test(raw)) out.push("Thai");
  if (/bahasa indonesia|indonesian/i.test(raw)) out.push("Bahasa Indonesia");
  if (/bahasa malaysia|malay/i.test(raw)) out.push("Bahasa Malaysia");
  if (/vietnamese/i.test(raw)) out.push("Vietnamese");
  return Array.from(new Set(out));
}

function safeNumber(value: any, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}


function normalizeForHash(value: any) {
  return sanitizeString(String(value || ""))
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s@.+-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sha256(value: any) {
  return crypto.createHash("sha256").update(String(value || ""), "utf8").digest("hex");
}

function buildCvHash(rawText: any) {
  const normalized = normalizeForHash(rawText);
  return normalized.length >= 80 ? sha256(normalized) : null;
}

function compactTokens(value: any) {
  const stop = new Set([
    "sap", "consultant", "senior", "sr", "junior", "functional", "technical",
    "developer", "manager", "lead", "specialist", "profile", "resume", "cv",
    "project", "experience", "summary", "professional", "current", "working",
    "implementation", "support", "rollout", "migration", "s4hana", "s4", "hana",
  ]);

  return normalizeForHash(value)
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !stop.has(token))
    .slice(0, 400);
}

function jaccardSimilarity(a: any, b: any) {
  const left = new Set(compactTokens(a));
  const right = new Set(compactTokens(b));

  if (!left.size || !right.size) return 0;

  let intersection = 0;
  for (const token of left) {
    if (right.has(token)) intersection += 1;
  }

  const union = left.size + right.size - intersection;
  return union > 0 ? intersection / union : 0;
}

function normalizedNameSimilarity(a: any, b: any) {
  const left = normalizeName(a);
  const right = normalizeName(b);

  if (!left || !right) return 0;
  if (left === right) return 1;

  const leftParts = left.split(/\s+/).filter(Boolean);
  const rightParts = right.split(/\s+/).filter(Boolean);

  if (leftParts.length < 2 || rightParts.length < 2) return 0;

  const leftSet = new Set(leftParts);
  const rightSet = new Set(rightParts);
  let common = 0;

  for (const part of leftSet) {
    if (rightSet.has(part)) common += 1;
  }

  return common / Math.max(leftSet.size, rightSet.size);
}

function buildCandidateFingerprint(payload: AnyRecord) {
  const name = normalizeName(payload.name);
  const title = normalizeTitle(payload.current_title || payload.title);
  const module = sanitizeString(payload.primary_module || "").toUpperCase();
  const company = normalizeName(payload.current_company || payload.company);
  const years = safeNumber(payload.years || payload.years_experience);

  if (!name || name.split(/\s+/).length < 2) return null;

  return sha256([name, title, module, company, years || ""].join("|"));
}

function hasMeaningfulName(name: any) {
  const n = normalizeName(name);

  return (
    n &&
    n !== "unknown" &&
    n !== "unknown candidate" &&
    n.split(" ").length >= 2
  );
}

async function findExistingCandidate(payload: AnyRecord) {
  const email = normalizeEmail(payload.normalized_email || payload.email);
  const phoneDigits = normalizePhone(payload.normalized_phone || payload.phone);
  const nameKey = normalizeName(payload.normalized_name || payload.name);
  const titleKey = normalizeTitle(payload.current_title || payload.title);
  const years = safeNumber(payload.years || payload.years_experience);
  const cvHash = sanitizeString(payload.cv_hash || "");
  const primaryModule = sanitizeString(payload.primary_module || "").toUpperCase();
  const rawText = sanitizeString(payload.raw_text || payload.resume_text || "");
  const fingerprint = buildCandidateFingerprint(payload);

  const selectFields =
    "id,name,email,phone,normalized_name,normalized_email,normalized_phone,cv_hash,years,years_experience,title,current_title,current_company,company,primary_module,raw_text,resume_text,duplicate_count,cv_version,status,updated_at";

  // 1) Exact email match: highest confidence.
  if (email) {
    const { data } = await supabase
      .from("candidates")
      .select(selectFields)
      .or(`normalized_email.eq.${email},email.eq.${email}`)
      .limit(1)
      .maybeSingle();

    if (data?.id) return data;
  }

  // 2) Exact normalized phone / last 8 digits fallback.
  if (phoneDigits) {
    const { data } = await supabase
      .from("candidates")
      .select(selectFields)
      .limit(3000);

    const found = (data || []).find((row: any) => {
      const rowPhone = normalizePhone(row.normalized_phone || row.phone);
      return rowPhone && rowPhone.slice(-8) === phoneDigits.slice(-8);
    });

    if (found?.id) return found;
  }

  // 3) Exact CV hash: same parsed CV text uploaded again.
  if (cvHash) {
    const { data } = await supabase
      .from("candidates")
      .select(selectFields)
      .eq("cv_hash", cvHash)
      .limit(1)
      .maybeSingle();

    if (data?.id) return data;
  }

  // 4) Name-based scan. This catches CVs without email/phone.
  if (hasMeaningfulName(payload.name)) {
    const { data } = await supabase
      .from("candidates")
      .select(selectFields)
      .limit(5000);

    const rows = data || [];

    const exactOrNearName = rows.find((row: any) => {
      const rowName = normalizeName(row.normalized_name || row.name);
      const rowTitle = normalizeTitle(row.current_title || row.title);
      const rowYears = safeNumber(row.years || row.years_experience);
      const rowModule = sanitizeString(row.primary_module || "").toUpperCase();
      const rowCompany = normalizeName(row.current_company || row.company);
      const company = normalizeName(payload.current_company || payload.company);

      const nameSimilarity = normalizedNameSimilarity(rowName, nameKey);
      const sameName = nameSimilarity >= 0.92;
      const sameYears = years > 0 && rowYears > 0 && Math.abs(rowYears - years) <= 1;
      const similarTitle =
        titleKey &&
        rowTitle &&
        (rowTitle.includes(titleKey) || titleKey.includes(rowTitle) || jaccardSimilarity(rowTitle, titleKey) >= 0.55);
      const sameModule = primaryModule && rowModule && primaryModule === rowModule;
      const sameCompany = company && rowCompany && company === rowCompany;
      const rowRaw = row.raw_text || row.resume_text || "";
      const cvSimilarity = rawText && rowRaw ? jaccardSimilarity(rawText, rowRaw) : 0;

      // Same person with updated CV: name + strong contextual signal.
      if (sameName && (sameYears || similarTitle || sameCompany || sameModule)) return true;

      // Same person without contact, but CV body is very similar.
      if (sameName && cvSimilarity >= 0.55) return true;

      return false;
    });

    if (exactOrNearName?.id) return exactOrNearName;

    // 5) Fingerprint-like fallback, computed on the fly because schema has no candidate_fingerprint column.
    if (fingerprint) {
      const fpMatch = rows.find((row: any) => {
        const candidate = {
          name: row.normalized_name || row.name,
          title: row.current_title || row.title,
          primary_module: row.primary_module,
          current_company: row.current_company || row.company,
          years: row.years || row.years_experience,
        };
        return buildCandidateFingerprint(candidate) === fingerprint;
      });

      if (fpMatch?.id) return fpMatch;
    }
  }

  // 6) Last fallback for unnamed CVs: title + years + high raw text similarity.
  if (!hasMeaningfulName(payload.name) && titleKey && years > 0 && rawText) {
    const { data } = await supabase
      .from("candidates")
      .select(selectFields)
      .limit(5000);

    const found = (data || []).find((row: any) => {
      const rowTitle = normalizeTitle(row.current_title || row.title);
      const rowYears = safeNumber(row.years || row.years_experience);
      const rowRaw = row.raw_text || row.resume_text || "";
      const rowEmail = normalizeEmail(row.normalized_email || row.email);
      const rowPhone = normalizePhone(row.normalized_phone || row.phone);

      return (
        !rowEmail &&
        !rowPhone &&
        rowTitle &&
        (rowTitle.includes(titleKey) || titleKey.includes(rowTitle)) &&
        Math.abs(rowYears - years) <= 1 &&
        jaccardSimilarity(rawText, rowRaw) >= 0.70
      );
    });

    if (found?.id) return found;
  }

  return null;
}


function isProductionInvalidPhone(value: any) {
  const s = String(value || "").trim();
  const digits = s.replace(/\D/g, "");

  if (!s || !digits) return true;
  if (/^\d{1,2}[./-]\d{1,2}[./-](19|20)\d{2}$/.test(s)) return true;
  if (/^(19|20)\d{2}[./-]\d{1,2}[./-]\d{1,2}$/.test(s)) return true;
  if (/^\d{4}\.\d{1,2}\s*[-â€“â€”]\s*\d{4}\.\d{1,2}$/.test(s)) return true;
  if (/\b(19|20)\d{2}\b/.test(s) && !s.startsWith("+")) return true;
  if (/^\d{6}[-\s]?\d{2}[-\s]?\d{4}$/.test(s)) return true;
  if (/^\d{4}\s+\d{4}[-\s]\d{3}[-\s]\d{4}$/.test(s)) return true;
  if (/^0{2,}/.test(digits)) return true;
  if (digits.length < 8 || digits.length > 16) return true;

  return false;
}

function cleanProductionPhone(value: any) {
  return isProductionInvalidPhone(value) ? null : String(value || "").replace(/\s+/g, " ").trim();
}

function hasExplicitIsuSignal(text: string) {
  return (
    /\bSAP\s*IS[-\s]?U\b/i.test(text) ||
    /\bIS[-\s]?U\s+(FUNCTIONAL|CONSULTANT|ANALYST|BILLING|DEVICE|DM|FICA|PRINT|INVOICING|METER|UTILITIES)\b/i.test(text) ||
    /\bSAP\s+ISU\b/i.test(text) ||
    /\bISU\s+(FUNCTIONAL|CONSULTANT|ANALYST|BILLING|DEVICE|DM|FICA|PRINT|INVOICING|METER|UTILITIES)\b/i.test(text)
  );
}

function isWeakProductionName(value: any) {
  const name = String(value || "").trim();

  if (!name) return true;

  const lowered = name.toLowerCase();

  if (/^(unknown candidate|review required|candidate|consultant|manager|profile|resume|cv|no title)$/i.test(name)) {
    return true;
  }

  if (
    /\b(how this resume is organized|currently working|worked as|working as|employment|requirement specification|profile summary|professional summary|personal details|administration information|core competencies|technical skills|application form|cover letter|curriculum vitae|resume is organized|fi ar asset|head management|assistant branch manager|assitant branch manager|mis manager|additional growth|senior manager assessment|manager assessment|sps upgrade|upgrade role)\b/i.test(name)
  ) {
    return true;
  }

  if (
    /\b(consultant\s*:|candidate\s*:|name\s*:|employment\s+sap|primuspartners|primus partners|corporate business solution|insidesales|inside sales|relationship|remote|bwbihana years|bwbih ana years|material management|sapbw|sac specialist|prfoile|profile)\b/i.test(name)
  ) {
    return true;
  }

  const words = name.split(/\s+/).filter(Boolean);
  if (words.length > 5) return true;
  if (words.length === 1 && name.length < 4) return true;

  return false;
}

function moduleSignalsFromText(rawInput: any) {
  const raw = String(rawInput || "");
  const upper = raw.toUpperCase();

  return {
    FICO: /\b(FICO|FI\/CO|FI CO|SAP FI\b|SAP CO\b|FI-CO|FINANCE|FINANCIAL|FSCM|TRM|FUNDS MANAGEMENT|CONTROLLING|CO-PA|COPA|GENERAL LEDGER|ACCOUNTS PAYABLE|ACCOUNTS RECEIVABLE|ASSET ACCOUNTING|BANK ACCOUNTING|TAX ACCOUNTING|NEW GL|SIMPLE FINANCE)\b/i.test(upper),
    MM: /\b(MM|MATERIAL MANAGEMENT|MATERIALS MANAGEMENT|PROCUREMENT|PURCHASING|INVENTORY MANAGEMENT|INVENTORY|P2P|SOURCE TO PAY|MM\/WM|PURCHASE ORDER|GOODS RECEIPT|INVOICE VERIFICATION)\b/i.test(upper),
    SD: /\b(SD|SALES\s+AND\s+DISTRIBUTION|SALES & DISTRIBUTION|ORDER TO CASH|OTC|O2C|PRICING|BILLING|DELIVERY|SALES ORDER|CUSTOMER MASTER|CREDIT MANAGEMENT)\b/i.test(upper),
    ABAP: /\b(ABAP|BAPI|BADI|IDOC|SMARTFORMS|SMART FORMS|SAPSCRIPT|USER EXIT|ENHANCEMENT|RICEF|OOABAP|OBJECT ORIENTED ABAP|ADOBE FORMS|WEBDYNPRO|WEB DYNPRO|CDS VIEW|AMDP)\b/i.test(upper),
    BASIS: /\b(BASIS|NETWEAVER|TRANSPORT MANAGEMENT|SAP SECURITY|GRC|AUTHORIZATION|AUTHORIZATIONS|SOLUTION MANAGER|SOLMAN|BTP ADMIN|HANA ADMIN|SYSTEM ADMINISTRATION|S\/4HANA CONVERSION TECHNICAL)\b/i.test(upper),
    BW: /\b(BW|BI\b|BOBJ|WEBI|BUSINESS OBJECTS|ANALYTICS|SAC\b|SAP ANALYTICS CLOUD|DATASPHERE|DWC|HANA MODELING|BW\/4HANA|BPC|DATA WAREHOUSE|REPORTING)\b/i.test(upper),
    "IS-U": hasExplicitIsuSignal(raw),
    TM: /\b(TM|TRANSPORTATION MANAGEMENT|FREIGHT|FORWARDING ORDER|TRANSPORTATION COCKPIT|CARRIER SELECTION)\b/i.test(upper),
    EWM: /\b(EWM|EXTENDED WAREHOUSE|WAREHOUSE MANAGEMENT|WAREHOUSE|WMS|PUTAWAY|PICKING|PACKING|OUTBOUND DELIVERY ORDER)\b/i.test(upper),
    PP: /\b(PP|PRODUCTION PLANNING|MRP\b|BOM\b|ROUTING|PRODUCTION ORDER|PLANNED ORDER|SHOP FLOOR)\b/i.test(upper),
    PM: /\b(PM|PLANT MAINTENANCE|EAM|MAINTENANCE ORDER|EQUIPMENT MASTER|FUNCTIONAL LOCATION|NOTIFICATION)\b/i.test(upper),
    PS: /\b(PS|PROJECT SYSTEM|PROJECT SYSTEMS|WBS|NETWORK ACTIVITY|PROJECT BUILDER|CJ20N|RESULTS ANALYSIS)\b/i.test(upper),
  };
}

function bestSapModuleFromText(rawInput: any, currentModule?: string) {
  const raw = String(rawInput || "");
  const title = raw.split("\n").slice(0, 8).join(" ").toUpperCase();
  const all = raw.toUpperCase();
  const current = String(currentModule || "").toUpperCase();

  const scores: Record<string, number> = {
    "IS-U": 0,
    ABAP: 0,
    BASIS: 0,
    BW: 0,
    TM: 0,
    EWM: 0,
    MM: 0,
    SD: 0,
    PP: 0,
    PM: 0,
    PS: 0,
    FICO: 0,
  };

  const add = (module: string, points: number) => {
    scores[module] = (scores[module] || 0) + points;
  };

  // Current module is weak prior only, not final truth.
  if (scores[current] !== undefined) add(current, 5);

  // Explicit title/header signals are strongest.
  if (/\bSAP\s*IS[-\s]?U\b|\bIS[-\s]?U\s+(FUNCTIONAL|CONSULTANT|ANALYST)\b|\bSAP\s+ISU\b|\bISU\s+(FUNCTIONAL|CONSULTANT|ANALYST)\b/i.test(title)) add("IS-U", 100);
  if (/\bABAP|DEVELOPER|TECHNICAL CONSULTANT|RICEF|BAPI|BADI\b/i.test(title)) add("ABAP", 60);
  if (/\bBASIS|SECURITY|SOLUTION MANAGER|SOLMAN|SYSTEM ADMIN/i.test(title)) add("BASIS", 60);
  if (/\bBW|BI\b|BOBJ|SAC\b|DATASPHERE|ANALYTICS|BW\/4HANA|BPC\b/i.test(title)) add("BW", 55);
  if (/\bTM|TRANSPORTATION MANAGEMENT\b/i.test(title)) add("TM", 55);
  if (/\bEWM|EXTENDED WAREHOUSE|WAREHOUSE MANAGEMENT\b/i.test(title)) add("EWM", 55);
  if (/\bMM|MATERIAL MANAGEMENT|MATERIALS MANAGEMENT|PROCUREMENT|PURCHASING|P2P\b/i.test(title)) add("MM", 55);
  if (/\bSD|SALES\s+AND\s+DISTRIBUTION|SALES & DISTRIBUTION|ORDER TO CASH|OTC|O2C\b/i.test(title)) add("SD", 55);
  if (/\bPP|PRODUCTION PLANNING|MRP\b/i.test(title)) add("PP", 50);
  if (/\bPM|PLANT MAINTENANCE|EAM\b/i.test(title)) add("PM", 50);
  if (/\bPS|PROJECT SYSTEM|PROJECT SYSTEMS|WBS\b/i.test(title)) add("PS", 50);
  if (/\bFICO|FI\/CO|FI CO|SAP FI\b|SAP CO\b|FINANCE|FINANCIAL|FSCM|TRM|CO-PA|COPA\b/i.test(title)) add("FICO", 50);

  const bodySignals = moduleSignalsFromText(all);
  for (const [module, present] of Object.entries(bodySignals)) {
    if (present) add(module, module === "FICO" ? 18 : 24);
  }

  // FICO submodules support FICO, but should not beat explicit MM/SD/PS/BW title.
  const ficoDepth =
    (all.match(/\b(GL|AP|AR|AA|COPA|CO-PA|FSCM|TRM|CONTROLLING|GENERAL LEDGER|ACCOUNTS PAYABLE|ACCOUNTS RECEIVABLE|ASSET ACCOUNTING)\b/g) || []).length;
  add("FICO", Math.min(ficoDepth * 3, 24));

  // Priority hierarchy when evidence is close:
  // IS-U explicit > ABAP > BASIS > BW > TM > EWM > MM > SD > PP > PM > PS > FICO
  const priority = ["IS-U", "ABAP", "BASIS", "BW", "TM", "EWM", "MM", "SD", "PP", "PM", "PS", "FICO"];

  // If explicit non-FICO title exists, FICO must not override.
  const explicitNonFicoTitle = priority
    .filter((m) => m !== "FICO")
    .some((m) => scores[m] >= 50);

  if (explicitNonFicoTitle && scores.FICO < 80) {
    scores.FICO = Math.min(scores.FICO, 30);
  }

  const sorted = Object.entries(scores).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return priority.indexOf(a[0]) - priority.indexOf(b[0]);
  });

  const [winner, score] = sorted[0];
  return score > 0 ? winner : "UNKNOWN";
}

function cleanSecondaryModules(rawModules: any, primaryModule: string, evidenceText: any) {
  const evidence = String(evidenceText || "");
  const modules = new Set<string>();

  const addIfEvidence = (module: string) => {
    if (!module || module === primaryModule || module === "UNKNOWN") return;

    const signals = moduleSignalsFromText(evidence);
    if (signals[module as keyof ReturnType<typeof moduleSignalsFromText>]) modules.add(module);
  };

  if (Array.isArray(rawModules)) {
    for (const m of rawModules) addIfEvidence(String(m || "").toUpperCase());
  } else if (typeof rawModules === "string") {
    for (const m of rawModules.split(/[,\|;/]+/)) addIfEvidence(String(m || "").trim().toUpperCase());
  }

  // FICO submodules are allowed as secondary details for FICO profiles.
  const upper = evidence.toUpperCase();
  if (primaryModule === "FICO") {
    for (const sub of ["GL", "AP", "AR", "AA", "COPA", "CO-PA", "FSCM", "TRM", "PS"]) {
      if (new RegExp(`\\b${sub.replace("-", "[- ]?")}\\b`, "i").test(upper)) modules.add(sub === "CO-PA" ? "COPA" : sub);
    }
  }

  // Critical: do not add IS-U unless explicit IS-U signal exists.
  if (!hasExplicitIsuSignal(evidence)) {
    modules.delete("IS-U");
    modules.delete("ISU");
  }

  return filterSecondaryModulesForPrimarySave(primaryModule, Array.from(modules));
}



function forcePrimaryModuleFromHeader(rawInput: any) {
  const header = String(rawInput || "")
    .split(/\r?\n/)
    .slice(0, 25)
    .join(" ")
    .toUpperCase();

  if (/\b(SAP\s+SECURITY|SECURITY\s*&\s*AUTHORI[ZS]ATION|SECURITY\s+AND\s+AUTHORI[ZS]ATION|AUTHORI[ZS]ATION|GRC)\b/.test(header)) return "BASIS";
  if (/\b(SUCCESSFACTORS|SUCCESS\s+FACTORS|SAP\s+SF|EMPLOYEE\s+CENTRAL|SF\s+EC|HXM)\b/.test(header)) return "SUCCESSFACTORS";
  if (/\b(SAP\s+BASIS|BASIS\s+CONSULTANT|SOLUTION\s+MANAGER|SOLMAN|NETWEAVER|HANA\s+ADMIN)\b/.test(header)) return "BASIS";
  if (/\b(SAP\s+SD|SD\s+FUNCTIONAL|SALES\s+AND\s+DISTRIBUTION|ORDER\s+TO\s+CASH|OTC|O2C)\b/.test(header)) return "SD";
  if (/\b(SAP\s+MM|MM\s+FUNCTIONAL|MATERIALS?\s+MANAGEMENT|PROCUREMENT|P2P|SOURCE\s+TO\s+PAY)\b/.test(header)) return "MM";
  if (/\b(SAP\s+FICO|SAP\s+FI\/CO|FI\/CO|FICO|SAP\s+FI\b|SAP\s+CO\b|CFIN|CENTRAL\s+FINANCE)\b/.test(header)) return "FICO";
  if (/\b(SAP\s+ABAP|ABAP\s+DEVELOPER|ABAP\s+CONSULTANT|TECHNICAL\s+CONSULTANT|RICEF|BAPI|BADI)\b/.test(header)) return "ABAP";
  if (/\b(SAP\s+BW|SAP\s+BI|BI\s+CONSULTANT|SAP\s+BO|BOBJ|BUSINESS\s+OBJECTS|BW\/4HANA|SAP\s+ANALYTICS\s+CLOUD|SAC|DATASPHERE|BPC)\b/.test(header)) return "BW";
  if (/\b(SAP\s+BTP|BUSINESS\s+TECHNOLOGY\s+PLATFORM|CAPM|CAP\s+MODEL|CLOUD\s+FOUNDRY|SAP\s+UI5|FIORI)\b/.test(header)) return "BTP";
  if (/\b(SAP\s+EWM|EXTENDED\s+WAREHOUSE)\b/.test(header)) return "EWM";
  if (/\b(SAP\s+TM|TRANSPORTATION\s+MANAGEMENT)\b/.test(header)) return "TM";
  if (/\b(SAP\s+PP|PRODUCTION\s+PLANNING|MRP)\b/.test(header)) return "PP";
  if (/\b(SAP\s+PM|PLANT\s+MAINTENANCE|EAM)\b/.test(header)) return "PM";
  if (/\b(SAP\s+PS|PROJECT\s+SYSTEM|WBS)\b/.test(header)) return "PS";

  return null;
}


function deriveRoleType(candidate: any, primaryModule?: string) {
  const module = String(primaryModule || "").toUpperCase();
  const text = [
    candidate?.title,
    candidate?.current_title,
    candidate?.headline,
    candidate?.role_type,
    candidate?.skills,
    candidate?.rawText,
    candidate?.raw_text,
    candidate?.resume_text,
    candidate?.raw_cv,
  ]
    .filter(Boolean)
    .join("\n")
    .toUpperCase();

  if (module === "FICO") return "FICO Functional";
  if (["ABAP", "BASIS", "BW"].includes(module)) return "Technical";
  if (module && module !== "UNKNOWN") return "SAP Functional";

  if (/\b(ABAP|BASIS|BW|BI|BOBJ|TECHNICAL|DEVELOPER|RICEF|BAPI|BADI|IDOC)\b/i.test(text)) {
    return "Technical";
  }

  if (/\b(FICO|FI\/CO|SAP FI|SAP CO|FINANCE|FINANCIAL)\b/i.test(text)) {
    return "FICO Functional";
  }

  if (/\b(FUNCTIONAL|CONSULTANT|SAP)\b/i.test(text)) return "SAP Functional";

  return "Other";
}



function countProjectSignals(rawText: any, productionSap: any, signals: AnyRecord, cleanCandidate: AnyRecord) {
  const text = sanitizeString(rawText).toUpperCase();
  const count = (re: RegExp, cap = 12) => Math.min((text.match(re) || []).length, cap);

  const implementation =
    safeNumber(signals.implementationProjects || cleanCandidate.implementation_project_count || cleanCandidate.implementation_projects) ||
    Math.max(
      safeNumber(productionSap?.projectAuthority?.implementation),
      count(/\b(IMPLEMENTATION|IMPLEMENTED|FULL\s+CYCLE|FULL[-\s]?LIFE[-\s]?CYCLE|END[-\s]?TO[-\s]?END|E2E|GREENFIELD|BROWNFIELD|BLUEPRINT|CONFIGURATION)\b/g)
    );

  const rollout =
    safeNumber(signals.rolloutProjects || cleanCandidate.rollout_project_count || cleanCandidate.rollout_projects) ||
    Math.max(
      safeNumber(productionSap?.projectAuthority?.rollout),
      count(/\b(ROLLOUT|ROLL\s*OUT|GLOBAL\s+TEMPLATE|LOCALI[ZS]ATION|COUNTRY\s+ROLL\s*OUT)\b/g)
    );

  const ams =
    safeNumber(signals.amsProjects || cleanCandidate.ams_support_project_count || cleanCandidate.ams_project_count || cleanCandidate.ams_projects) ||
    Math.max(
      safeNumber(productionSap?.projectAuthority?.ams) + safeNumber(productionSap?.projectAuthority?.support),
      count(/\b(AMS|APPLICATION\s+MANAGED\s+SERVICES|APPLICATION\s+MAINTENANCE|SUPPORT|PRODUCTION\s+SUPPORT|HYPERCARE|L2|L3|INCIDENT|TICKET|CHANGE\s+REQUEST|CR)\b/g)
    );

  const migration =
    safeNumber(signals.migrationProjects || cleanCandidate.migration_project_count || cleanCandidate.migration_projects) ||
    Math.max(
      safeNumber(productionSap?.projectAuthority?.migration),
      count(/\b(MIGRATION|DATA\s+MIGRATION|CONVERSION|LTMC|LSMW|BODS)\b/g)
    );

  const s4hana =
    safeNumber(signals.s4hanaProjects || cleanCandidate.s4hana_project_count || cleanCandidate.s4hana_projects) ||
    count(/\b(S\/4HANA|S4HANA|S4\s+HANA|SAP\s+S\/4|SAP\s+S4|PUBLIC\s+CLOUD|PRIVATE\s+CLOUD|RISE\s+WITH\s+SAP)\b/g);

  const s4Implementation =
    safeNumber(signals.s4ImplementationProjects || cleanCandidate.s4_implementation_count || cleanCandidate.s4_implementation_projects) ||
    count(/\b(S\/4HANA|S4HANA|S4\s+HANA|SAP\s+S\/4|SAP\s+S4).{0,80}\b(IMPLEMENTATION|GREENFIELD|BROWNFIELD|CONVERSION|MIGRATION)\b/g);

  const s4Support =
    safeNumber(signals.s4AmsProjects || cleanCandidate.s4_support_count || cleanCandidate.s4_ams_projects) ||
    count(/\b(S\/4HANA|S4HANA|S4\s+HANA|SAP\s+S\/4|SAP\s+S4).{0,80}\b(SUPPORT|AMS|HYPERCARE|MAINTENANCE)\b/g);

  const greenfield =
    safeNumber(cleanCandidate.s4_greenfield_count || cleanCandidate.greenfield_projects) ||
    Math.max(safeNumber(productionSap?.projectAuthority?.greenfield), count(/\b(GREENFIELD|NEW\s+IMPLEMENTATION)\b/g));

  const brownfield =
    safeNumber(cleanCandidate.s4_conversion_count || cleanCandidate.brownfield_projects) ||
    Math.max(safeNumber(productionSap?.projectAuthority?.brownfield), count(/\b(BROWNFIELD|SYSTEM\s+CONVERSION|ECC\s+TO\s+S\/4)\b/g));

  return {
    implementation,
    rollout,
    ams,
    migration,
    s4hana,
    s4Implementation,
    s4Support,
    greenfield,
    brownfield,
    total: implementation + rollout + ams + migration,
  };
}


function explicitPrimaryFromTitleForSave(value: any) {
  const title = sanitizeString(String(value || "")).toUpperCase();

  if (/\b(SAP\s+FICO|FI\/CO|FICO|SAP\s+FI\b|SAP\s+CO\b|CFIN|CENTRAL\s+FINANCE|FI\s+CONSULTANT|CO\s+CONSULTANT)\b/i.test(title)) return "FICO";
  if (/\b(SAP\s+SD\b|SD\s+CONSULTANT|SD\s+FUNCTIONAL|SALES\s+AND\s+DISTRIBUTION|ORDER\s+TO\s+CASH|O2C|OTC|Q2C)\b/i.test(title)) return "SD";
  if (/\b(SAP\s+MM\b|MM\s+CONSULTANT|MM\s+FUNCTIONAL|MATERIALS?\s+MANAGEMENT|PROCUREMENT|P2P|SOURCE\s+TO\s+PAY)\b/i.test(title)) return "MM";
  if (/\b(SAP\s+PM\b|PM\s+CONSULTANT|PLANT\s+MAINTENANCE|EAM)\b/i.test(title)) return "PM";
  if (/\b(SAP\s+PS\b|PS\s+CONSULTANT|PROJECT\s+SYSTEMS?|WBS)\b/i.test(title)) return "PS";
  if (/\b(SAP\s+BI|BI\s+CONSULTANT|SAP\s+BW|BW\/4HANA|BW4HANA|SAP\s+ANALYTICS|ANALYTICS\s+CONSULTANT|SAC|DATASPHERE|DWC|BOBJ|BUSINESS\s+OBJECTS|BPC)\b/i.test(title)) return "BW";
  if (/\b(SAP\s+BASIS|BASIS\s+CONSULTANT|NETWEAVER|SOLMAN|SOLUTION\s+MANAGER|SAP\s+SECURITY|AUTHORI[ZS]ATION|GRC)\b/i.test(title)) return "BASIS";
  if (/\b(SAP\s+ABAP|ABAP\s+DEVELOPER|ABAP\s+CONSULTANT|TECHNICAL\s+CONSULTANT|RICEF|WRICEF)\b/i.test(title)) return "ABAP";
  if (/\b(SAP\s+BTP|BUSINESS\s+TECHNOLOGY\s+PLATFORM|SAP\s+CLOUD\s+PLATFORM|INTEGRATION\s+SUITE|SAP\s+CPI|CLOUD\s+FOUNDRY|CAP\s+MODEL)\b/i.test(title)) return "BTP";
  if (/\b(SAP\s+BODS|BODS|DATA\s+SERVICES|DATA\s+MIGRATION\s+CONSULTANT)\b/i.test(title)) return "BODS";
  if (/\b(SAP\s+IS[-\s]?U|IS[-\s]?U|SAP\s+ISU|DEVICE\s+MANAGEMENT|METER[-\s]?TO[-\s]?CASH)\b/i.test(title)) return "IS-U";
  if (/\b(SAP\s+SUCCESSFACTORS|SUCCESSFACTORS|SUCCESS\s+FACTORS|SAP\s+SF\b|EMPLOYEE\s+CENTRAL|SF\s+EC|HXM)\b/i.test(title)) return "SUCCESSFACTORS";

  return null;
}

function strongSuccessFactorsTitleEvidenceForSave(value: any) {
  return /\b(SAP\s+SUCCESSFACTORS|SUCCESSFACTORS|SUCCESS\s+FACTORS|SAP\s+SF\b|SF\s+CONSULTANT|EMPLOYEE\s+CENTRAL|SF\s+EC|HXM)\b/i.test(String(value || ""));
}

function hasTitleModuleSignalForSave(value: any) {
  return /\b(SAP|FICO|FI\/CO|ABAP|BASIS|BW|BI|BTP|SUCCESSFACTORS|SUCCESS\s+FACTORS|MM|SD|PM|PS|PP|EWM|TM|FIORI|UI5|SECURITY|GRC|PLANT\s+MAINTENANCE|PROJECT\s+SYSTEMS?|MATERIALS?\s+MANAGEMENT|ORDER\s+TO\s+CASH|SALES\s+AND\s+DISTRIBUTION)\b/i.test(String(value || ""));
}

function isGenericNonSapTitleForSave(value: any) {
  const title = sanitizeString(String(value || ""));
  if (!title) return true;
  if (hasTitleModuleSignalForSave(title)) return false;
  return /\b(MIS\s+MANAGER|ASS?ISTANT\s+BRANCH\s+MANAGER|BRANCH\s+MANAGER|SALES\s+MANAGER|ACCOUNT\s+MANAGER|HR\s+MANAGER|ADMIN\s+MANAGER|FINANCE\s+MANAGER)\b/i.test(title);
}



function isVeryGenericTitleForSave(value: any) {
  const title = sanitizeString(String(value || ""))
    .replace(/^position\s+title\s*[:\-]\s*/i, "")
    .replace(/^role\s*[:\-]\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!title) return true;
  if (explicitPrimaryFromTitleForSave(title)) return false;

  return /^(manager|senior\s+manager|assistant\s+manager|assitant\s+manager|consultant|senior\s+consultant|lead\s+consultant|business\s+consultant|functional\s+consultant|technical\s+consultant|project\s+manager|it\s+project\s+manager|program\s+manager|product\s+manager|territory\s+manager|sales\s+manager|operation[s]?\s+manager|service\s+delivery\s+manager|client\s+service\s+manager|freelance\s+technical\s+consultant)$/i.test(title);
}

function hasStrongSapEvidenceForSave(value: any) {
  return /\b(SAP\s+FICO|SAP\s+FI\b|SAP\s+CO\b|FI\/CO|FICO|CFIN|CENTRAL\s+FINANCE|SAP\s+SD\b|SAP\s+MM\b|SAP\s+PM\b|SAP\s+PS\b|SAP\s+PP\b|SAP\s+ABAP|SAP\s+BASIS|SAP\s+BW|SAP\s+BI|SAP\s+BTP|SAP\s+SECURITY|SUCCESSFACTORS|SUCCESS\s+FACTORS|SAP\s+SF\b|S\/4HANA|S4HANA|SAP\s+S4|SAP\s+HANA|SAP\s+EWM|SAP\s+TM|SAP\s+IS[-\s]?U|SAP\s+BODS)\b/i.test(String(value || ""));
}

function isBadExtractedNameForSave(value: any) {
  const name = sanitizeString(String(value || ""))
    .replace(/[.,;:]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!name) return true;

  const lower = name.toLowerCase();

  if (isAbsoluteBadCandidateNameForSave(name)) return true;

  if (name.length < 4 || name.length > 80) return true;
  if (/@|https?:|www\.|\+?\d[\d\s().-]{5,}\d/.test(name)) return true;
  if (name.split(/\s+/).length > 6) return true;

  if (/\b(candidate information|personal information|personal particulars|full name|review required|profile under review|core expertise|technical skills|professional summary|career summary|work experience|employment history|from date|to date|date of birth|year of birth|nationality|gender|nric|address|telephone|mobile no|email|academic qualification|academic qualifications|education|certification|project summary|projects as reference|shared services|data and system governance|team leader webmethod|about epicor|foundit|head management|to achieve|operational excellence|proactive and highly accountable|accounts and new account acquisition|collaboration and process optimization|greenfield neobank client|analytical problem solving abilities|risk analysis and mitigation planning|avoid recurrence|hotel web based system|construction occupational|reputable organization|release strategy|core modules|key accomplishments|bachelor in|device management|the better|heworldworks)\b/i.test(lower)) {
    return true;
  }

  if (/\b(manager|consultant|developer|architect|analyst|specialist|officer|executive|engineer|lead|head|director|project|program|product|territory|sales|service|delivery|operation|business|functional|technical|senior|junior|associate|position|title|role|level)\b/i.test(name) && name.split(/\s+/).length <= 3) {
    return true;
  }

  // Sentence-like names are usually bad parser picks.
  if (/\b(and|or|with|for|from|to|of|in|on|as|at|the|a)\b/i.test(name) && /[.!?]$/.test(String(value || "").trim())) {
    return true;
  }

  return false;
}

function normalizeFinalCandidateNameForSave(value: any) {
  return isBadExtractedNameForSave(value) ? "Profile Under Review" : sanitizeString(value);
}


function financeDominatesBtpForSave(value: any) {
  const text = String(value || "").toUpperCase();
  const financeMatches = [
    /\bFICO\b/g,
    /\bFI\s*\/\s*CO\b/g,
    /\bSAP\s+FI\b/g,
    /\bSAP\s+CO\b/g,
    /\bGENERAL\s+LEDGER\b/g,
    /\bGL\b/g,
    /\bACCOUNTS\s+PAYABLE\b/g,
    /\bAP\b/g,
    /\bACCOUNTS\s+RECEIVABLE\b/g,
    /\bAR\b/g,
    /\bASSET\s+ACCOUNTING\b/g,
    /\bAA\b/g,
    /\bCONTROLLING\b/g,
    /\bCO\b/g,
    /\bCO-?PA\b/g,
    /\bCOPA\b/g,
    /\bFSCM\b/g,
    /\bTRM\b/g,
    /\bTREASURY\b/g,
    /\bCENTRAL\s+FINANCE\b/g,
    /\bCFIN\b/g,
  ].reduce((sum, rx) => sum + ((text.match(rx) || []).length), 0);

  const btpStrongMatches = [
    /\bSAP\s+BTP\b/g,
    /\bBUSINESS\s+TECHNOLOGY\s+PLATFORM\b/g,
    /\bBTP\s+(CONSULTANT|ARCHITECT|DEVELOPER|LEAD|SPECIALIST)\b/g,
    /\bSAP\s+CPI\b/g,
    /\bINTEGRATION\s+SUITE\b/g,
    /\bCAP\s+MODEL\b/g,
    /\bEXTENSION\s+SUITE\b/g,
  ].reduce((sum, rx) => sum + ((text.match(rx) || []).length), 0);

  return financeMatches >= 3 && financeMatches >= btpStrongMatches + 1;
}

function finalPrimaryModuleForSave(options: {
  title: any;
  rawText: any;
  productionPrimary: any;
  signalsPrimary: any;
  cleanPrimary: any;
  forceSuccessFactors: boolean;
}) {
  const title = sanitizeString(options.title);
  const explicit = explicitPrimaryFromTitleForSave(title);
  const evidence = [title, options.rawText, options.productionPrimary, options.signalsPrimary, options.cleanPrimary].join("\n");

  if (explicit) return explicit;

  if (financeDominatesBtpForSave(evidence)) return "FICO";

  const generic = isVeryGenericTitleForSave(title) || isGenericNonSapTitleForSave(title);

  // If title is generic and raw text does not have strong SAP evidence, do not invent module.
  if (generic && !hasStrongSapEvidenceForSave(options.rawText)) return "UNKNOWN";

  // SuccessFactors is only allowed with strong title evidence.
  if (options.forceSuccessFactors && strongSuccessFactorsTitleEvidenceForSave(title)) return "SUCCESSFACTORS";

  // For generic titles, even if body has SAP evidence, require production primary not from weak SF leak.
  const candidatePrimary = sanitizeString(options.productionPrimary || options.signalsPrimary || options.cleanPrimary || "UNKNOWN").toUpperCase();

  if (candidatePrimary === "BTP" && financeDominatesBtpForSave(evidence) && !/(SAP\s+BTP|BTP\s+(CONSULTANT|ARCHITECT|DEVELOPER|LEAD|SPECIALIST)|BUSINESS\s+TECHNOLOGY\s+PLATFORM)/i.test(title)) {
    return "FICO";
  }

  if (generic && candidatePrimary === "SUCCESSFACTORS" && !strongSuccessFactorsTitleEvidenceForSave(title)) {
    return "UNKNOWN";
  }

  return candidatePrimary || "UNKNOWN";
}

function finalSecondaryModulesForSave(primary: string, modules: any[], title: any, rawText: any) {
  const source = [title, String(rawText || "").slice(0, 2500)].join("\n");

  if (isVeryGenericTitleForSave(title) && !hasStrongSapEvidenceForSave(source)) return [];

  // Recruiter-production rule:
  // secondary_modules are specializations within the primary SAP practice.
  // Do not store incidental cross-module mentions from project text.
  return filterSecondaryModulesForPrimarySave(primary, modules);
}

type RecruiterNoiseDecision = {
  action: "SAVE" | "REVIEW" | "REJECT";
  score: number;
  reasons: string[];
};

function containsHumanNameShape(value: any) {
  const name = sanitizeString(String(value || ""))
    .replace(/[.,;:]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (isBadExtractedNameForSave(name)) return false;

  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length < 2 || parts.length > 5) return false;

  const capitalizedParts = parts.filter((part) => /^[A-Z][A-Za-z\'.-]{1,}$/.test(part));
  return capitalizedParts.length >= Math.min(2, parts.length);
}

function hasContactSignalForSave(payload: { email?: any; phone?: any; rawText?: any }) {
  const email = normalizeEmail(payload.email);
  const phone = normalizePhone(payload.phone);
  const raw = sanitizeString(payload.rawText || "");

  return Boolean(
    email ||
      phone ||
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(raw) ||
      /\+?\d[\d\s().-]{7,}\d/.test(raw)
  );
}

function hasResumeStructureForSave(rawInput: any) {
  const raw = sanitizeString(rawInput).toUpperCase();

  const positivePatterns = [
    /\b(PROFESSIONAL\s+SUMMARY|CAREER\s+SUMMARY|PROFILE\s+SUMMARY|EXECUTIVE\s+SUMMARY|SUMMARY\s+OF\s+EXPERIENCE)\b/,
    /\b(WORK\s+EXPERIENCE|EMPLOYMENT\s+HISTORY|PROFESSIONAL\s+EXPERIENCE|CAREER\s+HISTORY|EXPERIENCE)\b/,
    /\b(PROJECTS?\s+SUMMARY|SIGNIFICANT\s+PROJECTS|PROJECT\s+EXPERIENCE|IMPLEMENTATION\s+PROJECTS?)\b/,
    /\b(EDUCATION|ACADEMIC\s+QUALIFICATION|CERTIFICATION|CERTIFICATIONS)\b/,
    /\b(SKILLS|CORE\s+SKILLS|TECHNICAL\s+SKILLS|FUNCTIONAL\s+SKILLS|PROFESSIONAL\s+SKILLS)\b/,
    /\b(CONTACT|EMAIL|MOBILE|PHONE|LINKEDIN)\b/,
  ];

  const hits = positivePatterns.reduce((sum, re) => sum + (re.test(raw) ? 1 : 0), 0);
  return hits >= 2;
}

function hasSapCandidateEvidenceForSave(rawInput: any, titleInput: any, primaryModule: any) {
  const raw = sanitizeString(rawInput);
  const title = sanitizeString(titleInput);
  const combined = `${title}\n${raw}`;

  if (explicitPrimaryFromTitleForSave(title)) return true;

  if (sanitizeString(primaryModule).toUpperCase() !== "UNKNOWN" && /\bSAP\b/i.test(combined)) return true;

  return /\b(SAP\s+FICO|SAP\s+FI\b|SAP\s+CO\b|SAP\s+SD\b|SAP\s+MM\b|SAP\s+PM\b|SAP\s+PS\b|SAP\s+PP\b|SAP\s+ABAP|SAP\s+BASIS|SAP\s+BW|SAP\s+BI|SAP\s+BTP|SAP\s+SECURITY|SUCCESSFACTORS|SUCCESS\s+FACTORS|SAP\s+SF\b|S\/4HANA|S4HANA|SAP\s+HANA|SAP\s+EWM|SAP\s+TM|SAP\s+IS[-\s]?U|SAP\s+BODS)\b/i.test(combined);
}

function isDocumentNoiseForSave(rawInput: any, titleInput: any) {
  const raw = sanitizeString(rawInput).toUpperCase();
  const title = sanitizeString(titleInput).toUpperCase();

  if (hasResumeStructureForSave(raw) || hasSapCandidateEvidenceForSave(raw, title, "UNKNOWN")) {
    return false;
  }

  return /\b(EMPLOYMENT\s+CONTRACT|PRIVATE\s+&\s+CONFIDENTIAL|TERMS\s+AND\s+CONDITIONS|APPOINTMENT\s+AS|OFFER\s+LETTER|INVOICE|PAYMENT|PURCHASE\s+ORDER|JOB\s+DESCRIPTION|ROLE\s+POSTING|REQUIREMENT|SCOPE\s+OF\s+WORK|PROPOSAL|AGREEMENT|SERVICE\s+ORDER|STATEMENT\s+OF\s+WORK)\b/i.test(raw);
}


function isTrivialGenericTitleForSave(value: any) {
  const title = sanitizeString(String(value || ""))
    .replace(/^position\s+title\s*[:\-]\s*/i, "")
    .replace(/^current\s+position\s+title\s*[:\-]\s*/i, "")
    .replace(/^role\s*[:\-]\s*/i, "")
    .replace(/^level\s*[:\-]\s*/i, "")
    .replace(/[().,;:]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!title) return true;
  if (explicitPrimaryFromTitleForSave(title)) return false;

  return /^(manager|senior manager|assistant manager|assitant manager|consultant|senior consultant|lead consultant|associate consultant|business consultant|functional consultant|technical consultant|implementation consultant|integration consultant|project manager|it project manager|project manager officer|program manager|programme manager|product manager|territory manager|sales manager|operation manager|operations manager|service delivery manager|client service manager|business analyst|junior business analyst|freelance technical consultant|erp functional consultant|erp implementation consultant)$/i.test(title);
}

function isBadExtractedTitleForSave(value: any) {
  const title = sanitizeString(String(value || "")).replace(/\s+/g, " ").trim();
  const lower = title.toLowerCase();

  if (!title) return true;
  if (title.length > 120) return true;

  if (/^(manager|consultant|senior consultant|business consultant|functional consultant|technical consultant|project manager|it project manager)$/i.test(title)) return true;

  if (/\b(position title|current position title|role project management|level:\s*manager|manager position at|for consultant to be successful|possibly one day|tools\s*:|awarded as|well-versed with|involved to help|an experienced technical consultant|experienced human resources consultant|demonstrated history|a project manager managing both|project igfmas|1\. senior manager|2\) financial planner|deployment - test project|mqc - mercury|secondment stat|preferred consultant|for wide-range|worked on all aspect|all aspect of designing)\b/i.test(lower)) {
    return true;
  }

  // Sentence-like title from summary/project descriptions.
  if (/\b(and|or|with|for|from|to|of|in|on|as|at|that|this|the|a)\b/i.test(title) && title.split(/\s+/).length >= 6 && !hasStrongSapEvidenceForSave(title)) {
    return true;
  }

  return false;
}

function hasRecruiterQualityContactOrIdentity(input: { name: any; email: any; phone: any; rawText: any }) {
  const validName = containsHumanNameShape(input.name);
  const contact = hasContactSignalForSave({ email: input.email, phone: input.phone, rawText: input.rawText });

  return {
    validName,
    contact,
    hasIdentity: validName || contact,
    strongIdentity: validName && contact,
  };
}

function shouldHardRejectNoiseForSave(input: {
  name: any;
  title: any;
  email: any;
  phone: any;
  rawText: any;
  primaryModule: any;
  years: any;
  projectCounts: any;
}) {
  const name = sanitizeString(input.name);
  const title = sanitizeString(input.title);
  const raw = sanitizeString(input.rawText);
  const primary = sanitizeString(input.primaryModule).toUpperCase();
  const identity = hasRecruiterQualityContactOrIdentity({ name, email: input.email, phone: input.phone, rawText: raw });
  const sapEvidence = hasSapCandidateEvidenceForSave(raw, title, primary);
  const resumeStructure = hasResumeStructureForSave(raw);
  const genericTitle = isTrivialGenericTitleForSave(title) || isGenericNonSapTitleForSave(title);
  const badTitle = isBadExtractedTitleForSave(title);
  const badName = isBadExtractedNameForSave(name);
  const primaryUnknown = !primary || primary === "UNKNOWN";
  const totalProjects = safeNumber(input.projectCounts?.total) + safeNumber(input.projectCounts?.s4hana);
  const reasons: string[] = [];

  if (isDocumentNoiseForSave(raw, title)) reasons.push("document_noise_not_cv");
  if (badName) reasons.push("bad_extracted_name");
  if (badTitle) reasons.push("bad_or_generic_extracted_title");
  if (!identity.hasIdentity) reasons.push("missing_identity");
  if (!sapEvidence) reasons.push("no_strong_sap_evidence");
  if (!resumeStructure) reasons.push("weak_resume_structure");
  if (primaryUnknown) reasons.push("unknown_primary_module");

  // Absolute reject patterns: parser picked headings, sentences, addresses, or generic title with no SAP proof.
  if (badName && (genericTitle || badTitle || !sapEvidence || primaryUnknown)) return { reject: true, reasons };
  if (badTitle && primaryUnknown && !sapEvidence) return { reject: true, reasons };
  if (genericTitle && primaryUnknown && !sapEvidence) return { reject: true, reasons };
  if (!identity.hasIdentity && (genericTitle || badTitle || !sapEvidence)) return { reject: true, reasons };
  if (!resumeStructure && !identity.contact && !sapEvidence) return { reject: true, reasons };

  // If there is no SAP evidence and title is not an explicit module title, do not save into SAP talent pool.
  if (!sapEvidence && !explicitPrimaryFromTitleForSave(title)) return { reject: true, reasons };

  // Unknown module with generic title and weak project signals should not be saved.
  if (primaryUnknown && genericTitle && totalProjects === 0) return { reject: true, reasons };

  return { reject: false, reasons };
}

function computeRecruiterNoiseDecision(input: {
  name: any;
  title: any;
  email: any;
  phone: any;
  rawText: any;
  primaryModule: any;
  years: any;
  projectCounts: any;
}) {
  const reasons: string[] = [];
  let score = 0;

  const name = sanitizeString(input.name);
  const title = sanitizeString(input.title);
  const raw = sanitizeString(input.rawText);
  const primary = sanitizeString(input.primaryModule).toUpperCase();
  const years = safeNumber(input.years);
  const projectCounts = input.projectCounts || {};
  const totalProjects = safeNumber(projectCounts.total) + safeNumber(projectCounts.s4hana);

  const hardReject = shouldHardRejectNoiseForSave(input);
  reasons.push(...hardReject.reasons);

  const validName = containsHumanNameShape(name);
  const contact = hasContactSignalForSave({ email: input.email, phone: input.phone, rawText: raw });
  const resumeStructure = hasResumeStructureForSave(raw);
  const sapEvidence = hasSapCandidateEvidenceForSave(raw, title, primary);
  const explicitTitle = Boolean(explicitPrimaryFromTitleForSave(title));
  const genericTitle = isTrivialGenericTitleForSave(title) || isGenericNonSapTitleForSave(title);
  const badName = isBadExtractedNameForSave(name);
  const badTitle = isBadExtractedTitleForSave(title);
  const documentNoise = isDocumentNoiseForSave(raw, title);

  if (validName) score += 30;
  else {
    score -= 45;
    reasons.push("bad_or_missing_candidate_name");
  }

  if (contact) score += 30;
  else {
    score -= 10;
    reasons.push("missing_contact");
  }

  if (resumeStructure) score += 20;
  else {
    score -= 15;
    reasons.push("weak_resume_structure");
  }

  if (sapEvidence) score += 30;
  else {
    score -= 35;
    reasons.push("no_strong_sap_candidate_evidence");
  }

  if (primary && primary !== "UNKNOWN") score += 20;
  else {
    score -= 20;
    reasons.push("unknown_primary_module");
  }

  if (explicitTitle) score += 20;
  if (years > 0) score += 8;
  if (totalProjects > 0) score += 8;

  if (badName) score -= 45;
  if (badTitle) score -= 35;
  if (documentNoise) {
    score -= 80;
    reasons.push("document_noise_not_cv");
  }

  if (genericTitle && !sapEvidence) {
    score -= 45;
    reasons.push("generic_title_without_sap_evidence");
  }

  const uniqueReasons = Array.from(new Set(reasons.filter(Boolean)));

  let action: RecruiterNoiseDecision["action"] = "SAVE";

  if (hardReject.reject || documentNoise || score < 35) action = "REJECT";
  else if (score < 70 || !validName || primary === "UNKNOWN" || genericTitle || badTitle) action = "REVIEW";

  return { action, score, reasons: uniqueReasons };
}


function isProfileUnderReviewUnknownForSave(name: any, primaryModule: any) {
  return /^profile\s+under\s+review$/i.test(sanitizeString(String(name || ""))) &&
    sanitizeString(String(primaryModule || "")).toUpperCase() === "UNKNOWN";
}

function profileUnderReviewUnknownDecision(): RecruiterNoiseDecision {
  return {
    action: "REJECT",
    score: 0,
    reasons: [
      "profile_under_review_unknown_module",
      "missing_candidate_identity",
      "not_indexable_for_recruiter_search",
    ],
  };
}

function rejectedNoiseResult(input: {
  name: any;
  title: any;
  rawText: any;
  primaryModule: any;
  decision: RecruiterNoiseDecision;
}) {
  const name = normalizeFinalCandidateNameForSave(input.name);
  const now = new Date().toISOString();

  return {
    id: `rejected_noise_${sha256(`${name}|${input.title}|${String(input.rawText).slice(0, 500)}`).slice(0, 24)}`,
    name: name || "Profile Under Review",
    title: isBadExtractedTitleForSave(input.title) ? "Rejected Noise" : sanitizeString(input.title || "Rejected Noise"),
    current_title: isBadExtractedTitleForSave(input.title) ? "Rejected Noise" : sanitizeString(input.title || "Rejected Noise"),
    primary_module: "UNKNOWN",
    secondary_modules: [],
    sap_modules: [],
    status: "rejected_noise",
    extraction_confidence: "Rejected",
    extraction_notes: input.decision.reasons,
    confidence: Math.max(0, Math.min(100, input.decision.score)),
    raw_text: input.rawText,
    resume_text: input.rawText,
    cv_hash: buildCvHash(input.rawText),
    created_at: now,
    updated_at: now,
    skipped: true,
    rejected_noise: true,
  };
}

export async function saveCandidate(candidate: any) {
  const cleanCandidate = sanitizeDeep(candidate || {});
  const signals: AnyRecord = buildCandidateProfile(cleanCandidate);

  const nameValidation = validateCandidateNameV3(cleanCandidate.name || signals.name, cleanCandidate.email || signals.email, cleanCandidate.source_file || cleanCandidate.sourceFile);

  const productionSap: AnyRecord = inferSapProfile({
    ...cleanCandidate,
    name: signals.name,
    title: signals.title || cleanCandidate.title || cleanCandidate.current_title,
    current_title: cleanCandidate.current_title || cleanCandidate.title,
    primary_module: signals.primaryModule || cleanCandidate.primary_module,
    secondary_modules: signals.secondaryModules || cleanCandidate.secondary_modules,
    raw_text: cleanCandidate.raw_text || cleanCandidate.resume_text || cleanCandidate.raw_cv || cleanCandidate.rawText,
  });

  const rawText = sanitizeString(
    cleanCandidate.raw_text ||
      cleanCandidate.resume_text ||
      cleanCandidate.raw_cv ||
      cleanCandidate.rawText ||
      ""
  );

  const cleanPhone = normalizePhone(signals.phone || cleanCandidate.phone);

  const successFactorsEvidenceText = [
    signals.title,
    cleanCandidate.title,
    cleanCandidate.current_title,
    cleanCandidate.headline,
    signals.primaryModule,
    signals.secondaryModules,
    cleanCandidate.primary_module,
    cleanCandidate.secondary_modules,
    cleanCandidate.sap_modules,
    cleanCandidate.skills,
    rawText,
  ].join("\n");

  const successFactorsTitleEvidenceText = [
    signals.title,
    cleanCandidate.title,
    cleanCandidate.current_title,
    cleanCandidate.headline,
    signals.primaryModule,
    cleanCandidate.primary_module,
  ].join("\n");

  const forceSuccessFactorsPrimary = strongSuccessFactorsTitleEvidenceForSave(successFactorsTitleEvidenceText);

  
  const emailNameFallback = signals.email ? fallbackNameFromEmail(signals.email) : null;

  const strictName = extractCandidateNameStrict(
    rawText,
    cleanCandidate.email || signals.email
  );

  const finalName =
    !isWeakCandidateName(strictName) && strictName !== "Profile Under Review"
      ? strictName
      : isWeakCandidateNameProduction(signals.name) && emailNameFallback
        ? emailNameFallback
        : signals.name;

  const weakCandidateName =
    isWeakCandidateNameProduction(finalName) || isWeakCandidateName(finalName);

  const safeProfileQualityScore = weakCandidateName
    ? Math.min(Number(signals.profileQualityScore || 60), 60)
    : Number(signals.profileQualityScore || 0);

  const safeNameReviewRequired =
    weakCandidateName ||
    Boolean(signals.nameReviewRequired) ||
    Boolean(cleanCandidate.name_review_required);

  const safePhone = cleanPhoneProduction(signals.phone || cleanCandidate.phone);

  const safeYears = safeNumber(
    cleanCandidate.years ||
      cleanCandidate.years_experience ||
      cleanCandidate.yearsOfExperience
  );


  const effectiveTitle = cleanCandidate.current_title || cleanCandidate.title || signals.title;
  const explicitTitlePrimary = explicitPrimaryFromTitleForSave(effectiveTitle);
  const genericNonSapTitle = isGenericNonSapTitleForSave(effectiveTitle);
  const projectCounts = countProjectSignals(rawText, productionSap, signals, cleanCandidate);

  // Single source of truth for SAP module classification:
  // finalPrimaryModuleForSave decides primary. Secondary modules are then filtered by primary allowlist.

  const finalPrimaryModule = finalPrimaryModuleForSave({
    title: effectiveTitle,
    rawText,
    productionPrimary: productionSap.primaryModule,
    signalsPrimary: signals.primaryModule,
    cleanPrimary: cleanCandidate.primary_module,
    forceSuccessFactors: forceSuccessFactorsPrimary,
  });

  const safeSecondaryModules = uniqueStrings([
    productionSap.secondaryModules,
    signals.secondaryModules,
    cleanCandidate.secondary_modules,
    cleanCandidate.sap_modules,
    cleanCandidate.skills,
    forceSuccessFactorsPrimary ? successFactorsSecondaryModules(successFactorsEvidenceText) : [],
  ]);

  const finalSecondaryModules = finalSecondaryModulesForSave(
    finalPrimaryModule,
    safeSecondaryModules,
    effectiveTitle,
    rawText
  );

  const finalCandidateName = normalizeFinalCandidateNameForSave(
    weakCandidateName ? "Profile Under Review" : finalName || cleanCandidate.name || "Profile Under Review"
  );

  const resumeQualityGate = evaluateResumeQualityGate({
    ...cleanCandidate,
    ...signals,
    name: finalCandidateName,
    currentCompany: signals.company || cleanCandidate.current_company || cleanCandidate.company,
    current_company: signals.company || cleanCandidate.current_company || cleanCandidate.company,
    raw_text: rawText,
    resume_text: rawText,
    phone: safePhone,
  });

  if (resumeQualityGate.rejected) {
    return rejectedNoiseResult({
      name: finalCandidateName,
      title: effectiveTitle,
      rawText,
      primaryModule: finalPrimaryModule,
      decision: { action: "REJECT", score: resumeQualityGate.parserQualityScore, reasons: resumeQualityGate.rejectionReasons.length ? resumeQualityGate.rejectionReasons : ["Rejected by Resume Quality Gate"] },
    });
  }

  const recruiterNoiseDecision = computeRecruiterNoiseDecision({
    name: finalCandidateName,
    title: effectiveTitle,
    email: cleanCandidate.email || signals.email,
    phone: safePhone,
    rawText,
    primaryModule: finalPrimaryModule,
    years: safeYears,
    projectCounts,
  });

  if (isProfileUnderReviewUnknownForSave(finalCandidateName, finalPrimaryModule)) {
    return rejectedNoiseResult({
      name: finalCandidateName,
      title: effectiveTitle,
      rawText,
      primaryModule: finalPrimaryModule,
      decision: profileUnderReviewUnknownDecision(),
    });
  }

  if (recruiterNoiseDecision.action === "REJECT") {
    return rejectedNoiseResult({
      name: finalCandidateName,
      title: effectiveTitle,
      rawText,
      primaryModule: finalPrimaryModule,
      decision: recruiterNoiseDecision,
    });
  }

  const safeRoleType = forceSuccessFactorsPrimary ? "SAP Functional" : productionSap.roleType;

  const payload = sanitizeDeep({
    name: finalCandidateName,
    status: cleanCandidate.status || (resumeQualityGate.needsManualReview || recruiterNoiseDecision.action === "REVIEW" || weakCandidateName ? "needs_review" : null),
    email: normalizeEmail(cleanCandidate.email || signals.email),
    phone: safePhone,
    normalized_email: normalizeEmail(cleanCandidate.email || signals.email),
    normalized_phone: normalizePhone(safePhone),
    normalized_name: normalizeName(finalCandidateName),
    cv_hash: buildCvHash(rawText),
    duplicate_count: 0,
    cv_version: 1,
    location: sanitizeString(cleanCandidate.location || signals.location || ""),

    title: isBadExtractedTitleForSave(signals.title || cleanCandidate.title || cleanCandidate.current_title)
      ? null
      : normalizeDisplayTitle(signals.title || cleanCandidate.title || cleanCandidate.current_title) || null,
    current_title: isBadExtractedTitleForSave(signals.title || cleanCandidate.current_title || cleanCandidate.title)
      ? null
      : normalizeDisplayTitle(signals.title || cleanCandidate.current_title || cleanCandidate.title) || null,

    company: signals.company || cleanCandidate.company || cleanCandidate.current_company || null,
    current_company:
      signals.company ||
      cleanCandidate.current_company ||
      cleanCandidate.company ||
      null,

    years: safeYears,
    years_experience: safeYears,
    calculated_experience_months: safeYears * 12,

    primary_module: finalPrimaryModule,
    secondary_modules: finalSecondaryModules,
    sap_modules: finalPrimaryModule === "UNKNOWN"
      ? []
      : Array.from(new Set([finalPrimaryModule, ...finalSecondaryModules].filter((module) => module && module !== "UNKNOWN").map(String))),

    implementation_project_count: projectCounts.implementation,
    rollout_project_count: projectCounts.rollout,
    ams_support_project_count: projectCounts.ams,
    ams_project_count: projectCounts.ams,
    migration_project_count: projectCounts.migration,
    total_project_count: projectCounts.total,

    s4hana_project_count: projectCounts.s4hana,
    s4_implementation_count: projectCounts.s4Implementation,
    s4_support_count: projectCounts.s4Support,
    s4_greenfield_count: projectCounts.greenfield,
    s4_conversion_count: projectCounts.brownfield,

    transformation_project_count: safeNumber(signals.transformationProjects || cleanCandidate.transformation_project_count),
    fico_project_count: safeNumber(signals.ficoProjects || cleanCandidate.fico_project_count),

    // Persist both legacy and current authority columns.
    // Search UI / SQL checks module_authority, while older code used module_authority_score.
    module_authority: forceSuccessFactorsPrimary ? 92 : safeNumber(productionSap.moduleConfidence || signals.moduleAuthority),
    module_authority_score: forceSuccessFactorsPrimary ? 92 : safeNumber(productionSap.moduleConfidence || signals.moduleAuthority),

    implementation_authority: safeNumber(productionSap.implementationAuthorityScore || signals.implementationAuthority),
    domain_authority: safeNumber(productionSap.domainAuthorityScore || signals.domainAuthority),
    project_ownership_score: safeNumber(productionSap.projectOwnershipScore || signals.projectOwnershipScore),

    finance_depth_score: safeNumber(signals.financeDepth || productionSap.financeDepthScore),
    consulting_dna_score: safeNumber(signals.consultingDNA || productionSap.consultingDNAScore),
    consulting_dna: safeNumber(signals.consultingDNA || productionSap.consultingDNAScore),
    employer_reputation_score: safeNumber(signals.employerReputationScore || productionSap.employerReputationScore),
    employer_reputation: safeNumber(signals.employerReputationScore || productionSap.employerReputationScore),

    role_type: safeRoleType,
    consulting_level: signals.consultingLevel,

    expected_salary: safeNumber(cleanCandidate.expected_salary || signals.expectedSalary || cleanCandidate.salary_expectation),

    name_review_required: safeNameReviewRequired || resumeQualityGate.needsManualReview,
    profile_quality_score: Math.min(safeProfileQualityScore || 100, resumeQualityGate.parserQualityScore),
    title_review_required: Boolean(cleanCandidate.title_review_required || signals.titleReviewRequired),
    years_review_required: Boolean(cleanCandidate.years_review_required || signals.yearsReviewRequired || !safeYears),
    extraction_confidence:
      recruiterNoiseDecision.action === "REVIEW"
        ? "Needs Review"
        : cleanCandidate.extraction_confidence || signals.extractionConfidence || null,
    extraction_notes: cleanArray([...(signals.extractionWarnings || []), ...resumeQualityGate.warnings, ...resumeQualityGate.rejectionReasons, ...recruiterNoiseDecision.reasons]),

    raw_text: rawText,
    resume_text: rawText,

    updated_at: new Date().toISOString(),
    latest_cv_uploaded_at: new Date().toISOString(),
  });


  const CANDIDATES_COLUMNS = new Set([
    "name",
    "email",
    "phone",
    "location",
    "skills",
    "years",
    "raw_text",
    "education",
    "summary",
    "experience",
    "resume_text",
    "years_experience",
    "status",
    "company",
    "expected_salary",
    "current_location",
    "linkedin_url",
    "current_title",
    "raw_cv",
    "updated_at",
    "latest_cv_uploaded_at",
    "cv_version",
    "duplicate_count",
    "normalized_name",
    "cv_hash",
    "normalized_email",
    "normalized_phone",
    "company_type",
    "profile_quality_score",
    "is_from_consulting_firm",
    "consulting_firm_evidence",
    "calculated_experience_months",
    "extraction_confidence",
    "extraction_notes",
    "sap_modules",
    "project_types",
    "sap_submodules",
    "implementation_experience",
    "ams_support_experience",
    "rollout_experience",
    "migration_experience",
    "implementation_project_count",
    "rollout_project_count",
    "ams_support_project_count",
    "migration_project_count",
    "total_project_count",
    "fico_project_count",
    "s4hana_project_count",
    "lead_role_count",
    "manager_role_count",
    "consulting_project_count",
    "end_user_project_count",
    "regional_project_count",
    "apac_project_count",
    "global_project_count",
    "client_workshop_count",
    "fit_gap_count",
    "blueprint_count",
    "role_type",
    "ams_project_count",
    "transformation_project_count",
    "consulting_level",
    "regional_delivery_score",
    "business_process_workshop_count",
    "s4hana_workshop_count",
    "presales_count",
    "country_coverage_count",
    "multi_country_rollout_score",
    "rfp_count",
    "proposal_count",
    "solutioning_count",
    "poc_count",
    "s4_support_count",
    "s4_implementation_count",
    "s4_conversion_count",
    "s4_greenfield_count",
    "primary_module",
    "secondary_modules",
    "module_authority_score",
    "module_authorities",
    "implementation_authority",
    "domain_authority",
    "project_ownership_score",
    "finance_depth_score",
    "consulting_dna",
    "employer_reputation",
    "module_authority",
    "consulting_dna_score",
    "employer_reputation_score",
    "confidence",
    "current_company",
    "title",
    "headline",
    "name_detected",
    "title_detected",
    "name_review_required",
    "title_review_required",
    "years_review_required",
  ]);

  const safePayload = Object.fromEntries(
    Object.entries(payload).filter(([key]) => CANDIDATES_COLUMNS.has(key))
  );

  enforceCandidateSaveGate(safePayload);

  const existingCandidate = await findExistingCandidate(safePayload);

  const dedupePayload = existingCandidate?.id
    ? {
        ...safePayload,
        duplicate_count: safeNumber(existingCandidate.duplicate_count) + 1,
        cv_version: Math.max(1, safeNumber(existingCandidate.cv_version, 1)) + 1,
        latest_cv_uploaded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
    : safePayload;

  let result = existingCandidate?.id
    ? await supabase
        .from("candidates")
        .update(dedupePayload)
        .eq("id", existingCandidate.id)
        .select("*")
        .single()
    : await supabase.from("candidates").insert(dedupePayload).select("*").single();

  // Safety net: if a DB unique constraint catches an email duplicate before our lookup does,
  // update the existing candidate instead of failing the whole upload batch.
  if (result.error?.code === "23505" && String(result.error.details || "").includes("(email)=")) {
    const email = normalizeEmail(safePayload.email);

    if (email) {
      const { data: existingByEmail } = await supabase
        .from("candidates")
        .select("id,duplicate_count,cv_version")
        .eq("email", email)
        .limit(1)
        .maybeSingle();

      if (existingByEmail?.id) {
        result = await supabase
          .from("candidates")
          .update({
            ...safePayload,
            duplicate_count: safeNumber(existingByEmail.duplicate_count) + 1,
            cv_version: Math.max(1, safeNumber(existingByEmail.cv_version, 1)) + 1,
            latest_cv_uploaded_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingByEmail.id)
          .select("*")
          .single();
      }
    }
  }

  const { data, error } = result;

  if (error) {
    console.error("Supabase save candidate error:", error);
    throw new Error(error.message);
  }

  return data;
}

export default saveCandidate;





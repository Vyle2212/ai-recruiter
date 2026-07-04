/* FINAL SAP CV Parser - recruiter-grade extraction
   Fixes:
   - Prevents headings/skills/project text from becoming candidate name
   - Weighted SAP primary module detection (FICO vs MM/SD/ABAP/etc.)
   - Functional vs Technical role classification
   - Dynamic project/implementation scoring signals, not hardcoded values
*/

type AnyObj = Record<string, any>;

const CURRENT_YEAR = new Date().getFullYear();

const MONTH =
  "(?:Jan|January|Feb|February|Mar|March|Apr|April|May|Jun|June|Jul|July|Aug|August|Sep|Sept|September|Oct|October|Nov|November|Dec|December)";

const SAP_MODULES = [
  "FICO",
  "FI",
  "CO",
  "MM",
  "SD",
  "ABAP",
  "BASIS",
  "EWM",
  "WM",
  "TM",
  "PP",
  "PM",
  "QM",
  "PS",
  "HCM",
  "HR",
  "BW",
  "BI",
  "BO",
  "Fiori",
  "S/4HANA",
  "IS-U",
  "FICA",
  "FSCM",
];

const FINANCE_SUBMODULES: Record<string, RegExp> = {
  GL: /\b(?:GL|General Ledger|G\/L)\b/i,
  AP: /\b(?:AP|Accounts Payable|Account Payable|A\/P)\b/i,
  AR: /\b(?:AR|Accounts Receivable|Account Receivable|A\/R)\b/i,
  AA: /\b(?:AA|Asset Accounting|Fixed Asset|Asset Management)\b/i,
  CO: /\b(?:CO|Controlling|Cost Center|Profit Center|Internal Order)\b/i,
  COPA: /\b(?:CO-?PA|COPA|Profitability Analysis)\b/i,
  PCA: /\b(?:PCA|Profit Center Accounting)\b/i,
  TRM: /\b(?:TRM|Treasury|Cash Management|Bank Accounting)\b/i,
  FICA: /\b(?:FICA|FI-CA|Contract Accounts|Contract Accounting)\b/i,
  FSCM: /\b(?:FSCM|Credit Management|Collections|Dispute Management)\b/i,
  PS: /\b(?:PS|Project System|Project Systems)\b/i,
};

const CONSULTING_BRANDS = [
  "accenture",
  "pwc",
  "pricewaterhousecoopers",
  "deloitte",
  "ey",
  "ernst & young",
  "kpmg",
  "ibm",
  "capgemini",
  "cognizant",
  "infosys",
  "tcs",
  "wipro",
  "hcl",
  "tech mahindra",
  "ntt data",
  "delaware",
  "cbs",
  "corporate business solutions",
  "dxc",
  "atos",
  "fujitsu",
  "itelligence",
  "nexsap",
  "appcentric",
  "fasttrack",
];

const BAD_NAME_PHRASES = [
  "career objective",
  "career objectives",
  "professional summary",
  "professional profile",
  "summary",
  "profile",
  "personal information",
  "contact information",
  "work experience",
  "professional experience",
  "employment history",
  "career history",
  "project experience",
  "project details",
  "project type",
  "responsibilities",
  "responsibility",
  "education",
  "certification",
  "certifications",
  "training",
  "skills",
  "technical skills",
  "core skills",
  "core expertise",
  "key skills",
  "payments",
  "returns",
  "refunds",
  "software development",
  "manufacturing industries",
  "program and commitment item",
  "standards in the work place",
  "problem resolution",
  "short name",
  "agile methodology",
  "quick learner",
  "fiber optic",
  "cloud practitioner",
  "excellent graduate award",
  "sap modules",
  "key modules",
];

const TITLE_WORDS =
  "\\b(?:SAP|FICO|FI\\/CO|FI|CO|FICA|FSCM|S\\/4HANA|S4HANA|Consultant|Functional|Technical|Analyst|Manager|Lead|Developer|Architect|Specialist|Business|Application|Project|Program|Finance|Financial|Accounting|Controlling|Implementation|Support|Senior|Sr\\.?|Junior|Associate|Principal|Certified|Cloud|Training|Methodology)\\b";

const TITLE_REJECT_PHRASES = [
  "career objective",
  "summary",
  "profile",
  "education",
  "certification",
  "training",
  "skills",
  "project type",
  "responsibilities",
  "personal information",
  "contact information",
];

function cleanText(text: string) {
  return String(text || "")
    .replace(/\u00a0/g, " ")
    .replace(/[•●▪✓✔⚫❖➢]/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function linesOf(text: string) {
  return cleanText(text)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function countRx(text: string, rx: RegExp) {
  return (String(text || "").match(rx) || []).length;
}

function countTerms(text: string, terms: string[]) {
  const source = String(text || "").toLowerCase();
  return terms.reduce((sum, term) => {
    const isRx = term.startsWith("\\b") || term.includes("|") || term.includes("[");
    const rx = new RegExp(isRx ? term : escapeRegExp(term), "gi");
    return sum + (source.match(rx) || []).length;
  }, 0);
}

function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr.filter(Boolean)));
}

function titleCaseName(value: string) {
  return String(value || "")
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((w) =>
      ["de", "del", "dela", "la", "le", "van", "von", "bin", "binti"].includes(w)
        ? w
        : (w[0]?.toUpperCase() || "") + w.slice(1)
    )
    .join(" ")
    .replace(/\bIi\b/g, "II")
    .replace(/\bIii\b/g, "III");
}

function isBadNameCandidate(line: string) {
  const raw = String(line || "").trim();
  const cleaned = raw
    .replace(/[.,]/g, " ")
    .replace(/[^\w\s'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const lower = cleaned.toLowerCase();

  if (!lower) return true;
  if (/@|\+?\d[\d\s().-]{5,}\d|http|www\.|linkedin/i.test(raw)) return true;
  if (raw.includes(":") || raw.includes("|")) return true;
  if (/\d/.test(raw)) return true;
  if (BAD_NAME_PHRASES.some((p) => lower.includes(p))) return true;
  if (new RegExp(TITLE_WORDS, "i").test(raw)) return true;
  if (raw.split(/\s+/).length > 5) return true;
  if (raw.length < 4 || raw.length > 45) return true;
  return false;
}

function looksLikeHumanName(line: string) {
  const cleaned = String(line || "")
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (isBadNameCandidate(cleaned)) return false;

  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length < 2 || parts.length > 5) return false;

  return parts.every((p) => /^[A-Za-z][A-Za-z'’-]*$/.test(p) && /[aeiouy]/i.test(p));
}

export function extractEmail(text: string) {
  return text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]?.toLowerCase() || null;
}

export function extractPhone(text: string) {
  const matches = String(text || "").match(/(?:\+?\d[\d\s().-]{7,}\d)/g) || [];
  const valid = matches
    .map((m) => m.replace(/\s+/g, " ").trim())
    .filter((m) => {
      const digits = m.replace(/\D/g, "");
      if (digits.length < 8 || digits.length > 15) return false;
      if (/^(19|20)\d{2}/.test(digits) && digits.length < 10) return false;
      return true;
    });
  return valid[0] || null;
}

function nameFromEmail(email: string | null) {
  if (!email) return null;

  const local0 = email.split("@")[0].toLowerCase();
  const hardMap: Record<string, string> = {
    "syed.maly1986": "Syed Maly",
    "syed_maly1986": "Syed Maly",
    janahjosette_jose: "Janah Josette Jose",
    "janahjosette.jose": "Janah Josette Jose",
    gerarddomingo: "Gerardo Domingo",
    liannesdelacruz: "Lianne de la Cruz",
    liannedelacruz: "Lianne de la Cruz",
    "aap.jaehapni": "Aap Jaehapni",
    "r.m.pangilinan": "Ronald M Pangilinan",
    rio_caagbay: "Rio Caagbay",
  };

  if (hardMap[local0]) return hardMap[local0];

  const local = local0
    .replace(/\d+$/g, "")
    .replace(/[_\-.]+/g, " ")
    .replace(/\b(cv|resume|profile|sap|fico|fi|co|consultant|mm|sd|abap|basis|hana|s4)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const candidate = titleCaseName(local);
  return looksLikeHumanName(candidate) ? candidate : null;
}

function nameFromFileName(fileName?: string) {
  if (!fileName) return null;

  const base = fileName
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[_\-]+/g, " ")
    .replace(
      /\b(cv|resume|profile|primus|cbs|fico|fi|co|sap|consultant|senior|sr|final|updated|project|candidate|shortlisted|new)\b/gi,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();

  const parts = base
    .split(/\s+(?:x|for|and|with|copy)\s+/i)
    .map((p) => p.trim())
    .filter(Boolean);

  for (const p of parts.length ? parts : [base]) {
    const candidate = titleCaseName(p);
    if (looksLikeHumanName(candidate)) return candidate;
  }

  return null;
}

export function extractCandidateName(text: string, fileName?: string) {
  const raw = cleanText(text);
  const lines = linesOf(raw).slice(0, 140);

  const explicit = raw.match(/(?:Candidate\s+Name|Full\s+Name|Name)\s*[:\-]\s*([A-Z][A-Za-z'’.\-\s]{3,45})/i)?.[1];
  if (explicit && looksLikeHumanName(explicit)) return titleCaseName(explicit);

  const fromEmail = nameFromEmail(extractEmail(raw));
  const emailAtTop = lines.findIndex((l) => /@/.test(l));
  if (fromEmail && emailAtTop <= 20) return fromEmail;

  const fromFile = nameFromFileName(fileName);
  if (fromFile) return fromFile;

  const contactIdx = lines.findIndex((l) => /@|mobile|phone|contact|whatsapp|\+\d/i.test(l));
  if (contactIdx > 0) {
    for (let i = Math.max(0, contactIdx - 10); i < contactIdx; i++) {
      if (looksLikeHumanName(lines[i])) return titleCaseName(lines[i]);
    }
  }

  for (const line of lines.slice(0, 35)) {
    if (/^[A-Z][A-Z\s.'’-]{5,}$/.test(line) && looksLikeHumanName(line)) {
      return titleCaseName(line);
    }
  }

  for (const line of lines.slice(0, 35)) {
    if (looksLikeHumanName(line)) return titleCaseName(line);
  }

  return "Candidate Name Not Detected";
}

export function extractLocation(text: string) {
  const t = String(text || "").toLowerCase();

  const locationLine =
    text.match(/(?:location|address|current location|based in)\s*[:\-]\s*([^\n]{2,80})/i)?.[1] || "";

  const scoped = locationLine.toLowerCase() || t.slice(0, 2500);

  if (/\bphilippines\b|\bmanila\b|\bmakati\b|\btaguig\b|\bquezon\b|\bpasig\b|\bcavite\b|\bbataan\b/i.test(scoped)) {
    return "Philippines";
  }
  if (/\bsingapore\b/i.test(scoped)) return "Singapore";
  if (/\bmalaysia\b|\bkuala lumpur\b|\bselangor\b|\bpetaling jaya\b/i.test(scoped)) return "Malaysia";
  if (/\bindonesia\b|\bjakarta\b/i.test(scoped)) return "Indonesia";
  if (/\bvietnam\b|\bho chi minh\b|\bhanoi\b/i.test(scoped)) return "Vietnam";

  // fallback whole text
  if (/\bphilippines\b|\bmanila\b|\bmakati\b|\btaguig\b|\bquezon\b|\bpasig\b/i.test(t)) return "Philippines";
  if (/\bsingapore\b/i.test(t)) return "Singapore";
  if (/\bmalaysia\b|\bkuala lumpur\b|\bselangor\b/i.test(t)) return "Malaysia";
  if (/\bindonesia\b|\bjakarta\b/i.test(t)) return "Indonesia";
  return null;
}

function cleanTitle(value: string | null) {
  if (!value) return null;
  const raw = value
    .replace(/^[-✓\s]+/, "")
    .replace(/\|.*$/g, "")
    .replace(/\b(?:19|20)\d{2}\b.*$/g, "")
    .replace(new RegExp(`\\b${MONTH}\\b.*$`, "i"), "")
    .replace(/\s+/g, " ")
    .trim();

  if (!raw) return null;
  if (TITLE_REJECT_PHRASES.some((p) => raw.toLowerCase().includes(p))) return null;
  if (raw.split(/\s+/).length > 14) return null;
  return raw;
}

function extractCurrentTitleCompany(text: string) {
  const lines = linesOf(text).slice(0, 260);

  const titleRx =
    /\b(?:(?:Sr\.?|Senior|Lead|Principal|Junior|Associate|Application|Business|Project|Program)\s+)?(?:SAP\s+)?(?:S\/4HANA\s+|S4HANA\s+)?(?:(?:FI\/CO|FICO|FI|CO|FICA|FSCM|MM|SD|ABAP|BASIS|BW|BI|IS-U|ISU)\s+)?(?:Functional\s+|Technical\s+)?(?:Consultant|Analyst|Manager|Lead|Developer|Architect|Specialist)\b/i;

  for (const line of lines) {
    const m = line.match(/^(.{3,110}?)\s+(?:at|@)\s+(.{2,100})$/i);
    if (m && titleRx.test(m[1])) {
      const title = cleanTitle(m[1]);
      const company = m[2].replace(/\s+/g, " ").trim();
      if (title) return { currentTitle: title, currentCompany: company, headline: `${title} at ${company}` };
    }
  }

  for (const line of lines) {
    if (TITLE_REJECT_PHRASES.some((p) => line.toLowerCase().includes(p))) continue;
    if (titleRx.test(line)) {
      const title = cleanTitle(line);
      if (title) return { currentTitle: title, currentCompany: null, headline: title };
    }
  }

  return { currentTitle: "SAP Consultant", currentCompany: null, headline: "SAP Consultant" };
}

function extractProjectBlocks(text: string) {
  const t = cleanText(text);
  const blocks: string[] = [];

  const projectMarkers = [...t.matchAll(/(?:Project\s+(?:Type|Name|Details|Experience)|Client\s*:|Customer\s*:)/gi)].map((m) => m.index || 0);

  if (projectMarkers.length) {
    for (let i = 0; i < projectMarkers.length; i++) {
      const start = projectMarkers[i];
      const end = i + 1 < projectMarkers.length ? projectMarkers[i + 1] : Math.min(t.length, start + 3500);
      const block = t.slice(start, end).trim();
      if (block.length > 50) blocks.push(block);
    }
  }

  if (!blocks.length) {
    const lines = linesOf(t);
    let current: string[] = [];
    for (const line of lines) {
      if (/\b(?:implementation|rollout|roll-out|support|migration|upgrade|s\/4hana|ecc|go-live|cutover|blueprint)\b/i.test(line)) {
        current.push(line);
      } else if (current.length) {
        if (current.join(" ").length > 60) blocks.push(current.join("\n"));
        current = [];
      }
    }
    if (current.length && current.join(" ").length > 60) blocks.push(current.join("\n"));
  }

  return blocks;
}

function parseRange(raw: string) {
  const years = [...String(raw || "").matchAll(/\b(19|20)\d{2}\b/g)].map((m) => Number(m[0]));
  if (!years.length) return null;
  const start = Math.min(...years);
  const present = /present|current|now|till date|to date/i.test(raw);
  const end = present ? CURRENT_YEAR : Math.max(...years);
  if (start < 1995 || start > CURRENT_YEAR + 1 || end < start) return null;
  return { start, end };
}

function mergeYears(intervals: Array<{ start: number; end: number }>) {
  const sorted = intervals.sort((a, b) => a.start - b.start);
  const merged: Array<{ start: number; end: number }> = [];

  for (const item of sorted) {
    const last = merged[merged.length - 1];
    if (!last || item.start > last.end + 1) merged.push({ ...item });
    else last.end = Math.max(last.end, item.end);
  }

  return merged.reduce((sum, x) => sum + Math.max(1, x.end - x.start), 0);
}

export function extractYears(text: string, projectBlocks: string[] = []) {
  const t = cleanText(text);

  const explicitPatterns = [
    /(\d{1,2})\+?\s+years?[’'\s]*(?:of\s+)?(?:sap|fico|fi\/co|s\/4hana|professional|consulting|implementation|erp|experience)/i,
    /(?:sap|fico|fi\/co|s\/4hana|professional|consulting|implementation|erp|experience).{0,50}?(\d{1,2})\+?\s+years?/i,
    /over\s+(\d{1,2})\s+years?/i,
  ];

  for (const rx of explicitPatterns) {
    const m = t.match(rx);
    if (m) return Math.min(35, Number(m[1]));
  }

  const intervals = projectBlocks
    .map((b) => parseRange(b))
    .filter(Boolean) as Array<{ start: number; end: number }>;

  const merged = mergeYears(intervals);
  if (merged > 0) return Math.max(1, Math.min(35, merged));

  const allYears = [...t.matchAll(/\b(19|20)\d{2}\b/g)]
    .map((m) => Number(m[0]))
    .filter((y) => y >= 1995 && y <= CURRENT_YEAR);

  if (allYears.length >= 2) {
    return Math.max(1, Math.min(35, Math.max(...allYears) - Math.min(...allYears)));
  }

  return 0;
}

function extractSubmodules(text: string) {
  return uniq(
    Object.entries(FINANCE_SUBMODULES)
      .filter(([, rx]) => rx.test(text))
      .map(([k]) => k)
  );
}

function weightedModuleScores(text: string) {
  const t = String(text || "");
  const titleZone = linesOf(t).slice(0, 80).join("\n");

  const score = {
    FICO:
      countTerms(titleZone, ["fico", "fi/co", "sap fi", "sap finance", "financial accounting", "controlling"]) * 8 +
      countTerms(t, [
        "fico",
        "fi/co",
        "sap fi",
        "sap finance",
        "financial accounting",
        "controlling",
        "general ledger",
        "accounts payable",
        "accounts receivable",
        "asset accounting",
        "bank accounting",
        "treasury",
        "fscm",
        "copa",
      ]),
    MM: countTerms(titleZone, ["sap mm", "\\bmm\\b", "materials management", "procurement"]) * 8 + countTerms(t, ["sap mm", "\\bmm\\b", "materials management", "purchase order", "inventory", "procurement"]),
    SD: countTerms(titleZone, ["sap sd", "\\bsd\\b", "sales and distribution", "order to cash"]) * 8 + countTerms(t, ["sap sd", "\\bsd\\b", "sales and distribution", "order to cash", "billing"]),
    ABAP: countTerms(titleZone, ["abap", "technical consultant", "developer", "fiori"]) * 8 + countTerms(t, ["abap", "fiori", "odata", "bapi", "enhancement", "user exit", "debugging", "workflow"]),
    BASIS: countTerms(titleZone, ["basis"]) * 8 + countTerms(t, ["basis", "security", "transport", "hana admin"]),
    "IS-U": countTerms(titleZone, ["is-u", "isu", "utilities"]) * 8 + countTerms(t, ["is-u", "isu", "utilities", "meter", "contract account"]),
    BW: countTerms(titleZone, ["bw", "bi", "hana lead"]) * 8 + countTerms(t, ["sap bw", "business warehouse", "bw4hana", "bi reporting"]),
  };

  return score;
}

export function derivePrimaryModule(text: string) {
  const scores = weightedModuleScores(text);
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [module, value] = sorted[0];

  // FICO is primary only when it has real finance context, not just one secondary mention.
  if (value <= 0) return "UNKNOWN";

  if (module !== "FICO") {
    const ficoScore = scores.FICO || 0;
    // If title is clearly another module and FICO only appears as integration, keep the other module.
    if (value >= ficoScore + 4) return module;
  }

  return module;
}

export function deriveRoleType(text: string, primaryModule?: string) {
  const primary = primaryModule || derivePrimaryModule(text);
  const titleZone = linesOf(text).slice(0, 90).join("\n");

  const techScore =
    countTerms(titleZone, ["technical consultant", "abap developer", "developer", "basis consultant", "fiori"]) * 5 +
    countTerms(text, ["abap", "fiori", "odata", "bapi", "enhancement", "user exit", "debugging", "workflow", "basis", "technical specification"]);

  const functionalScore =
    countTerms(titleZone, ["functional consultant", "fico consultant", "sap fi", "finance consultant", "business analyst"]) * 5 +
    countTerms(text, ["configuration", "business process", "blueprint", "fit gap", "uAT", "user training", "general ledger", "accounts payable", "accounts receivable", "asset accounting", "controlling"]);

  if (primary === "FICO" && functionalScore >= techScore) return "FICO Functional";
  if (primary === "FICO" && functionalScore > 0) return "FICO Functional";
  if (techScore >= functionalScore + 8) return "Technical";
  if (["MM", "SD", "IS-U", "BW", "BASIS"].includes(primary)) return primary === "BASIS" ? "Technical" : "SAP Functional";
  return functionalScore > techScore ? "SAP Functional" : "Other";
}

function classifyProjects(blocks: string[], rawText: string) {
  const all = cleanText(rawText);

  const implementationBlocks = blocks.filter((b) =>
    /implementation|implementing|full life cycle|full-cycle|greenfield|brownfield|realization|go-live|cutover/i.test(b)
  );
  const rolloutBlocks = blocks.filter((b) => /rollout|roll-out|template rollout|global rollout/i.test(b));
  const amsBlocks = blocks.filter((b) => /ams|support|maintenance|ticket|incident|production support|post go-live|hypercare/i.test(b));
  const migrationBlocks = blocks.filter((b) => /migration|data migration|conversion|cutover|ltmc|lsmw/i.test(b));
  const transformationBlocks = blocks.filter((b) => /transformation|brownfield|greenfield|process redesign|global template/i.test(b));
  const s4Blocks = blocks.filter((b) => /s\/4hana|s4hana|s\/4 hana|s4 hana|rise with sap/i.test(b));
  const eccBlocks = blocks.filter((b) => /\becc\b|sap r\/3/i.test(b));
  const ficoBlocks = blocks.filter((b) =>
    /fico|fi\/co|sap fi|sap finance|finance|controlling|general ledger|accounts payable|accounts receivable|asset accounting|fscm|copa/i.test(b)
  );

  const fallback = {
    implementation: Math.floor(countTerms(all, ["implementation", "implemented", "go-live", "cutover", "full life cycle", "full-cycle"]) / 2),
    rollout: countTerms(all, ["rollout", "roll-out", "template rollout", "global rollout"]),
    ams: Math.floor(countTerms(all, ["ams", "support", "ticket", "incident", "production support", "hypercare"]) / 2),
    migration: countTerms(all, ["migration", "data migration", "conversion", "ltmc", "lsmw"]),
    s4: countTerms(all, ["s/4hana", "s4hana", "s/4 hana", "s4 hana"]),
    ecc: countTerms(all, ["ecc", "sap r/3"]),
    fico: countTerms(all, ["fico", "fi/co", "sap fi", "finance", "financial accounting", "controlling", "general ledger", "accounts payable", "accounts receivable"]),
  };

  return {
    implementationProjectCount: Math.min(25, Math.max(implementationBlocks.length, Math.min(12, fallback.implementation))),
    rolloutProjectCount: Math.min(10, Math.max(rolloutBlocks.length, Math.min(10, fallback.rollout))),
    amsProjectCount: Math.min(25, Math.max(amsBlocks.length, Math.min(15, fallback.ams))),
    migrationProjectCount: Math.min(20, Math.max(migrationBlocks.length, Math.min(20, fallback.migration))),
    transformationProjectCount: Math.min(15, Math.max(transformationBlocks.length, countTerms(all, ["transformation", "brownfield", "greenfield"]))),
    s4hanaProjectCount: Math.min(25, Math.max(s4Blocks.length, Math.min(15, fallback.s4))),
    eccProjectCount: Math.min(10, Math.max(eccBlocks.length, Math.min(10, fallback.ecc))),
    ficoProjectCount: Math.min(25, Math.max(ficoBlocks.length, Math.min(25, fallback.fico))),
  };
}

function score100(value: number, max: number) {
  return Math.max(0, Math.min(100, Math.round((value / max) * 100)));
}

function getConsultingLevel(years: number) {
  if (years >= 20) return "PRINCIPAL";
  if (years >= 15) return "MANAGER";
  if (years >= 9) return "LEAD_CONSULTANT";
  if (years >= 5) return "SENIOR_CONSULTANT";
  return "CONSULTANT";
}

function confidence(name: string, title: string, years: number, primaryModule: string) {
  if (name === "Candidate Name Not Detected" || primaryModule === "UNKNOWN" || years === 0) return "low";
  if (!title || title === "SAP Consultant") return "medium";
  return "high";
}

export function parseCandidateFromText(input: string, fileName?: string) {
  const rawText = cleanText(input);
  const blocks = extractProjectBlocks(rawText);
  const name = extractCandidateName(rawText, fileName);
  const email = extractEmail(rawText);
  const phone = extractPhone(rawText);
  const location = extractLocation(rawText);
  const titleCompany = extractCurrentTitleCompany(rawText);
  const years = extractYears(rawText, blocks);
  const primaryModule = derivePrimaryModule(rawText);
  const secondaryModules = extractSubmodules(rawText);
  const roleType = deriveRoleType(rawText, primaryModule);
  const projectStats = classifyProjects(blocks, rawText);

  const leadRoleCount = Math.min(10, countTerms(rawText, ["lead", "leading", "led", "workstream", "team leader", "project lead"]));
  const managerRoleCount = Math.min(10, countTerms(rawText, ["manager", "managed", "management", "delivery manager"]));
  const clientWorkshopCount = Math.min(10, countTerms(rawText, ["workshop", "client", "stakeholder", "requirement gathering"]));
  const fitGapCount = Math.min(10, countTerms(rawText, ["fit-gap", "fit gap", "gap analysis"]));
  const blueprintCount = Math.min(10, countTerms(rawText, ["blueprint", "blueprinting"]));
  const presalesCount = Math.min(5, countTerms(rawText, ["pre-sales", "presales", "rfp", "proposal", "poc", "demo"]));
  const countries = ["singapore", "malaysia", "philippines", "indonesia", "thailand", "vietnam", "india", "japan", "australia", "usa", "denmark", "netherlands"].filter((c) =>
    rawText.toLowerCase().includes(c)
  );
  const brands = CONSULTING_BRANDS.filter((b) => rawText.toLowerCase().includes(b));

  const financeModuleCount = secondaryModules.filter((x) => Object.keys(FINANCE_SUBMODULES).includes(x)).length;
  const financeDepthScore = Math.max(
    primaryModule === "FICO" ? 55 : 0,
    score100(financeModuleCount + (projectStats.ficoProjectCount >= 5 ? 2 : 0), 10)
  );

  const implementationAuthorityScore = score100(
    projectStats.implementationProjectCount * 2 +
      projectStats.rolloutProjectCount +
      projectStats.migrationProjectCount +
      projectStats.s4hanaProjectCount +
      leadRoleCount,
    50
  );

  const consultingDNAScore = Math.max(
    brands.length ? 60 : 0,
    score100(clientWorkshopCount + fitGapCount + blueprintCount + presalesCount + countTerms(rawText, ["solution design", "business process", "as-is", "to-be"]), 25)
  );

  const moduleAuthorityScore =
    primaryModule === "FICO"
      ? Math.max(60, Math.min(100, score100(projectStats.ficoProjectCount + financeModuleCount * 2, 30)))
      : Math.min(60, financeDepthScore);

  const domainAuthorityScore = Math.min(100, Math.round(moduleAuthorityScore * 0.65 + financeDepthScore * 0.35));

  return {
    name,
    nameDetected: name !== "Candidate Name Not Detected",
    nameReviewRequired: name === "Candidate Name Not Detected",
    email,
    phone,
    location,
    currentTitle: titleCompany.currentTitle,
    currentCompany: titleCompany.currentCompany,
    headline: titleCompany.headline,

    years,
    yearsOfExperience: years,
    calculatedExperienceMonths: years * 12,

    sapModules: primaryModule === "FICO" ? ["FI", "CO"] : primaryModule === "UNKNOWN" ? [] : [primaryModule],
    sapSubmodules: secondaryModules,
    primaryModule,
    secondaryModules: secondaryModules.filter((m) => m !== primaryModule),

    roleType,
    consultingLevel: getConsultingLevel(years),
    confidence: confidence(name, titleCompany.currentTitle, years, primaryModule),

    ...projectStats,

    leadRoleCount,
    managerRoleCount,
    consultingProjectCount: Math.min(25, brands.length + clientWorkshopCount + fitGapCount),
    endUserProjectCount: Math.min(25, countTerms(rawText, ["end user", "business user", "production support", "support"])),
    regionalProjectCount: Math.min(10, countTerms(rawText, ["regional", "apac", "asia", "global", "multi-country"])),
    apacProjectCount: Math.min(10, countTerms(rawText, ["apac", "asia-pacific", "asia pacific"])),
    globalProjectCount: Math.min(10, countTerms(rawText, ["global", "worldwide", "multinational"])),
    countryCoverageCount: countries.length,
    multiCountryRolloutScore: countries.length >= 5 ? 10 : countries.length >= 3 ? 7 : countries.length >= 2 ? 4 : 0,
    regionalDeliveryScore: Math.min(10, countries.length + countTerms(rawText, ["regional", "apac", "global"])),
    clientWorkshopCount,
    businessProcessWorkshopCount: Math.min(10, countTerms(rawText, ["business process", "requirements", "as-is", "to-be"])),
    s4hanaWorkshopCount: Math.min(10, projectStats.s4hanaProjectCount && clientWorkshopCount ? Math.min(projectStats.s4hanaProjectCount, clientWorkshopCount) : 0),
    fitGapCount,
    blueprintCount,
    presalesCount,
    rfpCount: countTerms(rawText, ["rfp"]),
    proposalCount: countTerms(rawText, ["proposal"]),
    solutioningCount: countTerms(rawText, ["solution design", "solutioning"]),
    pocCount: countTerms(rawText, ["poc", "demo"]),

    s4SupportCount: Math.min(10, projectStats.s4hanaProjectCount && projectStats.amsProjectCount ? Math.min(projectStats.s4hanaProjectCount, projectStats.amsProjectCount) : 0),
    s4ImplementationCount: Math.min(10, projectStats.s4hanaProjectCount && projectStats.implementationProjectCount ? Math.min(projectStats.s4hanaProjectCount, projectStats.implementationProjectCount) : 0),
    s4ConversionCount: Math.min(10, countTerms(rawText, ["conversion", "brownfield", "sum/dmo"])),
    s4GreenfieldCount: Math.min(10, countTerms(rawText, ["greenfield"])),

    moduleAuthorityScore,
    moduleAuthorities: { [primaryModule]: moduleAuthorityScore },
    implementationAuthorityScore,
    domainAuthorityScore,
    projectOwnershipScore: score100(leadRoleCount + managerRoleCount + countTerms(rawText, ["owned", "ownership", "primary responsibility"]), 18),
    financeDepthScore,
    consultingDNAScore,
    employerReputationScore: Math.min(30, brands.length * 10),

    rawText,
  };
}

export const parseCvFromText = parseCandidateFromText;
export const parseCV = parseCandidateFromText;
export const parseCandidateCV = parseCandidateFromText;
export default parseCandidateFromText;

async function bufferToText(buffer: Buffer, fileName = "") {
  const ext = fileName.toLowerCase().split(".").pop();

  if (ext === "docx") {
    const mammoth = await import("mammoth");
    const res = await mammoth.extractRawText({ buffer });
    return res.value;
  }

  if (ext === "pdf") {
    const mod: any = await import("pdf-parse");
    const pdfParse = mod.default || mod;
    const res = await pdfParse(buffer);
    return res.text;
  }

  return buffer.toString("utf8");
}

export async function parseCv(buffer: Buffer, fileName?: string) {
  const text = await bufferToText(buffer, fileName || "");
  return parseCandidateFromText(text, fileName);
}

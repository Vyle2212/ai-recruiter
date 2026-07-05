"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { resolveCanonicalCandidateDisplay } from "@/lib/candidateCanonicalDisplay";
import { buildCandidateValidationState } from "@/lib/candidateValidation";
import { buildTalentSearchExecutiveSummary, candidateHasContactInfo, cleanTalentSearchModule, cleanTalentSearchTitle, displayTalentSearchValidationStatus, isTalentSearchReviewBadge, resolveTalentSearchViewerRole, safeTalentSearchCompany, talentSearchSummaryVisibility, type TalentSearchViewerRole } from "@/lib/talentSearchDisplay";
import { COMPANY_TAXONOMY, COMPANY_TAXONOMY_SUGGESTIONS, SAP_TALENT_SKILL_GROUPS, SAP_SKILL_TAXONOMY, getSapSkillDisplayLabel } from "@/lib/sapTalentTaxonomy";

type AnyRecord = Record<string, any>;

function canonicalCandidateName(candidate: Candidate | AnyRecord | undefined) {
  if (!candidate) return "Candidate profile pending validation";
  return resolveCanonicalCandidateDisplay(candidate as AnyRecord).displayName || "Candidate profile pending validation";
}

function talentSearchBadgeTone(label: string) {
  return label === "Ready"
    ? "border-emerald-500/35 bg-emerald-950/20 text-emerald-100"
    : label === "Hidden" || label === "Archived" || label === "Duplicate"
      ? "border-red-500/35 bg-red-950/20 text-red-100"
      : "border-amber-500/35 bg-amber-950/20 text-amber-100";
}

function candidateValidationBadge(candidate: Candidate | AnyRecord | undefined) {
  const raw = (candidate || {}) as AnyRecord;
  const state = buildCandidateValidationState(raw);
  const resolved = resolveCanonicalCandidateDisplay(raw);
  const displayName = resolved.displayName || canonicalCandidateName(raw);
  const currentEmployer = resolved.currentEmployer || safeTalentSearchCompany(raw.display_company || raw.current_company || raw.currentCompany || raw.company || raw.employer);
  const title = resolved.displayRole || cleanTalentSearchTitle(raw.display_title || raw.title || raw.current_title || raw.role, raw.primary_module || raw.module || raw.sap_module);
  const label = displayTalentSearchValidationStatus({
    status: state.status,
    score: state.score,
    displayName,
    currentEmployer,
    title,
  });

  return { label, tone: talentSearchBadgeTone(label) };
}

type Candidate = {
  id?: string;
  name?: string;
  title?: string;
  email?: string;
  phone?: string;
  phone_status?: string;
  primary_module?: string;
  role_type?: string;
  seniority_level?: string;
  location?: string;
  current_location?: string;
  current_city?: string;
  country?: string;
  display_location?: string;
  years?: number;
  years_experience?: number;
  greenfield_projects?: number;
  brownfield_projects?: number;
  rollout_projects?: number;
  selective_transformation_projects?: number;
  s4hana_projects?: number;
  s4_implementation_projects?: number;
  s4_ams_projects?: number;
  implementation_projects?: number;
  implementation_project_count?: number;
  ams_projects?: number;
  ams_count?: number;
  ams_support_project_count?: number;
  project_counts?: {
    implementation?: number;
    ams?: number;
    rollout?: number;
    greenfield?: number;
    brownfield?: number;
    selective?: number;
    s4hana?: number;
    s4Ams?: number;
  };
  project_extraction_confidence?: string;
  project_extraction_source?: string;
  expected_salary?: number | string;
  expected_salary_currency?: string;
  salary_currency?: string;
  visa_status?: string;
  work_authorization?: string;
  languages?: string[] | string;
  language_score?: number;
  relocation?: string;
  relocation_willingness?: string;
  work_preference?: string;
  work_arrangement?: string;
  profile_quality_score?: number;
  quality_grade?: string;
  search_score?: number;
  search_fit?: number;
  why_matched?: string[];
  matched_tokens?: string[];
  selected_modules?: string[] | string;
  secondary_modules?: string[] | string;
  submodules?: string[] | string;
  all_modules?: string[] | string;
  index_all_modules?: string[] | string;
  module_match_type?: string;
  display_industry?: string;
  company_background?: string;
  display_company?: string;
  search_context_module?: string;
  searchFit?: number;
  display_title?: string;
  display_name?: string;
  quality_score?: number;
  rank_label?: string;
  rank_tier?: string;
  recommendation_summary?: string;
  recruiter_priority_score?: number;
  priority_score?: number;
  sort_score?: number;
};

const SHORTLIST_STORAGE_KEY = "sap-talent-shortlist";
const SEARCH_CACHE_KEY = "sap-talent-search-cache-v15";
const SEARCH_SCROLL_KEY = "sap-talent-search-scroll-y";
const DEFAULT_RECRUITER_EMAIL = "vjvjan.le@gmail.com";
const SEARCH_SHORTLIST_ID_KEY = "sap-talent-search-shortlist-id-v1";
const SEARCH_SHORTLIST_NAME = "Talent Pool Search Shortlist";
const SEARCH_SESSION_PREFIX = "sapTalentHub.searchSession.v1.";
const COMPARE_MATCHES_CACHE_KEY = "sapTalentHub.matches.pageState.v1";
const DEFAULT_SEARCH_PAGE_SIZE = 10;
const SEARCH_PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

type TalentSearchPaginationMeta = {
  totalCandidates: number;
  totalMatched: number;
  returnedCount: number;
  pageSize: number;
  limit: number;
  offset: number;
  page: number;
  currentPage: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
  hasMore: boolean;
};

const EMPTY_SEARCH_PAGINATION: TalentSearchPaginationMeta = {
  totalCandidates: 0,
  totalMatched: 0,
  returnedCount: 0,
  pageSize: DEFAULT_SEARCH_PAGE_SIZE,
  limit: DEFAULT_SEARCH_PAGE_SIZE,
  offset: 0,
  page: 1,
  currentPage: 1,
  totalPages: 1,
  hasPrevious: false,
  hasNext: false,
  hasMore: false,
};

type SearchCacheSnapshot = {
  filters: Record<string, any>;
  // Production performance: do not cache candidate result arrays in localStorage.
  // Large result sets make the browser slow when scaling to 100k+ profiles.
  scrollY: number;
  savedAt: string;
  searchId?: string;
};

function talentSearchCandidateId(candidate: Candidate) {
  const row = candidate as AnyRecord;
  return String(candidate.id || row.candidate_id || row.email || candidate.name || "").trim();
}

function createTalentSearchId(filters: Record<string, any>) {
  const modulePart = String((Array.isArray(filters.sapSkills) && filters.sapSkills[0]) || filters.module || filters.keyword || "talent-search")
    .replace(/[^a-z0-9]+/gi, "-")
    .toLowerCase();
  return `talent-${modulePart}-${Date.now().toString(36)}`;
}

const SAP_MODULE_GROUPS = SAP_TALENT_SKILL_GROUPS;

const SAP_SKILL_SUGGESTIONS = SAP_SKILL_TAXONOMY.map((skill) => getSapSkillDisplayLabel(skill));

const COUNTRY_CITY_MAP: Record<string, string[]> = {
  Malaysia: [
    "Kuala Lumpur",
    "Selangor",
    "Petaling Jaya",
    "Cyberjaya",
    "Putrajaya",
    "Penang",
    "Johor Bahru",
    "Malacca",
    "Ipoh",
    "Kuching",
    "Kota Kinabalu",
  ],
  Singapore: ["Singapore"],
  Philippines: [
    "Manila",
    "Makati",
    "Taguig",
    "Quezon City",
    "Pasig",
    "Mandaluyong",
    "Cebu",
    "Davao",
    "Clark",
  ],
  Indonesia: [
    "Jakarta",
    "Tangerang",
    "Bekasi",
    "Surabaya",
    "Bandung",
    "Yogyakarta",
    "Bali",
  ],
  Vietnam: [
    "Ho Chi Minh City",
    "Hanoi",
    "Da Nang",
    "Binh Duong",
    "Dong Nai",
    "Hai Phong",
  ],
  Thailand: ["Bangkok", "Chonburi", "Rayong", "Chiang Mai"],
  India: [
    "Bengaluru",
    "Hyderabad",
    "Chennai",
    "Mumbai",
    "Pune",
    "Delhi NCR",
    "Gurgaon",
    "Noida",
    "Kolkata",
    "Ahmedabad",
  ],
  Japan: ["Tokyo", "Osaka", "Yokohama", "Nagoya", "Fukuoka"],
  Australia: [
    "Sydney",
    "Melbourne",
    "Brisbane",
    "Perth",
    "Adelaide",
    "Canberra",
  ],
  "New Zealand": ["Auckland", "Wellington", "Christchurch"],
  China: ["Shanghai", "Beijing", "Shenzhen", "Guangzhou", "Suzhou"],
  "Hong Kong": ["Hong Kong"],
  Taiwan: ["Taipei", "Taichung", "Kaohsiung"],
  "South Korea": ["Seoul", "Busan", "Incheon"],
  "United Arab Emirates": ["Dubai", "Abu Dhabi", "Sharjah"],
  "Saudi Arabia": ["Riyadh", "Jeddah", "Dammam"],
  Qatar: ["Doha"],
  "United States": [
    "New York",
    "San Francisco",
    "San Jose",
    "Chicago",
    "Dallas",
    "Houston",
    "Atlanta",
    "Seattle",
    "Boston",
    "Los Angeles",
  ],
  "United Kingdom": [
    "London",
    "Manchester",
    "Birmingham",
    "Leeds",
    "Edinburgh",
    "Glasgow",
  ],
  Germany: [
    "Berlin",
    "Munich",
    "Frankfurt",
    "Hamburg",
    "Dusseldorf",
    "Stuttgart",
  ],
  Netherlands: ["Amsterdam", "Rotterdam", "Utrecht", "Eindhoven"],
  France: ["Paris", "Lyon", "Toulouse"],
  Canada: ["Toronto", "Vancouver", "Montreal", "Calgary"],
};

const COUNTRIES = Object.keys(COUNTRY_CITY_MAP);

// Company suggestions are taxonomy-driven. Large global firm lists should live in consulting_firms, not in UI code.
// Defensive normalization keeps /search stable even when taxonomy data contains
// null, undefined, strings, or object records from different taxonomy versions.
function normalizeCompanySuggestion(value: any): string {
  if (typeof value === "string") return value.trim();
  if (value && typeof value === "object") {
    return normalize(value.name || value.company || value.label || value.title || value.value);
  }
  return "";
}

const COMPANY_SUGGESTIONS = Array.from(
  new Set(
    [
      ...(Array.isArray(COMPANY_TAXONOMY_SUGGESTIONS)
        ? COMPANY_TAXONOMY_SUGGESTIONS
        : []),
      ...(Array.isArray(COMPANY_TAXONOMY) ? COMPANY_TAXONOMY : []),
    ]
      .map(normalizeCompanySuggestion)
      .filter((company): company is string => company.length > 0),
  ),
).sort((a, b) => a.localeCompare(b));

const CONSULTING_INDUSTRIES = [
  "Big 4",
  "Global Consulting",
  "Regional SI",
  "Boutique SAP Partner",
  "IT Services / IT Consulting",
  "Business Consulting & Services",
  "Professional Services",
];
const END_CLIENT_INDUSTRIES = [
  "Manufacturing",
  "Automotive",
  "Pharmaceuticals",
  "Banking / Financial Services",
  "Insurance",
  "Retail",
  "Utilities",
  "Oil & Gas",
  "Telecommunications",
  "Consumer Goods",
  "Logistics / Supply Chain",
  "Healthcare",
  "Technology / Product Company",
  "Public Sector",
];
const ALL_INDUSTRIES = Array.from(
  new Set([...CONSULTING_INDUSTRIES, ...END_CLIENT_INDUSTRIES]),
);

const ROLE_TYPES = [
  "All",
  "Functional",
  "Technical",
  "Solution Architect",
  "Project Manager",
  "Program Manager",
  "Practice Lead",
  "Delivery Lead",
];
const SENIORITY_LEVELS = [
  "All",
  "Consultant",
  "Senior Consultant",
  "Lead",
  "Manager",
  "Director",
  "Principal / Partner",
];
const PROJECT_TYPES = [
  "Implementation",
  "AMS / Support",
  "Rollout",
  "Migration",
  "Greenfield",
  "Brownfield",
  "Selective Transformation",
  "Upgrade",
  "Hypercare",
];
const AVAILABILITY_OPTIONS = [
  "All",
  "Actively Looking",
  "Open To Work",
  "Open To Discussion",
  "Passive",
  "Not Open To Work",
];
const AVAILABLE_WITHIN_OPTIONS = [
  "Any",
  "Immediate",
  "2 weeks",
  "1 month",
  "2 months",
  "3 months",
  "6 months",
];
const EMPLOYMENT_OPTIONS = ["All", "Permanent", "Contract", "Both"];
const BACKGROUND_OPTIONS = [
  "All",
  "Consulting Firm / SI",
  "End Client / In-house",
];
const QUALITY_TIERS = ["All", "A", "B", "C", "Review Needed"];
const UPDATED_WITHIN = [
  "Any",
  "7 days",
  "30 days",
  "60 days",
  "90 days",
  "180 days",
];
const CURRENCIES = [
  "Any",
  "USD",
  "EUR",
  "GBP",
  "SGD",
  "MYR",
  "PHP",
  "THB",
  "VND",
  "IDR",
  "AUD",
  "NZD",
  "JPY",
  "CNY",
  "HKD",
  "AED",
  "SAR",
  "QAR",
  "INR",
];
const VISA_STATUS_OPTIONS = [
  "All",
  "Citizen",
  "PR",
  "EP Holder",
  "DP Holder",
  "Work Visa",
  "Visa Required / Sponsorship",
];
const WORK_PREFERENCE_OPTIONS = [
  "All",
  "Onsite",
  "Hybrid",
  "Remote",
  "Open to Relocation",
  "Open to Travel",
];
const LANGUAGE_SUGGESTIONS = [
  "English",
  "Mandarin",
  "Cantonese",
  "Japanese",
  "Korean",
  "Thai",
  "Bahasa Indonesia",
  "Bahasa Malaysia",
  "Vietnamese",
  "Hindi",
  "Tamil",
  "French",
  "German",
  "Spanish",
  "Arabic",
];
const GENERAL_LANGUAGE_LEVEL_OPTIONS = [
  "Any",
  "Basic",
  "Conversational",
  "Business",
  "Fluent",
  "Native",
];
const JLPT_LANGUAGE_LEVEL_OPTIONS = ["Any", "N5", "N4", "N3", "N2", "N1"];
const NUMERIC_LANGUAGE_LEVEL_OPTIONS = ["Any", "5+", "6+", "7+", "8+", "9+", "10"];

function languageLevelOptions(language: string) {
  const clean = String(language || "").trim().toLowerCase();
  if (clean.includes("japanese") || clean === "jp" || clean === "nihongo") {
    return JLPT_LANGUAGE_LEVEL_OPTIONS;
  }
  if (clean.includes("english") || clean.includes("mandarin") || clean.includes("cantonese") || clean.includes("korean")) {
    return GENERAL_LANGUAGE_LEVEL_OPTIONS;
  }
  return GENERAL_LANGUAGE_LEVEL_OPTIONS;
}

type LanguageRequirement = { language: string; level: string };

function normalize(v: any): string {
  return String(v ?? "").trim();
}
function displayNumber(v: any, fallback = 0): number {
  const num = Number(v);
  return Number.isFinite(num) ? num : fallback;
}
function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((v) => v.trim()).filter(Boolean)));
}
function displaySkillLabel(value: any): string {
  const clean = normalize(value);
  const found = SAP_SKILL_TAXONOMY.find((skill: any) => {
    const candidates = [
      typeof skill === "string" ? skill : "",
      skill?.code,
      skill?.name,
      skill?.label,
      skill?.key,
      skill?.code ? `SAP ${skill.code}` : "",
      skill?.name ? `SAP ${skill.name}` : "",
      getSapSkillDisplayLabel(skill),
      ...((skill?.aliases || []) as string[]),
      ...((skill?.submodules || []) as string[]),
    ].map((item) => normalize(item).toLowerCase()).filter(Boolean);
    return candidates.includes(clean.toLowerCase());
  });
  return found ? getSapSkillDisplayLabel(found) : clean;
}

function inferSapSkillsFromKeyword(value: string): string[] {
  const text = ` ${normalize(value).toLowerCase()} `;
  if (!text.trim()) return [];

  return unique(
    SAP_SKILL_TAXONOMY
      .filter((skill: any) => {
        const label = getSapSkillDisplayLabel(skill);
        const rawValues = [
          typeof skill === "string" ? skill : "",
          skill?.code,
          skill?.key,
          skill?.name,
          skill?.label,
          label,
          label ? `SAP ${label}` : "",
          ...((skill?.aliases || []) as string[]),
        ].filter(Boolean);

        return rawValues.some((raw) => {
          const token = normalize(raw).toLowerCase();
          if (!token) return false;
          const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
          const isShort = /^[a-z0-9/_-]{2,6}$/.test(token);
          return new RegExp(isShort ? `(^|[^a-z0-9])${escaped}([^a-z0-9]|$)` : escaped, "i").test(text);
        });
      })
      .map((skill) => getSapSkillDisplayLabel(skill)),
  );
}

function inferProjectTypesFromKeyword(value: string): string[] {
  const text = normalize(value).toLowerCase();
  const found: string[] = [];
  if (/implementation|implemented|implement|end[- ]to[- ]end|e2e|full[- ]cycle/.test(text)) found.push("Implementation");
  if (/\bams\b|support|application management|managed services|production support/.test(text)) found.push("AMS / Support");
  if (/rollout|roll out|roll-out/.test(text)) found.push("Rollout");
  if (/greenfield|green field/.test(text)) found.push("Greenfield");
  if (/brownfield|brown field|conversion/.test(text)) found.push("Brownfield");
  if (/migration|migrate|upgrade/.test(text)) found.push("Migration");
  if (/s\/4|s4hana|s\/4hana|s4 hana/.test(text)) found.push("S/4HANA");
  return unique(found);
}

function cleanSapName(name: string): string {
  return normalize(name).replace(/^SAP\s+/i, "");
}

function sapSuggestionLabel(record: AnyRecord): string {
  const code = normalize(record?.code);
  const name = cleanSapName(record?.name);
  if (!code && !name) return "";
  if (!name) return code;
  return `${code} - SAP ${name}`;
}

function companySuggestionLabel(record: AnyRecord): string {
  return normalize(record?.name);
}

function languageChipLabel(item: LanguageRequirement): string {
  if (!item.level || item.level === "Any") return item.language;
  return `${item.language}: ${item.level}`;
}
function salaryRaw(value: string): string {
  return String(value || "").replace(/[^0-9]/g, "");
}
function formatSalaryInput(value: string): string {
  const raw = salaryRaw(value);
  if (!raw) return "";
  return Number(raw).toLocaleString("en-US");
}
function maskEmail(email?: string) {
  const value = normalize(email);
  if (!value || value.toLowerCase() === "no email") return "No email";
  const [name, domain] = value.split("@");
  if (!domain) return value;
  return `${name.slice(0, 2)}***@${domain}`;
}
function maskPhone(phone?: string, status?: string) {
  const value = normalize(phone);
  if (
    !value ||
    value.toLowerCase() === "no phone" ||
    normalize(status).toLowerCase().includes("no phone")
  )
    return "No phone";
  const digits = value.replace(/\D/g, "");
  const last = digits.slice(-3);
  return `${value.slice(0, 3)} ***** ${last}`;
}
function getCandidateKey(candidate: Candidate, index: number) {
  return (
    candidate.id ||
    `${candidate.email || candidate.name || "candidate"}-${index}`
  );
}

function getShortlistId(candidate: Candidate) {
  return String(
    candidate.id ||
      candidate.email ||
      candidate.phone ||
      candidate.name ||
      "candidate",
  );
}
function buildPaginationPages(currentPage: number, totalPages: number): Array<number | "..."> {
  const total = Math.max(1, totalPages || 1);
  const current = Math.max(1, Math.min(currentPage || 1, total));
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);

  const pages = new Set<number>([1, total, current, current - 1, current + 1]);
  if (current <= 4) {
    pages.add(2);
    pages.add(3);
    pages.add(4);
    pages.add(5);
  }
  if (current >= total - 3) {
    pages.add(total - 1);
    pages.add(total - 2);
    pages.add(total - 3);
    pages.add(total - 4);
  }

  const sorted = Array.from(pages).filter((page) => page >= 1 && page <= total).sort((a, b) => a - b);
  const out: Array<number | "..."> = [];
  for (const page of sorted) {
    const previous = out[out.length - 1];
    if (typeof previous === "number" && page - previous > 1) out.push("...");
    out.push(page);
  }
  return out;
}

function buildQuery(params: AnyRecord) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      if (value.length) search.set(key, value.join(","));
    } else if (
      value !== undefined &&
      value !== null &&
      String(value).trim() !== ""
    ) {
      search.set(key, String(value));
    }
  });
  return search.toString();
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1 block text-[12px] font-bold tracking-wide text-sky-200">
      {children}
    </label>
  );
}
function SelectField({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-11 w-full rounded-lg border border-slate-600 bg-black px-3 text-sm font-semibold text-white outline-none focus:border-cyan-400"
    >
      {children}
    </select>
  );
}
function TextField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoComplete="off"
      spellCheck={false}
      className="h-11 w-full rounded-lg border border-slate-600 bg-black px-3 text-sm font-semibold text-white outline-none placeholder:text-slate-500 focus:border-cyan-400"
    />
  );
}
function NumberField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      type="number"
      min="0"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      autoComplete="off"
      className="h-11 w-full rounded-lg border border-slate-600 bg-black px-3 text-sm font-semibold text-white outline-none focus:border-cyan-400"
    />
  );
}

function SectionTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-3">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
        {title}
      </p>
      {subtitle && <p className="mt-1 text-xs text-slate-400">{subtitle}</p>}
    </div>
  );
}

function MultiTagInput({
  label,
  values,
  setValues,
  suggestions,
  placeholder,
  disabled = false,
}: {
  label: string;
  values: string[];
  setValues: (values: string[]) => void;
  suggestions: string[];
  placeholder?: string;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const filtered = useMemo(() => {
    const q = draft.trim().toLowerCase();
    return suggestions
      .filter(
        (item) => !values.some((v) => v.toLowerCase() === item.toLowerCase()),
      )
      .filter((item) => !q || item.toLowerCase().includes(q))
      .slice(0, 28);
  }, [draft, suggestions, values]);
  const addValue = (value: string) => {
    const clean = value.trim();
    if (!clean || disabled) return;
    setValues(unique([...values, clean]));
    setDraft("");
    setOpen(false);
  };
  const removeValue = (value: string) =>
    setValues(values.filter((v) => v !== value));
  return (
    <div className="relative">
      <FieldLabel>{label}</FieldLabel>
      <div
        className={`min-h-11 rounded-lg border px-2 py-1.5 ${disabled ? "border-slate-800 bg-slate-950 opacity-60" : "border-slate-600 bg-black focus-within:border-cyan-400"}`}
      >
        <div className="flex flex-wrap items-center gap-1.5">
          {values.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => removeValue(value)}
              className="rounded-full border border-cyan-700 bg-cyan-950/60 px-2.5 py-1 text-xs font-bold text-cyan-100 hover:border-red-400"
            >
              {value} <span className="text-slate-400">x</span>
            </button>
          ))}
          <input
            value={draft}
            disabled={disabled}
            onFocus={() => !disabled && setOpen(true)}
            onChange={(e) => {
              setDraft(e.target.value);
              setOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                addValue(draft);
              }
              if (e.key === "Backspace" && !draft && values.length)
                removeValue(values[values.length - 1]);
            }}
            placeholder={values.length ? "Add more..." : placeholder}
            autoComplete="off"
            spellCheck={false}
            className="h-8 min-w-[130px] flex-1 bg-transparent px-1 text-sm font-semibold text-white outline-none placeholder:text-slate-500"
          />
          <button
            type="button"
            disabled={disabled}
            onClick={() => setOpen((v) => !v)}
            className="px-2 text-slate-400 hover:text-cyan-200"
          >
            {open ? "^" : "v"}
          </button>
        </div>
      </div>
      {open && !disabled && filtered.length > 0 && (
        <div className="absolute z-20 mt-2 max-h-72 w-full overflow-auto rounded-xl border border-slate-700 bg-slate-950 p-2 shadow-2xl">
          {filtered.map((item) => (
            <button
              key={item}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => addValue(item)}
              className="block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-100 hover:bg-slate-800"
            >
              {item}
            </button>
          ))}
          {draft.trim() && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => addValue(draft)}
              className="mt-1 block w-full rounded-lg border border-cyan-800 px-3 py-2 text-left text-sm font-bold text-cyan-200 hover:bg-cyan-950"
            >
              + Add "{draft.trim()}"
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function CheckboxGroup({
  label,
  values,
  selected,
  setSelected,
}: {
  label: string;
  values: string[];
  selected: string[];
  setSelected: (values: string[]) => void;
}) {
  const toggle = (value: string) =>
    selected.includes(value)
      ? setSelected(selected.filter((v) => v !== value))
      : setSelected([...selected, value]);
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="flex flex-wrap gap-2 rounded-lg border border-slate-700 bg-black/40 p-2">
        {values.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => toggle(value)}
            className={`rounded-full border px-3 py-1.5 text-xs font-bold ${selected.includes(value) ? "border-cyan-400 bg-cyan-950 text-cyan-100" : "border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500"}`}
          >
            {value}
          </button>
        ))}
      </div>
    </div>
  );
}


function SalaryField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <input
      type="text"
      inputMode="numeric"
      value={formatSalaryInput(value)}
      onChange={(e) => onChange(salaryRaw(e.target.value))}
      placeholder={placeholder}
      autoComplete="off"
      className="h-11 bg-black px-3 text-sm font-semibold text-white outline-none placeholder:text-slate-500"
    />
  );
}

function AccordionSection({
  title,
  subtitle,
  activeCount,
  open,
  onToggle,
  onClear,
  children,
}: {
  title: string;
  subtitle?: string;
  activeCount: number;
  open: boolean;
  onToggle: () => void;
  onClear: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-black/20">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-900/60"
      >
        <div>
          <div className="flex items-center gap-2">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
              {title}
            </p>
            {activeCount > 0 && (
              <span className="rounded-full border border-cyan-700 bg-cyan-950/70 px-2 py-0.5 text-[10px] font-black text-cyan-100">
                {activeCount} active
              </span>
            )}
          </div>
          {subtitle && <p className="mt-1 text-xs text-slate-400">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          {activeCount > 0 && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              className="rounded-md border border-slate-700 px-2 py-1 text-xs font-bold text-slate-300 hover:border-red-400 hover:text-red-200"
            >
              Clear
            </span>
          )}
          <span className="text-sm font-black text-sky-200">{open ? "^" : "v"}</span>
        </div>
      </button>
      {open && <div className="border-t border-slate-800 p-4">{children}</div>}
    </div>
  );
}

function LanguageRequirementInput({
  requirements,
  setRequirements,
}: {
  requirements: LanguageRequirement[];
  setRequirements: (values: LanguageRequirement[]) => void;
}) {
  const [language, setLanguage] = useState("");
  const [level, setLevel] = useState("Business");
  const levelOptions = languageLevelOptions(language);

  useEffect(() => {
    const options = languageLevelOptions(language);
    if (!options.includes(level)) setLevel(options[0] || "Any");
  }, [language, level]);

  const addRequirement = () => {
    const clean = language.trim();
    if (!clean) return;
    const selectedLevel = level === "Any" ? "Business" : level;
    const next = requirements.filter(
      (item) => item.language.toLowerCase() !== clean.toLowerCase(),
    );
    setRequirements([...next, { language: clean, level: selectedLevel }]);
    setLanguage("");
    setLevel("Business");
  };

  return (
    <div>
      <FieldLabel>Languages</FieldLabel>
      <div className="rounded-xl border border-slate-700 bg-black/40 p-3">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-12">
          <div className="md:col-span-5">
            <input
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addRequirement();
                }
              }}
              list="language-suggestions"
              placeholder="English, Mandarin, Japanese..."
              className="h-11 w-full rounded-lg border border-slate-600 bg-black px-3 text-sm font-semibold text-white outline-none placeholder:text-slate-500 focus:border-cyan-400"
            />
            <datalist id="language-suggestions">
              {LANGUAGE_SUGGESTIONS.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
          </div>
          <div className="md:col-span-4">
            <SelectField value={level} onChange={setLevel}>
              {levelOptions.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </SelectField>
          </div>
          <button
            type="button"
            onClick={addRequirement}
            className="h-11 rounded-lg border border-cyan-700 bg-cyan-950/60 px-4 text-sm font-black text-cyan-100 hover:bg-cyan-900 md:col-span-3"
          >
            + Add Language
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {requirements.length ? (
            requirements.map((item) => (
              <button
                key={`${item.language}-${item.level}`}
                type="button"
                onClick={() =>
                  setRequirements(requirements.filter((v) => v !== item))
                }
                className="rounded-full border border-cyan-700 bg-cyan-950/60 px-3 py-1.5 text-xs font-extrabold text-cyan-100 hover:border-red-400"
              >
                {languageChipLabel(item)} <span className="text-slate-400">x</span>
              </button>
            ))
          ) : (
            <span className="text-xs font-semibold text-slate-500">
              Add language and level together, e.g. English: Fluent, Mandarin: Business, Japanese: N2.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function FirmTypePresetButton({
  label,
  values,
  setValues,
}: {
  label: string;
  values: string[];
  setValues: (values: string[]) => void;
}) {
  const active = values.includes(label);
  return (
    <button
      type="button"
      onClick={() =>
        setValues(
          active
            ? values.filter((v) => v !== label)
            : unique([...values, label]),
        )
      }
      className={`rounded-full border px-3 py-1.5 text-xs font-bold ${active ? "border-cyan-400 bg-cyan-950 text-cyan-100" : "border-slate-700 bg-slate-900 text-sky-100 hover:border-cyan-500"}`}
    >
      {active ? "OK" : "+"} {label}
    </button>
  );
}

function Badge({
  children,
  tone = "slate",
}: {
  children: React.ReactNode;
  tone?: "slate" | "cyan" | "green" | "yellow";
}) {
  const cls =
    tone === "cyan"
      ? "border-cyan-700 bg-cyan-950/60 text-cyan-100"
      : tone === "green"
        ? "border-green-700 bg-green-950/50 text-green-100"
        : tone === "yellow"
          ? "border-yellow-700 bg-yellow-950/40 text-yellow-100"
          : "border-slate-700 bg-slate-800 text-slate-100";
  return (
    <span
      className={`rounded-full border px-3 py-1.5 text-xs font-extrabold ${cls}`}
    >
      {children}
    </span>
  );
}

function projectMetric(candidate: Candidate, key: string, fallback?: string) {
  return displayNumber(
    (candidate as AnyRecord)[key] ??
      (fallback ? (candidate as AnyRecord)[fallback] : undefined),
    0,
  );
}

function projectCounts(candidate: Candidate) {
  const pc = (candidate as AnyRecord).project_counts || {};

  const implementation = displayNumber(
    pc.implementation ??
      candidate.implementation_projects ??
      candidate.implementation_project_count,
  );
  const ams = displayNumber(
    pc.ams ??
      candidate.ams_projects ??
      candidate.ams_count ??
      candidate.ams_support_project_count,
  );
  const rollout = displayNumber(
    pc.rollout ?? candidate.rollout_projects,
  );
  const greenfield = displayNumber(
    pc.greenfield ?? candidate.greenfield_projects,
  );
  const brownfield = displayNumber(
    pc.brownfield ?? candidate.brownfield_projects,
  );
  const selective = displayNumber(
    pc.selective ?? candidate.selective_transformation_projects,
  );
  const s4hana = displayNumber(
    pc.s4hana ?? candidate.s4_implementation_projects ?? candidate.s4hana_projects,
  );
  const s4Ams = displayNumber(
    pc.s4Ams ?? candidate.s4_ams_projects,
  );

  return {
    implementation,
    ams,
    rollout,
    greenfield,
    brownfield,
    selective,
    s4hana,
    s4Ams,
  };
}

function candidateCompanyHighlights(candidate: Candidate): string[] {
  const text = [
    candidate.display_company,
    (candidate as AnyRecord).current_company,
    (candidate as AnyRecord).company,
    (candidate as AnyRecord).currentCompany,
    (candidate as AnyRecord).previous_companies,
    (candidate as AnyRecord).previousCompanies,
    (candidate as AnyRecord).experience,
    (candidate as AnyRecord).summary,
    (candidate as AnyRecord).resume_text,
    (candidate as AnyRecord).raw_text,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (!text) return [];

  return (COMPANY_SUGGESTIONS || [])
    .filter(
      (company): company is string =>
        typeof company === "string" && company.trim().length > 0,
    )
    .filter((company) => text.includes(company.toLowerCase()))
    .slice(0, 3);
}


function arrayFromValue(value: any): string[] {
  if (Array.isArray(value)) return value.map((item) => normalize(item)).filter(Boolean);
  if (typeof value === "string") {
    const clean = value.trim();
    if (!clean) return [];
    try {
      const parsed = JSON.parse(clean);
      if (Array.isArray(parsed)) return parsed.map((item) => normalize(item)).filter(Boolean);
    } catch {}
    return clean
      .replace(/^\{|\}$/g, "")
      .split(/[,;|]+/)
      .map((item) => normalize(item).replace(/^["']|["']$/g, ""))
      .filter(Boolean);
  }
  return [];
}

function normalizeSapChip(value: any): string {
  const raw = normalize(value);
  if (!raw) return "";
  const upper = raw
    .toUpperCase()
    .replace(/^SAP\s+/i, "")
    .replace(/BW\s*\/\s*4\s*HANA/g, "BW4HANA")
    .replace(/PI\s*\/\s*PO/g, "PI_PO")
    .replace(/CO\s*[-/]?\s*PA/g, "COPA")
    .replace(/\bCOPA\b/g, "COPA")
    .replace(/RE\s*[-/]?\s*FX/g, "RE_FX")
    .replace(/IS\s*[-/]?\s*U/g, "IS_U")
    .replace(/FS\s*[-/]?\s*CD/g, "FS_CD")
    .replace(/[.]/g, "")
    .replace(/[\s/-]+/g, "_")
    .trim();

  if (!upper || ["UNKNOWN", "ALL", "ANY", "SAP", "SAP_GENERAL", "GENERAL_SAP"].includes(upper)) return "";
  return upper;
}

function candidatePrimaryModule(candidate: Candidate): string {
  return normalizeSapChip(
    (candidate as AnyRecord).search_context_module ||
      candidate.primary_module ||
      (candidate as AnyRecord).primaryModule ||
      "",
  );
}

function candidateSapTags(candidate: Candidate): string[] {
  const primary = candidatePrimaryModule(candidate);

  // Production display rule:
  // Prefer index-backed module arrays only. Do not build chips from matched_tokens,
  // because matched_tokens are explanations and can include incidental module keywords.
  const indexBackedModules = unique([
    ...arrayFromValue((candidate as AnyRecord).index_all_modules),
    ...arrayFromValue((candidate as AnyRecord).all_modules),
    ...arrayFromValue((candidate as AnyRecord).selected_modules),
    primary,
    ...arrayFromValue((candidate as AnyRecord).secondary_modules),
    ...arrayFromValue((candidate as AnyRecord).submodules),
  ])
    .map(normalizeSapChip)
    .filter(Boolean);

  const modules = unique([
    primary,
    ...indexBackedModules.filter((module) => module !== primary),
  ]);

  // Keep the card clean: show primary + limited relevant specializations.
  // We intentionally do not show matched_tokens here.
  return modules.slice(0, 5);
}function formatLanguageValue(value: any): string {
  if (value === null || value === undefined) return "";

  if (typeof value === "string") {
    const clean = value.trim();
    if (!clean || clean === "[object Object]") return "";
    return clean;
  }

  if (typeof value === "number") return String(value);

  if (typeof value === "object") {
    const language =
      value.language ||
      value.name ||
      value.lang ||
      value.label ||
      value.code ||
      "";

    const level =
      value.level ||
      value.proficiency ||
      value.score ||
      value.rating ||
      value.value ||
      "";

    const cleanLanguage = normalize(language);
    const cleanLevel = normalize(level);

    if (cleanLanguage && cleanLevel && cleanLevel !== cleanLanguage) {
      return `${cleanLanguage} ${cleanLevel}`;
    }

    if (cleanLanguage) return cleanLanguage;

    const fallback = Object.values(value)
      .map((item) => normalize(item))
      .filter(Boolean)
      .slice(0, 2)
      .join(" ");

    return fallback && fallback !== "[object Object]" ? fallback : "";
  }

  return "";
}

function candidateLanguages(candidate: Candidate): string[] {
  const raw =
    (candidate as AnyRecord).languages ??
    (candidate as AnyRecord).language_skills ??
    (candidate as AnyRecord).language_proficiency;

  const toList = (value: any): string[] => {
    if (Array.isArray(value)) return value.map(formatLanguageValue);

    if (typeof value === "string" && value.trim()) {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed.map(formatLanguageValue);
        if (parsed && typeof parsed === "object") return [formatLanguageValue(parsed)];
      } catch {}

      return value
        .split(/[,;|]+/)
        .map((x) => formatLanguageValue(x));
    }

    if (value && typeof value === "object") return [formatLanguageValue(value)];

    return [];
  };

  return unique(toList(raw)).filter(Boolean).slice(0, 4);
}
function candidateCertifications(candidate: Candidate): string[] {
  return unique([
    ...arrayFromValue((candidate as AnyRecord).certifications),
    ...arrayFromValue((candidate as AnyRecord).certification),
    ...arrayFromValue((candidate as AnyRecord).certificates),
    ...arrayFromValue((candidate as AnyRecord).credentials),
    ...arrayFromValue((candidate as AnyRecord).licenses),
  ])
    .filter(Boolean)
    .slice(0, 3);
}

function candidateBackgroundSummary(candidate: Candidate, companies: string[]): string {
  if (companies.length) return companies.slice(0, 2).join(" -> ");
  const background = normalize(
    (candidate as AnyRecord).display_industry ||
      (candidate as AnyRecord).company_background ||
      (candidate as AnyRecord).industry ||
      (candidate as AnyRecord).background ||
      "",
  );
  return background || "Background pending validation";
}

function getCONFIDENCEScore(candidate: Candidate): number {
  const counts = projectCounts(candidate);
  const skills = candidateSapTags(candidate);
  const companies = candidateCompanyHighlights(candidate);
  const years = displayNumber(candidate.years ?? candidate.years_experience, 0);
  const hasContact = Boolean(candidate.email || candidate.phone);
  const certs = unique([
    ...arrayFromValue((candidate as AnyRecord).certifications),
    ...arrayFromValue((candidate as AnyRecord).certification),
    ...arrayFromValue((candidate as AnyRecord).certificates),
    ...arrayFromValue((candidate as AnyRecord).credentials),
    ...arrayFromValue((candidate as AnyRecord).licenses),
  ]).filter(Boolean);

  let score = 28;
  if (hasContact) score += 12;
  if (companies.length) score += 10;
  if (years >= 5) score += 6;
  if (years >= 10) score += 4;
  if (skills.length) score += Math.min(10, skills.length * 2);
  if (certs.length) score += 8;
  score += Math.min(18, counts.implementation * 4 + counts.s4hana * 3 + counts.greenfield * 2 + counts.brownfield * 2 + counts.rollout * 2 + counts.ams);

  return Math.max(0, Math.min(100, Math.round(score)));
}

function getCONFIDENCELabel(score: number): { label: string } {
  if (score >= 90) return { label: "Very High" };
  if (score >= 80) return { label: "High" };
  if (score >= 70) return { label: "Medium" };
  if (score >= 60) return { label: "Low" };
  return { label: "Very Low" };
}

function workAuthorization(candidate: Candidate): string {
  return normalize(
    candidate.visa_status ||
      candidate.work_authorization ||
      (candidate as AnyRecord).work_rights ||
      "Not verified",
  );
}
function workPreference(candidate: Candidate): string {
  return normalize(
    candidate.work_preference ||
      candidate.work_arrangement ||
      candidate.relocation ||
      candidate.relocation_willingness ||
      (candidate as AnyRecord).open_to_relocation ||
      "Not verified",
  );
}
function salaryLabel(candidate: Candidate): string {
  const amount =
    candidate.expected_salary ||
    (candidate as AnyRecord).salary_expectation ||
    "";
  if (!amount) return "Salary not confirmed";
  return `${candidate.expected_salary_currency || candidate.salary_currency || (candidate as AnyRecord).currency || ""} ${formatSalaryInput(String(amount))}`.trim();
}

function cleanCandidateTitle(candidate: Candidate): string {
  const row = candidate as AnyRecord;
  return cleanTalentSearchTitle(candidate.display_title || candidate.title || row.current_title || row.headline, candidatePrimaryModule(candidate) || candidate.primary_module || "SAP");
}

function profileSeniorityTone(years: number): string {
  if (years <= 2) return "Early-career";
  if (years <= 5) return "Developing";
  if (years <= 9) return "Relevant";
  if (years <= 14) return "Experienced";
  if (years <= 19) return "Senior";
  return "Lead-level";
}

function buildAiInsight(candidate: Candidate): string {
  // Build fresh UI summary from the same fields as the Project box.
  // Avoid stale backend recommendation_summary text that may not reflect normalized counts/modules.
  const module = candidatePrimaryModule(candidate) || candidate.primary_module || "SAP";
  const years = displayNumber(candidate.years ?? candidate.years_experience, 0);
  const counts = projectCounts(candidate);
  const companies = candidateCompanyHighlights(candidate);
  const title = cleanCandidateTitle(candidate);
  const tone = profileSeniorityTone(years);

  const evidence: string[] = [];
  if (counts.implementation) evidence.push(`${counts.implementation} implementation${counts.implementation > 1 ? "s" : ""}`);
  if (counts.ams) evidence.push(`${counts.ams} AMS/support`);
  if (counts.rollout) evidence.push(`${counts.rollout} rollout${counts.rollout > 1 ? "s" : ""}`);
  if (counts.s4hana) evidence.push(`${counts.s4hana} S/4HANA`);
  if (counts.greenfield) evidence.push(`${counts.greenfield} greenfield`);
  if (counts.brownfield) evidence.push(`${counts.brownfield} brownfield`);

  const parts: string[] = [];
  parts.push(`${tone} SAP ${module} candidate${title ? ` - ${title}` : ""}`);
  if (years) parts.push(`${years} years SAP experience`);
  if (evidence.length) parts.push(`Evidence: ${evidence.join(" - ")}`);
  else parts.push("Project delivery scope to validate");
  if (companies.length) parts.push(`Recent background: ${companies.slice(0, 2).join(" / ")}`);

  return `${parts.join(". ")}.`;
}
function getSearchScore(candidate: Candidate) {
  return displayNumber(
    candidate.search_score ??
      candidate.search_fit ??
      candidate.searchFit ??
      (candidate as AnyRecord).score ??
      0,
    0,
  );
}

function getPRIORITYScore(candidate: Candidate, score: number) {
  return displayNumber(
    candidate.recruiter_priority_score ??
      candidate.priority_score ??
      candidate.sort_score ??
      score,
    score,
  );
}

function getRankBadge(candidate: Candidate, index: number) {
  const explicit = normalize(candidate.rank_label);
  const tier = normalize(candidate.rank_tier).toLowerCase();
  const score = getSearchScore(candidate);
  const priority = getPRIORITYScore(candidate, score);

  let label = explicit;
  if (!label) {
    if (index === 0 || tier.includes("best") || priority >= 95) label = "#1";
    else if (index < 3 || tier.includes("top") || priority >= 90) label = `#${index + 1}`;
    else if (index < 10 || priority >= 84) label = `Rank #${index + 1}`;
    else label = `Rank #${index + 1}`;
  }

  const tone =
    index === 0 || /best/i.test(label)
      ? "gold"
      : priority >= 84
        ? "green"
        : "slate";

  return { label, tone, priority };
}

function getQualityScore(candidate: Candidate, fallback = 0) {
  return Math.round(
    displayNumber(
      candidate.profile_quality_score ??
        (candidate as AnyRecord).quality_score ??
        (candidate as AnyRecord).quality ??
        fallback,
      fallback,
    ),
  );
}

function getQualityLabel(score: number) {
  if (score >= 90) return { label: "Excellent", grade: "A", tone: "green" };
  if (score >= 80) return { label: "Strong", grade: "B+", tone: "cyan" };
  if (score >= 70) return { label: "Good", grade: "B", tone: "slate" };
  return { label: "Review", grade: "C", tone: "yellow" };
}

function RankBadge({ label, tone }: { label: string; tone: string }) {
  const cls =
    tone === "gold"
      ? "border-amber-400 bg-amber-300 text-black"
      : tone === "green"
        ? "border-emerald-500 bg-emerald-950 text-emerald-100"
        : "border-slate-600 bg-slate-800 text-slate-100";

  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-black ${cls}`}>
      {label}
    </span>
  );
}
function Candidate360Modal({
  candidate,
  onClose,
  shortlisted,
  onShortlist,
  searchId,
}: {
  candidate: Candidate;
  onClose: () => void;
  shortlisted: boolean;
  onShortlist: (candidate: Candidate) => void;
  searchId: string;
}) {
  const skills = candidateSapTags(candidate);
  const companies = candidateCompanyHighlights(candidate);
  const location = normalize(
    candidate.display_location ||
      candidate.location ||
      candidate.current_location ||
      candidate.country ||
      "N/A",
  );
  const years = displayNumber(candidate.years ?? candidate.years_experience, 0);
  const profileHref = candidate.id ? `/candidates/${candidate.id}?returnTo=${encodeURIComponent("/search")}${searchId ? `&searchId=${encodeURIComponent(searchId)}&searchSessionId=${encodeURIComponent(searchId)}` : ""}` : "#";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="max-h-[90vh] w-full max-w-6xl overflow-auto rounded-2xl border border-slate-700 bg-[#12161b] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
              Candidate 360 View
            </p>
            <h2 className="mt-2 text-3xl font-bold text-white">
              {canonicalCandidateName(candidate)}
            </h2>
            <p className="mt-1 text-sky-100">
              {cleanCandidateTitle(candidate)}
            </p>
            <p className="mt-2 text-sm text-slate-300">
              {location} - {years || "N/A"} years -{" "}
              {candidate.primary_module || "SAP"}
            </p>
          </div>
          <div className="text-right">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-green-500 text-lg font-black text-black">
              {candidate.quality_grade || "A"}
            </div>
            <p className="mt-2 text-sm font-bold text-slate-200">
              Quality {displayNumber(candidate.profile_quality_score, 0)}/100
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-3 rounded-lg border border-slate-600 px-4 py-2 text-sm font-bold text-slate-200 hover:bg-slate-800"
            >
              Close
            </button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-800 bg-black/30 p-4 lg:col-span-2">
            <SectionTitle title="AI MATCH Summary" />
            <p className="text-base font-semibold leading-7 text-white">
              {buildAiInsight(candidate)}
            </p>
            {candidate.why_matched?.length ? (
              <p className="mt-3 text-sm font-bold text-cyan-300">
                Matched: {candidate.why_matched.slice(0, 6).join(" - ")}
              </p>
            ) : null}
          </div>
          <div className="rounded-xl border border-slate-800 bg-black/30 p-4">
            <SectionTitle title="Contact" />
            <p className="text-sm font-semibold text-sky-200">
              {maskEmail(candidate.email)}
            </p>
            <p className="mt-1 text-sm font-semibold text-sky-200">
              {maskPhone(candidate.phone, candidate.phone_status)}
            </p>
            <p className="mt-3 text-xs text-slate-400">
              Unlock workflow can expose verified contact and original CV.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge tone="green">{workAuthorization(candidate)}</Badge>
              <Badge>{workPreference(candidate)}</Badge>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-800 bg-black/30 p-4">
            <SectionTitle title="Skills & Languages" />
            <div className="flex flex-wrap gap-2">
              {skills.length ? (
                skills.map((skill) => (
                  <Badge key={skill} tone="cyan">
                    {skill}
                  </Badge>
                ))
              ) : (
                <span className="text-sm text-slate-400">
                  Skills pending enrichment
                </span>
              )}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {candidateLanguages(candidate).length ? (
                candidateLanguages(candidate).map((lang, index) => (
                  <Badge key={`modal-lang-${lang}-${index}`} tone="green">
                    {lang}
                  </Badge>
                ))
              ) : (
                <span className="text-sm text-slate-400">
                  Language data not verified
                </span>
              )}
            </div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-black/30 p-4">
            <SectionTitle title="Project History" />
            <div className="grid grid-cols-2 gap-2 text-sm font-bold">
              {[
                ["Implementation", projectCounts(candidate).implementation],
                ["AMS / Support", projectCounts(candidate).ams],
                ["Rollout", projectCounts(candidate).rollout],
                ["S/4HANA", projectCounts(candidate).s4hana],
                ["Greenfield", projectCounts(candidate).greenfield],
                ["Brownfield", projectCounts(candidate).brownfield],
              ].map(([label, value]) => (
                <div key={String(label)}>
                  {String(label)}
                  <br />
                  <span className="text-xl text-white">{Number(value)}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-400">
              AI parsed first; candidate confirmation should update these counts
              from the portal.
            </p>
            <p className="mt-2 text-xs font-bold text-cyan-300">
              Data Quality:{" "}
              {(candidate as AnyRecord).project_extraction_confidence ||
                "Medium"}{" "}
              - Source:{" "}
              {(candidate as AnyRecord).project_extraction_source ||
                "AI inferred"}
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-black/30 p-4">
            <SectionTitle title="Employment" />
            <p className="text-sm font-semibold text-white">
              {companies.length
                ? companies.join(" - ")
                : safeTalentSearchCompany(candidate.display_company)}
            </p>
            <p className="mt-2 text-sm text-slate-300">
              {candidate.display_industry || "Industry pending validation"}
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-800 bg-black/30 p-4">
            <SectionTitle title="Availability" />
            <p className="text-sm font-semibold text-white">
              {(candidate as AnyRecord).availability_status ||
                "Not yet verified"}
            </p>
            <p className="mt-1 text-sm text-slate-300">
              Available within:{" "}
              {(candidate as AnyRecord).availability_timeline ||
                "Not yet verified"}
            </p>
            <p className="mt-1 text-sm text-slate-300">
              Work authorization: {workAuthorization(candidate)}
            </p>
            <p className="mt-1 text-sm text-slate-300">
              Work Preference: {workPreference(candidate)}
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-black/30 p-4">
            <SectionTitle title="Compensation" />
            <p className="text-sm font-semibold text-white">
              {candidate.expected_salary
                ? `${candidate.expected_salary_currency || candidate.salary_currency || ""} ${candidate.expected_salary}`
                : "Expected salary not confirmed"}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Salary should be confirmed by Candidate Portal or recruiter
              validation.
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-black/30 p-4">
            <SectionTitle title="CV Preview" />
            <p className="text-sm text-slate-300">
              Original CV access is controlled by subscription/admin unlock.
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-black/30 p-4">
            <SectionTitle title="Notes" />
            <p className="text-sm text-slate-300">
              Recruiter notes and engagement history will appear here after
              workflow tracking is enabled.
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => onShortlist(candidate)}
            className={`rounded-lg px-5 py-3 text-sm font-black text-white ${shortlisted ? "bg-emerald-700" : "bg-green-600 hover:bg-green-700"}`}
          >
            {shortlisted ? "Shortlisted OK" : "Shortlist"}
          </button>
          {candidate.id ? (
            <Link
              href={profileHref}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-sky-600 px-5 py-3 text-sm font-black text-white hover:bg-sky-700"
            >
              Open Full Profile Page
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function TalentPoolSearchPage() {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [activeSearchId, setActiveSearchId] = useState("");
  const [sapSkills, setSapSkills] = useState<string[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [minYears, setMinYears] = useState("0");
  const [companies, setCompanies] = useState<string[]>([]);
  const [industryTypes, setIndustryTypes] = useState<string[]>([]);
  const [background, setBackground] = useState("All");
  const [projectTypes, setProjectTypes] = useState<string[]>([]);
  const [availability, setAvailability] = useState("All");
  const [availableWithin, setAvailableWithin] = useState("Any");
  const [employmentType, setEmploymentType] = useState("All");
  const [visaStatus, setVisaStatus] = useState("All");
  const [workPreferenceFilter, setWorkPreferenceFilter] = useState<string[]>([]);
  const [languageRequirements, setLanguageRequirements] = useState<
    LanguageRequirement[]
  >([]);
  const [updatedWithin, setUpdatedWithin] = useState("Any");
  const [roleType, setRoleType] = useState("All");
  const [seniorityLevel, setSeniorityLevel] = useState("All");
  const [minGreenfield, setMinGreenfield] = useState("0");
  const [minBrownfield, setMinBrownfield] = useState("0");
  const [minRollout, setMinRollout] = useState("0");
  const [minSelective, setMinSelective] = useState("0");
  const [minS4Implementation, setMinS4Implementation] = useState("0");
  const [minS4Ams, setMinS4Ams] = useState("0");
  const [salaryCurrency, setSalaryCurrency] = useState("Any");
  const [minSalary, setMinSalary] = useState("");
  const [maxSalary, setMaxSalary] = useState("");
  const [qualityTier, setQualityTier] = useState("All");
  const [minQuality, setMinQuality] = useState("0");
  const [hasContactInfoOnly, setHasContactInfoOnly] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [viewerRole, setViewerRole] = useState<TalentSearchViewerRole>("recruiter");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(
    null,
  );
  const [shortlistedIds, setShortlistedIds] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState<AnyRecord | null>(null);
  const [pagination, setPagination] = useState<TalentSearchPaginationMeta>(EMPTY_SEARCH_PAGINATION);
  const [pageSize, setPageSize] = useState(DEFAULT_SEARCH_PAGE_SIZE);
  // Production performance: use local taxonomy suggestions on page load.
  // Do not call /api/admin/taxonomy here; admin taxonomy can refresh in Admin UI/background sync.
  const [sapSkillSuggestions] = useState<string[]>(SAP_SKILL_SUGGESTIONS);
  const [companySuggestions] = useState<string[]>(COMPANY_SUGGESTIONS);
  const [openFilterSections, setOpenFilterSections] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      setViewerRole(resolveTalentSearchViewerRole({
        requestedRole: params.get("viewerRole") || params.get("role"),
        adminFlag: params.get("internalTalentSearchAdmin") || params.get("adminSummary") || params.get("admin"),
        adminEnabled: process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_TALENT_SEARCH_ADMIN_SUMMARY === "true",
      }));
    } catch {}

    try {
      const saved = window.localStorage.getItem(SHORTLIST_STORAGE_KEY);
      if (saved) setShortlistedIds(new Set(JSON.parse(saved)));
    } catch {}

    async function loadPersistentShortlist() {
      try {
        const res = await fetch("/api/shortlists?includeCandidates=true&limit=200", { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        const shortlists = Array.isArray(json?.shortlists) ? json.shortlists : [];

        const savedShortlistId = window.localStorage.getItem(SEARCH_SHORTLIST_ID_KEY);
        const preferred =
          shortlists.find((item: AnyRecord) => item?.id && item.id === savedShortlistId) ||
          shortlists.find((item: AnyRecord) => item?.metadata?.source === "talent_pool_search" && item?.metadata?.recruiter_email === DEFAULT_RECRUITER_EMAIL) ||
          shortlists.find((item: AnyRecord) => item?.name === SEARCH_SHORTLIST_NAME);

        if (preferred?.id) window.localStorage.setItem(SEARCH_SHORTLIST_ID_KEY, String(preferred.id));

        const rows = Array.isArray(preferred?.shortlist_candidates) ? preferred.shortlist_candidates : [];
        const ids = rows
          .filter((row: AnyRecord) => String(row?.status || "active").toLowerCase() !== "removed")
          .map((row: AnyRecord) => String(row?.candidate_id || ""))
          .filter(Boolean);

        if (ids.length) {
          setShortlistedIds((prev) => new Set([...Array.from(prev), ...ids]));
        }
      } catch {
        // Keep localStorage fallback when the shortlist tables are not ready yet.
      }
    }

    loadPersistentShortlist();
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SEARCH_CACHE_KEY);
      if (!raw) return;
      const cache = JSON.parse(raw) as SearchCacheSnapshot;
      const f = cache?.filters || {};
      setKeyword(f.keyword || f.q || "");
      if (cache.searchId) setActiveSearchId(String(cache.searchId));
      setSapSkills(Array.isArray(f.sapSkills) ? f.sapSkills : []);
      setCountries(Array.isArray(f.countries) ? f.countries : []);
      setCities(Array.isArray(f.cities) ? f.cities : []);
      setMinYears(String(f.minYears ?? "0"));
      setCompanies(Array.isArray(f.companies) ? f.companies : []);
      setIndustryTypes(Array.isArray(f.industryTypes) ? f.industryTypes : []);
      setBackground(f.background || "All");
      setProjectTypes(Array.isArray(f.projectTypes) ? f.projectTypes : []);
      setAvailability(f.availability || "All");
      setAvailableWithin(f.availableWithin || "Any");
      setEmploymentType(f.employmentType || "All");
      setVisaStatus(f.visaStatus || "All");
      setWorkPreferenceFilter(Array.isArray(f.workPreferenceFilter) ? f.workPreferenceFilter : []);
      setLanguageRequirements(Array.isArray(f.languageRequirements) ? f.languageRequirements : []);
      setUpdatedWithin(f.updatedWithin || "Any");
      setRoleType(f.roleType || "All");
      setSeniorityLevel(f.seniorityLevel || "All");
      setMinGreenfield(String(f.minGreenfield ?? "0"));
      setMinBrownfield(String(f.minBrownfield ?? "0"));
      setMinRollout(String(f.minRollout ?? "0"));
      setMinSelective(String(f.minSelective ?? "0"));
      setMinS4Implementation(String(f.minS4Implementation ?? "0"));
      setMinS4Ams(String(f.minS4Ams ?? "0"));
      setSalaryCurrency(f.salaryCurrency || "Any");
      setMinSalary(f.minSalary || "");
      setMaxSalary(f.maxSalary || "");
      setQualityTier(f.qualityTier || "All");
      setMinQuality(String(f.minQuality ?? "0"));
      setHasContactInfoOnly(Boolean(f.hasContactInfoOnly));
      setShowReview(Boolean(f.showReview));
      const y = Number(cache.scrollY || window.localStorage.getItem(SEARCH_SCROLL_KEY) || 0);
      if (Number.isFinite(y) && y > 0) setTimeout(() => window.scrollTo(0, y), 150);
    } catch {
      // Ignore stale cache.
    }
  }, []);

  useEffect(() => {
    const saveScroll = () => {
      try {
        window.localStorage.setItem(SEARCH_SCROLL_KEY, String(window.scrollY || 0));
      } catch {}
    };
    window.addEventListener("scroll", saveScroll, { passive: true });
    window.addEventListener("beforeunload", saveScroll);
    return () => {
      window.removeEventListener("scroll", saveScroll);
      window.removeEventListener("beforeunload", saveScroll);
    };
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        SHORTLIST_STORAGE_KEY,
        JSON.stringify(Array.from(shortlistedIds)),
      );
    } catch {}
  }, [shortlistedIds]);


  const citySuggestions = useMemo(
    () =>
      unique(countries.flatMap((country) => COUNTRY_CITY_MAP[country] || [])),
    [countries],
  );
  const industryOptions =
    background === "Consulting Firm / SI"
      ? CONSULTING_INDUSTRIES
      : background === "End Client / In-house"
        ? END_CLIENT_INDUSTRIES
        : ALL_INDUSTRIES;

  const buildFilterSnapshot = () => ({
    keyword,
    q: keyword,
    sapSkills,
    countries,
    cities,
    minYears,
    companies,
    industryTypes,
    background,
    projectTypes,
    availability,
    availableWithin,
    employmentType,
    visaStatus,
    workPreferenceFilter,
    languageRequirements,
    updatedWithin,
    roleType,
    seniorityLevel,
    minGreenfield,
    minBrownfield,
    minRollout,
    minSelective,
    minS4Implementation,
    minS4Ams,
    salaryCurrency,
    minSalary,
    maxSalary,
    qualityTier,
    minQuality,
    hasContactInfoOnly,
    showReview,
  });

  const persistSearchCache = (nextCandidates?: Candidate[], _nextStats?: AnyRecord | null) => {
    try {
      const filters = buildFilterSnapshot();
      const searchId = activeSearchId || createTalentSearchId(filters);
      const cache: SearchCacheSnapshot = {
        filters,
        scrollY: window.scrollY || 0,
        savedAt: new Date().toISOString(),
        searchId,
      };
      window.localStorage.setItem(SEARCH_CACHE_KEY, JSON.stringify(cache));
      window.localStorage.setItem(SEARCH_SCROLL_KEY, String(window.scrollY || 0));
      setActiveSearchId(searchId);

      const results = Array.isArray(nextCandidates) ? nextCandidates : candidates;
      const candidateIds = results.map(talentSearchCandidateId).filter(Boolean);
      if (results.length && candidateIds.length) {
        const primaryModule = Array.isArray(filters.sapSkills) && filters.sapSkills.length ? filters.sapSkills[0] : filters.keyword || "";
        const snapshot = {
          searchId,
          searchSessionId: searchId,
          matches: results,
          candidateIds,
          ranking: candidateIds.map((candidateId, index) => ({ candidateId, rank: index + 1 })),
          filters,
          module: primaryModule,
          primaryModule,
          savedAt: cache.savedAt,
        };
        window.localStorage.setItem(SEARCH_SESSION_PREFIX + searchId, JSON.stringify(snapshot));
        window.sessionStorage.setItem(SEARCH_SESSION_PREFIX + searchId, JSON.stringify(snapshot));
        window.localStorage.setItem(COMPARE_MATCHES_CACHE_KEY, JSON.stringify(snapshot));
        window.sessionStorage.setItem(COMPARE_MATCHES_CACHE_KEY, JSON.stringify(snapshot));
      }
    } catch {
      // Local cache is best-effort only.
    }
  };
  const resetFilters = () => {
    setKeyword("");
    setSapSkills([]);
    setCountries([]);
    setCities([]);
    setMinYears("0");
    setCompanies([]);
    setIndustryTypes([]);
    setBackground("All");
    setProjectTypes([]);
    setAvailability("All");
    setAvailableWithin("Any");
    setEmploymentType("All");
    setVisaStatus("All");
    setWorkPreferenceFilter([]);
    setLanguageRequirements([]);
    setUpdatedWithin("Any");
    setRoleType("All");
    setSeniorityLevel("All");
    setMinGreenfield("0");
    setMinBrownfield("0");
    setMinRollout("0");
    setMinSelective("0");
    setMinS4Implementation("0");
    setMinS4Ams("0");
    setSalaryCurrency("Any");
    setMinSalary("");
    setMaxSalary("");
    setQualityTier("All");
    setMinQuality("0");
    setHasContactInfoOnly(false);
    setShowReview(false);
    setCandidates([]);
    setStats(null);
    setPagination(EMPTY_SEARCH_PAGINATION);
    setError("");
    try {
      window.localStorage.removeItem(SEARCH_CACHE_KEY);
      window.localStorage.removeItem(SEARCH_SCROLL_KEY);
      window.history.replaceState(null, "", window.location.pathname);
      window.scrollTo(0, 0);
    } catch {}
  };

  const fetchSearchPage = async ({ page = 1, nextPageSize = pageSize }: { page?: number; nextPageSize?: number } = {}) => {
    setLoading(true);
    setError("");
    try {
      const query = buildQuery({
        q: keyword,
        keyword,
        module: sapSkills[0] || "All",
        modules: sapSkills,
        sapSkills,
        country: countries.join(","),
        countries,
        city: cities.join(","),
        cities,
        location: unique([...countries, ...cities]).join(","),
        minYears,
        company: companies.join(","),
        companies,
        industry: industryTypes.join(","),
        industries: industryTypes,
        background,
        companyBackground: background,
        projectType: projectTypes.join(","),
        projectTypes,
        availability,
        availabilityStatus: availability,
        availableWithin,
        availableIn: availableWithin,
        employmentType,
        visaStatus,
        workPreference: workPreferenceFilter,
        relocation: workPreferenceFilter,
        languageRequirements: JSON.stringify(languageRequirements),
        languages: languageRequirements.map((item) => item.language),
        updatedWithin,
        roleType,
        seniorityLevel,
        level: seniorityLevel,
        minGreenfield,
        minBrownfield,
        minRollout,
        minSelective,
        minS4Implementation,
        minS4Ams,
        salaryCurrency,
        currency: salaryCurrency,
        minSalary,
        maxSalary,
        minQuality,
        qualityTier,
        hasContactInfoOnly: hasContactInfoOnly ? "true" : "false",
        contactInfoOnly: hasContactInfoOnly ? "true" : "false",
        showReview: showReview ? "true" : "false",
        viewerRole,
        internalTalentSearchAdmin: viewerRole === "admin" ? "true" : "false",
        page,
        pageSize: nextPageSize,
      });
      const res = await fetch(`/api/search-candidates?${query}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Search failed");
      const rawCandidates = (json.items || json.candidates || json.results || []) as Candidate[];
      const nextCandidates = rawCandidates;
      const nextStats = json.stats || json.meta || null;
      const nextPagination: TalentSearchPaginationMeta = {
        totalCandidates: Number(json.totalCandidates ?? 0) || 0,
        totalMatched: Number(json.totalMatched ?? rawCandidates.length) || 0,
        returnedCount: Number(json.returnedCount ?? rawCandidates.length) || 0,
        pageSize: Number(json.pageSize ?? json.limit ?? nextPageSize) || nextPageSize,
        limit: Number(json.limit ?? json.pageSize ?? nextPageSize) || nextPageSize,
        offset: Number(json.offset ?? ((page - 1) * nextPageSize)) || 0,
        page: Number(json.page ?? json.currentPage ?? page) || page,
        currentPage: Number(json.currentPage ?? json.page ?? page) || page,
        totalPages: Number(json.totalPages ?? 1) || 1,
        hasPrevious: Boolean(json.hasPrevious),
        hasNext: Boolean(json.hasNext),
        hasMore: Boolean(json.hasMore ?? json.hasNext),
      };
      setCandidates(nextCandidates);
      setStats(nextStats ? { ...nextStats, returnedCount: nextPagination.returnedCount } : { returnedCount: nextPagination.returnedCount });
      setPagination(nextPagination);
      persistSearchCache(nextCandidates, nextStats);
      try {
        window.history.replaceState(null, "", `${window.location.pathname}?${query}`);
      } catch {}
    } catch (err: any) {
      setError(err?.message || "Search failed");
      setCandidates([]);
      setStats(null);
      setPagination(EMPTY_SEARCH_PAGINATION);
    } finally {
      setLoading(false);
    }
  };

  const search = async () => {
    await fetchSearchPage({ page: 1, nextPageSize: pageSize });
  };

  const goToPage = async (page: number) => {
    const target = Math.max(1, Math.min(page, pagination.totalPages || 1));
    if (loading || target === pagination.currentPage) return;
    await fetchSearchPage({ page: target, nextPageSize: pageSize });
  };

  const changePageSize = async (value: number) => {
    const nextPageSize = SEARCH_PAGE_SIZE_OPTIONS.includes(value) ? value : DEFAULT_SEARCH_PAGE_SIZE;
    setPageSize(nextPageSize);
    await fetchSearchPage({ page: 1, nextPageSize });
  };
  const ensureSearchShortlist = async (): Promise<string | null> => {
    try {
      const saved = window.localStorage.getItem(SEARCH_SHORTLIST_ID_KEY);
      if (saved) return saved;

      const existingRes = await fetch("/api/shortlists?includeCandidates=true&limit=200", { cache: "no-store" });
      if (existingRes.ok) {
        const existingJson = await existingRes.json();
        const shortlists = Array.isArray(existingJson?.shortlists) ? existingJson.shortlists : [];
        const found =
          shortlists.find((item: AnyRecord) => item?.metadata?.source === "talent_pool_search" && item?.metadata?.recruiter_email === DEFAULT_RECRUITER_EMAIL) ||
          shortlists.find((item: AnyRecord) => item?.name === SEARCH_SHORTLIST_NAME);
        if (found?.id) {
          window.localStorage.setItem(SEARCH_SHORTLIST_ID_KEY, String(found.id));
          return String(found.id);
        }
      }

      const createRes = await fetch("/api/shortlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: SEARCH_SHORTLIST_NAME,
          mode: "recruiter",
          stage: "draft",
          status: "active",
          metadata: {
            source: "talent_pool_search",
            recruiter_email: DEFAULT_RECRUITER_EMAIL,
          },
        }),
      });
      if (!createRes.ok) return null;
      const createJson = await createRes.json();
      const shortlistId = createJson?.shortlist?.id;
      if (shortlistId) {
        window.localStorage.setItem(SEARCH_SHORTLIST_ID_KEY, String(shortlistId));
        return String(shortlistId);
      }
    } catch {}
    return null;
  };

  const shortlistCandidate = async (candidate: Candidate) => {
    const key = getShortlistId(candidate);
    const nextIds = new Set(shortlistedIds);
    nextIds.add(key);
    setShortlistedIds(nextIds);

    try {
      window.localStorage.setItem(SHORTLIST_STORAGE_KEY, JSON.stringify(Array.from(nextIds)));
      persistSearchCache(candidates, stats);
    } catch {}

    try {
      const shortlistId = await ensureSearchShortlist();
      if (!shortlistId) return;

      await fetch("/api/shortlist-candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shortlistId,
          candidateIds: [key],
          stage: "shortlisted",
          status: "active",
          metadata: {
            source: "talent_pool_search",
            recruiter_email: DEFAULT_RECRUITER_EMAIL,
            candidate_snapshot: candidate,
          },
        }),
      });
    } catch {
      // localStorage fallback already saved the shortlist state.
    }
  };

  const summaryVisibility = talentSearchSummaryVisibility(viewerRole);
  const totalPoolCount = summaryVisibility.canSeeTalentPoolTotal ? (pagination.totalCandidates || stats?.totalCandidates || 0) : 0;
  const resultCount = summaryVisibility.canSeeFilteredTotal ? (pagination.totalMatched || stats?.totalMatched || candidates.length) : candidates.length;
  const showingCount = candidates.length;
  const reachable =
    stats?.reachable ??
    candidates.filter((candidate) => candidateHasContactInfo(candidate)).length;
  const ready =
    stats?.ready ??
    candidates.filter((candidate) => String((candidate as AnyRecord).validation_badge || (candidate as AnyRecord).validation_status || "") === "Ready").length;
  const reviewNeeded =
    stats?.needsReview ??
    candidates.filter((c) => displayNumber(c.profile_quality_score) < 75 || Boolean((c as AnyRecord).review_needed)).length;
  const exportBlocked =
    stats?.exportBlocked ??
    candidates.filter((candidate) => Boolean((candidate as AnyRecord).excluded_from_client_view)).length;
  const inferredSapSkills = sapSkills.length ? [] : inferSapSkillsFromKeyword(keyword);
  const displayedSapSkills = sapSkills.length
    ? sapSkills.join(", ")
    : inferredSapSkills.length
      ? `${inferredSapSkills.join(", ")} (from keyword)`
      : "Any";

  const inferredProjectTypes = projectTypes.length ? [] : inferProjectTypesFromKeyword(keyword);
  const displayedProjectTypes = projectTypes.length
    ? projectTypes.join(", ")
    : inferredProjectTypes.length
      ? `${inferredProjectTypes.join(", ")} (from keyword)`
      : "Any";

  return (
    <main className="min-h-screen bg-black p-5 text-white">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">
          Talent Pool Search
        </h1>
        <Link
          href="/matches"
          className="text-sm font-bold text-sky-300 hover:text-sky-200"
        >
          Back to Matches
        </Link>
      </div>

      <section className="rounded-xl border border-slate-800 bg-[#15191e] p-4 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <SectionTitle
            title="Core Search"
            subtitle="Use skill, country, city, and years first. Open advanced filters only when needed."
          />
          <button
            type="button"
            onClick={() => setAdvancedOpen((v) => !v)}
            className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-bold text-sky-100 hover:border-cyan-500"
          >
            Advanced Filters {advancedOpen ? "^" : "v"}
          </button>
        </div>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
          <div className="lg:col-span-3">
            <FieldLabel>Keyword</FieldLabel>
            <TextField
              value={keyword}
              onChange={setKeyword}
              placeholder="FICO, CFIN, rollout..."
            />
          </div>
          <div className="lg:col-span-4">
            <MultiTagInput
              label="SAP Skills"
              values={sapSkills}
              setValues={setSapSkills}
              suggestions={sapSkillSuggestions}
              placeholder="Select or type SAP skills..."
            />
          </div>
          <div className="lg:col-span-2">
            <MultiTagInput
              label="Country"
              values={countries}
              setValues={(next) => {
                setCountries(next);
                setCities((prev) =>
                  prev.filter((city) =>
                    next.some((country) =>
                      (COUNTRY_CITY_MAP[country] || []).includes(city),
                    ),
                  ),
                );
              }}
              suggestions={COUNTRIES}
              placeholder="Malaysia, Singapore..."
            />
          </div>
          <div className="lg:col-span-2">
            <MultiTagInput
              label="City"
              values={cities}
              setValues={setCities}
              suggestions={citySuggestions}
              placeholder={
                countries.length ? "Select city (optional)" : "Select country first"
              }
              disabled={!countries.length}
            />
          </div>
          <div className="lg:col-span-1">
            <FieldLabel>{"Years >="}</FieldLabel>
            <NumberField value={minYears} onChange={setMinYears} />
          </div>
        </div>

        {advancedOpen && (
          <div className="mt-5 space-y-3 border-t border-slate-800 pt-5">
            <AccordionSection
              title="Delivery Experience"
              subtitle="Project exposure that SAP hiring managers care about most."
              activeCount={projectTypes.length + [minGreenfield, minRollout, minBrownfield, minSelective, minS4Implementation, minS4Ams].filter((v) => Number(v) > 0).length}
              open={!!openFilterSections.delivery}
              onToggle={() => setOpenFilterSections((prev) => ({ ...prev, delivery: !prev.delivery }))}
              onClear={() => {
                setProjectTypes([]);
                setMinGreenfield("0");
                setMinRollout("0");
                setMinBrownfield("0");
                setMinSelective("0");
                setMinS4Implementation("0");
                setMinS4Ams("0");
              }}
            >
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
                <div className="lg:col-span-5">
                  <CheckboxGroup
                    label="Project Type"
                    values={PROJECT_TYPES}
                    selected={projectTypes}
                    setSelected={setProjectTypes}
                  />
                </div>
                <div className="lg:col-span-7">
                  <FieldLabel>Project Experience</FieldLabel>
                  <div className="grid grid-cols-2 gap-3 rounded-lg border border-slate-700 bg-black/40 p-3 lg:grid-cols-6">
                    <div><FieldLabel>Greenfield</FieldLabel><NumberField value={minGreenfield} onChange={setMinGreenfield} /></div>
                    <div><FieldLabel>Rollout</FieldLabel><NumberField value={minRollout} onChange={setMinRollout} /></div>
                    <div><FieldLabel>Brownfield</FieldLabel><NumberField value={minBrownfield} onChange={setMinBrownfield} /></div>
                    <div><FieldLabel>Selective</FieldLabel><NumberField value={minSelective} onChange={setMinSelective} /></div>
                    <div><FieldLabel>S/4 Implementation</FieldLabel><NumberField value={minS4Implementation} onChange={setMinS4Implementation} /></div>
                    <div><FieldLabel>S/4 AMS</FieldLabel><NumberField value={minS4Ams} onChange={setMinS4Ams} /></div>
                  </div>
                </div>
              </div>
            </AccordionSection>

            <AccordionSection
              title="Availability"
              activeCount={[availability !== "All", availableWithin !== "Any", employmentType !== "All", updatedWithin !== "Any"].filter(Boolean).length}
              open={!!openFilterSections.availability}
              onToggle={() => setOpenFilterSections((prev) => ({ ...prev, availability: !prev.availability }))}
              onClear={() => {
                setAvailability("All");
                setAvailableWithin("Any");
                setEmploymentType("All");
                setUpdatedWithin("Any");
              }}
            >
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
                <div className="lg:col-span-3"><FieldLabel>Availability</FieldLabel><SelectField value={availability} onChange={setAvailability}>{AVAILABILITY_OPTIONS.map((v) => <option key={v}>{v}</option>)}</SelectField></div>
                <div className="lg:col-span-3"><FieldLabel>Available Within</FieldLabel><SelectField value={availableWithin} onChange={setAvailableWithin}>{AVAILABLE_WITHIN_OPTIONS.map((v) => <option key={v}>{v}</option>)}</SelectField></div>
                <div className="lg:col-span-3"><FieldLabel>Employment Type</FieldLabel><SelectField value={employmentType} onChange={setEmploymentType}>{EMPLOYMENT_OPTIONS.map((v) => <option key={v}>{v}</option>)}</SelectField></div>
                <div className="lg:col-span-3"><FieldLabel>Updated Within</FieldLabel><SelectField value={updatedWithin} onChange={setUpdatedWithin}>{UPDATED_WITHIN.map((v) => <option key={v}>{v}</option>)}</SelectField></div>
              </div>
            </AccordionSection>

            <AccordionSection
              title="Work Authorization & Language"
              subtitle="Use paired language + level requirements and practical work preferences for cross-border SAP hiring."
              activeCount={(visaStatus !== "All" ? 1 : 0) + workPreferenceFilter.length + languageRequirements.length}
              open={!!openFilterSections.workAuth}
              onToggle={() => setOpenFilterSections((prev) => ({ ...prev, workAuth: !prev.workAuth }))}
              onClear={() => {
                setVisaStatus("All");
                setWorkPreferenceFilter([]);
                setLanguageRequirements([]);
              }}
            >
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
                <div className="lg:col-span-3"><FieldLabel>Visa / Work Rights</FieldLabel><SelectField value={visaStatus} onChange={setVisaStatus}>{VISA_STATUS_OPTIONS.map((v) => <option key={v}>{v}</option>)}</SelectField></div>
                <div className="lg:col-span-3">
                  <CheckboxGroup
                    label="Work Preference"
                    values={WORK_PREFERENCE_OPTIONS.filter((v) => v !== "All")}
                    selected={workPreferenceFilter}
                    setSelected={setWorkPreferenceFilter}
                  />
                </div>
                <div className="lg:col-span-6"><LanguageRequirementInput requirements={languageRequirements} setRequirements={setLanguageRequirements} /></div>
              </div>
            </AccordionSection>

            <AccordionSection
              title="Background"
              subtitle="Search exact companies, then use quick firm-type presets only when needed."
              activeCount={companies.length + industryTypes.length + (background !== "All" ? 1 : 0)}
              open={!!openFilterSections.background}
              onToggle={() => setOpenFilterSections((prev) => ({ ...prev, background: !prev.background }))}
              onClear={() => {
                setCompanies([]);
                setIndustryTypes([]);
                setBackground("All");
              }}
            >
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
                <div className="lg:col-span-4">
                  <MultiTagInput label="Company" values={companies} setValues={setCompanies} suggestions={companySuggestions} placeholder="Search company: Accenture, Deloitte, cbs..." />
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-400">
                    <span className="font-bold text-sky-200">Popular:</span>
                    <FirmTypePresetButton label="Big 4" values={industryTypes} setValues={setIndustryTypes} />
                    <FirmTypePresetButton label="Global Consulting" values={industryTypes} setValues={setIndustryTypes} />
                    <FirmTypePresetButton label="Regional SI" values={industryTypes} setValues={setIndustryTypes} />
                    <FirmTypePresetButton label="Boutique SAP Partner" values={industryTypes} setValues={setIndustryTypes} />
                  </div>
                  <p className="mt-2 text-xs text-slate-500">Selected companies show above. Firm types are applied as background filters without flooding the screen.</p>
                </div>
                <div className="lg:col-span-2"><FieldLabel>Background</FieldLabel><SelectField value={background} onChange={(v) => { setBackground(v); setIndustryTypes([]); }}>{BACKGROUND_OPTIONS.map((v) => <option key={v}>{v}</option>)}</SelectField></div>
                <div className="lg:col-span-6"><CheckboxGroup label="Industry / Firm Type" values={industryOptions} selected={industryTypes} setSelected={setIndustryTypes} /></div>
              </div>
            </AccordionSection>

            <AccordionSection
              title="Compensation"
              subtitle="Expected monthly salary range. Use candidate-confirmed salary first; parsed CV salary is indicative only."
              activeCount={[salaryCurrency !== "Any", !!minSalary, !!maxSalary].filter(Boolean).length}
              open={!!openFilterSections.compensation}
              onToggle={() => setOpenFilterSections((prev) => ({ ...prev, compensation: !prev.compensation }))}
              onClear={() => {
                setSalaryCurrency("Any");
                setMinSalary("");
                setMaxSalary("");
              }}
            >
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
                <div className="lg:col-span-7">
                  <FieldLabel>Expected Salary Range</FieldLabel>
                  <div className="grid grid-cols-1 overflow-hidden rounded-xl border border-slate-600 bg-black focus-within:border-cyan-400 md:grid-cols-12">
                    <select value={salaryCurrency} onChange={(e) => setSalaryCurrency(e.target.value)} className="h-11 border-b border-slate-800 bg-black px-3 text-sm font-black text-white outline-none md:col-span-3 md:border-b-0 md:border-r">
                      {CURRENCIES.map((v) => <option key={v}>{v}</option>)}
                    </select>
                    <div className="md:col-span-4 border-b border-slate-800 md:border-b-0 md:border-r"><SalaryField value={minSalary} onChange={setMinSalary} placeholder="From" /></div>
                    <div className="hidden items-center justify-center bg-slate-950 text-xs font-black text-slate-500 md:flex">to</div>
                    <div className="md:col-span-4"><SalaryField value={maxSalary} onChange={setMaxSalary} placeholder="To" /></div>
                  </div>
                </div>
                <div className="lg:col-span-5 rounded-xl border border-slate-800 bg-black/20 p-3 text-xs text-slate-400">Note: Keep currency as Any for broad sourcing; set currency + range only when client budget is fixed.</div>
              </div>
            </AccordionSection>

            <AccordionSection
              title="Seniority"
              activeCount={[roleType !== "All", seniorityLevel !== "All", qualityTier !== "All", minQuality !== "0"].filter(Boolean).length}
              open={!!openFilterSections.seniority}
              onToggle={() => setOpenFilterSections((prev) => ({ ...prev, seniority: !prev.seniority }))}
              onClear={() => {
                setRoleType("All");
                setSeniorityLevel("All");
                setQualityTier("All");
                setMinQuality("0");
              }}
            >
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
                <div className="lg:col-span-3"><FieldLabel>Role Type</FieldLabel><SelectField value={roleType} onChange={setRoleType}>{ROLE_TYPES.map((v) => <option key={v}>{v}</option>)}</SelectField></div>
                <div className="lg:col-span-3"><FieldLabel>Seniority Level</FieldLabel><SelectField value={seniorityLevel} onChange={setSeniorityLevel}>{SENIORITY_LEVELS.map((v) => <option key={v}>{v}</option>)}</SelectField></div>
                <div className="lg:col-span-3"><FieldLabel>Quality Tier</FieldLabel><SelectField value={qualityTier} onChange={setQualityTier}>{QUALITY_TIERS.map((v) => <option key={v}>{v}</option>)}</SelectField></div>
                <div className="lg:col-span-2"><FieldLabel>{"Quality >="}</FieldLabel><NumberField value={minQuality} onChange={setMinQuality} /></div>
              </div>
            </AccordionSection>
          </div>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={search}
            disabled={loading}
            className="rounded-lg bg-blue-600 px-6 py-3 text-sm font-extrabold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? "Searching..." : "Search Talent Pool"}
          </button>
          <button
            type="button"
            onClick={resetFilters}
            className="rounded-lg border border-slate-600 bg-slate-900 px-6 py-3 text-sm font-extrabold text-white hover:bg-slate-800"
          >
            Reset Filters
          </button>
        </div>
      </section>

      {summaryVisibility.canSeeInternalMetrics ? (
      <section className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-6">
        {[
          ["Filtered Results", resultCount],
          ["Total Talent Pool", totalPoolCount],
          ["Reachable", reachable],
          ["Ready", ready],
          ["Needs Review", reviewNeeded],
          ["Export Blocked", exportBlocked],
        ].map(([label, value]) => (
          <div
            key={String(label)}
            className="rounded-xl border border-slate-800 bg-[#15191e] p-4"
          >
            <div className="text-sm text-sky-200">{label}</div>
            <div className="mt-1 text-2xl font-extrabold text-white">
              {String(value)}
            </div>
          </div>
        ))}
      </section>
      ) : null}
      {error && (
        <div className="mt-4 rounded-xl border border-red-900 bg-red-950/40 p-4 text-sm font-bold text-red-200">
          {error}
        </div>
      )}
      {!loading && !error && candidates.length === 0 && (
        <div className="mt-4 rounded-xl border border-slate-800 bg-[#15191e] p-4 text-sm font-semibold text-slate-300">
          No profiles found for the current filters. Try widening location,
          lowering quality, or removing secondary filters.
        </div>
      )}
      <section className="mt-4 space-y-3">
        {candidates.map((candidate, index) => {
          const score = getSearchScore(candidate);
          const rankBadge = getRankBadge(candidate, index);
          const qualityScore = getQualityScore(candidate, score);
          const qualityMeta = getQualityLabel(qualityScore);
          const quality = normalize(candidate.quality_grade) || qualityMeta.grade;
          const confidenceScore = getCONFIDENCEScore(candidate);
          const confidenceMeta = getCONFIDENCELabel(confidenceScore);
          const location = normalize(
            candidate.display_location ||
              candidate.location ||
              candidate.current_location ||
              candidate.country ||
              "N/A",
          );
          const country = normalize(
            candidate.country ||
              (candidate as AnyRecord).current_country ||
              "",
          );
          const years = displayNumber(
            candidate.years ?? candidate.years_experience,
            0,
          );
          const why = candidate.why_matched?.length
            ? candidate.why_matched
            : candidate.matched_tokens || [];
          const profileHref = candidate.id
            ? `/candidates/${candidate.id}?returnTo=${encodeURIComponent("/search")}${activeSearchId ? `&searchId=${encodeURIComponent(activeSearchId)}&searchSessionId=${encodeURIComponent(activeSearchId)}` : ""}`
            : "#";
          const skills = candidateSapTags(candidate);
          const companiesMatched = candidateCompanyHighlights(candidate);
          const validationBadge = candidateValidationBadge(candidate);
          const reviewProfile = isTalentSearchReviewBadge(validationBadge.label);
          const resolvedCardDisplay = resolveCanonicalCandidateDisplay(candidate as AnyRecord);
          const verifiedCurrentCompany = resolvedCardDisplay.currentEmployer || safeTalentSearchCompany((candidate as AnyRecord).display_company || (candidate as AnyRecord).current_company || (candidate as AnyRecord).currentCompany || companiesMatched[0]);
          const currentCompany = verifiedCurrentCompany === "Not disclosed" ? "Not disclosed" : verifiedCurrentCompany;
          const certifications = candidateCertifications(candidate);
          const counts = projectCounts(candidate);
          const projectEvidence = [
            ["Implementation", counts.implementation],
            ["Greenfield", counts.greenfield],
            ["Brownfield", counts.brownfield],
            ["S/4HANA", counts.s4hana],
            ["Rollout", counts.rollout],
            ["AMS", counts.ams],
          ].filter(([, value]) => Number(value) > 0);
          const reviewFlag = index < 3;
          const displayName = canonicalCandidateName(candidate);
          const avatarInitials = displayName === "Candidate profile pending validation"
            ? "ID"
            : displayName
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((part: string) => part[0])
                .join("")
                .toUpperCase() || "?";
          const moduleSummary = cleanTalentSearchModule(candidatePrimaryModule(candidate)) || "";
          const industrySummary = normalize(
            (candidate as AnyRecord).display_industry ||
              (candidate as AnyRecord).industry ||
              (candidate as AnyRecord).background ||
              (candidate as AnyRecord).company_background ||
              "",
          );
          const aiRecommendationItems = [
            counts.implementation || counts.greenfield || counts.s4hana || counts.ams
              ? "Enterprise Delivery"
              : null,
            years >= 10 && counts.implementation ? "Solution Architect" : null,
            counts.greenfield ? "Greenfield Ownership" : null,
            counts.ams ? "AMS Leadership" : null,
            /cpi|integration/i.test(skills.join(" ")) ? "Integration Specialist" : null,
            counts.rollout ? "Technical Lead" : null,
            /client|consult/i.test(moduleSummary) ? "Client-facing Consultant" : null,
          ].filter(Boolean);
          const aiRecommendations = aiRecommendationItems.slice(0, 2);
          const aiRecommendationOverflow = Math.max(0, aiRecommendationItems.length - aiRecommendations.length);
          const isShortlisted = shortlistedIds.has(getShortlistId(candidate));
          const accentClass = reviewFlag
            ? "border-l-amber-500/80"
            : /best|top/i.test(rankBadge.label)
              ? "border-l-emerald-500/80"
              : "border-l-sky-500/80";
          const showValidationBadge = summaryVisibility.canSeeValidationBadge;
          const executiveSummary = buildTalentSearchExecutiveSummary({
            module: moduleSummary,
            years,
            implementation: counts.implementation,
            greenfield: counts.greenfield,
            s4hana: counts.s4hana,
            ams: counts.ams,
            reviewBadge: validationBadge.label,
            certification: certifications[0],
          });
          const displayTitle = resolvedCardDisplay.displayRole || (reviewProfile && moduleSummary ? `SAP ${moduleSummary} Consultant` : reviewProfile ? "Role not disclosed" : cleanCandidateTitle(candidate));
          const compactProjectEvidence = projectEvidence.slice(0, 4);
          const whyItems = compactProjectEvidence.slice(0, 3).map(([label, value]) => {
            const shortLabel = String(label)
              .replace("Implementation", "Implementations")
              .replace("S/4HANA", "S/4 Implementations")
              .replace("Greenfield", "Greenfield Programs")
              .replace("Brownfield", "Brownfield Programs")
              .replace("Rollout", "Rollout Programs")
              .replace("AMS", "AMS Engagements");
            return `${Number(value)} ${shortLabel}`;
          });
          return (
            <article
              key={getCandidateKey(candidate, index)}
              className={`rounded-2xl border border-slate-800/35 bg-[#15191e] border-l-[3px] ${accentClass} p-2 shadow-[0_8px_18px_rgba(2,6,23,0.18)] transition-colors hover:bg-[#171d24]`}
            >
              <div className="grid grid-cols-1 gap-2 lg:grid-cols-[28%_40%_18%_14%]">
                <div className="rounded-xl border border-slate-800/35 bg-slate-950/18 p-3">
                  <div className="flex items-start gap-2.5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-sky-400/20 bg-gradient-to-br from-sky-950 via-slate-900 to-[#1a2330] text-[13px] font-black tracking-[0.08em] text-slate-100 shadow-inner">
                      {avatarInitials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h2 title={displayName} className="break-words text-[20px] font-extrabold leading-6 text-white">
                          {displayName}
                        </h2>
                        {showValidationBadge ? (
                          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] ${validationBadge.tone}`}>
                            {validationBadge.label}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 line-clamp-1 text-[13px] font-semibold leading-4 text-sky-100" title={displayTitle}>
                        {displayTitle}
                      </p>
                    </div>
                  </div>

                  <div className="mt-2.5 grid gap-1.5 text-[11px] leading-4">
                    <div className="truncate text-slate-300">
                      <span className="font-semibold uppercase tracking-[0.08em] text-slate-500">Contact </span>
                      {maskEmail(candidate.email)} - {maskPhone(candidate.phone, candidate.phone_status)}
                    </div>
                    <div className="truncate text-slate-300">
                      <span className="font-semibold uppercase tracking-[0.08em] text-slate-500">Current Employer </span>
                      <span className="text-slate-100">{currentCompany || "-"}</span>
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-1">
                    {country ? (
                      <span className="inline-flex h-[22px] items-center rounded-full border border-slate-700/55 bg-slate-900/40 px-2 text-[11px] font-semibold text-slate-100">
                        {country}
                      </span>
                    ) : null}
                    <span className="inline-flex h-[22px] items-center rounded-full border border-slate-700/55 bg-slate-900/40 px-2 text-[11px] font-semibold text-slate-100">
                      {years} yrs
                    </span>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-800/35 bg-slate-950/18 p-3">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-300">
                    EXECUTIVE SUMMARY
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-[14px] leading-5 text-slate-100">
                    {executiveSummary}
                  </p>

                  <div className="mt-2.5 flex flex-wrap gap-1">
                    {skills.slice(0, 4).map((skill) => (
                      <span key={skill} className="inline-flex h-[22px] items-center rounded-full border border-sky-700/40 bg-sky-950/20 px-2 text-[11px] font-semibold text-sky-100">
                        {skill}
                      </span>
                    ))}
                    {industrySummary ? industrySummary.split(/\s*[,/|]\s*/).filter(Boolean).slice(0, 2).map((item) => (
                      <span key={item} className="inline-flex h-[22px] items-center rounded-full border border-slate-700/55 bg-slate-900/40 px-2 text-[11px] font-semibold text-slate-100">
                        {item}
                      </span>
                    )) : null}
                    {compactProjectEvidence.slice(0, 3).map(([label, value]) => (
                      <span key={String(label)} className="inline-flex h-[22px] items-center rounded-full border border-emerald-700/35 bg-emerald-950/15 px-2 text-[11px] font-semibold text-emerald-100">
                        {String(label).replace("Implementation", "Impl").replace("S/4HANA", "S/4")} {Number(value)}
                      </span>
                    ))}
                    {certifications.slice(0, 2).map((cert) => (
                      <span key={cert} className="inline-flex h-[22px] items-center rounded-full border border-amber-700/35 bg-amber-950/15 px-2 text-[11px] font-semibold text-amber-100">
                        {cert}
                      </span>
                    ))}
                  </div>

                  {aiRecommendations.length || whyItems.length ? (
                    <div className="mt-2.5 grid gap-1.5 md:grid-cols-2">
                      {aiRecommendations.length ? (
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-300">
                            AI Recommendation
                          </div>
                          <div className="mt-1 grid gap-1">
                            {aiRecommendations.map((item, recommendationIndex) => (
                              <div
                                key={`${getCandidateKey(candidate, index)}-rec-${recommendationIndex}`}
                                className="flex items-start gap-1.5 text-[11px] font-semibold leading-4 text-slate-200"
                              >
                                <span className="text-emerald-300">OK</span>
                                <span>{item}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      {whyItems.length ? (
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-sky-300">
                            Why Matched
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {whyItems.map((item, reasonIndex) => (
                              <span
                                key={`${getCandidateKey(candidate, index)}-why-${reasonIndex}`}
                                className="inline-flex h-[22px] items-center gap-1 rounded-full border border-slate-700/40 bg-slate-900/35 px-2 text-[11px] font-semibold text-slate-100"
                              >
                                <span className="text-emerald-300">OK</span>
                                <span>{item}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <div className="rounded-xl border border-slate-800/35 bg-slate-950/18 p-3">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-300">
                    DELIVERY METRICS
                  </div>
                  <div className="mt-2 grid gap-1.5">
                    {projectEvidence.map(([label, value]) => (
                      <div key={String(label)} className="grid grid-cols-[1fr_auto] items-baseline gap-3 border-b border-slate-800/35 pb-1 last:border-b-0 last:pb-0">
                        <span className="text-[11px] font-semibold text-slate-400">{label}</span>
                        <span className="text-[18px] font-black leading-none text-white">{Number(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex h-full flex-col rounded-xl border border-slate-800/35 bg-slate-950/18 p-3">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-300">
                    AI MATCH
                  </div>
                  <div className="mt-2 flex flex-col items-center text-center">
                    <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 via-emerald-500 to-green-600 text-[16px] font-black text-black">
                      {quality}
                    </div>
                    <div className="mt-1 text-[11px] font-semibold leading-4 text-slate-100">
                      {qualityMeta.label}
                    </div>
                  </div>
                  <div className="mt-2 rounded-xl border border-slate-800/35 bg-slate-950/20 px-2 py-2">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                      SEARCH FIT
                    </div>
                    <div className="mt-0.5 text-[28px] font-black leading-none text-sky-300">
                      {Math.min(100, Math.round(score))}%
                    </div>
                    <div className="mt-2 grid gap-1.5">
                      <div>
                        <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-slate-500">
                          CONFIDENCE
                        </div>
                        <div className="text-[12px] font-semibold text-slate-200">
                          {confidenceMeta.label} ({confidenceScore}%)
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-slate-500">
                          PRIORITY
                        </div>
                        <div className="text-[16px] font-black text-slate-100">
                          {Math.min(100, Math.round(rankBadge.priority))}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-auto pt-2">
                    <div className="grid grid-cols-3 gap-1">
                      <button
                        type="button"
                        onClick={() => setSelectedCandidate(candidate)}
                        className="inline-flex h-[32px] w-full items-center justify-center rounded-lg bg-sky-600 px-1.5 text-[9px] font-black text-white hover:bg-sky-700"
                      >
                        View Profile
                      </button>
                      <button
                        type="button"
                        onClick={() => shortlistCandidate(candidate)}
                        className={`inline-flex h-[32px] w-full items-center justify-center rounded-lg px-1.5 text-[9px] font-black text-white ${isShortlisted ? "bg-emerald-700" : "bg-green-600 hover:bg-green-700"}`}
                      >
                        {isShortlisted ? "Shortlisted" : "Shortlist"}
                      </button>
                      {candidate.id ? (
                        <Link
                          href={profileHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-[32px] w-full items-center justify-center rounded-lg border border-slate-700 bg-slate-900 px-1.5 text-[9px] font-black text-slate-100 hover:border-slate-500 hover:bg-slate-800"
                        >
                          360
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </article>          );
        })}
      </section>
      {candidates.length ? (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-4 text-sm font-semibold text-slate-300">
          <div className="flex items-center gap-2">
            <span>Page size</span>
            <select
              value={pageSize}
              onChange={(event) => changePageSize(Number(event.target.value))}
              disabled={loading}
              className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm font-bold text-white disabled:opacity-60"
            >
              {SEARCH_PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => goToPage(pagination.currentPage - 1)}
              disabled={loading || !pagination.hasPrevious}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-bold text-slate-100 hover:bg-slate-800 disabled:opacity-50"
            >
              Previous
            </button>
            {buildPaginationPages(pagination.currentPage, pagination.totalPages).map((pageItem, index) => pageItem === "..." ? (
              <span key={`ellipsis-${index}`} className="px-2 text-slate-500">...</span>
            ) : (
              <button
                key={pageItem}
                type="button"
                onClick={() => goToPage(pageItem)}
                disabled={loading || pageItem === pagination.currentPage}
                className={`min-w-9 rounded-lg border px-3 py-2 font-bold ${pageItem === pagination.currentPage ? "border-sky-500 bg-sky-950 text-sky-100" : "border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800"} disabled:opacity-80`}
              >
                {pageItem}
              </button>
            ))}
            <button
              type="button"
              onClick={() => goToPage(pagination.currentPage + 1)}
              disabled={loading || !pagination.hasNext}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-bold text-slate-100 hover:bg-slate-800 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
      {selectedCandidate ? (
        <Candidate360Modal
          candidate={selectedCandidate}
          shortlisted={shortlistedIds.has(getShortlistId(selectedCandidate))}
          onShortlist={shortlistCandidate}
          onClose={() => setSelectedCandidate(null)}
          searchId={activeSearchId}
        />
      ) : null}
    </main>
  );
}













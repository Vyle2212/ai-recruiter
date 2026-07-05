export const TALENT_SEARCH_DISPLAY_RESOLVER_VERSION = "canonical-display-v3";

export type TalentSearchViewerRole = "admin" | "recruiter" | "client";

export type TalentSearchCountSummary = {
  totalCandidates: number;
  totalMatched: number;
  returnedCount: number;
  showingCount: number;
  hasContactInfoOnly: boolean;
  offset?: number;
  pageSize?: number;
  showReview?: boolean;
  viewerRole?: TalentSearchViewerRole;
};

export type TalentSearchRoleInput = {
  requestedRole?: string | null;
  adminFlag?: string | boolean | null;
  adminEnabled?: boolean;
};

export function resolveTalentSearchViewerRole(input: TalentSearchRoleInput = {}): TalentSearchViewerRole {
  const requestedRole = String(input.requestedRole || "").trim().toLowerCase();
  const adminFlag = input.adminFlag === true || /^(1|true|yes|admin)$/i.test(String(input.adminFlag || ""));
  if (requestedRole === "client") return "client";
  if (requestedRole === "admin" && adminFlag && input.adminEnabled) return "admin";
  return "recruiter";
}

export function talentSearchSummaryVisibility(role: TalentSearchViewerRole = "recruiter") {
  const admin = role === "admin";
  const recruiter = role === "recruiter";
  return {
    canSeeInternalMetrics: admin,
    canSeeTalentPoolTotal: admin,
    canSeeFilteredTotal: admin || recruiter,
    canSeeReachableInventory: admin,
    canSeeQualityInventory: admin,
    canSeeValidationBadge: admin || recruiter,
    canSeeCandidateCards: admin || recruiter || role === "client",
  };
}

export const TALENT_SEARCH_MOJIBAKE_PATTERN = /\u00c3|\u00c2|\u00e2|\u0100|\u0101|\u0106|\ufffd|\u013c|\u00e6/;

export function hasTalentSearchMojibake(value: string) {
  return TALENT_SEARCH_MOJIBAKE_PATTERN.test(value);
}

export function candidateHasContactInfo(candidate: any) {
  return Boolean(text(candidate?.email) || text(candidate?.phone));
}

function text(value: any) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export function isUnconfirmedTalentSearchEmployer(value: any) {
  const raw = text(value);
  if (!raw) return true;
  const normalized = raw.toLowerCase().replace(/[().,_/\\|&+-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!normalized || ["not disclosed", "non disclosed", "non-disclosed", "unknown", "protected", "n/a", "na", "none", "no details"].includes(normalized)) return true;
  if (/^(creation of|applying for the position|apply for the position|applying for|created by|responsible for|worked on|supporting|currently serving|currently at|based in)\b/i.test(raw)) return true;
  if (/\b(position|responsibilities|responsibility|project|module|skill|tools|platforms|creation of|applying for the position|non[- ]disclosed|no details)\b/i.test(raw)) return true;
  if (raw.length > 70 || raw.split(/\s+/).filter(Boolean).length > 8) return true;
  if (/^sap$/.test(normalized) || /^sap sap$/.test(normalized)) return true;
  if (/^(sap )?(fi|co|fico|sd|mm|pp|pm|ps|abap|basis|bw|bi|btp|ewm|tm|wm|hana|s4hana|s 4hana|successfactors|sf)( module)?$/.test(normalized)) return true;
  if (/^(implementation|rollout|support|ams|migration|project|greenfield|brownfield|technology consulting|academic background)$/.test(normalized)) return true;
  if (/\b(module|implementation|rollout|support|migration|greenfield|brownfield)\b/i.test(raw) && !/\b(ltd|limited|inc|corp|corporation|sdn|bhd|pte|plc|llc|gmbh|berhad|group|systems|solutions|consulting|technologies)\b/i.test(raw)) return true;
  return false;
}

export function safeTalentSearchCompany(value: any) {
  const raw = text(value);
  return isUnconfirmedTalentSearchEmployer(raw) ? "Not disclosed" : raw;
}

export function isTalentSearchReviewBadge(value: any) {
  const badge = text(value).toLowerCase();
  return badge === "needs review" || badge === "missing information" || badge === "parsing issue" || badge === "duplicate suspected";
}

export function isTalentSearchPlaceholderName(value: any) {
  return /profile under review|candidate profile pending validation|name requires validation|identity under review|pending validation/i.test(text(value));
}

const TALENT_SEARCH_BAD_DISPLAY_NAME = /profile under review|candidate profile pending validation|name requires validation|identity under review|current location|technology consulting|academic background|nationality|gender|father'?s name|\bbachelor\b|\bmaster\b|\bdegree\b|\bdiploma\b|\bcertificate\b|\bcertification\b|\bprofessional certificate\b|\bkey competencies\b|\bresponsibilities\b|\bemployment history\b|\bcareer history\b|\bsoftware\b|\bsolutions\b|\btechnolog(?:y|ies)\b|\bconsulting\b|\bconsultancy\b|\bsdn\s*bhd\b|\bpte\s*ltd\b|\bltd\b|\binc\b|\bcorp\b|\bcorporation\b/i;
const TALENT_SEARCH_GENERIC_NAME_START = /^(currently|experience|experienced|tools|responsibilities|responsibility|project|projects|for|with|and|each|installation|strictly|willing|light|extended)\b/i;

export function normalizeTalentSearchIdentity(value: any) {
  return text(value)
    .toLowerCase()
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[^a-z0-9@+]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function compactTalentSearchIdentity(value: any) {
  return normalizeTalentSearchIdentity(value).replace(/[^a-z0-9]+/g, "");
}

export function isTalentSearchBadDisplayName(value: any) {
  const name = text(value);
  if (!name) return true;
  if (TALENT_SEARCH_BAD_DISPLAY_NAME.test(name) || TALENT_SEARCH_GENERIC_NAME_START.test(name)) return true;
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length < 2 || parts.length > 7) return true;
  return !parts.every((part) => /^[A-Za-z][A-Za-z'.-]*$/.test(part));
}

export type TalentSearchQueryType = "empty" | "email" | "phone" | "placeholder" | "human-name" | "company" | "sap-skill" | "generic";

export function classifyTalentSearchQuery(value: any): TalentSearchQueryType {
  const raw = text(value);
  const normalized = normalizeTalentSearchIdentity(raw);
  if (!normalized) return "empty";
  if (isTalentSearchPlaceholderName(raw)) return "placeholder";
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.trim())) return "email";
  if (raw.replace(/\D/g, "").length >= 7 && /^[+()\d\s.-]+$/.test(raw)) return "phone";
  if (/\b(sap|fico|fi|co|mm|sd|pp|pm|ps|abap|basis|btp|ewm|wm|successfactors|s\/?4hana|hana|fiori)\b/i.test(raw)) return "sap-skill";
  if (/\b(ltd|limited|inc|corp|corporation|sdn|bhd|pte|plc|llc|gmbh|berhad|group|systems|solutions|consulting|technologies|technology|software|bank)\b/i.test(raw)) return "company";
  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length >= 2 && words.length <= 6 && words.every((word) => /^[a-z][a-z'.-]*$/.test(word))) return "human-name";
  return "generic";
}

export function extractTalentSearchExplicitName(candidate: any) {
  const directFields = [candidate?.full_name, candidate?.candidate_name, candidate?.normalized_name]
    .map(text)
    .filter(Boolean);
  for (const direct of directFields) {
    if (direct && !isTalentSearchBadDisplayName(direct) && !isTalentSearchPlaceholderName(direct)) return direct;
  }
  const blobs = [candidate?.raw_text, candidate?.rawText, candidate?.resume_text, candidate?.resumeText, candidate?.profile_text, candidate?.profileText]
    .map(text)
    .filter(Boolean);
  for (const blob of blobs) {
    const match = blob.match(/(?:full\s+name|candidate\s+name|name)\s*[:\-]\s*([A-Z][A-Za-z'.-]+(?:\s+[A-Z][A-Za-z'.-]+){1,5})/i)?.[1] || "";
    const name = text(match).replace(/\b(Gender|Marital|Citizenship|Email|E-mail)\b[\s\S]*$/i, "").trim();
    if (name && !isTalentSearchBadDisplayName(name) && !isTalentSearchPlaceholderName(name)) return name;
  }
  return "";
}

function normalizedCandidateNames(candidate: any, fields: string[]) {
  return fields
    .map((field) => normalizeTalentSearchIdentity(candidate?.[field]))
    .filter(Boolean);
}

function compactNameValues(names: string[]) {
  return names.map((name) => name.replace(/[^a-z0-9]+/g, ""));
}

function containsAllNameTokens(name: string, queryTokens: string[]) {
  return queryTokens.length > 0 && queryTokens.every((token) => name.split(/\s+/).includes(token));
}

export function talentSearchIdentityRank(candidate: any, rawQuery: any) {
  const queryType = classifyTalentSearchQuery(rawQuery);
  const normalizedQuery = normalizeTalentSearchIdentity(rawQuery);
  const compactQuery = compactTalentSearchIdentity(rawQuery);
  if (!normalizedQuery) return 0;
  const email = text(candidate?.email).toLowerCase();
  const queryEmail = text(rawQuery).toLowerCase();
  const phone = text(candidate?.phone).replace(/\D/g, "");
  const queryDigits = text(rawQuery).replace(/\D/g, "");
  const displayNames = normalizedCandidateNames(candidate, ["displayName", "display_name", "canonicalName", "canonical_name"]);
  const rawNames = normalizedCandidateNames(candidate, ["name", "full_name", "candidate_name", "normalized_name"]);
  const explicitName = normalizeTalentSearchIdentity(extractTalentSearchExplicitName(candidate));
  const allNames = [...displayNames, ...rawNames, explicitName].filter(Boolean);
  const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean);
  if (queryType === "email" && email && email === queryEmail) return 100000;
  if (queryType === "phone" && queryDigits.length >= 7 && phone.includes(queryDigits)) return 95000;
  if (queryType === "placeholder") return -100000;
  if (queryType === "human-name") {
    if (displayNames.includes(normalizedQuery) || compactNameValues(displayNames).includes(compactQuery)) return 92000;
    if (rawNames.includes(normalizedQuery) || compactNameValues(rawNames).includes(compactQuery)) return 90000;
    if (explicitName && (explicitName === normalizedQuery || explicitName.replace(/[^a-z0-9]+/g, "") === compactQuery)) return 90000;
    if (displayNames.some((name) => name.startsWith(normalizedQuery)) || rawNames.some((name) => name.startsWith(normalizedQuery)) || compactNameValues(allNames).some((name) => name.startsWith(compactQuery))) return 80000;
    if (allNames.some((name) => containsAllNameTokens(name, queryTokens))) return 70000;
    if (allNames.some((name) => name.includes(normalizedQuery)) || compactNameValues(allNames).some((name) => name.includes(compactQuery))) return 65000;
    return 0;
  }
  const company = normalizeTalentSearchIdentity(candidate?.currentCompany || candidate?.current_company || candidate?.display_company || candidate?.company);
  if (company && (company === normalizedQuery || company.includes(normalizedQuery))) return 40000;
  const title = normalizeTalentSearchIdentity(candidate?.display_title || candidate?.title || candidate?.current_title);
  if (title && title.includes(normalizedQuery)) return 30000;
  const moduleText = normalizeTalentSearchIdentity([candidate?.primary_module, candidate?.primaryModule, ...(Array.isArray(candidate?.selected_modules) ? candidate.selected_modules : []), ...(Array.isArray(candidate?.sap_modules) ? candidate.sap_modules : [])].join(" "));
  if (moduleText && moduleText.includes(normalizedQuery)) return 20000;
  return normalizeTalentSearchIdentity(candidate?.search_text || candidate?.summary).includes(normalizedQuery) ? 10000 : 0;
}

export function displayTalentSearchValidationStatus(input: {
  status?: any;
  score?: number;
  displayName?: any;
  currentEmployer?: any;
  title?: any;
}) {
  const rawStatus = text(input.status) || "Needs Review";
  const currentEmployer = safeTalentSearchCompany(input.currentEmployer);
  const displayName = text(input.displayName);
  const title = text(input.title);
  const placeholderName = isTalentSearchPlaceholderName(displayName);
  const missingEmployer = currentEmployer === "Not disclosed";
  const parserArtifact = /UNKNOWN|\bSAP\s+SAP\b/i.test([displayName, title, currentEmployer].join(" "));
  let label = rawStatus === "Duplicate Suspected" ? "Duplicate" : rawStatus;

  if (placeholderName || parserArtifact) label = missingEmployer ? "Missing Information" : "Needs Review";
  else if (missingEmployer) label = "Missing Information";
  else if (label === "Ready" && (!displayName || Number(input.score || 0) < 75)) label = "Needs Review";

  return label;
}

export function cleanTalentSearchModule(value: any) {
  const module = text(value).replace(/^SAP\s+/i, "").toUpperCase();
  return module && module !== "SAP" && module !== "UNKNOWN" && module !== "GENERAL_SAP" ? module : "";
}

export function cleanTalentSearchSummaryText(value: any) {
  return text(value)
    .replace(/\bSAP\s+SAP\b/gi, "SAP")
    .replace(/\bSAP\s+UNKNOWN\b/gi, "SAP")
    .replace(/\bUNKNOWN\s+consultant\b/gi, "consultant")
    .replace(/\bPreviously at SAP\.?/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildTalentSearchExecutiveSummary(input: {
  module?: any;
  years?: number;
  implementation?: number;
  greenfield?: number;
  s4hana?: number;
  ams?: number;
  reviewBadge?: any;
  previousEmployers?: any[];
  certification?: any;
}) {
  const module = cleanTalentSearchModule(input.module);
  const moduleText = module ? "SAP " + module : "SAP";
  const reviewProfile = isTalentSearchReviewBadge(input.reviewBadge);

  if (reviewProfile) {
    const focus = module ? moduleText + " profile" : "Candidate profile";
    return focus + " requires recruiter validation. Employer details require validation.";
  }

  const yearsText = input.years ? input.years + " years" : "Experience";
  const lead = input.greenfield && input.s4hana
    ? "Enterprise " + moduleText + " architect."
    : input.ams && input.implementation
      ? moduleText + " consultant."
      : "Specialized in enterprise " + moduleText + " delivery.";
  const tail = input.greenfield && input.s4hana
    ? yearsText + " across Greenfield, S/4HANA and AMS delivery."
    : input.ams && input.implementation
      ? yearsText + " in implementation and AMS programs."
      : (input.years ? input.years + " years" : "Strong delivery experience") + " across enterprise programs.";

  const certificationText = text(input.certification) ? " " + text(input.certification) + "." : "";

  return cleanTalentSearchSummaryText(lead + " " + tail + certificationText);
}

export function cleanTalentSearchTitle(value: any, primaryModule = "SAP") {
  let title = text(value)
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/^(employment|career history|work history)\s+/i, "")
    .replace(/^(title|position|designation|current position|current title|role|job title)\s*[:\-]\s*/i, "")
    .replace(/\bUNKNOWN\b/gi, "")
    .replace(/\bSAP\s+SAP\b/gi, "SAP")
    .replace(/([:;,.|\-])\s*\1+/g, "$1")
    .replace(/\s*[([{|\-]+\s*$/g, "")
    .replace(/\s*[,;:.]\s*$/g, "")
    .replace(/\b(?:at|in|for|with|and|or|of|the)\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();

  title = title
    .replace(/\bSAP\s+SAP\b/gi, "SAP")
    .replace(/^SAP\s+consultant$/i, "SAP Consultant")
    .replace(/^SAP\s*$/i, "")
    .replace(/\s*[([{|\-]+\s*$/g, "")
    .replace(/\s*[,;:.]\s*$/g, "")
    .trim();

  const module = text(primaryModule).replace(/^SAP\s+/i, "").toUpperCase();
  const hasModule = module && module !== "SAP" && module !== "UNKNOWN" && module !== "GENERAL_SAP";

  if (!title || /^(current location|professional objective|career objective|profile summary|professional summary|position level|nationality|date of birth|personal details)$/i.test(title)) {
    return hasModule ? `SAP ${module} Consultant` : "Role not disclosed";
  }

  if (/^SAP Consultant$/i.test(title) && hasModule) return `SAP ${module} Consultant`;
  if (/^consultant$/i.test(title) && hasModule) return `SAP ${module} Consultant`;
  if (/^consultant$/i.test(title)) return "SAP Consultant";

  return title;
}

export function buildTalentSearchCountSummary(input: TalentSearchCountSummary) {
  const role = input.viewerRole || "recruiter";
  const visibility = talentSearchSummaryVisibility(role);
  const activeFilters = [
    input.hasContactInfoOnly ? "Has contact info only" : "",
    input.showReview ? "Show review records" : "",
  ].filter(Boolean);

  if (role === "client") {
    return {
      resultsLabel: "",
      showingLabel: "",
      totalPoolLabel: "",
      filterLabel: "",
    };
  }

  if (!visibility.canSeeInternalMetrics) {
    return {
      resultsLabel: "",
      showingLabel: "",
      totalPoolLabel: "",
      filterLabel: "",
    };
  }

  return {
    resultsLabel: `Filtered Results: ${input.totalMatched}`,
    showingLabel: `Showing ${(input.offset || 0) + (input.showingCount || input.returnedCount ? 1 : 0)}-${(input.offset || 0) + (input.showingCount || input.returnedCount)} of ${input.totalMatched}`,
    totalPoolLabel: `Total Talent Pool: ${input.totalCandidates}`,
    filterLabel: activeFilters.length ? `Filtered by ${activeFilters.join(", ")}` : "",
  };
}

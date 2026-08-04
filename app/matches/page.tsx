"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";

type AnyRecord = Record<string, any>;

type Job = {
  id: string;
  title: string;
  primary_module?: string;
  primaryModule?: string;
  required_years?: number;
  requiredYears?: number;
};

type MatchCandidate = AnyRecord;

type ViewerRole = "client" | "recruiter" | "candidate" | "admin";

type ContactAccess = {
  canView: boolean;
  reason: string;
  cta: string;
  role: ViewerRole;
};


const MATCHES_CACHE_KEY = "sapTalentHub.matches.pageState.v1";
const SEARCH_SESSION_PREFIX = "sapTalentHub.searchSession.v1.";
const SEARCH_SESSION_STORE = "sapTalentHub.searchSessions.v1";

function getMatchCandidateId(candidate: MatchCandidate) {
  return String(
    candidate.id ||
      candidate.candidate_id ||
      candidate.candidate_slug ||
      candidate.slug ||
      candidate.email ||
      "",
  ).trim();
}

function getCachedMatchesState(): AnyRecord {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.sessionStorage.getItem(MATCHES_CACHE_KEY) || window.localStorage.getItem(MATCHES_CACHE_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

function createSearchSessionId(state: AnyRecord) {
  if (state.searchSessionId) return String(state.searchSessionId);
  const modulePart = String(state.primaryModule || state.module || "search").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  return `search-${modulePart}-${Date.now().toString(36)}`;
}

function writeSearchSessionSnapshot(state: AnyRecord) {
  if (typeof window === "undefined") return "";
  const matches = Array.isArray(state.matches) ? state.matches : [];
  const candidateIds = Array.isArray(state.candidateIds)
    ? state.candidateIds.map(String).filter(Boolean)
    : matches.map(getMatchCandidateId).filter(Boolean);
  const searchSessionId = createSearchSessionId({ ...state, candidateIds });

  if (!matches.length || !candidateIds.length) return searchSessionId;

  const snapshot = {
    ...state,
    searchSessionId,
    matches,
    candidateIds,
    ranking: candidateIds.map((candidateId: string, index: number) => ({ candidateId, rank: index + 1 })),
    filters: {
      selectedJobId: state.selectedJobId || "",
      clientMode: Boolean(state.clientMode),
      apiMode: state.apiMode || "",
      module: state.primaryModule || state.module || "",
    },
    module: state.primaryModule || state.module || "",
    primaryModule: state.primaryModule || state.module || "",
    savedAt: new Date().toISOString(),
  };

  try {
    window.sessionStorage.setItem(SEARCH_SESSION_PREFIX + searchSessionId, JSON.stringify(snapshot));
    window.sessionStorage.setItem(MATCHES_CACHE_KEY, JSON.stringify(snapshot));
    window.localStorage.setItem(SEARCH_SESSION_PREFIX + searchSessionId, JSON.stringify(snapshot));
    window.localStorage.setItem(MATCHES_CACHE_KEY, JSON.stringify(snapshot));
    const sessionIndex = JSON.parse(window.localStorage.getItem(SEARCH_SESSION_STORE) || "{}");
    window.localStorage.setItem(SEARCH_SESSION_STORE, JSON.stringify({ ...sessionIndex, [searchSessionId]: { module: snapshot.primaryModule, count: candidateIds.length, savedAt: snapshot.savedAt } }));
  } catch {}

  return searchSessionId;
}

type AiInsight = {
  ranking: number;
  confidence: number;
  talentIntelligenceScore: number;
  marketPositioning: string;
  sapExpertiseLevel: string;
  sapCareerLevel: string;
  executiveSummary: string;
  recommendation: string;
  whySelected: string[];
  validationNotes: string[];
  recruiterRisks: string[];
  bestFor: string[];
  sapSignals: string[];
  hiringRisk: string;
  timeToProductivity: string;
  interviewRecommendation: string;
  rankingExplanation: string[];
  offerAcceptanceProbability: number;
  offerDrivers: string[];
  offerRisks: string[];
  riskRadar: {
    counterOfferRisk: number;
    jobHoppingRisk: number;
    relocationRisk: number;
    noticePeriodRisk: number;
    overallRiskScore: number;
  };
  salaryBenchmark: {
    marketRange: string;
    candidatePositioning: string;
    currency: string;
  };
};

const moduleBestForMap: Record<string, string[]> = {
  BASIS: ["SAP technical platform", "S/4HANA conversion support", "System administration"],
  ABAP: ["ABAP development", "Custom enhancement", "Technical integration"],
  FICO: ["Finance transformation", "FICO implementation", "S/4HANA finance migration"],
  FI: ["Record-to-Report", "Finance implementation", "S/4HANA finance"],
  CO: ["Controlling implementation", "Costing process", "Management accounting"],
  MM: ["Procure-to-Pay", "MM implementation", "Logistics transformation"],
  SD: ["Order-to-Cash", "Sales & Distribution rollout", "Commercial process transformation"],
  PP: ["Plan-to-Produce", "Production planning", "Manufacturing process transformation"],
  PM: ["Plant maintenance", "Asset maintenance", "Maintenance process optimization"],
  PS: ["Project systems", "Project controlling", "Capital project management"],
  QM: ["Quality management", "Inspection process", "Manufacturing quality control"],
  WM: ["Warehouse management", "Inventory movement", "Logistics execution"],
  EWM: ["Extended warehouse management", "Warehouse automation", "S/4HANA logistics execution"],
  TM: ["Transportation management", "Freight process optimization", "Logistics execution"],
  BW: ["Data warehousing", "SAP reporting", "Analytics transformation"],
  BW4HANA: ["SAP BW/4HANA", "Enterprise data warehousing", "Analytics modernization"],
  SAC: ["SAP Analytics Cloud", "Planning and reporting", "Executive dashboarding"],
  BPC: ["Budgeting and planning", "Financial consolidation", "Planning transformation"],
  BTP: ["Enterprise SAP BTP Leadership", "Regional Transformation Programs", "Executive Stakeholder Engagement"],
  CPI: ["Cloud integration", "API integration", "SAP middleware"],
  PI: ["SAP integration", "Middleware implementation", "Interface management"],
  PO: ["SAP integration", "Middleware implementation", "Interface management"],
  HCM: ["Human capital management", "HR process transformation", "Payroll administration"],
  SUCCESSFACTORS: ["SuccessFactors implementation", "Cloud HR transformation", "Employee lifecycle process"],
  ARIBA: ["Source-to-Pay", "Supplier collaboration", "Procurement transformation"],
  MDG: ["Master data governance", "Data quality improvement", "Enterprise master data management"],
  GRC: ["Governance risk compliance", "Access control", "Security and compliance"],
  SECURITY: ["SAP security", "Role authorization", "Access governance"],
  ISU: ["Utilities process", "Billing and customer service", "Industry solution implementation"],
  CRM: ["Customer relationship management", "Sales/service process", "Customer engagement"],
  C4C: ["SAP Cloud for Customer", "CRM cloud transformation", "Customer experience process"],
  IBP: ["Integrated business planning", "Demand planning", "Supply planning"],
  APO: ["Advanced planning optimization", "Demand/supply planning", "Supply chain planning"],
  PPDS: ["Production planning detailed scheduling", "Manufacturing planning", "S/4HANA embedded PP/DS"],
  VIM: ["Vendor invoice management", "OpenText VIM", "AP automation"],
  OPENTEXT: ["Document management", "Invoice automation", "Enterprise content management"],
  CFIN: ["Central Finance", "Finance transformation", "S/4HANA finance architecture"],
  GROUPREPORTING: ["Group Reporting", "Financial consolidation", "S/4HANA reporting"],
  TREASURY: ["Treasury management", "Cash management", "Financial risk management"],
  CONCUR: ["Travel and expense management", "Concur implementation", "Expense process transformation"],
  FIELDGLASS: ["External workforce management", "Services procurement", "Vendor workforce process"],
  CPQ: ["Configure Price Quote", "Sales process automation", "Quote-to-cash transformation"],
  DATASPHERE: ["SAP Datasphere", "Data fabric", "Enterprise analytics modernization"],
  INTEGRATIONSUITE: ["SAP Integration Suite", "Cloud integration", "Enterprise integration architecture"],
  BUILDAPPS: ["SAP Build Apps", "Low-code application development", "Business process extension"],
  BUILDPROCESSAUTOMATION: ["SAP Build Process Automation", "Workflow automation", "Process automation"],
  EVENTMESH: ["Event-driven architecture", "SAP Event Mesh", "Cloud integration eventing"],
};

const sapModuleSynonymMap: Record<string, string> = {
  FINANCE: "FI",
  SAPFINANCE: "FI",
  RTR: "FI",
  R2R: "FI",
  RECORDTOREPORT: "FI",
  RECORDTOREPORTING: "FI",
  CONTROLLING: "CO",
  MANAGEMENTACCOUNTING: "CO",
  COSTING: "CO",
  PROCUREMENT: "MM",
  PROCURETOPAY: "MM",
  P2P: "MM",
  PURCHASING: "MM",
  SOURCETOPAY: "ARIBA",
  STP: "ARIBA",
  SALES: "SD",
  SALESDISTRIBUTION: "SD",
  ORDERTOCASH: "SD",
  OTC: "SD",
  O2C: "SD",
  ORDERMANAGEMENT: "SD",
  LOGISTICS: "MM",
  WAREHOUSE: "EWM",
  WAREHOUSEMANAGEMENT: "WM",
  EXTENDEDWAREHOUSEMANAGEMENT: "EWM",
  TRANSPORTATION: "TM",
  TRANSPORTATIONMANAGEMENT: "TM",
  PRODUCTIONPLANNING: "PP",
  MANUFACTURING: "PP",
  PLANTMAINTENANCE: "PM",
  MAINTENANCE: "PM",
  QUALITYMANAGEMENT: "QM",
  PROJECTSYSTEMS: "PS",
  PROJECTSYSTEM: "PS",
  HR: "HCM",
  HUMANRESOURCES: "HCM",
  HUMANCAPITALMANAGEMENT: "HCM",
  HXM: "SUCCESSFACTORS",
  SF: "SUCCESSFACTORS",
  SFEC: "SUCCESSFACTORS",
  SFSF: "SUCCESSFACTORS",
  CLOUDHR: "SUCCESSFACTORS",
  INTEGRATION: "CPI",
  MIDDLEWARE: "PI",
  INTEGRATIONSUITE: "INTEGRATIONSUITE",
  CLOUDINTEGRATION: "CPI",
  ANALYTICS: "BW",
  DATAWAREHOUSE: "BW",
  REPORTING: "BW",
  PLANNING: "SAC",
  ANALYTICSCLOUD: "SAC",
  DATASPHERE: "DATASPHERE",
  MASTERDATA: "MDG",
  MASTERDATAGOVERNANCE: "MDG",
  ACCESSCONTROL: "GRC",
  SECURITYGRC: "GRC",
  AUTHORIZATION: "SECURITY",
  AUTHORISATION: "SECURITY",
  CENTRALFINANCE: "CFIN",
  CFINS4HANA: "CFIN",
  GROUPREPORTING: "GROUPREPORTING",
  VENDORINVOICEMANAGEMENT: "VIM",
  INVOICEAUTOMATION: "VIM",
  OPENTEXTVIM: "VIM",
  LOWCODE: "BUILDAPPS",
  PROCESSAUTOMATION: "BUILDPROCESSAUTOMATION",
  EVENTDRIVEN: "EVENTMESH",
};


const sapTermGroups: Record<string, string[]> = {
  "S/4HANA": ["S/4HANA", "S4HANA", "S4 HANA", "S/4 HANA"],
  "S/4HANA Public Cloud": ["S/4HANA Public Cloud", "SAP S/4HANA Public Cloud"],
  "S/4HANA Private Cloud": ["S/4HANA Private Cloud", "SAP S/4HANA Private Cloud"],
  ECC: ["ECC", "SAP ECC", "ECC 6.0"],
  "RISE with SAP": ["RISE with SAP", "SAP RISE"],
  "GROW with SAP": ["GROW with SAP", "SAP GROW"],
  BTP: ["SAP BTP", "Business Technology Platform"],
  Fiori: ["Fiori", "SAP Fiori", "UI5", "SAPUI5", "Fiori Elements"],
  HANA: ["SAP HANA", "HANA DB"],
  Greenfield: ["greenfield", "green field"],
  Brownfield: ["brownfield", "brown field", "system conversion"],
  Implementation: ["implementation", "end-to-end", "full cycle", "full lifecycle", "full life cycle"],
  Rollout: ["rollout", "roll-out", "template rollout"],
  Migration: ["migration", "conversion", "upgrade", "data migration", "LTMC", "LSMW", "Data Migration Cockpit"],
  Integration: ["integration", "interface", "IDoc", "RFC", "BAPI", "CPI", "PI/PO", "SOAP", "REST", "API", "OData"],
  "ABAP Advanced": ["CDS", "AMDP", "OData", "RAP", "BOPF"],
  WRICEF: ["WRICEF", "RICEFW", "RICEF"],
  Enhancement: ["enhancement", "user exit", "BAdI", "SmartForms", "Adobe Forms", "ALV", "BRF+"],
  Workflow: ["workflow", "SAP Workflow", "BRF+"],
  AMS: ["AMS", "support", "incident", "ticket", "SLA", "L2", "L3", "production support"],
  Testing: ["UAT", "SIT", "unit testing", "regression testing", "test script"],
  Cutover: ["cutover", "go-live", "golive", "hypercare"],
  Security: ["authorization", "roles", "profiles", "GRC", "SoD", "access control"],
  Data: ["master data", "MDG", "data cleansing", "data conversion", "data migration"],
  Activate: ["SAP Activate", "Activate methodology", "Fit-to-Standard"],
  "Project Methodology": ["blueprint", "realization", "fit-gap", "fit gap", "design workshop"],
  "Solution Manager": ["Solution Manager", "SolMan", "ChaRM"],
  VIM: ["OpenText", "VIM", "Vendor Invoice Management"],
  OTC: ["OTC", "O2C", "Order to Cash", "Order-to-Cash"],
  P2P: ["P2P", "Procure to Pay", "Procure-to-Pay"],
  R2R: ["R2R", "RTR", "Record to Report", "Record-to-Report"],
  STP: ["STP", "Source to Pay", "Source-to-Pay"],
  "Central Finance": ["Central Finance", "CFIN", "cFIN"],
  "Group Reporting": ["Group Reporting", "SAP Group Reporting"],
  Datasphere: ["SAP Datasphere", "Datasphere"],
  "Integration Suite": ["SAP Integration Suite", "Integration Suite"],
  "Build Process Automation": ["SAP Build Process Automation", "Build Process Automation"],
  "Event Mesh": ["SAP Event Mesh", "Event Mesh"],
};

function n(value: any, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => String(value || "").trim()).filter(Boolean)));
}

function normalizeModule(value: any) {
  const normalized = String(value || "UNKNOWN")
    .toUpperCase()
    .replace(/^SAP\s+/i, "")
    .replace(/^SAP-/i, "")
    .replace(/^SAP_/i, "")
    .replace(/&/g, "AND")
    .replace(/[\s/_-]/g, "")
    .replace(/\./g, "");

  return sapModuleSynonymMap[normalized] || normalized;
}

function displayModule(value: any) {
  const raw = String(value || "UNKNOWN")
    .toUpperCase()
    .replace(/^SAP\s+/i, "")
    .replace(/^SAP-/i, "")
    .replace(/^SAP_/i, "")
    .trim();

  const normalized = normalizeModule(raw);

  const aliases: Record<string, string> = {
    BW4HANA: "BW/4HANA",
    S4HANA: "S/4HANA",
    SUCCESSFACTORS: "SuccessFactors",
    ISU: "IS-U",
    PPDS: "PP/DS",
    CFIN: "Central Finance",
    GROUPREPORTING: "Group Reporting",
    INTEGRATIONSUITE: "Integration Suite",
    BUILDAPPS: "Build Apps",
    BUILDPROCESSAUTOMATION: "Build Process Automation",
    EVENTMESH: "Event Mesh",
  };

  return aliases[normalized] || raw;
}

function textOf(value: any) {
  return JSON.stringify(value || "").toLowerCase();
}

function detectSapTerms(candidate: MatchCandidate) {
  const text = textOf(candidate);

  return Object.entries(sapTermGroups)
    .filter(([_, keywords]) =>
      keywords.some((keyword) => text.includes(keyword.toLowerCase()))
    )
    .map(([group]) => group);
}

function getCandidateName(c: MatchCandidate) {
  return c.name || c.candidate_name || "Review Required";
}

function getCandidateTitle(c: MatchCandidate) {
  return c.title || c.current_title || c.headline || "SAP Consultant";
}

function getCandidateEmail(c: MatchCandidate) {
  return c.email || c.candidate_email || "";
}

function getCandidatePhone(c: MatchCandidate) {
  return c.phone || c.mobile || c.candidate_phone || "";
}

function getScore(c: MatchCandidate) {
  return n(c.score ?? c.matchScore ?? c.finalScore ?? c.calibratedScore);
}

function isClientReady(c: MatchCandidate) {
  return Boolean(c.clientReady || c.isClientReady || c.client_ready);
}

function isStrongMatch(c: MatchCandidate) {
  return Boolean(c.strongMatch || c.isStrongMatch);
}

function getFinalClientReadyFlag(c: MatchCandidate) {
  return Boolean(
    c.clientReady === true ||
      c.isClientReady === true ||
      c.client_ready === true ||
      c.finalClientReady === true ||
      c.passesClientGate === true ||
      c.clientGatePass === true
  );
}

function getRequiredModule(c: MatchCandidate, fallback?: any) {
  return normalizeModule(c.requiredModule || c.required_module || c.jobRequiredModule || fallback || "UNKNOWN");
}

function hasBtpDirectDisplayEvidence(c: MatchCandidate) {
  const primary = getPrimaryModule(c);
  const title = `${getCandidateTitle(c)} ${c.headline || ""}`.toLowerCase();
  return primary === "BTP" || title.includes("sap btp") || title.includes("business technology platform") || title.includes("btp consultant") || title.includes("btp architect") || title.includes("btp developer") || title.includes("btp solution architect");
}

function getBtpAdjacentFramework(c: MatchCandidate) {
  const backendTier = String(c.btpAdjacentTier || "").trim();
  const backendLabel = String(c.btpAdjacentLabel || "").trim();
  const backendCap = n(c.btpRouteCap);

  if (backendTier && backendCap) {
    return {
      tier: backendTier,
      label: backendLabel || backendTier.replace(/_/g, " "),
      cap: backendCap,
      clientReadyEligible: backendTier === "DIRECT_BTP",
    };
  }

  const primary = getPrimaryModule(c);
  const haystack = JSON.stringify({
    title: getCandidateTitle(c),
    headline: c.headline,
    primaryModule: c.primaryModule || c.primary_module,
    secondaryModules: c.secondaryModules || c.secondary_modules,
    sapModules: c.sap_modules,
    sapSubmodules: c.sap_submodules,
    skills: c.skills,
    btpEvidenceLevel: c.btpEvidenceLevel,
    btpEcosystemEvidence: c.btpEcosystemEvidence,
    sapSignals: c.sapSignals,
  }).toUpperCase();

  if (hasBtpDirectDisplayEvidence(c)) {
    return { tier: "DIRECT_BTP", label: "Direct BTP", cap: 96, clientReadyEligible: true };
  }

  const functionalPrimary = ["FICO", "FI", "CO", "MM", "SD", "PP", "PM", "QM", "WM", "EWM", "TM", "PS", "ISU", "ARIBA", "SUCCESSFACTORS", "HCM"].includes(primary);
  const technicalAdjacentPrimary = ["ABAP", "BASIS", "BW", "BW4HANA", "PI", "PO", "PIPO"].includes(primary);
  const strongPlatform = ["INTEGRATIONSUITE", "CLOUDINTEGRATION", "CPI", "DATASPHERE", "DWC", "SAC", "ANALYTICSCLOUD", "EVENTMESH", "BUILDAPPS", "BUILDPROCESSAUTOMATION"].some((token) => haystack.includes(token));
  const weakPlatform = ["FIORI", "SAPUI5", "UI5", "CAP", "RAP", "RESTFULABAP", "PIPO", "EXTENSIONSUITE"].some((token) => haystack.includes(token));

  if (strongPlatform && !functionalPrimary) {
    return {
      tier: technicalAdjacentPrimary ? "TECHNICAL_PLATFORM_ADJACENT" : "STRONG_PLATFORM_ADJACENT",
      label: technicalAdjacentPrimary ? "Technical BTP-adjacent" : "Strong BTP platform-adjacent",
      cap: technicalAdjacentPrimary ? 82 : 85,
      clientReadyEligible: false,
    };
  }

  if (strongPlatform && functionalPrimary) {
    return { tier: "FUNCTIONAL_PLATFORM_ADJACENT", label: "Functional BTP-adjacent", cap: 72, clientReadyEligible: false };
  }

  if (weakPlatform && technicalAdjacentPrimary) {
    return { tier: "TECHNICAL_WEAK_ADJACENT", label: "Technical weak BTP-adjacent", cap: 74, clientReadyEligible: false };
  }

  if (weakPlatform && functionalPrimary) {
    return { tier: "FUNCTIONAL_WEAK_ADJACENT", label: "Functional weak BTP-adjacent", cap: 70, clientReadyEligible: false };
  }

  return { tier: "NO_TRUSTED_BTP_EVIDENCE", label: "No trusted BTP evidence", cap: 50, clientReadyEligible: false };
}

function getBtpFrontendCap(c: MatchCandidate) {
  return getBtpAdjacentFramework(c).cap;
}

function getDisplayScore(c: MatchCandidate) {
  const rawScore = n(c.score ?? c.matchScore ?? c.finalScore ?? c.calibratedScore);
  const requiredModule = getRequiredModule(c);
  if (requiredModule === "BTP" && !hasBtpDirectDisplayEvidence(c)) {
    return Math.min(rawScore, getBtpFrontendCap(c));
  }
  if (requiredModule === "BTP") {
    return Math.min(rawScore, getBtpFrontendCap(c));
  }
  return rawScore;
}

function getAiConfidenceV2(candidate: MatchCandidate) {
  const score = getScore(candidate);
  const moduleAuthority = getModuleAuthority(candidate) || score;
  const implementationAuthority = getImplementationAuthority(candidate) || score;
  const depth = getDepthValue(candidate) || score;
  const consultingDNA = getConsultingDNA(candidate) || score;
  const quality = n(candidate.profileQualityScore ?? candidate.quality ?? candidate.profile_quality_score, 75);
  const readiness = isClientReady(candidate) ? 95 : getDisplayCandidateStatus(candidate, false) === "Recruiter Review" ? 72 : 55;

  let confidence = Math.round(
    moduleAuthority * 0.3 +
      implementationAuthority * 0.22 +
      depth * 0.18 +
      consultingDNA * 0.12 +
      quality * 0.1 +
      readiness * 0.08
  );

  if (getRequiredModule(candidate) === "BTP") {
    const tier = getBtpAdjacentFramework(candidate).tier;
    const tierCaps: Record<string, number> = {
      DIRECT_BTP: 95,
      STRONG_PLATFORM_ADJACENT: 84,
      TECHNICAL_PLATFORM_ADJACENT: 82,
      FUNCTIONAL_PLATFORM_ADJACENT: 72,
      TECHNICAL_WEAK_ADJACENT: 74,
      FUNCTIONAL_WEAK_ADJACENT: 70,
      NO_TRUSTED_BTP_EVIDENCE: 55,
    };
    confidence = Math.min(confidence, tierCaps[tier] ?? 75);
  }

  if (!hasContact(candidate)) confidence -= 8;
  if (candidate.nameReviewRequired || candidate.contactMissing) confidence -= 10;
  return Math.max(35, Math.min(96, confidence));
}

function normalizeMatchForDisplay(c: MatchCandidate, requiredModuleFallback?: any) {
  const requiredModule = getRequiredModule(c, requiredModuleFallback);
  let next: MatchCandidate = {
    ...c,
    requiredModule,
    required_module: requiredModule,
  };

  const displayScore = requiredModule === "BTP" ? getDisplayScore(next) : getScore(next);
  const directRequired = getPrimaryModule(next) === requiredModule;
  const btpTier = requiredModule === "BTP" ? getBtpAdjacentFramework(next) : null;
  const directBtpAutoReady = Boolean(
    requiredModule === "BTP" &&
      btpTier?.clientReadyEligible &&
      displayScore >= 90 &&
      getImplementationAuthority(next) >= 80 &&
      getDepthValue(next) >= 75 &&
      getModuleAuthority(next) >= 80 &&
      hasContact(next) &&
      !next.nameReviewRequired &&
      !next.contactMissing
  );
  const finalReady = Boolean((getFinalClientReadyFlag(next) && directRequired && displayScore >= 85) || directBtpAutoReady);

  next = {
    ...next,
    score: displayScore,
    matchScore: displayScore,
    finalScore: displayScore,
    calibratedScore: displayScore,
    clientReady: finalReady,
    isClientReady: finalReady,
    client_ready: finalReady,
    finalClientReady: finalReady,
    passesClientGate: finalReady,
    clientGatePass: finalReady,
    strongMatch: finalReady,
    isStrongMatch: finalReady,
    status: finalReady ? "Client Ready" : "Recruiter Review",
    displayStatus: finalReady ? "Client Ready" : displayScore < 70 ? "Talent Pipeline" : "Recruiter Review",
    recommendation: finalReady ? "Client Ready" : displayScore < 70 ? "Talent Pipeline" : "Recruiter Review",
    btpAdjacentTier: btpTier?.tier || next.btpAdjacentTier,
    btpAdjacentLabel: btpTier?.label || next.btpAdjacentLabel,
    aiConfidenceV2: getAiConfidenceV2({ ...next, score: displayScore, clientReady: finalReady, isClientReady: finalReady }),
  };

  return next;
}

function normalizeMatchesForDisplay(rows: any[], requiredModuleFallback?: any) {
  return Array.isArray(rows) ? rows.map((row) => normalizeMatchForDisplay(row, requiredModuleFallback)) : [];
}

function getPrimaryModule(c: MatchCandidate) {
  return normalizeModule(c.primaryModule || c.primary_module);
}

function getPrimaryModuleDisplay(c: MatchCandidate) {
  return displayModule(c.primaryModule || c.primary_module);
}

function getSecondaryModules(c: MatchCandidate) {
  if (Array.isArray(c.secondaryModules)) return c.secondaryModules.map(displayModule).join(", ");
  const raw = c.secondaryModules || c.secondary_modules || "";
  return String(raw)
    .split(",")
    .map((x) => displayModule(x.trim()))
    .filter(Boolean)
    .join(", ");
}

function getYears(c: MatchCandidate) {
  return n(c.yearsOfExperience ?? c.years);
}

function getImplementation(c: MatchCandidate) {
  return n(c.implementationProjects ?? c.implementation);
}

function getRollout(c: MatchCandidate) {
  return n(c.rolloutProjects ?? c.rollout);
}

function getAms(c: MatchCandidate) {
  return n(c.amsProjects ?? c.ams);
}

function getS4hana(c: MatchCandidate) {
  return n(c.s4hanaProjects ?? c.s4hana);
}

function getEcc(c: MatchCandidate) {
  return n(c.eccProjects ?? c.ecc);
}

function getModuleAuthority(c: MatchCandidate) {
  return n(c.primaryModuleAuthority ?? c.moduleAuthority);
}

function getImplementationAuthority(c: MatchCandidate) {
  return n(c.implementationAuthority);
}

function getDepthLabel(c: MatchCandidate) {
  return c.depthLabel || "Domain Expertise";
}

function getDepthValue(c: MatchCandidate) {
  return n(c.technicalDepth ?? c.financeDepth ?? c.moduleDepth ?? c.roleComplexity ?? 0);
}

function getConsultingDNA(c: MatchCandidate) {
  return n(c.consultingDNA);
}

function getRoleFit(c: MatchCandidate) {
  return n(c.roleFit);
}

function getDomainAuthority(c: MatchCandidate) {
  return n(c.domainAuthority);
}

function hasContact(c: MatchCandidate) {
  return Boolean(getCandidateEmail(c) && getCandidatePhone(c));
}

function getViewerRole(clientView: boolean): ViewerRole {
  if (clientView) return "client";
  return "recruiter";
}

function boolish(value: any) {
  return value === true || value === "true" || value === 1 || value === "1";
}

function getCandidateContactAccess(candidate: MatchCandidate, clientView: boolean): ContactAccess {
  const role = getViewerRole(clientView);

  const clientHasSubscription =
    boolish(candidate.client_has_subscription) ||
    boolish(candidate.clientSubscriptionActive) ||
    boolish(candidate.subscription_active) ||
    boolish(candidate.subscriptionActive) ||
    boolish(candidate.contact_subscription_active);

  const recruiterApproved =
    boolish(candidate.contact_unlock_approved) ||
    boolish(candidate.admin_contact_approved) ||
    boolish(candidate.adminApprovedContact) ||
    boolish(candidate.recruiter_contact_approved);

  const adminOverride = boolish(candidate.admin_access) || boolish(candidate.isAdmin);

  if (adminOverride) {
    return { canView: true, reason: "Admin access granted.", cta: "Contact visible", role: "admin" };
  }

  if (role === "client") {
    if (clientHasSubscription && isClientReady(candidate)) {
      return {
        canView: true,
        reason: "Visible under active client subscription and submission-ready profile.",
        cta: "Contact visible",
        role,
      };
    }

    return {
      canView: false,
      reason: "Candidate contact information is managed through recruiter engagement workflows.",
      cta: "Contact Protected",
      role,
    };
  }

  if (role === "recruiter") {
    if (recruiterApproved) {
      return {
        canView: true,
        reason: "Admin approval granted for recruiter contact access.",
        cta: "Contact visible",
        role,
      };
    }

    return {
      canView: false,
      reason: "Candidate contact information is managed through recruiter engagement workflows.",
      cta: "Request access through recruiter workflow",
      role,
    };
  }

  return {
    canView: false,
    reason: "Contact protected.",
    cta: "Contact locked",
    role,
  };
}

function canShowContact(candidate: MatchCandidate, clientView: boolean) {
  return getCandidateContactAccess(candidate, clientView).canView;
}

function cleanRisk(note: string) {
  const value = String(note)
    .replace(/^Client-ready gate:\s*/i, "")
    .replace(/^client-ready gate:\s*/i, "")
    .trim();

  const map: Record<string, string> = {
    "score below 85.": "Overall match score is below client-ready benchmark.",
    "implementation authority below 75.": "Implementation leadership requires recruiter validation.",
    "primary module authority below 75.": "Primary module authority is below preferred client-ready threshold.",
    "module fit below 78.": "Module fit is not strong enough for direct client submission.",
    "profile quality below 80.": "Profile quality requires recruiter review before submission.",
    "missing contact details.": "Contact information is incomplete.",
    "name/title requires recruiter review.": "Candidate name or current title requires recruiter validation.",
  };

  return map[value] || value;
}

function clientFriendlyNote(risk: string) {
  if (risk.includes("Contact information")) return "Contact details should be confirmed before outreach.";
  if (risk.includes("module authority")) return "SAP module specialization should be validated in recruiter screening.";
  if (risk.includes("Implementation leadership")) return "Implementation leadership scope should be confirmed.";
  if (risk.includes("Profile quality")) return "Profile completeness should be reviewed.";
  if (risk.includes("Candidate name")) return "Profile identity/title should be validated.";
  if (risk.includes("Overall match score")) return "Profile may require additional recruiter validation.";
  return risk;
}

function getSapExpertiseLevel(candidate: MatchCandidate) {
  const score = getScore(candidate);
  const years = getYears(candidate);
  const implementation = getImplementation(candidate);
  const rollout = getRollout(candidate);
  const ams = getAms(candidate);
  const s4hana = getS4hana(candidate);
  const moduleAuthority = getModuleAuthority(candidate);
  const implementationAuthority = getImplementationAuthority(candidate);
  const depth = getDepthValue(candidate);
  const consultingDNA = getConsultingDNA(candidate);

  const authorityInputs = [moduleAuthority, implementationAuthority, depth, consultingDNA, score].filter(
    (value) => value > 0
  );

  const authorityAverage = authorityInputs.length
    ? authorityInputs.reduce((sum, value) => sum + value, 0) / authorityInputs.length
    : score;

  const deliveryEvidence =
    implementation * 2 +
    rollout * 1.2 +
    Math.min(ams, 10) * 0.5 +
    s4hana * 1.2 +
    Math.min(years, 20) * 0.8;

  const expertiseScore = Math.round(authorityAverage * 0.65 + Math.min(deliveryEvidence, 35));

  if (expertiseScore >= 90) return "Expert";
  if (expertiseScore >= 80) return "Advanced";
  if (expertiseScore >= 70) return "Intermediate";
  return "Emerging";
}

function getSapCareerLevel(candidate: MatchCandidate) {
  const years = getYears(candidate);
  const implementation = getImplementation(candidate);
  const rollout = getRollout(candidate);
  const moduleAuthority = getModuleAuthority(candidate);
  const implementationAuthority = getImplementationAuthority(candidate);
  const consultingDNA = getConsultingDNA(candidate);

  const deliveryWeight =
    implementation * 1.5 +
    rollout +
    moduleAuthority * 0.05 +
    implementationAuthority * 0.06 +
    consultingDNA * 0.04;

  if (years >= 18 && deliveryWeight >= 24) return "Principal Consultant / Director";
  if (years >= 14 && deliveryWeight >= 18) return "Manager / Solution Architect";
  if (years >= 10 && deliveryWeight >= 13) return "Lead Consultant";
  if (years >= 7 && deliveryWeight >= 8) return "Senior Consultant";
  if (years >= 3) return "Consultant";
  return "Associate Consultant";
}

function getMarketPositioning(ranking: number, total: number) {
  if (!total) return "N/A";

  if (ranking === 1) return "Top Ranked in Current Match Pool";

  if (ranking <= Math.max(2, Math.ceil(total * 0.25))) {
    return "Top Quartile in Current Search";
  }

  if (ranking <= Math.max(3, Math.ceil(total * 0.5))) {
    return "Above Average in Current Search";
  }

  return "Qualified Match in Current Search";
}

function getMarketPositioningLabel(position: string, clientView = false) {
  if (!clientView) return position;

  const map: Record<string, string> = {
    "Top Ranked in Current Match Pool": "#1 Recommended Candidate",
    "Top Quartile in Current Search": "Top Recommended Candidate",
    "Above Average in Current Search": "Recommended Candidate",
    "Qualified Match in Current Search": "Additional Qualified Candidate",
  };

  return map[position] || "Qualified Candidate";
}


function getClientExecutiveRecommendation(candidateOrScore: MatchCandidate | number) {
  if (typeof candidateOrScore === "number") {
    const score = candidateOrScore;
    if (score >= 95) return "Highly Recommended";
    if (score >= 90) return "Recommended";
    if (score >= 80) return "Recommended with Review";
    return "Additional Qualified Profile";
  }

  const candidate = candidateOrScore;
  const score = getScore(candidate);
  if (!isClientReady(candidate)) {
    if (score >= 70) return "Proceed after Recruiter Validation";
    return "Talent Pipeline";
  }
  if (score >= 95) return "Highly Recommended";
  if (score >= 90) return "Recommended";
  if (score >= 80) return "Recommended with Review";
  return "Additional Qualified Profile";
}

function getClientProfileStrength(candidateOrScore: MatchCandidate | number) {
  if (typeof candidateOrScore === "number") {
    const score = candidateOrScore;
    if (score >= 95) return "Exceptional Match";
    if (score >= 90) return "Strong Match";
    if (score >= 80) return "Qualified Match";
    return "Pipeline Match";
  }

  const candidate = candidateOrScore;
  const score = getScore(candidate);
  if (!isClientReady(candidate)) {
    if (score >= 70) return "Validation Required";
    return "Pipeline Match";
  }
  if (score >= 95) return "Exceptional Match";
  if (score >= 90) return "Strong Match";
  if (score >= 80) return "Qualified Match";
  return "Pipeline Match";
}


function getHiringRisk(candidate: MatchCandidate) {
  const score = getScore(candidate);
  const implementation = getImplementation(candidate);
  const moduleAuthority = getModuleAuthority(candidate);
  const hasFullContact = hasContact(candidate);

  if (score >= 90 && implementation >= 5 && moduleAuthority >= 80 && hasFullContact) {
    return "Low";
  }

  if (score >= 75 && implementation >= 2 && moduleAuthority >= 70) {
    return "Medium";
  }

  return "High";
}

function getTimeToProductivity(candidate: MatchCandidate) {
  const implementation = getImplementation(candidate);
  const s4hana = getS4hana(candidate);
  const moduleAuthority = getModuleAuthority(candidate);

  if (implementation >= 5 && s4hana >= 3 && moduleAuthority >= 80) {
    return "Immediate";
  }

  if (implementation >= 3 && moduleAuthority >= 70) {
    return "< 1 month";
  }

  return "1-3 months";
}

function getInterviewRecommendation(candidate: MatchCandidate) {
  const score = getScore(candidate);
  const risk = getHiringRisk(candidate);

  if (score >= 92 && risk === "Low") return "Fast Track Interview";
  if (score >= 80) return "Interview Recommended";
  if (score >= 70) return "Keep Warm";
  return "Pipeline Only";
}

function getOfferAcceptanceProbability(candidate: MatchCandidate) {
  const score = getScore(candidate);
  const hasFullContact = hasContact(candidate);
  const location = String(candidate.location || "").toLowerCase();
  const base = score >= 90 ? 82 : score >= 80 ? 72 : score >= 70 ? 62 : 48;
  const contactAdjust = hasFullContact ? 4 : -8;
  const locationAdjust = location.includes("malaysia") || location.includes("philippines") || location.includes("indonesia") ? 4 : 0;
  return Math.max(35, Math.min(92, base + contactAdjust + locationAdjust));
}

function getSalaryBenchmark(candidate: MatchCandidate) {
  const module = getPrimaryModule(candidate);
  const location = String(candidate.location || "").toLowerCase();
  const careerLevel = getSapCareerLevel(candidate);

  const seniority =
    careerLevel.includes("Principal") || careerLevel.includes("Director")
      ? "principal"
      : careerLevel.includes("Manager")
      ? "manager"
      : careerLevel.includes("Lead")
      ? "lead"
      : careerLevel.includes("Senior")
      ? "senior"
      : "consultant";

  if (location.includes("philippines")) {
    const ranges: Record<string, string> = {
      principal: "PHP 220k - 300k / month",
      manager: "PHP 190k - 260k / month",
      lead: "PHP 170k - 230k / month",
      senior: "PHP 140k - 190k / month",
      consultant: "PHP 90k - 140k / month",
    };
    return {
      marketRange: ranges[seniority],
      candidatePositioning: "Within SAP consulting market range",
      currency: "PHP",
    };
  }

  if (location.includes("malaysia")) {
    const ranges: Record<string, string> = {
      principal: "MYR 22k - 32k / month",
      manager: "MYR 18k - 26k / month",
      lead: "MYR 14k - 22k / month",
      senior: "MYR 10k - 16k / month",
      consultant: "MYR 7k - 11k / month",
    };
    return {
      marketRange: ranges[seniority],
      candidatePositioning: "Within SAP consulting market range",
      currency: "MYR",
    };
  }

  if (location.includes("singapore")) {
    const ranges: Record<string, string> = {
      principal: "SGD 15k - 23k / month",
      manager: "SGD 12k - 18k / month",
      lead: "SGD 9k - 14k / month",
      senior: "SGD 7k - 11k / month",
      consultant: "SGD 5k - 8k / month",
    };
    return {
      marketRange: ranges[seniority],
      candidatePositioning: "Within SAP consulting market range",
      currency: "SGD",
    };
  }

  return {
    marketRange: module === "BTP" ? "Premium SAP cloud talent range" : "Market benchmark requires recruiter validation",
    candidatePositioning: "Indicative benchmark only",
    currency: "N/A",
  };
}

function getRankingExplanation(candidate: MatchCandidate, ranking: number, allCandidates: MatchCandidate[]) {
  const score = getScore(candidate);
  const implementation = getImplementation(candidate);
  const s4hana = getS4hana(candidate);
  const years = getYears(candidate);
  const moduleAuthority = getModuleAuthority(candidate);
  const risk = getHiringRisk(candidate);

  const reasons = [
    `Ranked #${ranking} based on match score, SAP module alignment, implementation evidence, and profile readiness.`,
  ];

  if (score >= 90) reasons.push("High overall match score versus current search pool.");
  if (moduleAuthority >= 85) reasons.push("Strong primary SAP module authority.");
  if (implementation >= 5) reasons.push("Strong implementation delivery evidence.");
  if (s4hana >= 5) reasons.push("Strong S/4HANA transformation exposure.");
  if (years >= 12) reasons.push("Senior SAP consulting maturity.");
  if (risk === "Low") reasons.push("Low hiring risk based on profile completeness and delivery evidence.");

  return reasons;
}

function getMarketScarcityScore(module: string) {
  const normalized = normalizeModule(module);
  const scarcity: Record<string, number> = {
    BTP: 94,
    CPI: 90,
    INTEGRATIONSUITE: 90,
    MDG: 88,
    EWM: 86,
    TM: 84,
    BASIS: 78,
    ABAP: 72,
    FICO: 68,
    MM: 64,
    SD: 62,
  };

  return scarcity[normalized] || 70;
}


const marketTalentData: Record<string, Record<string, number>> = {
  Malaysia: {
    FICO: 128,
    MM: 102,
    SD: 87,
    ABAP: 95,
    BASIS: 56,
    BTP: 21,
  },
  Philippines: {
    FICO: 176,
    MM: 133,
    SD: 91,
    ABAP: 84,
    BASIS: 42,
    BTP: 18,
  },
  Singapore: {
    FICO: 73,
    MM: 65,
    SD: 54,
    ABAP: 48,
    BASIS: 31,
    BTP: 14,
  },
  Indonesia: {
    FICO: 141,
    MM: 118,
    SD: 96,
    ABAP: 77,
    BASIS: 45,
    BTP: 16,
  },
};

function getMarketTalentCount(country: string, module: string) {
  return marketTalentData[country]?.[normalizeModule(module)] ?? 0;
}

function candidateModuleSet(candidate: MatchCandidate) {
  const modules = new Set<string>();
  const add = (value: any) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(add);
      return;
    }
    String(value)
      .split(/[,;|]/)
      .map((item) => normalizeModule(item.trim()))
      .filter((item) => item && item !== "UNKNOWN")
      .forEach((item) => modules.add(item));
  };

  add(candidate.primaryModule || candidate.primary_module);
  add(candidate.secondaryModules || candidate.secondary_modules);
  add(candidate.sap_modules);
  add(candidate.sap_submodules);

  if (getRequiredModule(candidate) === "BTP" && hasBtpDirectDisplayEvidence(candidate)) modules.add("BTP");
  return modules;
}

function buildTalentMap(candidates: MatchCandidate[]) {
  const countries = ["Malaysia", "Philippines", "Indonesia", "Singapore"];
  const modules = ["FICO", "MM", "SD", "ABAP", "BASIS", "BTP"];

  return countries.map((country) => {
    const matchedProfiles = candidates.filter((c) =>
      String(c.location || "").toLowerCase().includes(country.toLowerCase())
    );

    // V37 Real Talent Map: use the current normalized match pool instead of static market estimates.
    const moduleCounts = modules.reduce((acc, module) => {
      acc[module] = matchedProfiles.filter((candidate) => candidateModuleSet(candidate).has(module)).length;
      return acc;
    }, {} as Record<string, number>);

    return {
      country,
      matchedTotal: matchedProfiles.length,
      total: Object.values(moduleCounts).reduce((sum, value) => sum + value, 0),
      modules: moduleCounts,
    };
  });
}

function getRiskRadar(candidate: MatchCandidate) {
  const score = getScore(candidate);
  const years = getYears(candidate);
  const implementation = getImplementation(candidate);
  const rollout = getRollout(candidate);
  const hasFullContact = hasContact(candidate);
  const location = String(candidate.location || "").toLowerCase();
  const moduleAuthority = getModuleAuthority(candidate);
  const salaryBenchmark = getSalaryBenchmark(candidate);

  const seniorityPressure = years >= 15 ? 14 : years >= 10 ? 9 : years <= 6 ? 5 : 7;
  const marketPressure = score >= 92 ? 12 : score >= 85 ? 8 : 4;
  const counterOfferRisk = Math.max(35, Math.min(88, 42 + seniorityPressure + marketPressure + (hasFullContact ? 6 : -4)));

  const jobHoppingRisk = Math.max(8, Math.min(45, years <= 6 ? 28 : implementation >= 5 ? 12 : 20));
  const relocationRisk = location.includes("malaysia") || location.includes("philippines") || location.includes("indonesia") || location.includes("singapore")
    ? 22
    : 46;

  const noticePeriodRisk = Math.max(
    25,
    Math.min(
      75,
      38 +
        (years >= 12 ? 12 : 4) +
        (implementation + rollout >= 8 ? 6 : 0) +
        (salaryBenchmark.currency === "N/A" ? 6 : 0)
    )
  );

  const overallRiskScore = Math.round(
    counterOfferRisk * 0.35 +
      jobHoppingRisk * 0.15 +
      relocationRisk * 0.2 +
      noticePeriodRisk * 0.2 +
      (moduleAuthority < 75 ? 10 : 0)
  );

  return {
    counterOfferRisk,
    jobHoppingRisk,
    relocationRisk,
    noticePeriodRisk,
    overallRiskScore,
  };
}

function getOfferAcceptanceDrivers(candidate: MatchCandidate) {
  const drivers: string[] = [];
  const score = getScore(candidate);
  const implementation = getImplementation(candidate);
  const s4hana = getS4hana(candidate);
  const salary = getSalaryBenchmark(candidate);

  if (score >= 90) drivers.push("Strong role-to-profile alignment");
  if (implementation >= 5) drivers.push("Proven implementation delivery fit");
  if (s4hana >= 3) drivers.push("Relevant S/4HANA transformation exposure");
  if (hasContact(candidate)) drivers.push("Contact readiness verified");
  if (salary.currency !== "N/A") drivers.push("Indicative salary range is benchmarked for local market");

  return drivers.length ? drivers : ["Acceptance requires recruiter validation"];
}

function getOfferAcceptanceRisks(candidate: MatchCandidate) {
  const risks: string[] = [];
  const radar = getRiskRadar(candidate);
  const score = getScore(candidate);

  if (radar.counterOfferRisk >= 65) risks.push("Counter-offer risk is elevated for high-demand SAP talent");
  if (radar.noticePeriodRisk >= 55) risks.push("Notice period or transition timing may require early confirmation");
  if (radar.relocationRisk >= 40) risks.push("Location or relocation preference should be validated");
  if (!hasContact(candidate)) risks.push("Contact details require recruiter confirmation");
  if (score < 85) risks.push("Profile may need additional screening before offer strategy");

  return risks.length ? risks : ["No major offer acceptance risks detected"];
}

function buildHiringFunnelForecast(candidates: MatchCandidate[], clientView: boolean) {
  const ready = candidates.filter((candidate) => (clientView ? isClientReady(candidate) : isStrongMatch(candidate))).length;
  const review = candidates.filter((candidate) => {
    const score = getScore(candidate);
    const isPositive = clientView ? isClientReady(candidate) : isStrongMatch(candidate);
    return !isPositive && score >= 70;
  }).length;

  const sourced = Math.max(candidates.length, ready + review);
  const interview = Math.max(0, Math.round(ready * 0.55 + review * 0.2));
  const finalRound = Math.max(0, Math.round(interview * 0.45));
  const offer = Math.max(0, Math.round(finalRound * 0.5));
  const avgAcceptance = candidates.length
    ? candidates.reduce((sum, candidate) => sum + getOfferAcceptanceProbability(candidate), 0) / candidates.length
    : 0;
  const expectedHire = Number(((offer * avgAcceptance) / 100).toFixed(1));

  return {
    sourced,
    ready,
    review,
    interview,
    finalRound,
    offer,
    expectedHire,
  };
}

function getMarketScarcityLabel(score: number) {
  if (score >= 85) return "Critical scarcity";
  if (score >= 75) return "High scarcity";
  if (score >= 65) return "Moderate scarcity";
  return "Available market";
}

function getExpectedTimeToFill(scarcityScore: number, readyCount: number) {
  const base = scarcityScore >= 85 ? 55 : scarcityScore >= 75 ? 45 : scarcityScore >= 65 ? 38 : 30;
  return Math.max(21, base - Math.min(12, readyCount));
}

function getRecommendedInterviewWindow(scarcityScore: number) {
  if (scarcityScore >= 85) return "3-5 days";
  if (scarcityScore >= 70) return "5-7 days";
  return "7-10 days";
}

function getTalentAvailabilityIndex(candidates: MatchCandidate[]) {
  const total = candidates.length || 1;
  const ready = candidates.filter((c) => isClientReady(c) || isStrongMatch(c)).length;
  const review = candidates.filter((c) => !isClientReady(c) && getScore(c) >= 70).length;
  const pipeline = Math.max(0, candidates.length - ready - review);

  const openToMove = Math.round(Math.min(45, Math.max(8, (ready / total) * 100 + (review / total) * 12)));
  const active = Math.round(Math.min(40, Math.max(10, (pipeline / total) * 45 + (review / total) * 18)));
  const passive = Math.max(0, 100 - openToMove - active);

  return {
    openToMove,
    passive,
    active,
  };
}




function getRiskRadarLabel(value: number) {
  if (value >= 70) return "High";
  if (value >= 55) return "Elevated";
  if (value >= 35) return "Moderate";
  return "Low";
}

function getExecutiveVerdict(candidate: MatchCandidate) {
  const score = getScore(candidate);
  const risk = getHiringRisk(candidate);
  const contact = hasContact(candidate);
  const implementation = getImplementation(candidate);
  const moduleAuthority = getModuleAuthority(candidate);

  if (!isClientReady(candidate)) {
    if (score >= 70) return "Proceed after recruiter validation";
    if (implementation >= 5 && moduleAuthority >= 70) return "Keep warm as backup talent";
    return "Pipeline only for this role";
  }

  if (score >= 95 && risk === "Low" && contact) return "Priority Interview - strongest submission profile";
  if (score >= 90 && risk !== "High") return "Recommended for client presentation";
  if (score >= 80) return "Proceed after recruiter validation";
  if (implementation >= 5 && moduleAuthority >= 70) return "Keep warm as backup talent";
  return "Pipeline only for this role";
}

function getHiringSuccessProbability(candidate: MatchCandidate) {
  const score = getScore(candidate);
  const acceptance = getOfferAcceptanceProbability(candidate);
  const radar = getRiskRadar(candidate);
  const implementation = getImplementation(candidate);
  const moduleAuthority = getModuleAuthority(candidate);
  const riskPenalty = Math.round(radar.overallRiskScore * 0.25);
  const deliveryBonus = implementation >= 5 ? 4 : implementation >= 2 ? 2 : 0;
  const moduleBonus = moduleAuthority >= 85 ? 4 : moduleAuthority >= 75 ? 2 : 0;

  return Math.max(30, Math.min(96, Math.round(score * 0.45 + acceptance * 0.45 + deliveryBonus + moduleBonus - riskPenalty)));
}

function getExecutiveMarketPosition(candidate: MatchCandidate, allCandidates: MatchCandidate[], clientView: boolean) {
  const insight = buildAiInsights(candidate, allCandidates);
  const base = getMarketPositioningLabel(insight.marketPositioning, clientView);
  const scarcity = getMarketScarcityScore(getPrimaryModule(candidate));
  const scarcityText = getMarketScarcityLabel(scarcity);
  return `${base} | ${scarcityText}`;
}

function getHiringSuccessLabel(probability: number) {
  if (probability >= 85) return "Very High";
  if (probability >= 75) return "High";
  if (probability >= 65) return "Moderate";
  return "Requires Validation";
}

function getDisplayCandidateStatus(candidate: MatchCandidate, clientView: boolean) {
  const score = getScore(candidate);

  if (clientView) {
    if (isClientReady(candidate)) return "Ready for Client Submission";
    if (score < 70) return "Talent Pipeline";
    return "Under Review";
  }

  if (isStrongMatch(candidate)) return "Strong Match";
  if (score < 70) return "Backup Pool";
  return "Recruiter Review";
}

function getPipelineStageLabel(candidate: MatchCandidate, clientView: boolean) {
  const score = getScore(candidate);

  if (clientView) {
    if (isClientReady(candidate)) return "Ready Pool";
    if (score < 70) return "Talent Pipeline";
    return "Under Review";
  }

  if (isStrongMatch(candidate)) return "Strong Match";
  if (score < 70) return "Backup Pool";
  return "Recruiter Review";
}

function buildExecutiveSummary(candidate: MatchCandidate, insightBase: {
  primaryModuleDisplay: string;
  years: number;
  implementation: number;
  s4hana: number;
  consultingDNA: number;
  sapCareerLevel: string;
}) {
  const experience = insightBase.years
    ? `${insightBase.years} years SAP ${insightBase.primaryModuleDisplay} experience`
    : `SAP ${insightBase.primaryModuleDisplay} experience`;

  const deliveryEvidence = [
    insightBase.implementation
      ? `${insightBase.implementation} end-to-end implementation program(s)`
      : "",
    insightBase.s4hana ? `${insightBase.s4hana} S/4HANA program(s)` : "",
    insightBase.consultingDNA >= 85 ? "strong consulting delivery profile" : "",
  ].filter(Boolean);

  const deliveryText = deliveryEvidence.length
    ? `with ${deliveryEvidence.join(", ")}`
    : "with relevant SAP delivery background";

  return `${experience}, profiled at ${insightBase.sapCareerLevel} level, ${deliveryText}. Recommended for enterprise SAP roles requiring strong domain expertise, implementation delivery, and client-facing consulting capability.`;
}

function buildAiInsights(candidate: MatchCandidate, allCandidates: MatchCandidate[]): AiInsight {
  const sorted = [...allCandidates].sort((a, b) => getScore(b) - getScore(a));

  const ranking =
    sorted.findIndex((c) => {
      if (c === candidate) return true;
      if (candidate.id && c.id) return c.id === candidate.id;
      const emailA = getCandidateEmail(candidate);
      const emailB = getCandidateEmail(c);
      if (emailA && emailB) return emailA === emailB;
      return false;
    }) + 1 || 1;

  const total = allCandidates.length || 1;
  const score = getScore(candidate);
  const years = getYears(candidate);
  const primaryModule = getPrimaryModule(candidate);
  const primaryModuleDisplay = getPrimaryModuleDisplay(candidate);
  const implementation = getImplementation(candidate);
  const rollout = getRollout(candidate);
  const s4hana = getS4hana(candidate);
  const location = candidate.location || "";
  const moduleAuthority = getModuleAuthority(candidate);
  const implementationAuthority = getImplementationAuthority(candidate);
  const depth = getDepthValue(candidate);
  const consultingDNA = getConsultingDNA(candidate);
  const roleFit = getRoleFit(candidate);
  const domainAuthority = getDomainAuthority(candidate);
  const sapSignals = detectSapTerms(candidate);

  // V37 Assessment Confidence v2: weighted by module authority, delivery proof, depth, consulting DNA,
  // profile quality, and readiness gates. This avoids high confidence for high-score adjacent profiles.
  const confidence = getAiConfidenceV2(candidate);

  const implementationScore =
    implementationAuthority > 0 ? implementationAuthority : score;

  const moduleScore = moduleAuthority > 0 ? moduleAuthority : score;

  const consultingScore = consultingDNA > 0 ? consultingDNA : score;

  const talentIntelligenceScore = Math.round(
    score * 0.4 +
      implementationScore * 0.2 +
      moduleScore * 0.2 +
      consultingScore * 0.2
  );

  const whySelected: string[] = [];

  if (years) whySelected.push(`${years} years SAP experience`);
  if (primaryModule && primaryModule !== "UNKNOWN") whySelected.push(`Strong alignment with SAP ${primaryModuleDisplay} leadership requirements.`);
  if (moduleAuthority >= 60 || score >= 80) whySelected.push(`Demonstrated SAP consulting depth across enterprise programs.`);
  if (implementation) whySelected.push(`${implementation} implementation project(s)`);
  if (rollout) whySelected.push(`${rollout} rollout project(s)`);
  if (s4hana) whySelected.push(`${s4hana} S/4HANA project exposure`);
  if (location && location !== "N/A") whySelected.push(`${location} market exposure`);
  if (implementationAuthority >= 90) whySelected.push("High implementation authority");
  if (depth >= 85) whySelected.push(`${getDepthLabel(candidate)} is strong`);
  if (consultingDNA >= 85) whySelected.push("Strong consulting DNA");

  const rawGaps: string[] = Array.isArray(candidate.gaps) ? candidate.gaps : [];
  const recruiterRisks = rawGaps.map(cleanRisk).filter(Boolean);

  if (!hasContact(candidate)) {
    const contactRisk = "Contact information is incomplete.";
    if (!recruiterRisks.includes(contactRisk)) recruiterRisks.push(contactRisk);
  }

  const validationNotes = recruiterRisks.length
    ? recruiterRisks.map(clientFriendlyNote)
    : ["Ready for client submission."];

  const bestFor =
    moduleBestForMap[primaryModule] || [
      `SAP ${primaryModuleDisplay} consulting`,
      `${primaryModuleDisplay} implementation support`,
      "Recruiter validation recommended",
    ];

  const marketPositioning = getMarketPositioning(ranking, total);
  const sapExpertiseLevel = getSapExpertiseLevel(candidate);
  const sapCareerLevel = getSapCareerLevel(candidate);

  const recommendation =
    isClientReady(candidate) && score >= 90 && recruiterRisks.length === 0
      ? "Strongly Recommended"
      : isClientReady(candidate) && score >= 85
      ? "Recommended"
      : score >= 70
      ? "Recruiter Review Recommended"
      : "Talent Pool Backup";

  const hiringRisk = getHiringRisk(candidate);
  const timeToProductivity = getTimeToProductivity(candidate);
  const interviewRecommendation = getInterviewRecommendation(candidate);
  const offerAcceptanceProbability = getOfferAcceptanceProbability(candidate);
  const offerDrivers = getOfferAcceptanceDrivers(candidate);
  const offerRisks = getOfferAcceptanceRisks(candidate);
  const riskRadar = getRiskRadar(candidate);
  const salaryBenchmark = getSalaryBenchmark(candidate);
  const rankingExplanation = getRankingExplanation(candidate, ranking, allCandidates);

  return {
    ranking,
    confidence,
    talentIntelligenceScore,
    marketPositioning,
    sapExpertiseLevel,
    sapCareerLevel,
    hiringRisk,
    timeToProductivity,
    interviewRecommendation,
    offerAcceptanceProbability,
    offerDrivers,
    offerRisks,
    riskRadar,
    salaryBenchmark,
    rankingExplanation,
    executiveSummary: buildExecutiveSummary(candidate, {
      primaryModuleDisplay,
      years,
      implementation,
      s4hana,
      consultingDNA,
      sapCareerLevel,
    }),
    recommendation,
    whySelected: whySelected.length ? whySelected : ["Relevant SAP consulting background"],
    validationNotes,
    recruiterRisks: recruiterRisks.length ? recruiterRisks : ["No critical risks detected."],
    bestFor,
    sapSignals,
  };
}

function getCandidateKey(candidate: MatchCandidate, index = 0) {
  return String(
    candidate.id ||
      candidate.candidate_id ||
      getCandidateEmail(candidate) ||
      `${getCandidateName(candidate)}-${getCandidatePhone(candidate)}-${index}`
  );
}



function persistMatchesPageSelection(selectedCandidateKey: string) {
  if (typeof window === "undefined") return;

  try {
    const state = getCachedMatchesState();
    const nextState: AnyRecord = {
      ...state,
      selectedCandidateKey,
      scrollY: window.scrollY,
      savedAt: new Date().toISOString(),
    };
    if (Array.isArray(nextState.matches) && nextState.matches.length) {
      writeSearchSessionSnapshot(nextState);
    } else {
      window.sessionStorage.setItem(MATCHES_CACHE_KEY, JSON.stringify(nextState));
    }
  } catch {}
}

function getCandidateDetailHref(candidate: MatchCandidate, index = 0, clientView = true, activeSearchSessionId = "") {
  const id =
    candidate.id ||
    candidate.candidate_id ||
    candidate.candidate_slug ||
    candidate.slug ||
    getCandidateEmail(candidate) ||
    getCandidateKey(candidate, index);

  const returnTo =
    typeof window !== "undefined"
      ? `${window.location.pathname}${window.location.search}`
      : "/matches";

  const role = clientView ? "client" : "recruiter";
  const subscription = clientView ? "false" : "false";

  const searchSessionId = activeSearchSessionId || getCachedMatchesState().searchSessionId || "";
  const sessionParam = searchSessionId ? `&searchId=${encodeURIComponent(String(searchSessionId))}&searchSessionId=${encodeURIComponent(String(searchSessionId))}` : "";

  return `/candidates/${encodeURIComponent(String(id))}-returnTo=${encodeURIComponent(returnTo)}&role=${role}&subscription=${subscription}${sessionParam}`;
}

function getCountryCode(candidate: MatchCandidate) {
  const location = String(candidate.location || "").toLowerCase();
  if (location.includes("malaysia")) return "MY";
  if (location.includes("philippines")) return "PH";
  if (location.includes("singapore")) return "SG";
  if (location.includes("indonesia")) return "ID";
  if (location.includes("vietnam")) return "VN";
  return String(candidate.location || "SEA").slice(0, 3).toUpperCase();
}

function getShortlistSignal(candidate: MatchCandidate) {
  return `${getYears(candidate)}Y SAP | ${getImplementation(candidate)} Impl | ${getS4hana(candidate)} S/4 | ${getCountryCode(candidate)}`;
}

function parseSalaryRange(range: string) {
  const numbers = String(range || "").match(/[\d,.]+/g)?.map((item) => Number(item.replace(/,/g, ""))) || [];
  if (numbers.length >= 2) return { low: numbers[0], high: numbers[1], median: Math.round((numbers[0] + numbers[1]) / 2) };
  if (numbers.length === 1) return { low: numbers[0], high: numbers[0], median: numbers[0] };
  return { low: 0, high: 0, median: 0 };
}

function getCompensationBenchmark(candidate: MatchCandidate, insight?: AiInsight) {
  const salary = insight?.salaryBenchmark || getSalaryBenchmark(candidate);
  const range = parseSalaryRange(salary.marketRange);
  const currency = salary.currency && salary.currency !== "N/A" ? salary.currency : "N/A";
  const expectedRaw = n(candidate.expected_salary ?? candidate.expectedSalary ?? candidate.salary_expectation ?? candidate.expectedPackage);
  const expected = expectedRaw || (range.median ? Math.round(range.median * 1.04) : 0);
  const difference = range.median ? Math.round(((expected - range.median) / range.median) * 100) : 0;
  const position = !range.median
    ? "Requires recruiter validation"
    : difference > 8
    ? "â–² Above Market"
    : difference < -8
    ? "â–¼ Below Market"
    : "âœ“ Market Aligned";

  return {
    currency,
    expected: expected ? `${currency} ${expected.toLocaleString()}` : "To be confirmed",
    median: range.median ? `${currency} ${range.median.toLocaleString()}` : "To be validated",
    difference: range.median ? `${difference >= 0 ? "+" : ""}${difference}%` : "N/A",
    position,
  };
}

function getSapModuleHeatmap(candidate: MatchCandidate) {
  const primary = getPrimaryModule(candidate);
  const secondary = getSecondaryModules(candidate);
  const moduleAuthority = getModuleAuthority(candidate) || getScore(candidate);
  const depth = getDepthValue(candidate) || getScore(candidate);
  const s4hana = Math.min(100, getS4hana(candidate) * 10);
  const items = [
    { label: getPrimaryModuleDisplay(candidate), value: Math.max(50, moduleAuthority) },
    { label: `S/4 ${getPrimaryModuleDisplay(candidate)}`, value: Math.max(35, Math.min(98, Math.round((s4hana + depth) / 2))) },
  ];

  const secondaryList = secondary
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 4);

  secondaryList.forEach((item, index) => {
    items.push({ label: item, value: Math.max(45, moduleAuthority - 10 - index * 6) });
  });

  if (primary === "FICO" || primary === "FI" || primary === "CO") {
    ["FSCM", "TRM", "COPA"].forEach((item, index) => {
      if (!items.some((existing) => existing.label.toUpperCase().includes(item))) {
        items.push({ label: item, value: Math.max(45, depth - 10 - index * 7) });
      }
    });
  }

  return items.slice(0, 6);
}

function getImplementationMaturity(candidate: MatchCandidate) {
  const implementation = getImplementation(candidate);
  const rollout = getRollout(candidate);
  const s4hana = getS4hana(candidate);
  const ams = getAms(candidate);
  const migrationSignal = buildAiInsights(candidate, [candidate]).sapSignals.includes("Migration") ? Math.max(1, Math.round(s4hana * 0.4)) : 0;
  const greenfield = buildAiInsights(candidate, [candidate]).sapSignals.includes("Greenfield") ? Math.max(1, Math.round(implementation * 0.35)) : 0;
  const brownfield = buildAiInsights(candidate, [candidate]).sapSignals.includes("Brownfield") ? Math.max(1, Math.round(implementation * 0.25)) : 0;
  const maturity = Math.min(98, Math.round((getImplementationAuthority(candidate) || getScore(candidate)) * 0.65 + Math.min(implementation * 4 + s4hana * 2, 32)));

  return {
    maturity,
    rows: [
      `Greenfield: ${greenfield}`,
      `Brownfield: ${brownfield}`,
      `Rollout: ${rollout}`,
      `Migration: ${migrationSignal}`,
      `Support / AMS: ${ams}`,
    ],
  };
}

function getRecruiterInsight(candidate: MatchCandidate, insight: AiInsight) {
  const career = insight.sapCareerLevel;
  const primary = getPrimaryModuleDisplay(candidate);
  const highSeniority = career.includes("Principal") || career.includes("Director") || career.includes("Manager");
  const suitable = [
    `${primary} implementation leadership`,
    getS4hana(candidate) >= 3 ? "S/4HANA transformation program" : "SAP delivery program",
    getConsultingDNA(candidate) >= 85 ? "Client-facing workshops" : "Functional delivery support",
  ];

  const watchouts = [
    highSeniority ? "Senior profile â€” confirm role seniority and budget alignment" : "Confirm growth expectation and project fit",
    insight.riskRadar.counterOfferRisk >= 60 ? "Counter-offer risk should be managed early" : "Maintain fast interview momentum",
    !hasContact(candidate) ? "Contact details require recruiter confirmation" : "Confirm notice period and availability",
  ];

  return {
    headline:
      getConsultingDNA(candidate) >= 85
        ? "Strong consulting pedigree with client-facing SAP delivery evidence."
        : "Relevant SAP delivery profile with recruiter validation recommended.",
    suitable,
    watchouts,
  };
}

function getSubmissionReadiness(candidate: MatchCandidate, insight: AiInsight) {
  const checks = [
    { label: "SAP expertise aligned", done: getModuleAuthority(candidate) >= 75 || getScore(candidate) >= 85 },
    { label: "Implementation experience validated", done: getImplementationAuthority(candidate) >= 75 || getImplementation(candidate) >= 3 },
    { label: "Profile readiness confirmed", done: hasContact(candidate) && getInterviewRecommendation(candidate) !== "Pipeline Only" },
  ];

  const score = Math.round((checks.filter((check) => check.done).length / checks.length) * 100);
  return { score, checks };
}

function getOfferAcceptanceOutlook(probability: number) {
  if (probability >= 85) return "High";
  if (probability >= 72) return "Moderate";
  return "Requires Validation";
}

function submissionConfidence(candidate: MatchCandidate, insight: AiInsight) {
  if (getScore(candidate) >= 82 && insight.riskRadar.overallRiskScore < 50) return { label: "Ready", reason: "Evidence supports client submission after standard recruiter confirmation." };
  if (getScore(candidate) >= 68) return { label: "Conditional", reason: "Submission is viable once the main validation points are confirmed." };
  if (getScore(candidate) >= 55) return { label: "Hold", reason: "Keep warm, but do not lead with this profile until risks are resolved." };
  return { label: "Reject", reason: "Current evidence is not strong enough for client submission." };
}

function buildSubmissionHighlights(candidate: MatchCandidate, insight: AiInsight) {
  return uniqueStrings([
    getYears(candidate) ? `${getYears(candidate)} years SAP` : "SAP experience to confirm",
    /architect/i.test(getCandidateTitle(candidate)) ? "Solution Architect" : getCandidateTitle(candidate),
    getPrimaryModuleDisplay(candidate) !== "UNKNOWN" ? `Enterprise SAP ${getPrimaryModuleDisplay(candidate)}` : "SAP module depth to confirm",
    getConsultingDNA(candidate) >= 70 ? "Leadership experience" : "Leadership scope to validate",
    candidate.location ? "Regional delivery" : "Regional delivery to confirm",
    getArchitectureSignal(candidate) ? "Architecture ownership" : "Architecture ownership to validate",
  ]).slice(0, 6);
}

function buildSubmissionRisks(candidate: MatchCandidate, insight: AiInsight) {
  return uniqueStrings([
    getImplementation(candidate) <= 0 ? "Implementation ownership requires validation" : "Implementation ownership should be confirmed",
    getSalaryAlignmentLabel(candidate) === "Unknown" ? "Current package unavailable" : "Salary alignment should be confirmed",
    getNoticeLabel(candidate) === "Unknown" ? "Notice pending" : "Notice period should be confirmed",
    !hasContact(candidate) ? "Contact path unavailable" : "",
    ...insight.recruiterRisks.slice(0, 2),
  ]).filter(Boolean).slice(0, 5);
}

function buildInterviewFocus(candidate: MatchCandidate, risks: string[]) {
  const primaryModule = getPrimaryModuleDisplay(candidate);
  return uniqueStrings([
    "Which phases did you personally own from design through go-live or hypercare-",
    `What was your most recent ${primaryModule} architecture responsibility, and what decisions did you own-`,
    "Which client stakeholders did you work with directly, and what outcomes did you influence-",
    "What is your current availability, notice period, and expected package-",
    risks.some((risk) => /S\/4HANA/i.test(risk)) ? "What S/4HANA scope did you own, and how recent was it-" : "Where would you need support in the first 90 days of this mandate-",
  ]).slice(0, 5);
}

function buildSubmissionEmail(candidate: MatchCandidate, insight: AiInsight, risks: string[], confidence: { label: string; reason: string }) {
  const name = getCandidateName(candidate);
  const module = getPrimaryModuleDisplay(candidate);
  const highlights = buildSubmissionHighlights(candidate, insight).slice(0, 4);
  return [
    "Hi [Client Name],",
    `I am sharing ${name} for your review because the profile aligns strongly with the ${module} mandate and appears suitable for senior delivery or architecture-led responsibilities.`,
    `${name} is best positioned as a ${getCandidateTitle(candidate)} with ${getYears(candidate) ? `${getYears(candidate)} years of SAP experience` : "SAP experience requiring final confirmation"}.`,
    `Key strengths: ${highlights.join("; ")}.`,
    `Main validation point before submission: ${risks[0] || "availability and package confirmation"}.`,
    `Recommendation: ${confidence.label}. ${confidence.reason}`,
    "Would you like us to arrange a focused technical and delivery validation conversation-",
  ];
}

function buildContextualClientEmail(candidate: MatchCandidate, allCandidates: MatchCandidate[], primaryModule: string) {
  const insight = buildAiInsights(candidate, allCandidates);
  const risks = buildSubmissionRisks(candidate, insight);
  const confidence = submissionConfidence(candidate, insight);
  const module = getPrimaryModuleDisplay(candidate) !== "UNKNOWN" ? getPrimaryModuleDisplay(candidate) : displayModule(primaryModule);
  return [
    `Subject: SAP ${module} candidate recommendation - ${getCandidateName(candidate)}`,
    "",
    "Hi [Client Name],",
    "",
    `I recommend reviewing ${getCandidateName(candidate)} for the SAP ${module} requirement.`,
    "",
    buildSubmissionHighlights(candidate, insight).slice(0, 3).join("; ") || "Delivery evidence needs validation.",
    "",
    `Commercial position: ${risks.slice(0, 2).join("; ") || "salary, availability and notice period should be confirmed before submission"}.`,
    "",
    "Would you like us to progress this profile for interview review-",
  ].join("\n");
}

function buildContextualWhatsApp(candidate: MatchCandidate, allCandidates: MatchCandidate[], primaryModule: string) {
  const insight = buildAiInsights(candidate, allCandidates);
  const risks = buildSubmissionRisks(candidate, insight);
  const module = getPrimaryModuleDisplay(candidate) !== "UNKNOWN" ? getPrimaryModuleDisplay(candidate) : displayModule(primaryModule);
  return [
    "Hi [Client Name],",
    "",
    `I'd recommend ${getCandidateName(candidate)} for the SAP ${module} requirement.`,
    buildSubmissionHighlights(candidate, insight).slice(0, 2).join("; ") || "Delivery evidence needs validation.",
    `Pending: ${risks.slice(0, 2).join("; ") || "salary, availability and notice period confirmation"}.`,
    "Shall I send the profile through-",
  ].join("\n");
}

function buildContextualHiringManagerBrief(candidate: MatchCandidate, allCandidates: MatchCandidate[], primaryModule: string) {
  const insight = buildAiInsights(candidate, allCandidates);
  const risks = buildSubmissionRisks(candidate, insight);
  const questions = buildInterviewFocus(candidate, risks);
  const module = getPrimaryModuleDisplay(candidate) !== "UNKNOWN" ? getPrimaryModuleDisplay(candidate) : displayModule(primaryModule);
  return [
    "HIRING MANAGER BRIEF",
    "",
    `Candidate: ${getCandidateName(candidate)}`,
    `Role focus: SAP ${module}`,
    "",
    "What to test:",
    ...questions.slice(0, 5).map((item) => `- ${item}`),
    "",
    "Potential concern:",
    risks[0] || "Ownership evidence needs recruiter validation.",
    "",
    "Expected outcome:",
    "Interview should confirm delivery ownership, architecture scope and commercial feasibility before client progression.",
  ].join("\n");
}

async function copyShortlistCommunication(value: string, onMessage?: (message: string) => void, message = "Copied") {
  try {
    await navigator.clipboard.writeText(value);
    onMessage?.(message);
  } catch {
    onMessage?.("Copy failed");
  }
}

function generateClientSubmissionPack(candidates: MatchCandidate[], allCandidates: MatchCandidate[], primaryModule: string) {
  const candidate = candidates[0];
  if (!candidate) return;

  const insight = buildAiInsights(candidate, allCandidates);
  const confidence = submissionConfidence(candidate, insight);
  const highlights = buildSubmissionHighlights(candidate, insight);
  const risks = buildSubmissionRisks(candidate, insight);
  const questions = buildInterviewFocus(candidate, risks);
  const emailLines = buildSubmissionEmail(candidate, insight, risks, confidence);
  const today = new Date().toLocaleDateString();
  const name = getCandidateName(candidate);
  const module = getPrimaryModuleDisplay(candidate) !== "UNKNOWN" ? getPrimaryModuleDisplay(candidate) : displayModule(primaryModule);
  const oneLinePitch = `${module} ${getCandidateTitle(candidate)} with ${getYears(candidate) ? `${getYears(candidate)} years' SAP experience` : "SAP delivery experience"}, best suited for lead, architecture or senior delivery roles.`;

  const summaryBullets = [
    `Why this candidate: ${name} is the strongest current submission for ${module} based on match strength and available delivery signals.`,
    `Business impact: positioned to support enterprise SAP delivery, architecture decisions and stakeholder alignment.`,
    `Relevant experience: ${highlights.slice(0, 3).join("; ")}.`,
    `Largest validation point: ${risks[0] || "availability, package and implementation ownership require confirmation"}.`,
  ];

  const html = `
    <html>
      <head>
        <title>Executive Client Submission - ${name}</title>
        <style>
          body { margin: 0; background: #f8fafc; color: #0f172a; font-family: Arial, sans-serif; }
          .page { max-width: 920px; margin: 0 auto; padding: 44px; background: #ffffff; }
          .brand { display: flex; justify-content: space-between; gap: 24px; color: #475569; font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
          h1 { margin: 30px 0 6px; font-size: 30px; color: #0f172a; }
          h2 { margin: 30px 0 12px; font-size: 15px; color: #0369a1; letter-spacing: 0.14em; text-transform: uppercase; }
          .sub { color: #475569; margin-bottom: 26px; }
          .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
          .card { border: 1px solid #e2e8f0; border-radius: 14px; padding: 16px; background: #f8fafc; }
          .label { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.12em; font-weight: 700; }
          .value { margin-top: 6px; font-weight: 700; line-height: 1.45; }
          ul { margin: 0; padding-left: 18px; }
          li { margin: 8px 0; line-height: 1.45; }
          .email { white-space: pre-line; line-height: 1.55; border-left: 3px solid #0284c7; padding-left: 16px; color: #1e293b; }
          .confidence { font-size: 28px; font-weight: 800; color: ${confidence.label === "Ready" ? "#15803d" : confidence.label === "Conditional" ? "#b45309" : "#991b1b"}; }
          .pitch { font-size: 18px; line-height: 1.5; font-weight: 700; color: #0f172a; }
          @media print { body { background: #fff; } .page { padding: 28px; } }
        </style>
      </head>
      <body>
        <main class="page">
          <div class="brand"><span>Executive Search AI</span><span>${today}</span></div>
          <h1>${name}</h1>
          <div class="sub">Client submission package for ${module} mandate</div>

          <h2>Section 1 · Executive Summary</h2>
          <ul>${summaryBullets.map((item) => `<li>${item}</li>`).join("")}</ul>

          <h2>Section 2 · Client Submission Email</h2>
          <div class="email">${emailLines.join("\n\n")}</div>

          <h2>Section 3 · Candidate Highlights</h2>
          <div class="grid">${highlights.map((item) => `<div class="card"><div class="value">&#10003; ${item}</div></div>`).join("")}</div>

          <h2>Section 4 · Client Risks</h2>
          <ul>${(risks.length ? risks : ["Unknown risks require recruiter validation"]).map((item) => `<li>${item}</li>`).join("")}</ul>

          <h2>Section 5 · Interview Focus</h2>
          <ul>${questions.map((item) => `<li>${item}</li>`).join("")}</ul>

          <h2>Section 6 · Submission Confidence</h2>
          <div class="card"><div class="confidence">${confidence.label}</div><div class="value">${confidence.reason}</div></div>

          <h2>Section 7 · One-line Sales Pitch</h2>
          <div class="pitch">${oneLinePitch}</div>
        </main>
      </body>
    </html>`;

  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
}
async function safeReadJson(res: Response) {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("API returned an invalid response. Please check the server logs.");
  }
}

export default function MatchesPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [clientMode, setClientMode] = useState(true);
  const [matches, setMatches] = useState<MatchCandidate[]>([]);
  const [apiMode, setApiMode] = useState<"Client" | "Internal">("Client");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [workflowMessage, setWorkflowMessage] = useState("");
  const [aiSearchQuery, setAiSearchQuery] = useState("");
  const [aiSearchIntent, setAiSearchIntent] = useState<any>(null);
  const [aiSearchActive, setAiSearchActive] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [showShortlistBoard, setShowShortlistBoard] = useState(false);
  const [selectedCandidateKey, setSelectedCandidateKey] = useState("");
  const [searchSessionId, setSearchSessionId] = useState("");
  const comparisonRef = useRef<HTMLDivElement | null>(null);
  const shortlistBoardRef = useRef<HTMLDivElement | null>(null);
  const restoredPageStateRef = useRef(false);

  function scrollToSection(ref: React.RefObject<HTMLDivElement | null>) {
    window.setTimeout(() => {
      window.requestAnimationFrame(() => {
        ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }, 140);
  }

  function persistPageState(nextState?: Partial<{
    matches: MatchCandidate[];
    selectedJobId: string;
    clientMode: boolean;
    apiMode: "Client" | "Internal";
    showComparison: boolean;
    showShortlistBoard: boolean;
    selectedCandidateKey: string;
  }>) {
    if (typeof window === "undefined") return;

    const state = {
      selectedJobId,
      clientMode,
      apiMode,
      matches,
      showComparison,
      showShortlistBoard,
      selectedCandidateKey,
      savedAt: new Date().toISOString(),
      ...(nextState || {}),
    };

    try {
      const nextSearchSessionId = writeSearchSessionSnapshot({
        ...state,
        candidateIds: state.matches.map((candidate) => getMatchCandidateId(candidate)).filter(Boolean),
        primaryModule,
      });
      if (nextSearchSessionId) setSearchSessionId(nextSearchSessionId);
    } catch {}
  }


  const selectedJob = useMemo(() => jobs.find((j) => j.id === selectedJobId), [jobs, selectedJobId]);

  const requiredYears = selectedJob?.required_years ?? selectedJob?.requiredYears ?? 7;
  const primaryModule = selectedJob?.primary_module ?? selectedJob?.primaryModule ?? "UNKNOWN";

  const currentMode = apiMode || (clientMode ? "Client" : "Internal");
  const isClientModeDisplay = currentMode === "Client";

  const positiveLabel = isClientModeDisplay ? "Ready Pool" : "Strong Match";
  const backupLabel = isClientModeDisplay ? "Talent Pipeline" : "Backup Pool";
  const actionButtonLabel = isClientModeDisplay ? "Generate Client Shortlist" : "Generate Matches";
  const exportButtonLabel = isClientModeDisplay ? "Export Client-Ready CSV" : "Export Strong Match CSV";

  const positiveMatches = matches.filter((c) => (isClientModeDisplay ? isClientReady(c) : isStrongMatch(c)));
  const backupMatches = matches.filter((c) => getScore(c) < 70);
  const reviewMatches = matches.filter((c) => {
    const isPositive = isClientModeDisplay ? isClientReady(c) : isStrongMatch(c);
    return !isPositive && getScore(c) >= 70;
  });
  const reviewLabel = isClientModeDisplay ? "Under Review" : "Recruiter Review";
  const sortedMatches = useMemo(() => [...matches].sort((a, b) => getScore(b) - getScore(a)), [matches]);
  const top10Shortlist = sortedMatches.slice(0, 10);
  const comparisonCandidates = sortedMatches.slice(0, 3);
  const selectedCandidate = useMemo(() => {
    if (!matches.length) return null;
    return (
      matches.find((candidate, index) => getCandidateKey(candidate, index) === selectedCandidateKey) ||
      sortedMatches[0]
    );
  }, [matches, selectedCandidateKey, sortedMatches]);

  function getCandidateStatusLabel(candidate: MatchCandidate) {
    return getDisplayCandidateStatus(candidate, isClientModeDisplay);
  }

  const loadJobs = useCallback(async () => {
    try {
      setError("");
      const res = await fetch("/api/jobs", { cache: "no-store" });
      const data = await safeReadJson(res);
      const rows = Array.isArray(data) ? data : data.jobs || data.data || [];
      setJobs(rows);
      if (rows.length) setSelectedJobId((current) => current || rows[0].id);
    } catch (err: any) {
      setError(err?.message || "Unable to load jobs.");
    }
  }, []);

  async function generateMatches() {
    if (!selectedJobId) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: selectedJobId, clientMode }),
      });

      const data = await safeReadJson(res);

      if (!res.ok) throw new Error(data?.error || `Match API failed with status ${res.status}`);

      const rows = data.matches || data.results || data.data || [];
      const normalizedRows = normalizeMatchesForDisplay(rows, data?.job?.primary_module || data?.job?.primaryModule || primaryModule);

      setApiMode(data.mode === "Internal" ? "Internal" : "Client");
      setAiSearchActive(false);
      setAiSearchIntent(null);
      setMatches(normalizedRows);
      setShowComparison(false);
      setShowShortlistBoard(false);
      setSelectedCandidateKey(normalizedRows?.[0] ? getCandidateKey(normalizedRows[0], 0) : "");
    } catch (err: any) {
      setError(err?.message || "Match generation failed.");
      setMatches([]);
    } finally {
      setLoading(false);
    }
  }


  async function runAiSearch() {
    const query = aiSearchQuery.trim();
    if (!query) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, limit: 300 }),
      });

      const data = await safeReadJson(res);
      if (!res.ok) throw new Error(data?.error || `AI Search API failed with status ${res.status}`);

      const rows = data.results || data.candidates || data.data || [];
      const normalizedRows = normalizeMatchesForDisplay(rows, primaryModule);
      setMatches(normalizedRows);
      setAiSearchIntent(data.intent || null);
      setAiSearchActive(true);
      setApiMode(clientMode ? "Client" : "Internal");
      setShowComparison(false);
      setShowShortlistBoard(false);
      setSelectedCandidateKey(normalizedRows?.[0] ? getCandidateKey(normalizedRows[0], 0) : "");
    } catch (err: any) {
      setError(err?.message || "AI search failed.");
      setMatches([]);
    } finally {
      setLoading(false);
    }
  }

  async function saveTopTalentPool() {
    const candidatesToSave = top10Shortlist.length ? top10Shortlist : sortedMatches.slice(0, 10);
    if (!candidatesToSave.length) return;

    setWorkflowMessage("");
    try {
      const res = await fetch("/api/talent-pools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: selectedJob ? `${selectedJob.title} â€” Top Talent Pool` : "SAP Talent Pool",
          description: "Auto-created from SAP Talent Hub match results.",
          source: aiSearchActive ? "ai_search" : "job_match",
          jobId: selectedJobId,
          candidateIds: candidatesToSave.map((candidate) => candidate.id || candidate.candidate_id).filter(Boolean),
          metadata: {
            mode: currentMode,
            primaryModule,
            requiredYears,
            aiSearchIntent,
          },
        }),
      });
      const data = await safeReadJson(res);
      if (!res.ok) throw new Error(data?.error || "Unable to save talent pool.");
      setWorkflowMessage(`Saved ${data.count || candidatesToSave.length} candidate(s) to Talent Pool.`);
    } catch (err: any) {
      setError(err?.message || "Talent Pool save failed.");
    }
  }

  async function createJobShortlist() {
    const candidatesToSave = positiveMatches.length ? positiveMatches : top10Shortlist;
    if (!candidatesToSave.length) return;

    setWorkflowMessage("");
    try {
      const res = await fetch("/api/shortlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: selectedJobId,
          name: selectedJob ? `${selectedJob.title} â€” ${isClientModeDisplay ? "Client Shortlist" : "Recruiter Shortlist"}` : "SAP Job Shortlist",
          mode: isClientModeDisplay ? "client" : "recruiter",
          stage: isClientModeDisplay ? "ready_pool" : "strong_match",
          candidateIds: candidatesToSave.map((candidate) => candidate.id || candidate.candidate_id).filter(Boolean),
          metadata: {
            primaryModule,
            requiredYears,
            generatedFrom: aiSearchActive ? "ai_search" : "match_results",
          },
        }),
      });
      const data = await safeReadJson(res);
      if (!res.ok) throw new Error(data?.error || "Unable to create shortlist.");
      setWorkflowMessage(`Created shortlist with ${data.count || candidatesToSave.length} candidate(s).`);
    } catch (err: any) {
      setError(err?.message || "Shortlist creation failed.");
    }
  }

  function getPipelineStage(candidate: MatchCandidate) {
    return getPipelineStageLabel(candidate, isClientModeDisplay);
  }

  function csvCell(value: any, forceText = false) {
    const raw = value === null || value === undefined ? "" : String(value);
    const safe = forceText && raw ? `\t${raw}` : raw;
    return `"${safe.replace(/"/g, '""')}"`;
  }

  function exportCsv(exportAll = false) {
    const rows = exportAll
      ? matches
      : isClientModeDisplay
      ? matches.filter(isClientReady)
      : matches.filter(isStrongMatch);

    const headers = [
      "candidate_id",
      "rank",
      "name",
      "title",
      "email",
      "phone",
      "location",
      "primary_module",
      "secondary_modules",
      "years",
      "implementation_projects",
      "rollout_projects",
      "ams_support_projects",
      "s4hana_projects",
      "ecc_projects",
      "match_score",
      "ai_confidence",
      "talent_intelligence_score",
      "market_positioning",
      "sap_expertise_level",
      "sap_career_level",
      "pipeline_stage",
      "status",
      "implementation_authority",
      "domain_authority",
      "role_fit",
      "module_authority",
      "process_technical_depth",
      "consulting_dna",
      "sap_signals",
      "recommendation",
      "candidate_headline",
      "hiring_risk",
      "time_to_productivity",
      "interview_recommendation",
      "offer_acceptance_probability",
      "offer_acceptance_drivers",
      "offer_acceptance_risks",
      "counter_offer_risk",
      "job_hopping_risk",
      "relocation_risk",
      "notice_period_risk",
      "overall_risk_score",
      "salary_market_range",
      "salary_positioning",
      "ranking_explanation",
      "executive_summary",
    ];

    const csv = [
      headers.join(","),
      ...rows.map((c) => {
        const insight = buildAiInsights(c, matches);

        return headers
          .map((h) => {
            const value =
              h === "candidate_id"
                ? c.id || c.candidate_id || ""
                : h === "rank"
                ? insight.ranking
                : h === "name"
                ? getCandidateName(c)
                : h === "title"
                ? getCandidateTitle(c)
                : h === "email"
                ? getCandidateEmail(c)
                : h === "phone"
                ? getCandidatePhone(c)
                : h === "location"
                ? c.location || ""
                : h === "primary_module"
                ? getPrimaryModuleDisplay(c)
                : h === "secondary_modules"
                ? getSecondaryModules(c)
                : h === "years"
                ? getYears(c)
                : h === "implementation_projects"
                ? getImplementation(c)
                : h === "rollout_projects"
                ? getRollout(c)
                : h === "ams_support_projects"
                ? getAms(c)
                : h === "s4hana_projects"
                ? getS4hana(c)
                : h === "ecc_projects"
                ? getEcc(c)
                : h === "match_score"
                ? getScore(c)
                : h === "ai_confidence"
                ? insight.confidence
                : h === "talent_intelligence_score"
                ? insight.talentIntelligenceScore
                : h === "market_positioning"
                ? getMarketPositioningLabel(insight.marketPositioning, isClientModeDisplay)
                : h === "sap_expertise_level"
                ? insight.sapExpertiseLevel
                : h === "sap_career_level"
                ? insight.sapCareerLevel
                : h === "pipeline_stage"
                ? getPipelineStage(c)
                : h === "status"
                ? getCandidateStatusLabel(c)
                : h === "implementation_authority"
                ? getImplementationAuthority(c)
                : h === "domain_authority"
                ? getDomainAuthority(c)
                : h === "role_fit"
                ? getRoleFit(c)
                : h === "module_authority"
                ? getModuleAuthority(c)
                : h === "process_technical_depth"
                ? getDepthValue(c)
                : h === "consulting_dna"
                ? getConsultingDNA(c)
                : h === "sap_signals"
                ? insight.sapSignals.join(" | ")
                : h === "recommendation"
                ? insight.recommendation
                : h === "candidate_headline"
                ? `${getYears(c)}y ${getPrimaryModuleDisplay(c)} | ${getImplementation(c)} Impl | ${getS4hana(c)} S/4HANA | ${insight.sapCareerLevel}`
                : h === "hiring_risk"
                ? insight.hiringRisk
                : h === "time_to_productivity"
                ? insight.timeToProductivity
                : h === "interview_recommendation"
                ? insight.interviewRecommendation
                : h === "offer_acceptance_probability"
                ? `${insight.offerAcceptanceProbability}%`
                : h === "salary_market_range"
                ? insight.salaryBenchmark.marketRange
                : h === "salary_positioning"
                ? insight.salaryBenchmark.candidatePositioning
                : h === "ranking_explanation"
                ? insight.rankingExplanation.join(" | ")
                : h === "executive_summary"
                ? insight.executiveSummary
                : c[h] ?? "";

            return csvCell(value, h === "phone" || h === "email" || h === "candidate_id");
          })
          .join(",");
      }),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = exportAll
      ? "all-ai-matches.csv"
      : isClientModeDisplay
      ? "client-ready-ai-shortlist.csv"
      : "strong-matches-ai-insights.csv";

    a.click();
    URL.revokeObjectURL(url);
  }


  useEffect(() => {
    if (restoredPageStateRef.current) return;
    restoredPageStateRef.current = true;

    try {
      const cached = window.sessionStorage.getItem(MATCHES_CACHE_KEY);
      if (!cached) return;

      const state = JSON.parse(cached);
      if (!state || !Array.isArray(state.matches)) return;

      if (state.selectedJobId) setSelectedJobId(state.selectedJobId);
      if (typeof state.clientMode === "boolean") setClientMode(state.clientMode);
      if (state.apiMode === "Client" || state.apiMode === "Internal") setApiMode(state.apiMode);
      if (state.searchSessionId) setSearchSessionId(String(state.searchSessionId));
      setMatches(state.matches);
      if (typeof state.showComparison === "boolean") setShowComparison(state.showComparison);
      if (typeof state.showShortlistBoard === "boolean") setShowShortlistBoard(state.showShortlistBoard);
      if (state.selectedCandidateKey) setSelectedCandidateKey(String(state.selectedCandidateKey));
    } catch {
      window.sessionStorage.removeItem(MATCHES_CACHE_KEY);
    }
  }, []);

  useEffect(() => {
    if (!restoredPageStateRef.current) return;

    if (!matches.length) return;

    try {
      const nextSearchSessionId = writeSearchSessionSnapshot({
        selectedJobId,
        clientMode,
        apiMode,
        matches,
        candidateIds: matches.map((candidate) => getMatchCandidateId(candidate)).filter(Boolean),
        primaryModule,
        showComparison,
        showShortlistBoard,
        selectedCandidateKey,
      });
      if (nextSearchSessionId) setSearchSessionId(nextSearchSessionId);
    } catch {}
  }, [selectedJobId, clientMode, apiMode, matches, primaryModule, showComparison, showShortlistBoard, selectedCandidateKey]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-semibold">Match Results</h1>
        <a href="/search" className="text-blue-300 font-semibold">
          Talent Pool Search â†’
        </a>
      </div>

      <section className="bg-[#171a1f] border border-[#30363d] rounded-xl p-6 mb-8">
        <label className="block text-sm font-semibold mb-3">Select Job</label>

        <select
          value={selectedJobId}
          onChange={(e) => {
            setSelectedJobId(e.target.value);
            setMatches([]);
            setShowComparison(false);
            setShowShortlistBoard(false);
            setSelectedCandidateKey("");
            window.sessionStorage.removeItem(MATCHES_CACHE_KEY);
          }}
          className="w-full bg-black border border-gray-600 rounded px-4 py-3 mb-5"
        >
          {jobs.length ? (
            jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.title}
              </option>
            ))
          ) : (
            <option value="">No jobs available</option>
          )}
        </select>

        <label className="flex items-center gap-2 text-sm font-semibold mb-5">
          <input
            type="checkbox"
            checked={clientMode}
            onChange={(e) => {
              setClientMode(e.target.checked);
              setApiMode(e.target.checked ? "Client" : "Internal");
              setMatches([]);
              setShowComparison(false);
              setShowShortlistBoard(false);
              setSelectedCandidateKey("");
              window.sessionStorage.removeItem(MATCHES_CACHE_KEY);
            }}
          />
          {clientMode
            ? "Client Mode - polished shortlist for client presentation"
            : "Internal Mode - recruiter intelligence with broader talent pool"}
        </label>

        <div className="mb-5 rounded-xl border border-cyan-500/30 bg-slate-950/40 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-cyan-300 mb-2">AI Talent Search</label>
              <input
                value={aiSearchQuery}
                onChange={(event) => setAiSearchQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") runAiSearch();
                }}
                placeholder="Example: SAP FICO Malaysia S/4HANA Greenfield 10 years"
                className="w-full rounded-lg border border-slate-600 bg-black px-4 py-3 text-white outline-none focus:border-cyan-400"
              />
            </div>
            <button
              type="button"
              onClick={runAiSearch}
              disabled={loading || !aiSearchQuery.trim()}
              className="rounded-lg bg-cyan-600 px-5 py-3 font-bold text-white hover:bg-cyan-500 disabled:opacity-50"
            >
              AI Search
            </button>
          </div>
          {aiSearchActive && aiSearchIntent ? (
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-cyan-200">
              <span className="rounded-full border border-cyan-500/40 px-3 py-1">Intent: {aiSearchIntent.primaryModule || "Any SAP"}</span>
              {aiSearchIntent.country ? <span className="rounded-full border border-cyan-500/40 px-3 py-1">Country: {aiSearchIntent.country}</span> : null}
              {aiSearchIntent.minYears ? <span className="rounded-full border border-cyan-500/40 px-3 py-1">Min Years: {aiSearchIntent.minYears}</span> : null}
              {Array.isArray(aiSearchIntent.signals) && aiSearchIntent.signals.length ? (
                <span className="rounded-full border border-cyan-500/40 px-3 py-1">Signals: {aiSearchIntent.signals.slice(0, 4).join(", ")}</span>
              ) : null}
            </div>
          ) : null}
        </div>

        {error && (
          <div className="bg-red-950 border border-red-700 text-red-200 rounded-lg p-4 mb-5 font-semibold">
            {error}
          </div>
        )}

        {workflowMessage && (
          <div className="bg-emerald-950/60 border border-emerald-700 text-emerald-200 rounded-lg p-4 mb-5 font-semibold">
            {workflowMessage}
          </div>
        )}

        <div className="flex flex-wrap gap-4 mb-6">
          <button
            onClick={generateMatches}
            disabled={loading || !selectedJobId}
            className="bg-green-600 hover:bg-green-700 disabled:opacity-50 px-6 py-3 rounded-lg font-bold"
          >
            {loading ? "Generating..." : actionButtonLabel}
          </button>

          <button
            onClick={() => exportCsv(false)}
            disabled={!positiveMatches.length}
            className="bg-[#1f252d] border border-[#3a424d] px-6 py-3 rounded-lg font-bold disabled:opacity-50"
          >
            {exportButtonLabel}
          </button>

          <button
            onClick={() => exportCsv(true)}
            disabled={!matches.length}
            className="bg-[#1f252d] border border-[#3a424d] px-6 py-3 rounded-lg font-bold disabled:opacity-50"
          >
            Export All AI Results
          </button>

          <button
            onClick={() => {
              setShowComparison(true);
              persistPageState({ showComparison: true });
              scrollToSection(comparisonRef);
            }}
            disabled={matches.length < 2}
            className="bg-[#1f252d] border border-[#3a424d] px-6 py-3 rounded-lg font-bold disabled:opacity-50"
          >
            Compare Candidates
          </button>

          <button
            onClick={() => {
              setShowShortlistBoard(true);
              persistPageState({ showShortlistBoard: true });
              scrollToSection(shortlistBoardRef);
            }}
            disabled={!matches.length}
            className="bg-[#1f252d] border border-[#3a424d] px-6 py-3 rounded-lg font-bold disabled:opacity-50"
          >
            Shortlist Board
          </button>

          <button
            onClick={saveTopTalentPool}
            disabled={!matches.length}
            className="bg-cyan-700 hover:bg-cyan-600 border border-cyan-500/40 px-6 py-3 rounded-lg font-bold disabled:opacity-50"
          >
            Save Talent Pool
          </button>

          <button
            onClick={createJobShortlist}
            disabled={!matches.length || !selectedJobId}
            className="bg-purple-700 hover:bg-purple-600 border border-purple-500/40 px-6 py-3 rounded-lg font-bold disabled:opacity-50"
          >
            Create Job Shortlist
          </button>
        </div>

        <div className="grid grid-cols-5 gap-4 mb-4">
          <MetricCard label="Matches Found" value={matches.length} />
          <MetricCard label={positiveLabel} value={positiveMatches.length} />
          <MetricCard label={reviewLabel} value={reviewMatches.length} />
          <MetricCard label={backupLabel} value={backupMatches.length} />
          <MetricCard label="Mode" value={currentMode} />
        </div>

        <div className="text-blue-300 text-sm font-semibold">
          Required years: {requiredYears} | Primary module: {primaryModule}
        </div>
      </section>

      {!loading && !matches.length && !error && (
        <div className="bg-[#171a1f] border border-[#30363d] rounded-xl p-8 text-center text-blue-200 font-semibold">
          Select a job and generate matches to view AI recruiter recommendations.
        </div>
      )}

      {matches.length > 0 && (
        <EnterpriseTalentIntelligence
          candidates={matches}
          primaryModule={primaryModule}
          clientView={isClientModeDisplay}
        />
      )}

      {matches.length > 0 && (
        <ExecutiveShortlistRecommendation
          candidates={top10Shortlist}
          allCandidates={matches}
          clientView={isClientModeDisplay}
          selectedCandidate={selectedCandidate}
          onSelectCandidate={(candidate, index) => setSelectedCandidateKey(getCandidateKey(candidate, index))}
          onGeneratePack={() => generateClientSubmissionPack(comparisonCandidates, matches, primaryModule)}
          searchSessionId={searchSessionId}
        />
      )}

      {matches.length > 0 && (
        <ExecutiveSearchCopilot
          candidates={matches}
          selectedCandidate={selectedCandidate}
          primaryModule={String(primaryModule)}
        />
      )}

      {matches.length > 1 && (
        <CandidateSimilaritySearch
          candidates={matches}
          referenceCandidate={selectedCandidate}
          onSelectCandidate={(candidate, index) => setSelectedCandidateKey(getCandidateKey(candidate, index))}
        />
      )}

      {((isClientModeDisplay && comparisonCandidates.length >= 2) || (showComparison && comparisonCandidates.length >= 2)) && (
        <div ref={comparisonRef} id="candidate-comparison" className="scroll-mt-6 rounded-xl border border-[#30363d] bg-[#171a1f] p-5 mb-8">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">Compare Shortlist</div>
              <div className="mt-1 text-xl font-bold text-white">Open executive comparison workspace</div>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-blue-200">Match Results stays focused on the candidate pipeline. Detailed trade-offs, risks, and side-by-side reasoning now live in the Compare workspace.</p>
            </div>
            <a
              href={"/compare-ids=" + encodeURIComponent(comparisonCandidates.map((candidate) => String(candidate.id || candidate.candidate_id || candidate.email || getCandidateName(candidate))).filter(Boolean).slice(0, 5).join(",")) + "&module=" + encodeURIComponent(String(primaryModule || "")) + "&source=shortlist"}
              className="inline-flex shrink-0 items-center justify-center rounded-lg bg-cyan-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-cyan-600"
            >
              Compare Shortlist
            </a>
          </div>
        </div>
      )}

      {(showShortlistBoard || isClientModeDisplay) && matches.length > 0 && (
        <div ref={shortlistBoardRef} id="shortlist-board" className="scroll-mt-6">
          <ShortlistBoard
            candidates={matches}
            allCandidates={matches}
            clientView={isClientModeDisplay}
            primaryModule={String(primaryModule)}
            onSelectCandidate={(candidate, index) => setSelectedCandidateKey(getCandidateKey(candidate, index))}
            onWorkflowMessage={setWorkflowMessage}
          />
        </div>
      )}

      {selectedCandidate && (
        <CandidateCard
          candidate={selectedCandidate}
          allCandidates={matches}
          statusLabel={getCandidateStatusLabel(selectedCandidate)}
          clientView={isClientModeDisplay}
        />
      )}
    </main>
  );
}

function MetricCard({ label, value }: { label: string; value: any }) {
  return (
    <div className="bg-[#22272e] rounded-lg p-4">
      <div className="text-xs text-blue-200 mb-2">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}




type CopilotResponse = {
  answer: string;
  reasoning: string;
  evidence: string[];
  action: string;
  confidence: "High" | "Medium" | "Low";
};

function confidenceFromEvidence(evidence: string[]) {
  const known = evidence.filter((item) => !/unknown|requires validation|to confirm/i.test(item)).length;
  if (known >= 3) return "High";
  if (known >= 2) return "Medium";
  return "Low";
}

function candidateEvidence(candidate: MatchCandidate) {
  return uniqueStrings([
    `${getScore(candidate)}% match strength`,
    getImplementation(candidate) ? `${getImplementation(candidate)} implementation signal(s)` : "Implementation ownership Unknown",
    getArchitectureSignal(candidate) ? "Architecture responsibility detected" : "Architecture responsibility Unknown",
    getConsultingSignal(candidate) ? "Consulting DNA detected" : "Consulting DNA Unknown",
    getModuleAuthority(candidate) ? `${getPrimaryModuleDisplay(candidate)} module authority ${getModuleAuthority(candidate)}%` : `${getPrimaryModuleDisplay(candidate)} module authority Unknown`,
    hasContact(candidate) ? "Contact path available" : "Contact path Unknown",
  ]).slice(0, 5);
}

function safestCandidate(candidates: MatchCandidate[]) {
  return [...candidates].sort((a, b) => {
    const riskA = buildAiInsights(a, candidates).riskRadar.overallRiskScore;
    const riskB = buildAiInsights(b, candidates).riskRadar.overallRiskScore;
    return riskA - riskB || getScore(b) - getScore(a);
  })[0];
}

function strongestBy(candidates: MatchCandidate[], signal: "btp" | "implementation" | "architecture" | "leadership" | "consulting" | "offer" | "risk") {
  return [...candidates].sort((a, b) => {
    const value = (candidate: MatchCandidate) => {
      if (signal === "btp") return getPrimaryModule(candidate) === "BTP" ? Math.max(getModuleAuthority(candidate), getScore(candidate)) + 12 : Math.max(getModuleAuthority(candidate), getScore(candidate));
      if (signal === "implementation") return Math.max(getImplementationAuthority(candidate), getImplementation(candidate) * 18);
      if (signal === "architecture") return getArchitectureSignal(candidate);
      if (signal === "leadership") return Math.max(getConsultingDNA(candidate), /lead|manager|principal|head|director/i.test(getCandidateTitle(candidate)) ? 82 : 0);
      if (signal === "consulting") return getConsultingSignal(candidate);
      if (signal === "offer") return buildAiInsights(candidate, candidates).offerAcceptanceProbability;
      if (signal === "risk") return 100 - buildAiInsights(candidate, candidates).riskRadar.overallRiskScore;
      return getScore(candidate);
    };
    return value(b) - value(a);
  })[0];
}

function buildCopilotResponse(question: string, candidates: MatchCandidate[], selectedCandidate: MatchCandidate | null, primaryModule: string): CopilotResponse {
  const slate = [...candidates].sort((a, b) => getScore(b) - getScore(a)).slice(0, 10);
  const top = slate[0];
  const second = slate[1];
  const active = selectedCandidate || top;
  const q = question.toLowerCase();

  if (!active) {
    return {
      answer: "Unknown. No candidate slate is loaded.",
      reasoning: "The copilot needs generated matches before it can compare or recommend candidates.",
      evidence: ["No match data available"],
      action: "Generate matches for a job, then ask again.",
      confidence: "Low",
    };
  }

  let candidate = top;
  let answer = `${getCandidateName(top)} should be reviewed first.`;
  let reasoning = "This profile has the strongest current match position in the loaded slate.";
  let action = "Run a focused recruiter screen before client submission.";

  if (/replace|candidate a|candidate b/i.test(question) && top && second) {
    const leader = getScore(top) >= getScore(second) ? top : second;
    const challenger = leader === top ? second : top;
    candidate = leader;
    answer = `${getCandidateName(leader)} remains stronger than ${getCandidateName(challenger)}.`;
    reasoning = "The stronger profile has better overall match strength and more defensible submission evidence.";
    action = `Validate ${getCandidateName(challenger)} on implementation ownership before replacing ${getCandidateName(leader)}.`;
  } else if (/btp|module/i.test(q)) {
    candidate = strongestBy(slate, "btp");
    answer = `${getCandidateName(candidate)} is strongest for SAP ${getPrimaryModuleDisplay(candidate)} in this slate.`;
    reasoning = "Module fit is the strongest available differentiator for this question.";
    action = "Confirm recent project scope and hands-on ownership before client positioning.";
  } else if (/implementation|ownership/i.test(q)) {
    candidate = strongestBy(slate, "implementation");
    answer = `${getCandidateName(candidate)} shows the strongest implementation ownership evidence.`;
    reasoning = "Implementation authority and implementation count are stronger than the rest of the current slate.";
    action = "Validate full-cycle ownership from design through go-live or hypercare.";
  } else if (/architecture|architect/i.test(q)) {
    candidate = strongestBy(slate, "architecture");
    answer = `${getCandidateName(candidate)} has the strongest architecture signal.`;
    reasoning = "Architecture title, solution design language, domain authority and role fit are the clearest available indicators.";
    action = "Ask for the most recent architecture decision they personally owned.";
  } else if (/consulting|deloitte/i.test(q)) {
    candidate = strongestBy(slate, "consulting");
    answer = `${getCandidateName(candidate)} is the strongest consulting-style profile for a Deloitte-type environment.`;
    reasoning = "Consulting DNA, client-facing language and enterprise delivery signals are most relevant to that environment.";
    action = "Validate stakeholder management, workshop ownership and consulting delivery cadence.";
  } else if (/leadership|leader/i.test(q)) {
    candidate = strongestBy(slate, "leadership");
    answer = `${getCandidateName(candidate)} has the strongest leadership profile.`;
    reasoning = "Leadership signal is based on title seniority, consulting DNA and enterprise delivery authority.";
    action = "Confirm team size, decision authority and client escalation ownership.";
  } else if (/safe|risk|safest/i.test(q)) {
    candidate = safestCandidate(slate);
    const risk = buildAiInsights(candidate, slate).riskRadar.overallRiskScore;
    answer = `${getCandidateName(candidate)} is currently the safest submission.`;
    reasoning = `This profile has the lowest visible submission risk in the current slate at ${risk}%.`;
    action = "Still confirm availability, package and notice before release.";
  } else if (/offer/i.test(q)) {
    candidate = strongestBy(slate, "offer");
    const offer = buildAiInsights(candidate, slate).offerAcceptanceProbability;
    answer = `${getCandidateName(candidate)} is most likely to progress toward offer.`;
    reasoning = `Offer acceptance outlook is strongest at ${offer}% among the compared candidates.`;
    action = "Move this profile into first interview while confirming compensation expectations early.";
  } else if (/submit|interview first|interview/i.test(q)) {
    candidate = active;
    const confidence = submissionConfidence(candidate, buildAiInsights(candidate, slate));
    answer = confidence.label === "Ready" ? `Submit ${getCandidateName(candidate)} after recruiter confirmation.` : `Do not submit ${getCandidateName(candidate)} without validation.`;
    reasoning = confidence.reason;
    action = confidence.label === "Ready" ? "Prepare the client submission package and book a validation screen." : "Validate implementation ownership, notice and salary before submission.";
  } else if (/confidence|62|why/i.test(q)) {
    candidate = active;
    const insight = buildAiInsights(candidate, slate);
    answer = `${getCandidateName(candidate)} confidence is constrained by unresolved validation signals.`;
    reasoning = "Confidence drops when delivery ownership, contact readiness, salary, notice or client-risk signals are incomplete.";
    action = "Resolve the highest-impact unknown first: implementation ownership, availability or package.";
    return {
      answer,
      reasoning,
      evidence: uniqueStrings([
        `${getScore(candidate)}% match strength`,
        `Risk radar ${insight.riskRadar.overallRiskScore}%`,
        ...buildSubmissionRisks(candidate, insight),
      ]).slice(0, 5),
      action,
      confidence: "Medium",
    };
  } else if (/similar|find another/i.test(q)) {
    const reference = active;
    candidate = slate.find((item) => getCandidateKey(item) !== getCandidateKey(reference) && Math.abs(getArchitectureSignal(item) - getArchitectureSignal(reference)) <= 15) || second || reference;
    answer = candidate === reference ? "Unknown. No clearly similar alternative is available in the current slate." : `${getCandidateName(candidate)} is the closest architecture-style alternative to ${getCandidateName(reference)}.`;
    reasoning = "Similarity is based on architecture signal, module fit and seniority indicators available in the current results.";
    action = candidate === reference ? "Broaden the search or generate a larger match pool." : "Compare recent architecture ownership before replacing the reference candidate.";
  }

  const evidence = candidateEvidence(candidate);
  return { answer, reasoning, evidence, action, confidence: confidenceFromEvidence(evidence) };
}

type SimilarityProfile = {
  candidate: MatchCandidate;
  similarity: number;
  careerDna: number;
  leadership: number;
  implementation: number;
  architecture: number;
  risk: number;
  reasons: string[];
  hiddenAlternative: boolean;
  replacement: "Yes" | "Conditional" | "No";
};

function closeness(a: number, b: number) {
  return Math.max(0, 100 - Math.abs(Math.round(a || 0) - Math.round(b || 0)));
}

function boolCloseness(a: boolean, b: boolean) {
  return a === b ? 100 : 35;
}

function regionalExposure(candidate: MatchCandidate) {
  const text = candidateSignalText(candidate);
  const countrySignals = ["malaysia", "singapore", "thailand", "vietnam", "indonesia", "philippines", "australia", "japan", "india", "china"].filter((country) => text.includes(country)).length;
  return Math.min(100, countrySignals * 22 + (getCountryCode(candidate) !== "SEA" ? 24 : 0));
}

function transformationExposure(candidate: MatchCandidate) {
  const insight = buildAiInsights(candidate, [candidate]);
  const signals = insight.sapSignals.join(" ").toLowerCase();
  return Math.min(100, getS4hana(candidate) * 14 + getImplementation(candidate) * 8 + (/greenfield|brownfield|migration|transformation/.test(signals) ? 28 : 0));
}

function enterpriseScale(candidate: MatchCandidate) {
  const text = candidateSignalText(candidate);
  return Math.min(100, getImplementation(candidate) * 10 + getS4hana(candidate) * 8 + (/enterprise|global|regional|rollout|template|multi-country|multinational/.test(text) ? 34 : 0));
}

function careerDnaVector(candidate: MatchCandidate) {
  return {
    careerProgression: Math.min(100, getYears(candidate) * 4 + (/senior|lead|manager|architect|principal|director/i.test(getCandidateTitle(candidate)) ? 28 : 0)),
    consultingDna: getConsultingSignal(candidate),
    implementationOwnership: Math.max(getImplementationAuthority(candidate), getImplementation(candidate) * 18),
    architectureMaturity: getArchitectureSignal(candidate),
    leadershipGrowth: Math.max(getConsultingDNA(candidate), /lead|manager|principal|head|director/i.test(getCandidateTitle(candidate)) ? 82 : 0),
    stakeholderLevel: getStakeholderSignal(candidate),
    deliveryScale: Math.min(100, getImplementation(candidate) * 12 + getRollout(candidate) * 8 + getS4hana(candidate) * 8),
    regionalExposure: regionalExposure(candidate),
    industryExperience: candidate.industry || candidate.industries || candidate.domain ? 72 : 0,
    moduleConsistency: Math.max(getModuleAuthority(candidate), getScore(candidate)),
    promotionPattern: /senior|lead|manager|architect|principal|director/i.test(getCandidateTitle(candidate)) ? 78 : Math.min(70, getYears(candidate) * 4),
    projectComplexity: Math.min(100, getImplementation(candidate) * 10 + getS4hana(candidate) * 12 + getAms(candidate) * 4),
    clientFacing: getStakeholderSignal(candidate) || getConsultingSignal(candidate),
    transformationExposure: transformationExposure(candidate),
    enterpriseScale: enterpriseScale(candidate),
    risk: 100 - buildAiInsights(candidate, [candidate]).riskRadar.overallRiskScore,
  };
}

function buildSimilarityReasons(reference: MatchCandidate, candidate: MatchCandidate) {
  const ref = careerDnaVector(reference);
  const next = careerDnaVector(candidate);
  return uniqueStrings([
    closeness(ref.careerProgression, next.careerProgression) >= 75 ? "Similar career progression" : "Different progression pattern",
    closeness(ref.consultingDna, next.consultingDna) >= 75 ? "Comparable consulting maturity" : "Consulting maturity differs",
    closeness(ref.implementationOwnership, next.implementationOwnership) >= 75 ? "Similar delivery ownership" : next.implementationOwnership > ref.implementationOwnership ? "Higher implementation ownership" : "Lower implementation ownership",
    closeness(ref.architectureMaturity, next.architectureMaturity) >= 75 ? "Architecture evolution aligns" : "Architecture maturity differs",
    closeness(ref.leadershipGrowth, next.leadershipGrowth) >= 75 ? "Leadership growth is comparable" : next.leadershipGrowth > ref.leadershipGrowth ? "Stronger leadership signal" : "Lower leadership signal",
    closeness(ref.transformationExposure, next.transformationExposure) >= 75 ? "Transformation exposure feels similar" : "Transformation exposure differs",
  ]).slice(0, 5);
}

function buildSimilarityProfiles(reference: MatchCandidate, candidates: MatchCandidate[]) {
  const ref = careerDnaVector(reference);
  return candidates
    .filter((candidate) => getCandidateKey(candidate) !== getCandidateKey(reference))
    .map((candidate) => {
      const next = careerDnaVector(candidate);
      const careerDna = Math.round([
        closeness(ref.careerProgression, next.careerProgression),
        closeness(ref.consultingDna, next.consultingDna),
        closeness(ref.stakeholderLevel, next.stakeholderLevel),
        closeness(ref.deliveryScale, next.deliveryScale),
        closeness(ref.regionalExposure, next.regionalExposure),
        closeness(ref.moduleConsistency, next.moduleConsistency),
        closeness(ref.transformationExposure, next.transformationExposure),
        closeness(ref.enterpriseScale, next.enterpriseScale),
      ].reduce((sum, value) => sum + value, 0) / 8);
      const leadership = closeness(ref.leadershipGrowth, next.leadershipGrowth);
      const implementation = closeness(ref.implementationOwnership, next.implementationOwnership);
      const architecture = closeness(ref.architectureMaturity, next.architectureMaturity);
      const risk = closeness(ref.risk, next.risk);
      const similarity = Math.round(careerDna * 0.44 + leadership * 0.16 + implementation * 0.16 + architecture * 0.16 + risk * 0.08);
      const hiddenAlternative = getPrimaryModule(candidate) !== getPrimaryModule(reference) || Math.abs(getScore(candidate) - getScore(reference)) > 18;
      const replacement = similarity >= 86 && next.risk >= ref.risk - 10 ? "Yes" : similarity >= 72 ? "Conditional" : "No";
      return {
        candidate,
        similarity,
        careerDna,
        leadership,
        implementation,
        architecture,
        risk,
        reasons: buildSimilarityReasons(reference, candidate),
        hiddenAlternative,
        replacement,
      } satisfies SimilarityProfile;
    })
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 8);
}

function CandidateSimilaritySearch({
  candidates,
  referenceCandidate,
  onSelectCandidate,
}: {
  candidates: MatchCandidate[];
  referenceCandidate: MatchCandidate | null;
  onSelectCandidate: (candidate: MatchCandidate, index: number) => void;
}) {
  const reference = referenceCandidate || candidates[0];
  if (!reference) return null;

  const profiles = buildSimilarityProfiles(reference, candidates);
  const best = profiles[0];
  const hidden = profiles.filter((profile) => profile.hiddenAlternative).slice(0, 3);
  const recommendation = best
    ? `${getCandidateName(best.candidate)} should be contacted next because their career DNA is closest to ${getCandidateName(reference)} while preserving recruiter-validation visibility.`
    : "Insufficient comparable profiles in the current slate.";

  return (
    <section className="bg-[#171a1f] border border-[#30363d] rounded-xl p-6 mb-8 shadow-[0_20px_60px_rgba(0,0,0,0.24)]">
      <div className="flex flex-col gap-3 mb-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">AI Candidate Similarity Search</div>
          <h2 className="mt-2 text-2xl font-bold text-white">Career DNA match finder</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-blue-200">Reference profile: {getCandidateName(reference)}. Similarity is based on progression, consulting maturity, ownership, architecture evolution and delivery scale.</p>
        </div>
        <div className="rounded-full bg-[#11161d] px-4 py-2 text-xs font-bold text-blue-200 ring-1 ring-[#2a333d]">No keyword matching</div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_310px]">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {profiles.slice(0, 6).map((profile, index) => (
            <button
              key={`similar-${getCandidateKey(profile.candidate, index)}`}
              type="button"
              onClick={() => onSelectCandidate(profile.candidate, index)}
              className="rounded-2xl bg-[#11161d] p-4 text-left ring-1 ring-[#2a333d]/80 transition hover:-translate-y-0.5 hover:ring-cyan-500/30"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Rank #{index + 1}</div>
                  <div className="mt-1 text-lg font-black text-white">{getCandidateName(profile.candidate)}</div>
                  <div className="mt-1 text-xs text-blue-200">{getCandidateTitle(profile.candidate)}</div>
                </div>
                <div className="text-2xl font-black text-cyan-100">{profile.similarity}%</div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl bg-[#0d1218] p-2"><span className="text-slate-500">Career DNA</span><div className="font-bold text-white">{profile.careerDna}%</div></div>
                <div className="rounded-xl bg-[#0d1218] p-2"><span className="text-slate-500">Leadership</span><div className="font-bold text-white">{profile.leadership}%</div></div>
                <div className="rounded-xl bg-[#0d1218] p-2"><span className="text-slate-500">Implementation</span><div className="font-bold text-white">{profile.implementation}%</div></div>
                <div className="rounded-xl bg-[#0d1218] p-2"><span className="text-slate-500">Architecture</span><div className="font-bold text-white">{profile.architecture}%</div></div>
              </div>
              <div className="mt-3 space-y-1.5">
                {profile.reasons.slice(0, 4).map((reason) => <div key={reason} className="text-xs font-semibold leading-5 text-slate-300">&#10003; {reason}</div>)}
              </div>
            </button>
          ))}
        </div>

        <div className="space-y-3">
          <div className="rounded-2xl bg-[#11161d] p-4 ring-1 ring-[#2a333d]/80">
            <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Similarity Explanation</div>
            <div className="mt-2 text-sm font-semibold leading-6 text-slate-100">
              The closest profiles share career progression, consulting maturity, delivery ownership, architecture evolution and leadership growth. Different titles are allowed when the professional trajectory is similar.
            </div>
          </div>
          <div className="rounded-2xl bg-[#11161d] p-4 ring-1 ring-[#2a333d]/80">
            <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Replacement Analysis</div>
            <div className="mt-2 text-2xl font-black text-cyan-100">{best ? best.replacement : "No"}</div>
            <div className="mt-2 text-sm leading-6 text-slate-300">
              {best ? `${getCandidateName(best.candidate)} can ${best.replacement === "Yes" ? "replace" : best.replacement === "Conditional" ? "potentially replace" : "not yet replace"} ${getCandidateName(reference)} based on career DNA similarity and risk alignment.` : "No replacement profile available."}
            </div>
          </div>
          <div className="rounded-2xl bg-[#11161d] p-4 ring-1 ring-[#2a333d]/80">
            <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Hidden Alternatives</div>
            <div className="mt-3 space-y-2">
              {(hidden.length ? hidden : profiles.slice(1, 3)).map((profile) => (
                <div key={`hidden-${getCandidateName(profile.candidate)}`} className="rounded-xl bg-[#0d1218] px-3 py-2 text-xs leading-5 text-slate-200">
                  Although {getCandidateName(profile.candidate)} may look different by title or module, the implementation trajectory and leadership curve are professionally similar.
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl bg-cyan-950/15 p-4 ring-1 ring-cyan-500/20">
            <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-cyan-200">Recruiter Recommendation</div>
            <div className="mt-2 text-sm font-semibold leading-6 text-cyan-50">{recommendation}</div>
            <div className="mt-3 text-xs text-cyan-100">Risk: validate ownership, salary and availability before substituting. Confidence: {best && best.similarity >= 84 ? "High" : best && best.similarity >= 72 ? "Medium" : "Low"}</div>
          </div>
        </div>
      </div>
    </section>
  );
}
function ExecutiveSearchCopilot({
  candidates,
  selectedCandidate,
  primaryModule,
}: {
  candidates: MatchCandidate[];
  selectedCandidate: MatchCandidate | null;
  primaryModule: string;
}) {
  const prompts = [
    "Should I submit now-",
    "Who is stronger in SAP BTP-",
    "Who has stronger implementation ownership-",
    "Which candidate is safest-",
    "Who fits Deloitte-",
    "Why is confidence only 62%-",
  ];
  const [question, setQuestion] = useState(prompts[0]);
  const [response, setResponse] = useState<CopilotResponse>(() => buildCopilotResponse(prompts[0], candidates, selectedCandidate, primaryModule));

  useEffect(() => {
    setResponse(buildCopilotResponse(question || prompts[0], candidates, selectedCandidate, primaryModule));
  }, [candidates, selectedCandidate, primaryModule]);

  function ask(nextQuestion = question) {
    const trimmed = nextQuestion.trim() || prompts[0];
    setQuestion(trimmed);
    setResponse(buildCopilotResponse(trimmed, candidates, selectedCandidate, primaryModule));
  }

  return (
    <section className="bg-[#171a1f] border border-[#30363d] rounded-xl p-6 mb-8 shadow-[0_20px_60px_rgba(0,0,0,0.24)]">
      <div className="flex flex-col gap-3 mb-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">Executive Search Copilot</div>
          <h2 className="mt-2 text-2xl font-bold text-white">Recruitment Director answer engine</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-blue-200">Ask submission, replacement, validation, risk, consulting DNA and interview-priority questions against the current match slate.</p>
        </div>
        <div className="rounded-full bg-[#11161d] px-4 py-2 text-xs font-bold text-blue-200 ring-1 ring-[#2a333d]">Unknown remains Unknown</div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") ask();
          }}
          className="rounded-xl border border-[#2a333d] bg-[#0d1218] px-4 py-3 text-sm font-semibold text-white outline-none transition focus:border-cyan-500/60"
          placeholder="Ask: Should I submit now- Who has stronger implementation ownership-"
        />
        <button type="button" onClick={() => ask()} className="rounded-xl bg-cyan-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-cyan-600">
          Ask Copilot
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {prompts.map((prompt) => (
          <button key={prompt} type="button" onClick={() => ask(prompt)} className="rounded-full bg-[#11161d] px-3 py-1.5 text-xs font-bold text-blue-100 ring-1 ring-[#2a333d] transition hover:ring-cyan-500/40">
            {prompt}
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="rounded-2xl bg-[#11161d] p-4 ring-1 ring-[#2a333d]/80">
          {[
            ["Answer", response.answer],
            ["Reasoning", response.reasoning],
            ["Recommended Action", response.action],
          ].map(([label, value]) => (
            <div key={label} className="border-b border-[#2a333d]/70 py-3 first:pt-0 last:border-0 last:pb-0">
              <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">{label}</div>
              <div className="mt-1 text-sm font-semibold leading-6 text-slate-100">{value}</div>
            </div>
          ))}
        </div>
        <div className="rounded-2xl bg-[#11161d] p-4 ring-1 ring-[#2a333d]/80">
          <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Evidence</div>
          <div className="mt-3 space-y-2">
            {response.evidence.map((item) => (
              <div key={item} className="rounded-xl bg-[#0d1218] px-3 py-2 text-xs font-semibold leading-5 text-slate-200">{item}</div>
            ))}
          </div>
          <div className="mt-4 border-t border-[#2a333d]/70 pt-3">
            <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Confidence</div>
            <div className={response.confidence === "High" ? "mt-1 text-xl font-black text-green-300" : response.confidence === "Medium" ? "mt-1 text-xl font-black text-amber-300" : "mt-1 text-xl font-black text-slate-300"}>{response.confidence}</div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ExecutiveShortlistRecommendation({
  candidates,
  allCandidates,
  clientView,
  selectedCandidate,
  onSelectCandidate,
  onGeneratePack,
  searchSessionId,
}: {
  candidates: MatchCandidate[];
  allCandidates: MatchCandidate[];
  clientView: boolean;
  selectedCandidate: MatchCandidate | null;
  onSelectCandidate: (candidate: MatchCandidate, index: number) => void;
  onGeneratePack: () => void;
  searchSessionId: string;
}) {
  const top3 = candidates.slice(0, 3);

  return (
    <section className="bg-[#171a1f] border border-[#30363d] rounded-xl p-6 mb-8">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h2 className="text-2xl font-bold">Executive Shortlist Recommendation</h2>
          <p className="text-sm text-blue-200 mt-1">
            Top candidates prioritized for fast enterprise hiring decisions. Candidate detail below renders only the selected profile.
          </p>
        </div>
        {clientView && (
          <button
            onClick={onGeneratePack}
            className="bg-green-600 hover:bg-green-700 px-5 py-3 rounded-lg font-bold text-sm"
          >
            Generate Client Submission Pack PDF
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {top3.map((candidate, index) => {
          const insight = buildAiInsights(candidate, allCandidates);
          const isSelected = selectedCandidate && getCandidateKey(selectedCandidate) === getCandidateKey(candidate, index);
          return (
            <div
              key={`top3-${getCandidateKey(candidate, index)}`}
              className={
                isSelected
                  ? "bg-[#11161d] border-2 border-green-500 rounded-xl p-4"
                  : "bg-[#11161d] border border-[#2a333d] rounded-xl p-4"
              }
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="text-cyan-300 text-sm font-bold">#{index + 1}</div>
                  <h3 className="text-lg font-bold">{getCandidateName(candidate)}</h3>
                  <div className="text-xs text-blue-200">{insight.sapCareerLevel}</div>
                </div>
                <div className="text-right">
                  <div className="text-3xl text-green-400 font-bold">{getScore(candidate)}%</div>
                  <div className="text-xs text-blue-200">Match</div>
                </div>
              </div>

              <div className="bg-[#22272e] rounded-lg p-3 mb-4 text-sm font-bold text-cyan-200">
                {getShortlistSignal(candidate)}
              </div>

              <div className="space-y-2 text-sm font-semibold mb-4">
                <div>Hiring Success: {getHiringSuccessProbability(candidate)}%</div>
                <div>Offer Acceptance: {insight.offerAcceptanceProbability}%</div>
                <div className="text-purple-300">{getMarketPositioningLabel(insight.marketPositioning, clientView)}</div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => onSelectCandidate(candidate, index)}
                  className="w-full bg-[#1f252d] border border-[#3a424d] hover:border-green-500 px-4 py-2 rounded-lg font-bold text-sm"
                >
                  Quick View
                </button>
                <a
                  href={getCandidateDetailHref(candidate, index, clientView, searchSessionId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    persistMatchesPageSelection(getCandidateKey(candidate, index));
                  }}
                  className="text-center w-full bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg font-bold text-sm"
                  title="Open Candidate 360 in a separate tab"
                >
                  Candidate 360 â†—
                </a>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-[#11161d] border border-[#2a333d] rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-cyan-400 font-bold text-lg">Top 10 Shortlist</h3>
            <p className="text-xs text-blue-200 mt-1">Compact shortlist view. Select one profile to review the full candidate detail.</p>
          </div>
          <div className="text-xs text-blue-200 font-bold uppercase">{candidates.length} profiles shown</div>
        </div>

        <div className="grid grid-cols-5 gap-3">
          {candidates.slice(0, 10).map((candidate, index) => {
            const insight = buildAiInsights(candidate, allCandidates);
            const isSelected = selectedCandidate && getCandidateKey(selectedCandidate) === getCandidateKey(candidate, index);
            return (
              <button
                key={`top10-${getCandidateKey(candidate, index)}`}
                onClick={() => onSelectCandidate(candidate, index)}
                className={
                  isSelected
                    ? "text-left bg-[#22272e] border-2 border-green-500 rounded-lg p-3"
                    : "text-left bg-[#22272e] border border-[#30363d] hover:border-cyan-400 rounded-lg p-3"
                }
              >
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <div className="font-bold truncate">{getCandidateName(candidate)}</div>
                    <div className="text-xs text-blue-200 truncate">{getCandidateTitle(candidate)}</div>
                  </div>
                  <div className="text-green-400 font-bold">{getScore(candidate)}%</div>
                </div>
                <div className="mt-2 text-xs text-purple-300 truncate">
                  {getMarketPositioningLabel(insight.marketPositioning, clientView)}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function EnterpriseTalentIntelligence({
  candidates,
  primaryModule,
  clientView,
}: {
  candidates: MatchCandidate[];
  primaryModule: string;
  clientView: boolean;
}) {
  const talentMap = buildTalentMap(candidates);
  const availability = getTalentAvailabilityIndex(candidates);
  const scarcityScore = getMarketScarcityScore(primaryModule);
  const scarcityLabel = getMarketScarcityLabel(scarcityScore);
  const funnel = buildHiringFunnelForecast(candidates, clientView);
  const avgAcceptance = candidates.length
    ? Math.round(
        candidates.reduce((sum, candidate) => sum + getOfferAcceptanceProbability(candidate), 0) /
          candidates.length
      )
    : 0;
  const expectedTimeToFill = getExpectedTimeToFill(scarcityScore, funnel.ready);
  const interviewWindow = getRecommendedInterviewWindow(scarcityScore);
  const selectedModule = normalizeModule(primaryModule);

  return (
    <section className="bg-[#171a1f] border border-[#30363d] rounded-xl p-6 mb-8">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold">Enterprise Talent Assessment</h2>
          <p className="text-sm text-blue-200 mt-1">
            Indicative market intelligence generated from SAP Talent Hub signals and the current match pool.
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs text-blue-200 uppercase font-bold tracking-wide">Market Scarcity Score</div>
          <div className="text-4xl text-yellow-400 font-bold">{scarcityScore}/100</div>
          <div className="text-xs text-gray-400">Primary Module: {displayModule(primaryModule)}</div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <EnterpriseMetricCard
          title="Talent Availability Index"
          rows={[
            `Open to move: ${availability.openToMove}%`,
            `Passive: ${availability.passive}%`,
            `Active: ${availability.active}%`,
          ]}
        />
        <EnterpriseMetricCard
          title="Hiring Success Probability"
          rows={[
            `Expected hiring success: ${Math.max(30, Math.min(95, Math.round(avgAcceptance * 0.65 + (funnel.ready ? 25 : 5))))}%`,
            `Offer acceptance benchmark: ${avgAcceptance}%`,
            `${funnel.expectedHire} expected hire(s) from current ready pool`,
            "Model uses role fit, market pressure, readiness gates, and salary benchmark signals",
          ]}
        />
        <EnterpriseMetricCard
          title="Hiring Funnel Forecast"
          rows={[
            `${funnel.sourced} profiles in current pool`,
            `${funnel.ready} ready / strong match profiles`,
            `${funnel.interview} projected interviews`,
            `${funnel.finalRound} projected final rounds`,
            `${funnel.offer} projected offer(s)`,
            `${funnel.expectedHire} expected hire(s)`,
          ]}
        />
        <EnterpriseMetricCard
          title="Executive Hiring Dashboard"
          rows={[
            `Expected time-to-fill: ${expectedTimeToFill} days`,
            `Hiring difficulty: ${scarcityLabel}`,
            `Recommended interview window: ${interviewWindow}`,
            `Expected offer acceptance: ${avgAcceptance}%`,
          ]}
        />
      </div>

      <div className="bg-[#11161d] rounded-xl border border-[#2a333d] p-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-cyan-400 font-bold text-lg">Current Search Pool Distribution</h3>
            <p className="text-xs text-blue-200 mt-1">
              Current module distribution based on candidates matched in the active search pool. Not representative of total market supply.
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs text-blue-200 uppercase font-bold">Selected Skill</div>
            <div className="text-2xl text-green-400 font-bold">{displayModule(primaryModule)}</div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left border-b border-[#30363d]">
                <th className="py-3 pr-4 text-blue-200">Country</th>
                {["FICO", "MM", "SD", "ABAP", "BASIS", "BTP"].map((module) => (
                  <th key={module} className="py-3 pr-4 text-blue-200">
                    {displayModule(module)}
                  </th>
                ))}
                <th className="py-3 pr-4 text-blue-200">Current Matched</th>
              </tr>
            </thead>
            <tbody>
              {talentMap.map((item) => (
                <tr key={item.country} className="border-b border-[#22272e]">
                  <td className="py-3 pr-4 font-bold text-green-400">{item.country}</td>
                  {["FICO", "MM", "SD", "ABAP", "BASIS", "BTP"].map((module) => (
                    <td
                      key={`${item.country}-${module}`}
                      className={normalizeModule(module) === selectedModule ? "py-3 pr-4 text-yellow-300 font-bold" : "py-3 pr-4"}
                    >
                      {item.modules[module] || 0}
                    </td>
                  ))}
                  <td className="py-3 pr-4 text-cyan-300 font-bold">{item.matchedTotal}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <EnterpriseMetricCard
          title="Market Scarcity"
          rows={[
            `${displayModule(primaryModule)}: ${scarcityScore}/100`,
            scarcityLabel,
            scarcityScore >= 85 ? "Immediate talent engagement recommended" : "Use fast interview process for top profiles",
          ]}
        />
        <EnterpriseMetricCard
          title="Current Pool Signal"
          rows={[
            "Current availability signal based on candidates currently matched in the active search pool.",
            ...talentMap.map((item) => `${item.country}: ${item.modules[selectedModule] || 0} ${displayModule(primaryModule)} profiles`),
          ]}
        />
        <EnterpriseMetricCard
          title="Pipeline Conversion"
          rows={[
            `Ready-to-interview ratio: ${funnel.sourced ? Math.round((funnel.ready / funnel.sourced) * 100) : 0}%`,
            `Interview-to-final estimate: ${funnel.interview ? Math.round((funnel.finalRound / funnel.interview) * 100) : 0}%`,
            `Offer-to-hire estimate: ${funnel.offer ? Math.round((funnel.expectedHire / funnel.offer) * 100) : 0}%`,
          ]}
        />
        <EnterpriseMetricCard
          title="Commercial Hiring Advice"
          rows={[
            scarcityScore >= 75 ? "Move top profiles within one week" : "Maintain active shortlist refresh",
            avgAcceptance < 75 ? "Prepare salary flexibility" : "Offer range appears workable",
            "Use shortlist board to separate ready pool from validation pool",
          ]}
        />
      </div>
    </section>
  );
}

function EnterpriseMetricCard({ title, rows }: { title: string; rows: string[] }) {
  return (
    <div className="bg-[#11161d] rounded-xl border border-[#2a333d] p-4">
      <h3 className="text-cyan-400 font-bold mb-3">{title}</h3>
      <div className="space-y-2">
        {rows.map((row, index) => (
          <div key={`${title}-${index}`} className="text-sm font-semibold">
            âœ“ {row}
          </div>
        ))}
      </div>
    </div>
  );
}


function CandidateCard({
  candidate,
  allCandidates,
  statusLabel,
  clientView,
}: {
  candidate: MatchCandidate;
  allCandidates: MatchCandidate[];
  statusLabel: string;
  clientView: boolean;
}) {
  const score = getScore(candidate);
  const isReady = statusLabel === "Strong Match" || statusLabel === "Ready for Client Submission";
  const insight = buildAiInsights(candidate, allCandidates);
  const email = getCandidateEmail(candidate);
  const phone = getCandidatePhone(candidate);
  const contactAccess = getCandidateContactAccess(candidate, clientView);
  const showContact = contactAccess.canView;
  const moduleHeatmap = getSapModuleHeatmap(candidate);
  const maturity = getImplementationMaturity(candidate);
  const recruiterInsight = getRecruiterInsight(candidate, insight);
  const readiness = getSubmissionReadiness(candidate, insight);

  return (
    <article className="bg-[#171a1f] border border-[#30363d] rounded-xl p-6 relative mb-8">
      <div className="absolute right-6 top-6 text-right max-w-[260px]">
        {clientView ? (
          <>
            <div className="text-xs text-blue-200 font-bold uppercase tracking-wide">Executive Recommendation</div>
            <div className="text-2xl font-bold text-green-400">{getClientExecutiveRecommendation(candidate)}</div>
            <div className="text-cyan-300 text-sm font-bold mt-2">Candidate Ranking</div>
            <div className="text-purple-300 text-sm font-semibold">{getMarketPositioningLabel(insight.marketPositioning, true)}</div>
            <div className="text-blue-300 text-xs font-semibold">Top #{insight.ranking} of {allCandidates.length}</div>
            <div className="text-cyan-300 text-sm font-bold mt-2">Profile Strength</div>
            <div className="text-blue-200 text-sm font-semibold">{getClientProfileStrength(candidate)}</div>
            <div className={isReady ? "text-green-400 font-bold mt-2" : "text-yellow-400 font-bold mt-2"}>{statusLabel}</div>
          </>
        ) : (
          <>
            <div className="text-4xl font-bold text-green-400">{score}%</div>
            <div className="font-semibold">Executive Assessment</div>
            <div className="text-cyan-300 text-sm font-bold">Leadership Readiness {Math.max(getConsultingDNA(candidate), getImplementationAuthority(candidate), getScore(candidate))}%</div>
            <div className="text-blue-300 text-xs font-semibold">Talent Assessment {insight.talentIntelligenceScore}%</div>
            <div className="text-blue-300 text-xs font-semibold">Top #{insight.ranking} of {allCandidates.length}</div>
            <div className="text-purple-300 text-xs font-semibold">{getMarketPositioningLabel(insight.marketPositioning, false)}</div>
            <div className={isReady ? "text-green-400 font-bold mt-1" : "text-yellow-400 font-bold mt-1"}>{statusLabel}</div>
          </>
        )}
      </div>

      <div className="pr-72 mb-8">
        <h2 className="text-2xl font-semibold mb-2">{getCandidateName(candidate)}</h2>
        <div className="text-blue-100 mb-2">{getCandidateTitle(candidate)}</div>
        <div className="text-blue-300">
          {showContact ? `${email || "No email"} | ${phone || "No phone"}` : contactAccess.reason}
        </div>
        {!showContact && (
          <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-xs font-bold text-yellow-200">
            {contactAccess.cta}
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8 pr-48">
        <InsightPanel
          title="Executive Verdict"
          color="cyan"
          items={[
            getExecutiveVerdict(candidate),
            `Hiring Success Probability: ${getHiringSuccessProbability(candidate)}% (${getHiringSuccessLabel(getHiringSuccessProbability(candidate))})`,
            `Market Position: ${getExecutiveMarketPosition(candidate, allCandidates, clientView)}`,
            insight.executiveSummary,
          ]}
        />
        <CompensationBenchmarkPanel benchmark={getCompensationBenchmark(candidate, insight)} />
        <InsightPanel
          title="Offer Acceptance Outlook"
          color="green"
          items={[
            `${getOfferAcceptanceOutlook(insight.offerAcceptanceProbability)} (${insight.offerAcceptanceProbability}%)`,
            ...insight.offerDrivers.slice(0, 3),
            ...insight.offerRisks.slice(0, 2).map((risk) => `Potential risk: ${risk}`),
          ]}
        />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8 pr-48">
        <ModuleHeatmapPanel items={moduleHeatmap} />
        <ImplementationMaturityPanel maturity={maturity.maturity} rows={maturity.rows} />
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8 pr-48">
        <RecruiterInsightPanel insight={recruiterInsight} />
        <SubmissionReadinessPanel readiness={readiness} />
        <InsightPanel
          title="Interview Recommendation Engine"
          color="green"
          items={[
            insight.interviewRecommendation,
            `Hiring Success Probability: ${getHiringSuccessProbability(candidate)}%`,
            `Profile Strength: ${getClientProfileStrength(candidate)}`,
            `Time to Productivity: ${insight.timeToProductivity}`,
          ]}
        />
      </div>

      <SapSignalChipsPanel signals={insight.sapSignals} />

      <BadgeRow
        title="Project Experience"
        badges={[
          `Implementation: ${getImplementation(candidate)}`,
          `Rollout: ${getRollout(candidate)}`,
          `AMS/Support: ${getAms(candidate)}`,
          `S/4HANA: ${getS4hana(candidate)}`,
          `ECC: ${getEcc(candidate)}`,
        ]}
      />

      {!clientView && (
        <BadgeRow
          title="Internal Assessment Factors"
          badges={[
            `Implementation Experience: ${getImplementationAuthority(candidate)}`,
            `Market / Employer Signal: ${getDomainAuthority(candidate)}`,
            `Role Alignment: ${getRoleFit(candidate)}`,
            `Domain Expertise: ${getDepthValue(candidate)}`,
            `Consulting & Stakeholder Leadership: ${getConsultingDNA(candidate)}`,
          ]}
        />
      )}

      <CandidateAvailabilityPanel candidate={candidate} />
      <ContactGovernancePanel access={contactAccess} candidate={candidate} />

      <div className="flex flex-wrap gap-2 mt-6">
        {[
          `Years: ${getYears(candidate)}`,
          `Location: ${candidate.location || "N/A"}`,
          `Primary Module: ${getPrimaryModuleDisplay(candidate)}`,
          `Secondary: ${getSecondaryModules(candidate)}`,
          `SAP Expertise: ${insight.sapExpertiseLevel}`,
          `SAP Career Level: ${insight.sapCareerLevel}`,
          !clientView ? `SAP Expertise Alignment: ${getModuleAuthority(candidate)}` : "",
          `Role Type: ${candidate.roleType || "N/A"}`,
          `Consulting Level: ${candidate.consultingLevel || "N/A"}`,
          !clientView ? `Confidence: ${candidate.confidence || "medium"}` : "",
        ]
          .filter(Boolean)
          .map((badge) => (
            <span key={badge} className="bg-[#252b33] px-3 py-2 rounded-full text-xs font-bold">{badge}</span>
          ))}
      </div>
    </article>
  );
}



function formatDate(value: any) {
  if (!value) return "Pending Validation";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString();
}

function getCandidateOpenStatus(candidate: MatchCandidate) {
  return (
    candidate.open_to_work_status ||
    candidate.openToWorkStatus ||
    candidate.availability_status ||
    candidate.candidate_status ||
    (candidate.open_to_work === true || candidate.openToWork === true ? "Open now" : "To Be Confirmed")
  );
}

function getNoticePeriod(candidate: MatchCandidate) {
  return candidate.notice_period || candidate.noticePeriod || candidate.notice || "To Be Confirmed";
}

function CandidateAvailabilityPanel({ candidate }: { candidate: MatchCandidate }) {
  return (
    <div className="bg-[#11161d] border border-[#2a333d] rounded-xl p-4 mb-6">
      <h3 className="text-cyan-400 font-bold mb-3">Candidate Availability & Status</h3>
      <div className="grid grid-cols-4 gap-3 text-sm">
        <MiniMetric label="Open Status" value={getCandidateOpenStatus(candidate)} />
        <MiniMetric label="Plan to Open" value={candidate.open_from_date || candidate.openFromDate || candidate.plan_to_open || "To Be Confirmed"} />
        <MiniMetric label="Notice Period" value={getNoticePeriod(candidate)} />
        <MiniMetric label="CV Uploaded" value={formatDate(candidate.cv_uploaded_at || candidate.cvUploadedAt || candidate.created_at)} />
        <MiniMetric label="Status Updated" value={formatDate(candidate.status_updated_at || candidate.statusUpdatedAt || candidate.updated_at)} />
        <MiniMetric label="Notice Updated" value={formatDate(candidate.notice_period_updated_at || candidate.noticePeriodUpdatedAt)} />
        <MiniMetric label="Relocation" value={candidate.relocation || candidate.relocation_willingness || "To Be Confirmed"} />
        <MiniMetric label="Travel Readiness" value={candidate.travel_readiness || candidate.travel || "To Be Confirmed"} />
      </div>
    </div>
  );
}

function ContactGovernancePanel({ access, candidate }: { access: ContactAccess; candidate: MatchCandidate }) {
  return (
    <div className="bg-[#11161d] border border-[#2a333d] rounded-xl p-4 mb-6">
      <h3 className="text-cyan-400 font-bold mb-3">Contact Governance</h3>
      <div className="grid grid-cols-4 gap-3 text-sm">
        <MiniMetric label="Viewer Role" value={access.role} />
        <MiniMetric label="Contact Access" value={access.canView ? "Unlocked" : "Locked"} />
        <MiniMetric label="CV Open Count" value={candidate.cv_open_count || candidate.cvOpenCount || 0} />
        <MiniMetric label="Profile Comments" value={candidate.profile_comment_count || candidate.profileCommentCount || 0} />
      </div>
      <p className="mt-3 text-xs text-blue-200">
        {access.reason} Track unlock approvals, CV openings, conversion rates, and recruiter comments in the Admin Portal.
      </p>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: any }) {
  return (
    <div className="bg-[#22272e] rounded-lg p-3">
      <div className="text-blue-200 text-xs font-bold">{label}</div>
      <div className="font-bold mt-1">{value === undefined || value === null || value === "" ? "N/A" : String(value)}</div>
    </div>
  );
}

function CompensationBenchmarkPanel({ benchmark }: { benchmark: { currency: string; expected: string; median: string; difference: string; position: string } }) {
  return (
    <div className="bg-[#11161d] border border-[#2a333d] rounded-xl p-4 mb-4">
      <h3 className="text-cyan-400 font-bold mb-3">Compensation Benchmark</h3>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="bg-[#22272e] rounded-lg p-3">
          <div className="text-blue-200 text-xs">Candidate Expected</div>
          <div className="font-bold">{benchmark.expected}</div>
        </div>
        <div className="bg-[#22272e] rounded-lg p-3">
          <div className="text-blue-200 text-xs">Market Median</div>
          <div className="font-bold">{benchmark.median}</div>
        </div>
        <div className="bg-[#22272e] rounded-lg p-3">
          <div className="text-blue-200 text-xs">Difference</div>
          <div className="font-bold">{benchmark.difference}</div>
        </div>
        <div className="bg-[#22272e] rounded-lg p-3">
          <div className="text-blue-200 text-xs">Position</div>
          <div className="font-bold text-green-400">{benchmark.position}</div>
        </div>
      </div>
    </div>
  );
}

function SapSignalChipsPanel({ signals }: { signals: string[] }) {
  const list = signals.length ? signals : ["No major SAP signals detected"];
  return (
    <div className="bg-[#11161d] border border-[#2a333d] rounded-xl p-4 mb-6">
      <h3 className="text-cyan-400 font-bold mb-3">SAP Intelligence Signals</h3>
      <div className="flex flex-wrap gap-2">
        {list.map((signal) => (
          <span key={signal} className="bg-[#22272e] border border-[#3a424d] rounded-full px-3 py-2 text-xs font-bold text-blue-100">
            {signal}
          </span>
        ))}
      </div>
    </div>
  );
}

function ModuleHeatmapPanel({ items }: { items: { label: string; value: number }[] }) {
  return (
    <div className="bg-[#11161d] border border-[#2a333d] rounded-xl p-4 mb-4">
      <h3 className="text-cyan-400 font-bold mb-2">SAP Module Heatmap</h3>
      <p className="text-xs text-blue-200 mb-4">Module authority view for enterprise SAP role alignment.</p>
      {items.map((item) => (
        <ScoreBar key={`${item.label}-${item.value}`} label={item.label} value={item.value} />
      ))}
    </div>
  );
}

function ImplementationMaturityPanel({ maturity, rows }: { maturity: number; rows: string[] }) {
  return (
    <div className="bg-[#11161d] border border-[#2a333d] rounded-xl p-4 mb-4">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-green-400 font-bold">Implementation Maturity</h3>
          <p className="text-xs text-blue-200 mt-1">SAP delivery maturity across transformation, rollout, migration, and support.</p>
        </div>
        <div className="text-right">
          <div className="text-xs text-blue-200 uppercase font-bold">Score</div>
          <div className="text-3xl text-green-400 font-bold">{maturity}%</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {rows.map((row) => (
          <div key={row} className="bg-[#22272e] rounded-lg p-3 text-sm font-semibold">âœ“ {row}</div>
        ))}
      </div>
    </div>
  );
}

function RecruiterInsightPanel({ insight }: { insight: { headline: string; suitable: string[]; watchouts: string[] } }) {
  return (
    <div className="bg-[#11161d] border border-[#2a333d] rounded-xl p-4 mb-4">
      <h3 className="text-cyan-400 font-bold mb-3">Recruiter Insight</h3>
      <div className="text-sm font-semibold mb-4">{insight.headline}</div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-green-400 font-bold mb-2">Suitable For</div>
          {insight.suitable.map((item) => <div key={item} className="text-sm font-semibold mb-1">âœ“ {item}</div>)}
        </div>
        <div>
          <div className="text-yellow-400 font-bold mb-2">Watchouts</div>
          {insight.watchouts.map((item) => <div key={item} className="text-sm font-semibold mb-1">â€¢ {item}</div>)}
        </div>
      </div>
    </div>
  );
}

function SubmissionReadinessPanel({ readiness }: { readiness: { score: number; checks: { label: string; done: boolean }[] } }) {
  return (
    <div className="bg-[#11161d] border border-[#2a333d] rounded-xl p-4 mb-4">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-green-400 font-bold">Client Submission Status</h3>
          <p className="text-xs text-blue-200 mt-1">Submission readiness assessment for client presentation.</p>
        </div>
        <div className="text-right">
          <div className="text-3xl text-green-400 font-bold">{readiness.score}%</div>
        </div>
      </div>
      <div className="space-y-2">
        {readiness.checks.map((check) => (
          <div key={check.label} className="text-sm font-semibold">
            <span className={check.done ? "text-green-400" : "text-yellow-400"}>{check.done ? "âœ“" : "â€¢"}</span> {check.label}
          </div>
        ))}
      </div>
    </div>
  );
}


function RiskRadarPanel({
  radar,
}: {
  radar: {
    counterOfferRisk: number;
    jobHoppingRisk: number;
    relocationRisk: number;
    noticePeriodRisk: number;
    overallRiskScore: number;
  };
}) {
  return (
    <div className="bg-[#11161d] border border-[#2a333d] rounded-xl p-4 mb-4">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-yellow-400 font-bold">Candidate Risk Radar</h3>
          <p className="text-xs text-blue-200 mt-1">Predictive risk signals for recruiter and client alignment.</p>
        </div>
        <div className="text-right">
          <div className="text-xs text-blue-200 uppercase font-bold">Overall</div>
          <div className="text-2xl text-yellow-300 font-bold">{radar.overallRiskScore}%</div>
        </div>
      </div>

      <ScoreBar label={`Counter Offer Risk - ${getRiskRadarLabel(radar.counterOfferRisk)}`} value={radar.counterOfferRisk} />
      <ScoreBar label={`Job Hopping Risk - ${getRiskRadarLabel(radar.jobHoppingRisk)}`} value={radar.jobHoppingRisk} />
      <ScoreBar label={`Relocation Risk - ${getRiskRadarLabel(radar.relocationRisk)}`} value={radar.relocationRisk} />
      <ScoreBar label={`Notice Period Risk - ${getRiskRadarLabel(radar.noticePeriodRisk)}`} value={radar.noticePeriodRisk} />
    </div>
  );
}

function OfferPredictorPanel({ insight }: { insight: AiInsight }) {
  return (
    <div className="bg-[#11161d] border border-[#2a333d] rounded-xl p-4 mb-4">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-green-400 font-bold">Offer Predictor Reasoning</h3>
          <p className="text-xs text-blue-200 mt-1">Explains why the offer acceptance score is high or low.</p>
        </div>
        <div className="text-right">
          <div className="text-xs text-blue-200 uppercase font-bold">Acceptance</div>
          <div className="text-2xl text-green-400 font-bold">{insight.offerAcceptanceProbability}%</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-cyan-400 font-bold mb-2">Drivers</div>
          <div className="space-y-2">
            {insight.offerDrivers.map((item, index) => (
              <div key={`driver-${index}`} className="text-sm font-semibold">
                âœ“ {item}
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="text-yellow-400 font-bold mb-2">Risks</div>
          <div className="space-y-2">
            {insight.offerRisks.map((item, index) => (
              <div key={`risk-${index}`} className="text-sm font-semibold">
                â€¢ {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function InsightPanel({
  title,
  color,
  items,
  soft = false,
}: {
  title: string;
  color: "cyan" | "green" | "yellow";
  items: string[];
  soft?: boolean;
}) {
  const titleClass =
    color === "green" ? "text-green-400" : color === "yellow" ? "text-yellow-400" : "text-cyan-400";

  return (
    <div className="bg-[#11161d] border border-[#2a333d] rounded-xl p-4 mb-4">
      <h3 className={`${titleClass} font-bold mb-3`}>{title}</h3>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={`${title}-${index}`} className="text-sm font-semibold">
            {color === "yellow" ? (soft ? "â€¢" : item.includes("No critical") ? "âœ“" : "âš ") : "âœ“"} {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function BadgeRow({ title, badges }: { title: string; badges: string[] }) {
  return (
    <div className="mb-6">
      <h3 className="text-cyan-400 font-bold mb-3">{title}</h3>
      <div className="flex flex-wrap gap-2">
        {badges.map((badge) => (
          <span key={badge} className="bg-[#252b33] px-3 py-2 rounded-full text-xs font-bold">
            {badge}
          </span>
        ))}
      </div>
    </div>
  );
}

type ExecutiveCompareCriterion = {
  label: string;
  winner: string;
  advantage: string;
  risk: string;
  validation: string;
};

function compareUnknown(value: any) {
  return value === null || value === undefined || value === "" || String(value).toLowerCase() === "unknown";
}

function compareLabel(value: any) {
  return compareUnknown(value) ? "Unknown" : String(value);
}

function candidateSignalText(candidate: MatchCandidate) {
  return textOf({
    title: getCandidateTitle(candidate),
    headline: candidate.headline,
    summary: candidate.summary,
    skills: candidate.skills,
    experience: candidate.experience,
    projects: candidate.projects,
    currentCompany: candidate.current_company || candidate.company,
  });
}

function getAvailabilityLabel(candidate: MatchCandidate) {
  return compareLabel(candidate.availability || candidate.available_from || candidate.openStatus || candidate.open_status || (getInterviewRecommendation(candidate) === "Pipeline Only" ? "Unknown" : "Ready to engage"));
}

function getNoticeLabel(candidate: MatchCandidate) {
  return compareLabel(candidate.notice_period || candidate.noticePeriod || candidate.notice || candidate.availability_notice || "Unknown");
}

function getTravelLabel(candidate: MatchCandidate) {
  return compareLabel(candidate.travel_readiness || candidate.travel || candidate.travelReadiness || "Unknown");
}

function getWorkAuthorizationLabel(candidate: MatchCandidate) {
  return compareLabel(candidate.work_authorization || candidate.workAuthorization || candidate.work_rights || candidate.workRights || "Unknown");
}

function getSalaryAlignmentLabel(candidate: MatchCandidate) {
  const benchmark = getCompensationBenchmark(candidate);
  if (!benchmark || benchmark.position === "Requires recruiter validation" || benchmark.position === "N/A") return "Unknown";
  return benchmark.position.replace(/â–²|â–¼|âœ“/g, "").trim() || "Unknown";
}

function getArchitectureSignal(candidate: MatchCandidate) {
  const text = candidateSignalText(candidate);
  const title = getCandidateTitle(candidate).toLowerCase();
  const base = /architect|solution design|blueprint|enterprise architecture/.test(text) ? 78 : 0;
  return Math.max(base, /architect/.test(title) ? 86 : 0, getDomainAuthority(candidate), getRoleFit(candidate));
}

function getStakeholderSignal(candidate: MatchCandidate) {
  const text = candidateSignalText(candidate);
  if (/stakeholder|workshop|steering|client-facing|client facing|presentation|business users/.test(text)) return 82;
  if (getConsultingDNA(candidate) >= 75) return 72;
  return 0;
}

function getConsultingSignal(candidate: MatchCandidate) {
  const text = candidateSignalText(candidate);
  if (/consulting|consultant|accenture|deloitte|ey|pwc|ibm|capgemini|kpmg/.test(text)) return Math.max(78, getConsultingDNA(candidate));
  return getConsultingDNA(candidate);
}

function getCriterionValue(candidate: MatchCandidate, label: string) {
  const text = candidateSignalText(candidate);
  if (label === "Implementation Ownership") return Math.max(getImplementationAuthority(candidate), getImplementation(candidate) * 18);
  if (label === "Architecture") return getArchitectureSignal(candidate);
  if (label === "Leadership") return Math.max(getConsultingDNA(candidate), /lead|manager|principal|head|director/.test(getCandidateTitle(candidate).toLowerCase()) ? 82 : 0);
  if (label === "Enterprise Delivery") return Math.min(100, getImplementation(candidate) * 14 + getS4hana(candidate) * 8 + getRollout(candidate) * 6);
  if (label === "Consulting Background") return getConsultingSignal(candidate);
  if (label === "Stakeholder Exposure") return getStakeholderSignal(candidate);
  if (label === "Industry Alignment") return compareUnknown(candidate.industry || candidate.industries || candidate.domain) ? 0 : 70;
  if (label === "Module Depth") return Math.max(getModuleAuthority(candidate), getDepthValue(candidate), getScore(candidate));
  if (label === "Communication Evidence") return /presentation|workshop|stakeholder|training|client communication|steering/.test(text) ? 75 : 0;
  if (label === "Availability") return getAvailabilityLabel(candidate) === "Unknown" ? 0 : 70;
  if (label === "Notice") return getNoticeLabel(candidate) === "Unknown" ? 0 : 70;
  if (label === "Salary Alignment") return getSalaryAlignmentLabel(candidate) === "Unknown" ? 0 : getSalaryAlignmentLabel(candidate).includes("Above") ? 45 : 76;
  if (label === "Travel") return getTravelLabel(candidate) === "Unknown" ? 0 : 65;
  if (label === "Work Authorization") return getWorkAuthorizationLabel(candidate) === "Unknown" ? 0 : 75;
  if (label === "Client Risk") return Math.max(0, 100 - buildAiInsights(candidate, [candidate]).riskRadar.overallRiskScore);
  return getScore(candidate);
}

function getCriterionEvidence(candidate: MatchCandidate, label: string) {
  if (label === "Implementation Ownership") return getImplementation(candidate) ? `${getImplementation(candidate)} implementation signal(s)` : "Unknown";
  if (label === "Architecture") return getArchitectureSignal(candidate) ? "Architecture responsibility detected" : "Unknown";
  if (label === "Leadership") return getConsultingDNA(candidate) || /lead|manager|principal|head|director/i.test(getCandidateTitle(candidate)) ? "Leadership signal present" : "Unknown";
  if (label === "Enterprise Delivery") return getImplementation(candidate) || getS4hana(candidate) || getRollout(candidate) ? "Enterprise delivery evidence present" : "Unknown";
  if (label === "Consulting Background") return getConsultingSignal(candidate) ? "Consulting signal present" : "Unknown";
  if (label === "Stakeholder Exposure") return getStakeholderSignal(candidate) ? "Stakeholder-facing signal present" : "Unknown";
  if (label === "Industry Alignment") return compareLabel(candidate.industry || candidate.industries || candidate.domain || "Unknown");
  if (label === "Module Depth") return getPrimaryModuleDisplay(candidate);
  if (label === "Communication Evidence") return getCriterionValue(candidate, label) ? "Communication signal present" : "Unknown";
  if (label === "Availability") return getAvailabilityLabel(candidate);
  if (label === "Notice") return getNoticeLabel(candidate);
  if (label === "Salary Alignment") return getSalaryAlignmentLabel(candidate);
  if (label === "Travel") return getTravelLabel(candidate);
  if (label === "Work Authorization") return getWorkAuthorizationLabel(candidate);
  if (label === "Client Risk") return buildAiInsights(candidate, [candidate]).hiringRisk || "Unknown";
  return "Unknown";
}

function compareWinner(candidates: MatchCandidate[], label: string) {
  const ranked = candidates
    .map((candidate) => ({ candidate, value: getCriterionValue(candidate, label) }))
    .sort((a, b) => b.value - a.value);
  if (!ranked[0] || ranked[0].value <= 0) return null;
  return ranked[0].candidate;
}

function buildExecutiveCompareCriteria(candidates: MatchCandidate[], allCandidates: MatchCandidate[]): ExecutiveCompareCriterion[] {
  const labels = [
    "Implementation Ownership",
    "Architecture",
    "Leadership",
    "Enterprise Delivery",
    "Consulting Background",
    "Stakeholder Exposure",
    "Industry Alignment",
    "Module Depth",
    "Communication Evidence",
    "Availability",
    "Notice",
    "Salary Alignment",
    "Travel",
    "Work Authorization",
    "Client Risk",
  ];

  return labels.map((label) => {
    const winner = compareWinner(candidates, label);
    const winnerName = winner ? getCandidateName(winner) : "Unknown";
    const evidence = winner ? getCriterionEvidence(winner, label) : "No reliable evidence available";
    const weakest = [...candidates].sort((a, b) => getCriterionValue(a, label) - getCriterionValue(b, label))[0];
    const weakEvidence = weakest ? getCriterionEvidence(weakest, label) : "Unknown";
    const risk = !winner
      ? `${label} remains unproven across the compared slate.`
      : weakEvidence === "Unknown"
        ? `${label} is not evidenced for ${getCandidateName(weakest)}.`
        : `${getCandidateName(weakest)} carries the highest ${label.toLowerCase()} risk.`;

    return {
      label,
      winner: winnerName,
      advantage: winner ? `${evidence}. Advantage over the slate on ${label.toLowerCase()}.` : "Unknown advantage.",
      risk,
      validation: label === "Client Risk"
        ? "Confirm client objections before submission."
        : winner
          ? `Validate ${label.toLowerCase()} with ${winnerName} before client positioning.`
          : `Validate ${label.toLowerCase()} during recruiter screening.`,
    };
  });
}

function getRankingStatus(candidate: MatchCandidate, index: number) {
  if (index === 0 && getScore(candidate) >= 70) return "Ready";
  if (index === 1) return "Strong Backup";
  return "Hold";
}

function buildCandidateReasons(candidate: MatchCandidate, allCandidates: MatchCandidate[]) {
  const insight = buildAiInsights(candidate, allCandidates);
  return [
    getImplementation(candidate) ? "Stronger implementation ownership evidence" : "Implementation ownership requires validation",
    getArchitectureSignal(candidate) ? "Clearer architecture responsibility" : "Architecture scope requires validation",
    getConsultingSignal(candidate) ? "Stronger consulting or client-facing signal" : "Consulting background unclear",
    getModuleAuthority(candidate) || getScore(candidate) ? `Deeper ${getPrimaryModuleDisplay(candidate)} alignment` : "Module depth unknown",
    insight.riskRadar.overallRiskScore < 55 ? "Lower visible delivery risk" : "Delivery risk requires mitigation",
    hasContact(candidate) ? "Faster recruiter outreach path" : "Contact path requires confirmation",
  ].filter(Boolean).slice(0, 6);
}

function buildBackupPreferenceReasons(candidate: MatchCandidate) {
  return [
    getSalaryAlignmentLabel(candidate) !== "Unknown" ? "Salary alignment is easier to position" : "Salary expectations may be easier after screening",
    getNoticeLabel(candidate) !== "Unknown" ? "Notice period is clearer" : "Notice period could be more favorable",
    getTravelLabel(candidate) !== "Unknown" ? "Travel readiness is clearer" : "Travel flexibility may be stronger",
    compareLabel(candidate.industry || candidate.industries || candidate.domain || "Unknown") !== "Unknown" ? "Industry exposure may be closer to the mandate" : "Regional or industry context may prove stronger",
  ].slice(0, 4);
}

function buildSubmissionRiskRows(candidates: MatchCandidate[], allCandidates: MatchCandidate[]) {
  return candidates.map((candidate) => {
    const insight = buildAiInsights(candidate, allCandidates);
    const risk = insight.riskRadar.overallRiskScore >= 70 ? "High" : insight.riskRadar.overallRiskScore >= 45 ? "Medium" : "Low";
    const reason = insight.recruiterRisks[0] || insight.hiringRisk || "Unknown";
    const mitigation = !hasContact(candidate)
      ? "Confirm contact path before outreach."
      : getImplementation(candidate) <= 0
        ? "Validate implementation ownership before client submission."
        : "Use screening to confirm scope, notice and salary alignment.";
    return { candidate, risk, reason, mitigation };
  });
}

function buildPartnerRecommendation(leader: MatchCandidate, backup: MatchCandidate | undefined, allCandidates: MatchCandidate[]) {
  const leaderName = getCandidateName(leader);
  const primaryModule = getPrimaryModuleDisplay(leader);
  const insight = buildAiInsights(leader, allCandidates);
  const backupLine = backup ? `${getCandidateName(backup)} should be kept warm as the backup if validation exposes delivery or availability concerns.` : "Keep the remaining profile as backup only after validation.";
  return `${leaderName} should be submitted first for ${primaryModule} because the profile carries the strongest combination of delivery evidence, module alignment and executive readiness in this slate. Validate implementation ownership, availability and compensation before release. ${backupLine} Client positioning should lead with business delivery and risk control, not a CV summary.`;
}

function CandidateComparison({
  candidates,
  allCandidates,
  clientView,
}: {
  candidates: MatchCandidate[];
  allCandidates: MatchCandidate[];
  clientView: boolean;
}) {
  const ranked = [...candidates].sort((a, b) => getScore(b) - getScore(a)).slice(0, 3);
  const leader = ranked[0];
  const backup = ranked[1];
  const criteria = buildExecutiveCompareCriteria(ranked, allCandidates);
  const leaderReasons = leader ? buildCandidateReasons(leader, allCandidates) : [];
  const backupReasons = backup ? buildBackupPreferenceReasons(backup) : [];
  const riskRows = buildSubmissionRiskRows(ranked, allCandidates);

  if (!leader) return null;

  return (
    <section className="bg-[#171a1f] border border-[#30363d] rounded-xl p-6 mb-8 shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
      <div className="flex flex-col gap-3 mb-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">Executive AI Comparison</div>
          <h2 className="mt-2 text-2xl font-bold text-white">Submission decision briefing</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-blue-200">Partner-style comparison focused on who to submit first, what to validate, and how to handle client objections.</p>
        </div>
        <div className="rounded-full bg-cyan-950/30 px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-cyan-100 ring-1 ring-cyan-500/20">
          {clientView ? "Client shortlist view" : "Recruiter decision view"}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(360px,0.75fr)]">
        <div className="rounded-2xl bg-[#11161d] p-4 ring-1 ring-[#2a333d]/80">
          <div className="text-xs font-bold uppercase tracking-[0.16em] text-blue-200">Executive Ranking</div>
          <div className="mt-4 space-y-3">
            {ranked.map((candidate, index) => (
              <div key={`rank-${getCandidateName(candidate)}-${index}`} className="flex items-start justify-between gap-4 rounded-xl bg-[#0d1218] px-3 py-3">
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">#{index + 1} {getRankingStatus(candidate, index)}</div>
                  <div className="mt-1 font-bold text-white">{getCandidateName(candidate)}</div>
                  <div className="mt-1 text-xs text-blue-200">{index === 0 ? "Best first submission based on current evidence." : index === 1 ? "Credible backup if validation changes the decision." : "Hold until key risks are resolved."}</div>
                </div>
                <div className="text-right text-sm font-bold text-cyan-100">{getScore(candidate)}%</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-[#12202a] to-[#0d1218] p-4 ring-1 ring-cyan-500/20">
          <div className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-200">AI Recommendation</div>
          <div className="mt-3 text-sm text-blue-200">Recommended Candidate</div>
          <div className="mt-1 text-2xl font-black text-white">{getCandidateName(leader)}</div>
          <div className="mt-4 grid gap-2">
            {leaderReasons.slice(0, 4).map((reason) => (
              <div key={reason} className="rounded-xl bg-cyan-950/18 px-3 py-2 text-sm font-semibold text-cyan-50">&#10003; {reason}</div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6">
        <div className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-blue-200">Side-by-side Executive Comparison</div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {criteria.map((item) => (
            <div key={item.label} className="rounded-2xl bg-[#11161d]/80 p-4 ring-1 ring-[#2a333d]/70 transition hover:bg-[#151c24] hover:ring-cyan-500/20">
              <div className="text-sm font-bold text-white">{item.label}</div>
              <div className="mt-3 grid gap-2 text-xs leading-5">
                <div><span className="text-slate-500">Winner</span><div className="font-bold text-cyan-100">{item.winner}</div></div>
                <div><span className="text-slate-500">Advantage</span><div className="text-slate-200">{item.advantage}</div></div>
                <div><span className="text-slate-500">Risk</span><div className="text-amber-100">{item.risk}</div></div>
                <div><span className="text-slate-500">Validation Needed</span><div className="text-slate-300">{item.validation}</div></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl bg-[#11161d] p-4 ring-1 ring-[#2a333d]/80">
          <div className="text-xs font-bold uppercase tracking-[0.16em] text-green-300">Why {getCandidateName(leader)} Wins</div>
          <div className="mt-3 grid gap-2">
            {leaderReasons.map((reason) => <div key={reason} className="text-sm font-semibold text-slate-100">&#10003; {reason}</div>)}
          </div>
        </div>
        <div className="rounded-2xl bg-[#11161d] p-4 ring-1 ring-[#2a333d]/80">
          <div className="text-xs font-bold uppercase tracking-[0.16em] text-amber-300">Why {backup ? getCandidateName(backup) : "the backup"} Might Be Better</div>
          <div className="mt-3 grid gap-2">
            {(backupReasons.length ? backupReasons : ["Unknown until recruiter screening is complete"]).map((reason) => <div key={reason} className="text-sm font-semibold text-slate-100">&#8226; {reason}</div>)}
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl bg-[#11161d] p-4 ring-1 ring-[#2a333d]/80">
        <div className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-blue-200">Submission Risk Comparison</div>
        <div className="grid gap-3 xl:grid-cols-3">
          {riskRows.map(({ candidate, risk, reason, mitigation }) => (
            <div key={`risk-${getCandidateName(candidate)}`} className="rounded-xl bg-[#0d1218] p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="font-bold text-white">{getCandidateName(candidate)}</div>
                <div className={risk === "Low" ? "text-green-300 font-bold" : risk === "High" ? "text-red-300 font-bold" : "text-amber-300 font-bold"}>{risk}</div>
              </div>
              <div className="mt-2 text-xs leading-5 text-slate-300">{reason}</div>
              <div className="mt-2 text-xs leading-5 text-cyan-100">Mitigation: {mitigation}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 rounded-2xl bg-cyan-950/15 p-4 ring-1 ring-cyan-500/20">
        <div className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-200">Executive Recommendation</div>
        <p className="mt-2 max-w-5xl text-sm leading-6 text-cyan-50">{buildPartnerRecommendation(leader, backup, allCandidates)}</p>
      </div>
    </section>
  );
}
function ScoreBar({ label, value }: { label: string; value: number }) {
  const normalized = Math.max(0, Math.min(100, Math.round(value || 0)));

  return (
    <div className="mb-3">
      <div className="flex justify-between text-xs font-semibold mb-1">
        <span>{label}</span>
        <span>{normalized}%</span>
      </div>
      <div className="h-2 bg-[#252b33] rounded-full overflow-hidden">
        <div className="h-full bg-green-500 rounded-full" style={{ width: `${normalized}%` }} />
      </div>
    </div>
  );
}


function ShortlistBoard({
  candidates,
  allCandidates,
  clientView,
  primaryModule,
  onSelectCandidate,
  onWorkflowMessage,
}: {
  candidates: MatchCandidate[];
  allCandidates: MatchCandidate[];
  clientView: boolean;
  primaryModule: string;
  onSelectCandidate?: (candidate: MatchCandidate, index: number) => void;
  onWorkflowMessage?: (message: string) => void;
}) {
  type BoardColumn = {
    id: string;
    title: string;
    subtitle: string;
    items: MatchCandidate[];
    accent: string;
  };

  const buildColumns = useCallback((): BoardColumn[] => {
    const aiRecommended = candidates.filter((c) => (clientView ? isClientReady(c) : isStrongMatch(c)));
    const recruiterReviewing = candidates.filter((c) => {
      const score = getScore(c);
      return !(clientView ? isClientReady(c) : isStrongMatch(c)) && score >= 70;
    });
    const talentPool = candidates.filter((c) => getScore(c) < 70);

    return [
      {
        id: "ready",
        title: clientView ? "Ready Pool" : "Strong Match",
        subtitle: clientView
          ? "Only candidates passing submission gates are shown here."
          : "Candidates meeting all recruiter-grade submission criteria.",
        items: aiRecommended,
        accent: "text-green-400",
      },
      {
        id: "review",
        title: clientView ? "Under Review" : "Recruiter Review",
        subtitle: clientView
          ? "Profiles requiring recruiter confirmation before client presentation."
          : "High-potential profiles requiring recruiter validation before submission.",
        items: recruiterReviewing,
        accent: "text-yellow-400",
      },
      {
        id: "pipeline",
        title: clientView ? "Talent Pipeline" : "Backup Pool",
        subtitle: clientView
          ? "Relevant profiles for future pipeline consideration."
          : "Relevant talent pool profiles that do not meet current submission gates.",
        items: talentPool,
        accent: "text-blue-300",
      },
      {
        id: "submitted",
        title: "Submitted",
        subtitle: clientView
          ? "Profiles already released for client presentation."
          : "Profiles already released or submitted to the client.",
        items: [],
        accent: "text-cyan-400",
      },
    ];
  }, [candidates, clientView]);

  const [columns, setColumns] = useState<BoardColumn[]>(buildColumns);

  useEffect(() => {
    setColumns(buildColumns());
  }, [buildColumns]);

  function handleDragEnd(result: DropResult) {
    const { source, destination } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    setColumns((current) => {
      const next = current.map((column) => ({ ...column, items: [...column.items] }));
      const sourceColumn = next.find((column) => column.id === source.droppableId);
      const destinationColumn = next.find((column) => column.id === destination.droppableId);
      if (!sourceColumn || !destinationColumn) return current;

      const [moved] = sourceColumn.items.splice(source.index, 1);
      if (!moved) return current;
      destinationColumn.items.splice(destination.index, 0, moved);
      return next;
    });
  }

  return (
    <section className="bg-[#171a1f] border border-[#30363d] rounded-xl p-6 mb-8">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold">Drag & Drop Shortlist Board</h2>
          <p className="text-sm text-blue-200 mt-1">Move profiles between Ready Pool, Under Review, Talent Pipeline, and Submitted.</p>
        </div>
        <div className="text-right text-xs text-blue-200 font-bold uppercase">Enterprise shortlist workflow</div>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-4 gap-4">
          {columns.map((column) => (
            <Droppable droppableId={column.id} key={column.id}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={
                    snapshot.isDraggingOver
                      ? "bg-[#16251f] rounded-xl p-4 border-2 border-green-500 min-h-[420px]"
                      : "bg-[#11161d] rounded-xl p-4 border border-[#2a333d] min-h-[420px]"
                  }
                >
                  <div className="mb-4">
                    <h3 className={`${column.accent} font-bold`}>
                      {column.title} ({column.items.length})
                    </h3>
                    <p className="text-xs text-gray-400 mt-1 leading-relaxed">{column.subtitle}</p>
                  </div>

                  <div className="space-y-3">
                    {column.items.length ? (
                      column.items.slice(0, 10).map((candidate, index) => {
                        const insight = buildAiInsights(candidate, allCandidates);
                        const key = getCandidateKey(candidate, index);

                        return (
                          <Draggable draggableId={`${column.id}-${key}`} index={index} key={`${column.id}-${key}`}>
                            {(dragProvided, dragSnapshot) => (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                {...dragProvided.dragHandleProps}
                                onClick={() => onSelectCandidate?.(candidate, index)}
                                className={
                                  dragSnapshot.isDragging
                                    ? "bg-[#2b333d] rounded-lg p-3 shadow-xl border border-green-500 cursor-grabbing"
                                    : "bg-[#22272e] rounded-lg p-3 cursor-grab hover:border hover:border-cyan-400"
                                }
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <div className="truncate font-bold">{getCandidateName(candidate)}</div>
                                    <div className="line-clamp-1 text-xs text-blue-200">{getCandidateTitle(candidate)}</div>
                                  </div>
                                  <span className="shrink-0 rounded-full bg-cyan-950/60 px-2 py-0.5 text-[10px] font-black text-cyan-200 ring-1 ring-cyan-700/40">{getScore(candidate)}%</span>
                                </div>
                                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
                                  <span className="rounded-full bg-green-950/50 px-2 py-0.5 text-green-300 ring-1 ring-green-800/50">{submissionConfidence(candidate, insight).label === "Ready" ? "Ready to Submit" : submissionConfidence(candidate, insight).label}</span>
                                  <span className="rounded-full bg-[#11161d] px-2 py-0.5 text-cyan-300 ring-1 ring-cyan-900/50">Top #{insight.ranking}</span>
                                </div>
                                <div className="mt-2 text-[11px] leading-4 text-purple-200">{getMarketPositioningLabel(insight.marketPositioning, clientView)}</div>
                                <div className="mt-3 border-t border-slate-700/70 pt-2">
                                  <div className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">Communication</div>
                                  <div className="mt-2 grid grid-cols-2 gap-1.5">
                                    <button type="button" onClick={(event) => { event.stopPropagation(); copyShortlistCommunication(buildContextualClientEmail(candidate, allCandidates, primaryModule), onWorkflowMessage, "Client email copied"); }} className="rounded-md bg-[#11161d] px-2 py-1.5 text-[10px] font-bold text-cyan-100 ring-1 ring-cyan-900/50 hover:bg-cyan-950/40">Client Email</button>
                                    <button type="button" onClick={(event) => { event.stopPropagation(); copyShortlistCommunication(buildContextualWhatsApp(candidate, allCandidates, primaryModule), onWorkflowMessage, "WhatsApp copied"); }} className="rounded-md bg-[#11161d] px-2 py-1.5 text-[10px] font-bold text-cyan-100 ring-1 ring-cyan-900/50 hover:bg-cyan-950/40">WhatsApp</button>
                                    <button type="button" onClick={(event) => { event.stopPropagation(); copyShortlistCommunication(buildContextualHiringManagerBrief(candidate, allCandidates, primaryModule), onWorkflowMessage, "Hiring manager brief copied"); }} className="rounded-md bg-[#11161d] px-2 py-1.5 text-[10px] font-bold text-cyan-100 ring-1 ring-cyan-900/50 hover:bg-cyan-950/40">HM Brief</button>
                                    <button type="button" onClick={(event) => { event.stopPropagation(); generateClientSubmissionPack([candidate], allCandidates, primaryModule); onWorkflowMessage?.("Submission PDF opened"); }} className="rounded-md bg-cyan-700 px-2 py-1.5 text-[10px] font-bold text-white hover:bg-cyan-600">PDF</button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        );
                      })
                    ) : (
                      <div className="text-sm text-gray-400">No candidates yet</div>
                    )}
                    {provided.placeholder}
                  </div>
                </div>
              )}
            </Droppable>
          ))}
        </div>
      </DragDropContext>
    </section>
  );
}

















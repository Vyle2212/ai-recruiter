import type { SapPrimaryModule } from "./sapRecruiterRules";

export type RoleComplexityResult = {
  score: number;
  label: string;
  module: SapPrimaryModule | string;
  strengths: string[];
};

function n(value: any, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function textOf(...values: any[]) {
  return values
    .flatMap((value) => {
      if (!value) return [];
      if (Array.isArray(value)) return value.map(String);
      if (typeof value === "object") return [JSON.stringify(value)];
      return [String(value)];
    })
    .join(" ")
    .replace(/\u0000/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function blob(candidate: any) {
  return textOf(
    candidate?.title,
    candidate?.current_title,
    candidate?.headline,
    candidate?.summary,
    candidate?.company,
    candidate?.primaryModule,
    candidate?.primary_module,
    candidate?.secondaryModules,
    candidate?.secondary_modules,
    candidate?.sap_modules,
    candidate?.sap_submodules,
    candidate?.modules,
    candidate?.skills,
    candidate?.rawText,
    candidate?.raw_text,
    candidate?.resumeText,
    candidate?.resume_text,
    candidate?.raw_cv
  ).toUpperCase();
}

function has(text: string, pattern: RegExp) {
  return pattern.test(text);
}

function addIf(text: string, pattern: RegExp, points: number, strengths: string[], label: string) {
  if (has(text, pattern)) {
    strengths.push(label);
    return points;
  }
  return 0;
}

function projectPremium(candidate: any) {
  return (
    Math.min(n(candidate?.implementationProjects ?? candidate?.implementation_projects), 8) * 2 +
    Math.min(n(candidate?.rolloutProjects ?? candidate?.rollout_projects), 6) * 2 +
    Math.min(n(candidate?.s4hanaProjects ?? candidate?.s4hana_projects), 6) * 1.5
  );
}

export function complexityLabelForModule(module: any) {
  const m = String(module || "UNKNOWN").toUpperCase();

  if (m === "FICO") return "Finance Depth";
  if (m === "SD") return "Order-to-Cash Depth";
  if (m === "MM") return "Procure-to-Pay Depth";
  if (m === "EWM") return "Warehouse Depth";
  if (m === "TM") return "Transportation Depth";
  if (m === "PP") return "Production Planning Depth";
  if (m === "PM") return "Plant Maintenance / EAM Depth";
  if (m === "PS") return "Project System Depth";
  if (m === "IS-U") return "Utilities Depth";
  if (["ABAP", "BASIS", "BW", "BI"].includes(m)) return "Technical / Platform Depth";

  return "Role Complexity";
}

export function calculateFicoComplexity(candidate: any): RoleComplexityResult {
  const text = blob(candidate);
  const strengths: string[] = [];
  let score = 24;

  score += addIf(text, /\b(GENERAL\s+LEDGER|NEW\s+GL|GL)\b/i, 10, strengths, "GL");
  score += addIf(text, /\b(ACCOUNTS\s+PAYABLE|AP)\b/i, 9, strengths, "AP");
  score += addIf(text, /\b(ACCOUNTS\s+RECEIVABLE|AR)\b/i, 9, strengths, "AR");
  score += addIf(text, /\b(ASSET\s+ACCOUNTING|AA)\b/i, 9, strengths, "AA");
  score += addIf(text, /\b(CONTROLLING|COST\s+CENTER|PROFIT\s+CENTER|INTERNAL\s+ORDER)\b/i, 9, strengths, "CO");
  score += addIf(text, /\b(CO-?PA|COPA)\b/i, 8, strengths, "COPA");
  score += addIf(text, /\b(FSCM|CREDIT\s+MANAGEMENT|COLLECTIONS?|DISPUTE\s+MANAGEMENT)\b/i, 8, strengths, "FSCM");
  score += addIf(text, /\b(TRM|TREASURY|CASH\s+MANAGEMENT|BANK\s+ACCOUNTING)\b/i, 8, strengths, "TRM / Treasury");
  score += addIf(text, /\b(CENTRAL\s+FINANCE|CFIN)\b/i, 9, strengths, "Central Finance");
  score += addIf(text, /\b(GROUP\s+REPORTING|CONSOLIDATION)\b/i, 8, strengths, "Group Reporting");

  score += projectPremium(candidate);

  return { score: clamp(score, 20, 97), label: complexityLabelForModule("FICO"), module: "FICO", strengths };
}

export function calculateSdComplexity(candidate: any): RoleComplexityResult {
  const text = blob(candidate);
  const strengths: string[] = [];
  let score = 24;

  score += addIf(text, /\b(SALES\s+(AND|&)?\s*DISTRIBUTION|SAP\s+SD|ORDER\s+TO\s+CASH|OTC|O2C)\b/i, 14, strengths, "Order-to-Cash / SD");
  score += addIf(text, /\b(PRICING|CONDITION\s+TECHNIQUE|REBATE|DISCOUNT)\b/i, 10, strengths, "Pricing");
  score += addIf(text, /\b(BILLING|INVOICE|INVOICING)\b/i, 8, strengths, "Billing");
  score += addIf(text, /\b(SALES\s+ORDER|DELIVERY|DELIVERIES|SHIPPING|SHIPMENT)\b/i, 8, strengths, "Sales order / delivery");
  score += addIf(text, /\b(CREDIT\s+MANAGEMENT|ATP|AVAILABILITY\s+CHECK)\b/i, 8, strengths, "Credit / ATP");
  score += addIf(text, /\b(EDI|IDOC|RFC|API|INTERFACE|3RD[-\s]?PARTY)\b/i, 8, strengths, "EDI / integration");
  score += addIf(text, /\b(TM|TRANSPORTATION|EWM|WAREHOUSE|MM|PP|FICO)\b/i, 7, strengths, "Cross-module integration");
  score += addIf(text, /\b(FIORI|S\/4HANA|S4HANA|S4\s+HANA)\b/i, 7, strengths, "S/4HANA / Fiori");
  score += addIf(text, /\b(LTMC|LSMW|DATA\s+MIGRATION)\b/i, 5, strengths, "Migration tools");

  score += projectPremium(candidate);

  return { score: clamp(score, 20, 97), label: complexityLabelForModule("SD"), module: "SD", strengths };
}

export function calculateMmComplexity(candidate: any): RoleComplexityResult {
  const text = blob(candidate);
  const strengths: string[] = [];
  let score = 24;

  score += addIf(text, /\b(MATERIALS?\s+MANAGEMENT|SAP\s+MM|PROCURE\s+TO\s+PAY|P2P|PROCUREMENT)\b/i, 14, strengths, "Procure-to-Pay / MM");
  score += addIf(text, /\b(PURCHASING|PURCHASE\s+ORDER|PO\s+PROCESS)\b/i, 9, strengths, "Purchasing");
  score += addIf(text, /\b(INVENTORY|GOODS\s+RECEIPT|GOODS\s+ISSUE|GR\/IR|STOCK)\b/i, 9, strengths, "Inventory / GR-GI");
  score += addIf(text, /\b(MRP|SOURCE\s+LIST|INFO\s+RECORD|QUOTA|RELEASE\s+STRATEGY)\b/i, 9, strengths, "MRP / sourcing");
  score += addIf(text, /\b(ARIBA|VENDOR|SUPPLIER|CONTRACT|RFQ)\b/i, 8, strengths, "Vendor / sourcing");
  score += addIf(text, /\b(EWM|WM|SD|PP|FICO|INTEGRATION)\b/i, 7, strengths, "Cross-module integration");
  score += addIf(text, /\b(FIORI|S\/4HANA|S4HANA|S4\s+HANA)\b/i, 7, strengths, "S/4HANA / Fiori");

  score += projectPremium(candidate);

  return { score: clamp(score, 20, 97), label: complexityLabelForModule("MM"), module: "MM", strengths };
}

export function calculateEwmComplexity(candidate: any): RoleComplexityResult {
  const text = blob(candidate);
  const strengths: string[] = [];
  let score = 24;

  score += addIf(text, /\b(EWM|EXTENDED\s+WAREHOUSE|WAREHOUSE\s+MANAGEMENT|WMS)\b/i, 15, strengths, "EWM / Warehouse");
  score += addIf(text, /\b(INBOUND|OUTBOUND|PUTAWAY|PICKING|PACKING)\b/i, 10, strengths, "Inbound / outbound");
  score += addIf(text, /\b(RF|MOBILE\s+DATA|SCANNER|BARCODE)\b/i, 8, strengths, "RF / mobile warehouse");
  score += addIf(text, /\b(WAVE|SLOTING|SLOTTING|CROSS[-\s]?DOCKING)\b/i, 8, strengths, "Wave / advanced warehouse");
  score += addIf(text, /\b(YARD|LABOR|MFS|MATERIAL\s+FLOW)\b/i, 9, strengths, "Yard / labor / MFS");
  score += addIf(text, /\b(TM|TRANSPORTATION|MM|SD|PP|INTEGRATION)\b/i, 8, strengths, "Logistics integration");
  score += addIf(text, /\b(FIORI|S\/4HANA|S4HANA|S4\s+HANA)\b/i, 7, strengths, "S/4HANA / Fiori");

  score += projectPremium(candidate);

  return { score: clamp(score, 20, 97), label: complexityLabelForModule("EWM"), module: "EWM", strengths };
}

export function calculateTmComplexity(candidate: any): RoleComplexityResult {
  const text = blob(candidate);
  const strengths: string[] = [];
  let score = 24;

  score += addIf(text, /\b(TM|TRANSPORTATION\s+MANAGEMENT|FREIGHT)\b/i, 15, strengths, "Transportation Management");
  score += addIf(text, /\b(FORWARDING|CARRIER|CARRIER\s+SELECTION|FREIGHT\s+ORDER)\b/i, 10, strengths, "Carrier / freight");
  score += addIf(text, /\b(SHIPMENT|ROUTE|PLANNING|TENDERING)\b/i, 9, strengths, "Shipment planning");
  score += addIf(text, /\b(EWM|SD|MM|INTEGRATION)\b/i, 8, strengths, "Logistics integration");
  score += addIf(text, /\b(FIORI|S\/4HANA|S4HANA|S4\s+HANA)\b/i, 7, strengths, "S/4HANA / Fiori");

  score += projectPremium(candidate);

  return { score: clamp(score, 20, 97), label: complexityLabelForModule("TM"), module: "TM", strengths };
}

export function calculatePpComplexity(candidate: any): RoleComplexityResult {
  const text = blob(candidate);
  const strengths: string[] = [];
  let score = 24;

  score += addIf(text, /\b(PP|PRODUCTION\s+PLANNING|MANUFACTURING)\b/i, 15, strengths, "Production Planning");
  score += addIf(text, /\b(MRP|BOM|ROUTING|WORK\s+CENTER|PRODUCTION\s+ORDER)\b/i, 12, strengths, "MRP / BOM / routing");
  score += addIf(text, /\b(DEMAND\s+MANAGEMENT|CAPACITY\s+PLANNING|SHOP\s+FLOOR)\b/i, 9, strengths, "Planning / shop floor");
  score += addIf(text, /\b(MM|SD|QM|PM|EWM|INTEGRATION)\b/i, 8, strengths, "Manufacturing integration");
  score += addIf(text, /\b(FIORI|S\/4HANA|S4HANA|S4\s+HANA)\b/i, 7, strengths, "S/4HANA / Fiori");

  score += projectPremium(candidate);

  return { score: clamp(score, 20, 97), label: complexityLabelForModule("PP"), module: "PP", strengths };
}

export function calculatePmComplexity(candidate: any): RoleComplexityResult {
  const text = blob(candidate);
  const strengths: string[] = [];
  let score = 24;

  score += addIf(text, /\b(PM|PLANT\s+MAINTENANCE|EAM|ENTERPRISE\s+ASSET)\b/i, 15, strengths, "Plant Maintenance / EAM");
  score += addIf(text, /\b(MAINTENANCE\s+ORDER|EQUIPMENT|FUNCTIONAL\s+LOCATION|NOTIFICATION)\b/i, 12, strengths, "Maintenance master/process");
  score += addIf(text, /\b(PREVENTIVE|CORRECTIVE|BREAKDOWN|INSPECTION)\b/i, 9, strengths, "Maintenance execution");
  score += addIf(text, /\b(MM|PP|PS|FICO|INTEGRATION)\b/i, 8, strengths, "EAM integration");
  score += addIf(text, /\b(FIORI|S\/4HANA|S4HANA|S4\s+HANA)\b/i, 7, strengths, "S/4HANA / Fiori");

  score += projectPremium(candidate);

  return { score: clamp(score, 20, 97), label: complexityLabelForModule("PM"), module: "PM", strengths };
}

export function calculatePsComplexity(candidate: any): RoleComplexityResult {
  const text = blob(candidate);
  const strengths: string[] = [];
  let score = 24;

  score += addIf(text, /\b(PS|PROJECT\s+SYSTEMS?|WBS|CJ20N)\b/i, 15, strengths, "Project System");
  score += addIf(text, /\b(WBS|NETWORK\s+ACTIVITY|PROJECT\s+BUILDER|MILESTONE)\b/i, 12, strengths, "WBS / network");
  score += addIf(text, /\b(COSTING|BUDGET|SETTLEMENT|RESULT\s+ANALYSIS)\b/i, 10, strengths, "Project finance control");
  score += addIf(text, /\b(FICO|SD|MM|PP|INTEGRATION)\b/i, 8, strengths, "PS integration");
  score += addIf(text, /\b(FIORI|S\/4HANA|S4HANA|S4\s+HANA)\b/i, 7, strengths, "S/4HANA / Fiori");

  score += projectPremium(candidate);

  return { score: clamp(score, 20, 97), label: complexityLabelForModule("PS"), module: "PS", strengths };
}

export function calculateIsuComplexity(candidate: any): RoleComplexityResult {
  const text = blob(candidate);
  const strengths: string[] = [];
  let score = 24;

  score += addIf(text, /\b(IS-U|ISU|UTILITIES)\b/i, 15, strengths, "IS-U / Utilities");
  score += addIf(text, /\b(BILLING|INVOICING|PRINT\s+WORKBENCH|FICA)\b/i, 12, strengths, "Utilities billing / FICA");
  score += addIf(text, /\b(DEVICE\s+MANAGEMENT|METER\s+READING|DM|MR)\b/i, 10, strengths, "Device / meter");
  score += addIf(text, /\b(CRM|FICO|ABAP|INTEGRATION)\b/i, 8, strengths, "Utilities integration");
  score += addIf(text, /\b(FIORI|S\/4HANA|S4HANA|S4\s+HANA)\b/i, 7, strengths, "S/4HANA / Fiori");

  score += projectPremium(candidate);

  return { score: clamp(score, 20, 97), label: complexityLabelForModule("IS-U"), module: "IS-U", strengths };
}

export function calculateTechnicalComplexity(candidate: any): RoleComplexityResult {
  const text = blob(candidate);
  const module = String(candidate?.primaryModule || candidate?.primary_module || "TECHNICAL").toUpperCase();
  const strengths: string[] = [];
  let score = 24;

  score += addIf(text, /\b(ABAP|RICEF|BAPI|BADI|USER\s+EXIT|ENHANCEMENT|SMARTFORMS?|SAPSCRIPT)\b/i, 13, strengths, "ABAP / RICEF");
  score += addIf(text, /\b(CDS|AMDP|ODATA|FIORI|UI5)\b/i, 12, strengths, "Modern SAP development");
  score += addIf(text, /\b(BASIS|NETWEAVER|HANA\s+ADMIN|TRANSPORT|SECURITY|GRC|AUTHORI[ZS]ATION)\b/i, 13, strengths, "Basis / security");
  score += addIf(text, /\b(BW|BI|BW\/4HANA|BPC|BOBJ|WEBI|DATASPHERE|DWC|SAC|ANALYTICS)\b/i, 13, strengths, "Analytics / data platform");
  score += addIf(text, /\b(INTEGRATION|INTERFACE|IDOC|RFC|API|PI\/PO|CPI)\b/i, 9, strengths, "Integration");
  score += addIf(text, /\b(S\/4HANA|S4HANA|S4\s+HANA|HANA)\b/i, 7, strengths, "S/4HANA / HANA");

  score += projectPremium(candidate);

  return { score: clamp(score, 20, 97), label: complexityLabelForModule(module), module, strengths };
}

export function calculateGenericComplexity(candidate: any): RoleComplexityResult {
  const text = blob(candidate);
  const strengths: string[] = [];
  let score = 35;

  score += addIf(text, /\b(IMPLEMENTATION|CONFIGURATION|CUSTOMIZING|BLUEPRINT|FIT[-\s]?GAP)\b/i, 16, strengths, "Implementation delivery");
  score += addIf(text, /\b(ROLLOUT|ROLL\s*OUT|MIGRATION|UPGRADE|CONVERSION)\b/i, 12, strengths, "Transformation / rollout");
  score += addIf(text, /\b(S\/4HANA|S4HANA|S4\s+HANA|FIORI)\b/i, 10, strengths, "S/4HANA / Fiori");
  score += addIf(text, /\b(INTEGRATION|INTERFACE|IDOC|RFC|API)\b/i, 8, strengths, "Integration");

  score += projectPremium(candidate);

  return { score: clamp(score, 20, 90), label: "Role Complexity", module: candidate?.primaryModule || candidate?.primary_module || "UNKNOWN", strengths };
}

export function calculateRoleComplexity(candidate: any, requiredModule?: SapPrimaryModule | string): RoleComplexityResult {
  const module = String(requiredModule || candidate?.primaryModule || candidate?.primary_module || "UNKNOWN").toUpperCase();

  if (module === "FICO") return calculateFicoComplexity(candidate);
  if (module === "SD") return calculateSdComplexity(candidate);
  if (module === "MM") return calculateMmComplexity(candidate);
  if (module === "EWM") return calculateEwmComplexity(candidate);
  if (module === "TM") return calculateTmComplexity(candidate);
  if (module === "PP") return calculatePpComplexity(candidate);
  if (module === "PM") return calculatePmComplexity(candidate);
  if (module === "PS") return calculatePsComplexity(candidate);
  if (module === "IS-U" || module === "ISU") return calculateIsuComplexity(candidate);
  if (["ABAP", "BASIS", "BW", "BI"].includes(module)) return calculateTechnicalComplexity(candidate);

  return calculateGenericComplexity(candidate);
}

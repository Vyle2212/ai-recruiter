export type SapPrimaryModule =
  | "FICO" | "FI" | "CO" | "CFIN" | "FSCM" | "TRM" | "BCM" | "GR" | "BPC" | "RAR" | "RE-FX" | "PSM" | "FM"
  | "MM" | "SD" | "LE" | "WM" | "EWM" | "TM" | "GTS" | "QM" | "CS" | "LO" | "VC" | "HU"
  | "PP" | "PPDS" | "PM" | "EAM" | "PS" | "DMC" | "ME" | "MII" | "PLM"
  | "IBP" | "APO" | "ARIBA" | "SRM" | "CLM"
  | "ABAP" | "BASIS" | "SECURITY" | "GRC" | "BTP" | "CPI" | "PI/PO" | "FIORI" | "UI5" | "MDG" | "WRICEF" | "RAP" | "CAP" | "CDS" | "AMDP"
  | "HANA" | "BW" | "BW/4HANA" | "SAC" | "DATASPHERE" | "BOBJ" | "BODS" | "PAPM"
  | "HCM" | "SUCCESSFACTORS" | "EC" | "ECP" | "RCM" | "RMK" | "ONB" | "LMS" | "PMGM" | "COMP"
  | "CONCUR" | "FIELDGLASS" | "CX" | "CRM" | "COMMERCE" | "CPQ" | "BRIM" | "FSM"
  | "IS-U" | "IS-OIL" | "IS-RETAIL" | "FS-CD" | "IS-BANKING" | "FICA"
  | "UNKNOWN";

export type SapRoleType =
  | "FICO Functional"
  | "SAP Functional"
  | "Technical"
  | "Manager/PM"
  | "Other";

export type SapProjectAuthority = {
  implementation: number;
  rollout: number;
  support: number;
  ams: number;
  enhancement: number;
  migration: number;
  upgrade: number;
  brownfield: number;
  greenfield: number;
};

export type SapProfileInference = {
  primaryModule: SapPrimaryModule;
  secondaryModules: string[];
  roleType: SapRoleType;
  moduleScores: Record<string, number>;
  moduleConfidence: number;
  weakName: boolean;
  financeDepthScore: number;
  consultingDNAScore: number;
  implementationAuthorityScore: number;
  profileQualityScore: number;
  projectAuthority: SapProjectAuthority;
  evidenceNotes: string[];
};

const TECHNICAL_MODULES = new Set([
  "ABAP", "BASIS", "SECURITY", "GRC", "BTP", "CPI", "PI/PO", "FIORI", "UI5", "MDG", "WRICEF", "RAP", "CAP", "CDS", "AMDP", "HANA"
]);

const FUNCTIONAL_MODULES = new Set([
  "FICO", "FI", "CO", "CFIN", "FSCM", "TRM", "BCM", "GR", "BPC", "RAR", "RE-FX", "PSM", "FM",
  "MM", "SD", "LE", "WM", "EWM", "TM", "GTS", "QM", "CS", "LO", "VC", "HU",
  "PP", "PPDS", "PM", "EAM", "PS", "DMC", "ME", "MII", "PLM",
  "IBP", "APO", "ARIBA", "SRM", "CLM",
  "HCM", "SUCCESSFACTORS", "EC", "ECP", "RCM", "RMK", "ONB", "LMS", "PMGM", "COMP",
  "CONCUR", "FIELDGLASS", "CX", "CRM", "COMMERCE", "CPQ", "BRIM", "FSM",
  "IS-U", "IS-OIL", "IS-RETAIL", "FS-CD", "IS-BANKING", "FICA"
]);

const ANALYTICS_MODULES = new Set(["BW", "BW/4HANA", "SAC", "DATASPHERE", "BOBJ", "BODS", "PAPM"]);

const MODULE_PRIORITY = [
  // Prefer explicit business modules over incidental technical platform keywords.
  "FICO", "FI", "CO", "CFIN", "FSCM", "TRM", "BCM", "GR", "RAR",
  "MM", "SD", "PP", "PM", "EAM", "PS", "QM", "WM", "EWM", "TM", "LE", "CS", "LO", "GTS",
  "SUCCESSFACTORS", "HCM", "EC", "ECP", "RCM", "RMK", "ONB", "LMS", "PMGM", "COMP",
  "BW/4HANA", "BW", "SAC", "DATASPHERE", "BPC", "BOBJ", "BODS", "PAPM",
  "BTP", "CPI", "PI/PO", "MDG", "GRC", "SECURITY", "FIORI", "UI5",
  "ABAP", "BASIS", "HANA", "WRICEF", "RAP", "CAP", "CDS", "AMDP",
  "ARIBA", "IBP", "APO", "PPDS",
  "IS-U", "IS-OIL", "IS-RETAIL", "FS-CD", "IS-BANKING", "FICA",
  "DMC", "ME", "MII", "PLM", "SRM", "CLM", "CONCUR", "FIELDGLASS", "CX", "CRM", "COMMERCE", "CPQ", "BRIM", "FSM",
] as const;

const CONSULTING_BRANDS = [
  "ACCENTURE",
  "DELOITTE",
  "PWC",
  "PRICEWATERHOUSECOOPERS",
  "EY",
  "ERNST & YOUNG",
  "KPMG",
  "IBM",
  "CAPGEMINI",
  "NTT DATA",
  "NTT",
  "COGNIZANT",
  "INFOSYS",
  "TCS",
  "WIPRO",
  "HCL",
  "TECH MAHINDRA",
  "DXC",
  "ATOS",
  "FUJITSU",
  "CBS",
  "CORPORATE BUSINESS SOLUTIONS",
  "CORPORATE BUSINESS SOLUTION",
  "DELAWARE",
  "ITELLIGENCE",
  "NEXSAP",
  "APPCENTRIC",
];

const WEAK_NAME_PHRASES = [
  "UNKNOWN CANDIDATE",
  "REVIEW REQUIRED",
  "CANDIDATE NAME NOT DETECTED",
  "HOW THIS RESUME IS ORGANIZED",
  "CURRENTLY WORKING",
  "WORKING AS",
  "WORKED AS",
  "EMPLOYMENT",
  "WORK HISTORY",
  "PERSONAL DETAIL",
  "PERSONAL DETAILS",
  "PROFESSIONAL SUMMARY",
  "PROFILE SUMMARY",
  "TECHNICAL SKILLS",
  "CORE COMPETENCIES",
  "CAREER OBJECTIVE",
  "CURRICULUM VITAE",
  "RESUME",
  "CV",
  "MANILA",
  "PHILIPPINES",
  "MALAYSIA",
  "INDIA",
  "BANGALORE UNIVERSITY",
  "ACCENTURE DELIVERY CENTER",
  "ACCENTURE INC DESIGNATION",
  "ACCENTURE, INC",
  "APPLICATION DEVELOPMENT MANAGER",
  "MAGELLAN DATA MIGRATION",
  "ORDER TO CASH TESTING",
  "ACCOUNTS PAYABLE",
  "DIGITAL TRANSFORMATION",
  "CHEVRON CLIENT",
  "INDUSTRIES GLOBALLY",
  "SEAMLESS TRANSITION",
  "AND SEAMLESS TRANSITION",
  "TRACKING AND ISSUE RESOLUTION",
  "ISSUE RESOLUTION",
  "WALLDORF CONSULTING",
  "TOKYO DENKI UNIVERSITY",
  "JOB TARGET",
  "EMPLOYMENT SAP",
  "CONSULTING PMO",
  "SPS UPGRADE",
  "UPGRADE ROLE",
  "FI AR ASSET",
  "HEAD MANAGEMENT",
  "ASSISTANT BRANCH MANAGER",
  "ASSITANT BRANCH MANAGER",
  "MIS MANAGER",
  "ADDITIONAL GROWTH",
  "THE BETTER",
  "AND QUALITY",
];

const MODULE_RULES: Partial<Record<
  Exclude<SapPrimaryModule, "UNKNOWN">,
  {
    title: RegExp[];
    body: RegExp[];
    project: RegExp[];
  }
>> = {
  FICO: {
    title: [
      /\bSAP\s*FI\/?CO\b/i,
      /\bFI\/CO\b/i,
      /\bFICO\b/i,
      /\bSAP\s+FI\b/i,
      /\bSAP\s+CO\b/i,
      /\bFI\s+CONSULTANT\b/i,
      /\bCO\s+CONSULTANT\b/i,
      /\bSAP\s+FINANCE\b/i,
      /\bSAP\s+FINANCIAL\b/i,
      /\bFINANCE\s+CONSULTANT\b/i,
      /\bFINANCIAL\s+ACCOUNTING\b/i,
      /\bFI\s+CONSULTANT\b/i,
      /\bCONTROLLING\b/i,
      /\bFSCM\b/i,
      /\bTRM\b/i,
      /\bCFIN\b/i,
      /\bCENTRAL\s+FINANCE\b/i,
    ],
    body: [
      /\bFICO\b/i,
      /\bFI\/CO\b/i,
      /\bSAP\s+FI\b/i,
      /\bSAP\s+CO\b/i,
      /\bFI\s+CONSULTANT\b/i,
      /\bCO\s+CONSULTANT\b/i,
      /\bGENERAL\s+LEDGER\b/i,
      /\bGL\b/i,
      /\bACCOUNTS\s+PAYABLE\b/i,
      /\bAP\b/i,
      /\bACCOUNTS\s+RECEIVABLE\b/i,
      /\bAR\b/i,
      /\bASSET\s+ACCOUNTING\b/i,
      /\bAA\b/i,
      /\bCONTROLLING\b/i,
      /\bCO-?PA\b/i,
      /\bCOPA\b/i,
      /\bFSCM\b/i,
      /\bTRM\b/i,
      /\bTREASURY\b/i,
      /\bGROUP\s+REPORTING\b/i,
      /\bCENTRAL\s+FINANCE\b/i,
      /\bCFIN\b/i,
      /\bBANK\s+ACCOUNTING\b/i,
      /\bPROFIT\s+CENTER\b/i,
      /\bCOST\s+CENTER\b/i,
      /\bINTERNAL\s+ORDER\b/i,
    ],
    project: [
      /\b(FICO|FI\/CO|SAP\s+FI|SAP\s+CO|FINANCE|FINANCIAL|FSCM|TRM|CFIN|CENTRAL\s+FINANCE).{0,80}\b(IMPLEMENTATION|ROLLOUT|ROLL\s*OUT|SUPPORT|AMS|MIGRATION|UPGRADE|S\/4HANA|GREENFIELD|BROWNFIELD|BLUEPRINT|CONFIGURATION)\b/i,
      /\b(IMPLEMENTATION|ROLLOUT|ROLL\s*OUT|SUPPORT|AMS|MIGRATION|UPGRADE|S\/4HANA|GREENFIELD|BROWNFIELD|BLUEPRINT|CONFIGURATION).{0,80}\b(FICO|FI\/CO|SAP\s+FI|SAP\s+CO|FINANCE|FINANCIAL|FSCM|TRM|CFIN|CENTRAL\s+FINANCE)\b/i,
    ],
  },
  MM: {
    title: [/\bSAP\s+MM\b/i, /\bMM\s+CONSULTANT\b/i, /\bMATERIALS?\s+MANAGEMENT\b/i, /\bPROCUREMENT\b/i, /\bP2P\b/i],
    body: [/\bSAP\s+MM\b/i, /\bMM\b/i, /\bMATERIALS?\s+MANAGEMENT\b/i, /\bPROCUREMENT\b/i, /\bPURCHASING\b/i, /\bINVENTORY\s+MANAGEMENT\b/i, /\bP2P\b/i, /\bPURCHASE\s+ORDER\b/i, /\bGOODS\s+RECEIPT\b/i],
    project: [/\b(MM|MATERIALS?\s+MANAGEMENT|PROCUREMENT|P2P|PURCHASING).{0,80}\b(IMPLEMENTATION|ROLLOUT|SUPPORT|AMS|MIGRATION|UPGRADE|BLUEPRINT|CONFIGURATION)\b/i],
  },
  SD: {
    title: [/\bSAP\s+SD\b/i, /\bSD\s+CONSULTANT\b/i, /\bSALES\s+(&|AND)\s+DISTRIBUTION\b/i, /\bORDER\s+TO\s+CASH\b/i, /\bOTC\b/i, /\bO2C\b/i],
    body: [/\bSAP\s+SD\b/i, /\bSD\b/i, /\bSALES\s+(&|AND)\s+DISTRIBUTION\b/i, /\bORDER\s+TO\s+CASH\b/i, /\bOTC\b/i, /\bO2C\b/i, /\bPRICING\b/i, /\bBILLING\b/i, /\bDELIVERY\b/i, /\bSALES\s+ORDER\b/i],
    project: [/\b(SD|SALES\s+(&|AND)\s+DISTRIBUTION|ORDER\s+TO\s+CASH|OTC|O2C|PRICING|BILLING).{0,80}\b(IMPLEMENTATION|ROLLOUT|SUPPORT|AMS|MIGRATION|UPGRADE|BLUEPRINT|CONFIGURATION)\b/i],
  },
  ABAP: {
    title: [/\bABAP\b/i, /\bDEVELOPER\b/i, /\bTECHNICAL\s+CONSULTANT\b/i, /\bRICEF\b/i],
    body: [/\bABAP\b/i, /\bBAPI\b/i, /\bBADI\b/i, /\bIDOC\b/i, /\bSMARTFORMS?\b/i, /\bSAPSCRIPT\b/i, /\bUSER\s+EXIT\b/i, /\bENHANCEMENT\b/i, /\bRICEF\b/i, /\bOOABAP\b/i, /\bCDS\s+VIEW\b/i, /\bAMDP\b/i],
    project: [/\b(ABAP|RICEF|BAPI|BADI|IDOC|SMARTFORMS?|CDS).{0,80}\b(IMPLEMENTATION|DEVELOPMENT|SUPPORT|ENHANCEMENT|MIGRATION|UPGRADE)\b/i],
  },
  BASIS: {
    title: [/\bBASIS\b/i, /\bSAP\s+SECURITY\b/i, /\bSOLUTION\s+MANAGER\b/i, /\bSOLMAN\b/i, /\bSYSTEM\s+ADMIN/i],
    body: [/\bBASIS\b/i, /\bNETWEAVER\b/i, /\bTRANSPORT\s+MANAGEMENT\b/i, /\bSAP\s+SECURITY\b/i, /\bGRC\b/i, /\bAUTHORI[ZS]ATION\b/i, /\bSOLUTION\s+MANAGER\b/i, /\bSOLMAN\b/i, /\bSYSTEM\s+ADMIN/i],
    project: [/\b(BASIS|SECURITY|GRC|SOLUTION\s+MANAGER|SOLMAN|TRANSPORT).{0,80}\b(IMPLEMENTATION|SUPPORT|AMS|MIGRATION|UPGRADE|CONVERSION)\b/i],
  },
  BW: {
    title: [/\bSAP\s+BW\b/i, /\bBW\b/i, /\bBI\b/i, /\bBOBJ\b/i, /\bSAC\b/i, /\bDATASPHERE\b/i, /\bANALYTICS\b/i, /\bBW\/4HANA\b/i, /\bBPC\b/i],
    body: [/\bSAP\s+BW\b/i, /\bBW\b/i, /\bBI\b/i, /\bBOBJ\b/i, /\bWEBI\b/i, /\bBUSINESS\s+OBJECTS\b/i, /\bSAC\b/i, /\bSAP\s+ANALYTICS\s+CLOUD\b/i, /\bDATASPHERE\b/i, /\bDWC\b/i, /\bBW\/4HANA\b/i, /\bBPC\b/i, /\bDATA\s+WAREHOUSE\b/i, /\bREPORTING\b/i],
    project: [/\b(BW|BI|BOBJ|SAC|DATASPHERE|DWC|BW\/4HANA|BPC|REPORTING).{0,80}\b(IMPLEMENTATION|SUPPORT|AMS|MIGRATION|UPGRADE|MODEL|REPORT)\b/i],
  },
  "IS-U": {
    title: [/\bSAP\s*IS[-\s]?U\b/i, /\bIS[-\s]?U\s+(FUNCTIONAL|CONSULTANT|ANALYST|BILLING)\b/i, /\bSAP\s+ISU\b/i, /\bISU\s+(FUNCTIONAL|CONSULTANT|ANALYST|BILLING)\b/i],
    body: [/\bSAP\s*IS[-\s]?U\b/i, /\bIS[-\s]?U\b/i, /\bSAP\s+ISU\b/i, /\bISU\s+BILLING\b/i, /\bDEVICE\s+MANAGEMENT\b/i, /\bMETER\s+READING\b/i, /\bUTILITIES\s+BILLING\b/i],
    project: [/\b(IS[-\s]?U|ISU|UTILITIES\s+BILLING|DEVICE\s+MANAGEMENT).{0,80}\b(IMPLEMENTATION|ROLLOUT|SUPPORT|AMS|MIGRATION|UPGRADE|CONFIGURATION)\b/i],
  },
  TM: {
    title: [/\bSAP\s+TM\b/i, /\bTRANSPORTATION\s+MANAGEMENT\b/i],
    body: [/\bSAP\s+TM\b/i, /\bTRANSPORTATION\s+MANAGEMENT\b/i, /\bFREIGHT\b/i, /\bFORWARDING\s+ORDER\b/i, /\bCARRIER\s+SELECTION\b/i],
    project: [/\b(TM|TRANSPORTATION\s+MANAGEMENT|FREIGHT).{0,80}\b(IMPLEMENTATION|ROLLOUT|SUPPORT|AMS|MIGRATION|UPGRADE)\b/i],
  },
  EWM: {
    title: [/\bSAP\s+EWM\b/i, /\bEWM\b/i, /\bEXTENDED\s+WAREHOUSE\b/i, /\bWAREHOUSE\s+MANAGEMENT\b/i],
    body: [/\bSAP\s+EWM\b/i, /\bEWM\b/i, /\bEXTENDED\s+WAREHOUSE\b/i, /\bWAREHOUSE\s+MANAGEMENT\b/i, /\bWMS\b/i, /\bPUTAWAY\b/i, /\bPICKING\b/i, /\bPACKING\b/i],
    project: [/\b(EWM|EXTENDED\s+WAREHOUSE|WAREHOUSE\s+MANAGEMENT|WMS).{0,80}\b(IMPLEMENTATION|ROLLOUT|SUPPORT|AMS|MIGRATION|UPGRADE)\b/i],
  },
  PP: {
    title: [/\bSAP\s+PP\b/i, /\bPRODUCTION\s+PLANNING\b/i, /\bMRP\b/i],
    body: [/\bSAP\s+PP\b/i, /\bPP\b/i, /\bPRODUCTION\s+PLANNING\b/i, /\bMRP\b/i, /\bBOM\b/i, /\bROUTING\b/i, /\bPRODUCTION\s+ORDER\b/i],
    project: [/\b(PP|PRODUCTION\s+PLANNING|MRP|BOM|ROUTING).{0,80}\b(IMPLEMENTATION|ROLLOUT|SUPPORT|AMS|MIGRATION|UPGRADE)\b/i],
  },
  PM: {
    title: [/\bSAP\s+PM\b/i, /\bPLANT\s+MAINTENANCE\b/i, /\bEAM\b/i],
    body: [/\bSAP\s+PM\b/i, /\bPLANT\s+MAINTENANCE\b/i, /\bEAM\b/i, /\bMAINTENANCE\s+ORDER\b/i, /\bEQUIPMENT\s+MASTER\b/i, /\bFUNCTIONAL\s+LOCATION\b/i],
    project: [/\b(PM|PLANT\s+MAINTENANCE|EAM|MAINTENANCE).{0,80}\b(IMPLEMENTATION|ROLLOUT|SUPPORT|AMS|MIGRATION|UPGRADE)\b/i],
  },
  PS: {
    title: [/\bSAP\s+PS\b/i, /\bPROJECT\s+SYSTEMS?\b/i, /\bPS\s+(TEAM\s+LEAD|CONSULTANT|LEAD)\b/i, /\bWBS\b/i],
    body: [/\bSAP\s+PS\b/i, /\bPROJECT\s+SYSTEMS?\b/i, /\bWBS\b/i, /\bNETWORK\s+ACTIVITY\b/i, /\bPROJECT\s+BUILDER\b/i, /\bCJ20N\b/i],
    project: [/\b(PS|PROJECT\s+SYSTEMS?|WBS|CJ20N).{0,80}\b(IMPLEMENTATION|ROLLOUT|SUPPORT|AMS|MIGRATION|UPGRADE|CONFIGURATION)\b/i],
  },
  HCM: {
    title: [/\bSUCCESSFACTORS\b/i, /\bSUCCESS\s*FACTORS\b/i, /\bSAP\s+SF\b/i, /\bEMPLOYEE\s+CENTRAL\b/i, /\bSF\s+EC\b/i, /\bHXM\b/i],
    body: [/\bSAP\s+HCM\b/i, /\bSAP\s+HR\b/i, /\bSUCCESSFACTORS\b/i, /\bPAYROLL\b/i, /\bORGANIZATION\s+MANAGEMENT\b/i],
    project: [/\b(HCM|HR|SUCCESSFACTORS|PAYROLL).{0,80}\b(IMPLEMENTATION|ROLLOUT|SUPPORT|AMS|MIGRATION|UPGRADE)\b/i],
  },
};




function hasStrongTitleEvidence(module: string, titleZone: string) {
  const title = String(titleZone || "").toUpperCase();

  const patterns: Record<string, RegExp> = {
    BTP: /\b(SAP\s+BTP|BUSINESS\s+TECHNOLOGY\s+PLATFORM|SAP\s+CLOUD\s+PLATFORM|INTEGRATION\s+SUITE|SAP\s+CPI|CLOUD\s+FOUNDRY|CAP\s+MODEL)\b/i,
    BW: /\b(SAP\s+BW|SAP\s+BI|BI\s+CONSULTANT|BW\/4HANA|BW4HANA|BOBJ|BUSINESS\s+OBJECTS|SAP\s+ANALYTICS\s+CLOUD|SAC|DATASPHERE|BPC)\b/i,
    SUCCESSFACTORS: /\b(SAP\s+SUCCESSFACTORS|SUCCESSFACTORS|SUCCESS\s+FACTORS|SAP\s+SF|EMPLOYEE\s+CENTRAL|SF\s+EC|HXM)\b/i,
    SECURITY: /\b(SAP\s+SECURITY|SECURITY\s+CONSULTANT|AUTHORI[ZS]ATION|GRC)\b/i,
    BASIS: /\b(SAP\s+BASIS|BASIS\s+CONSULTANT|NETWEAVER|SOLUTION\s+MANAGER|SOLMAN)\b/i,
    ABAP: /\b(SAP\s+ABAP|ABAP\s+DEVELOPER|ABAP\s+CONSULTANT|TECHNICAL\s+CONSULTANT|RICEF|WRICEF)\b/i,
    FICO: /\b(SAP\s+FICO|FI\/CO|FICO|SAP\s+FI\b|SAP\s+CO\b|CFIN|CENTRAL\s+FINANCE)\b/i,
    MM: /\b(SAP\s+MM|MM\s+CONSULTANT|MM\s+FUNCTIONAL|MATERIALS?\s+MANAGEMENT|PROCUREMENT|P2P)\b/i,
    SD: /\b(SAP\s+SD|SD\s+CONSULTANT|SD\s+FUNCTIONAL|SALES\s+AND\s+DISTRIBUTION|ORDER\s+TO\s+CASH|O2C|OTC)\b/i,
  };

  return patterns[module]?.test(title) || false;
}

function applyModuleQualityGates(scores: Record<string, number>, titleZone: string) {
  const gated = { ...scores };

  // Prevent incidental technical keywords in functional CV bodies from winning.
  for (const module of ["BTP", "BW", "SUCCESSFACTORS", "SECURITY", "BASIS", "ABAP"]) {
    if (gated[module] && gated[module] > 0 && !hasStrongTitleEvidence(module, titleZone)) {
      gated[module] = Math.min(gated[module], Math.floor(gated[module] * 0.55));
    }
  }

  // Explicit title evidence should beat body noise.
  for (const module of ["FICO", "MM", "SD", "ABAP", "BASIS", "BW", "BTP", "SUCCESSFACTORS"]) {
    if (hasStrongTitleEvidence(module, titleZone)) {
      gated[module] = Math.max(gated[module] || 0, 95);
    }
  }

  return gated;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapedModulePattern(module: string) {
  const aliases: Record<string, string[]> = {
    ARIBA: ["ARIBA", "SAP ARIBA", "SOURCE TO PAY", "S2P", "SOURCE TO CONTRACT", "SCT", "GUIDED BUYING"],
    SUCCESSFACTORS: ["SUCCESSFACTORS", "SUCCESS FACTORS", "HXM", "SF"],
    DATASPHERE: ["DATASPHERE", "DATA WAREHOUSE CLOUD", "DWC"],
    "BW/4HANA": ["BW/4HANA", "BW4HANA", "BW 4HANA"],
    BTP: ["BTP", "BUSINESS TECHNOLOGY PLATFORM", "EXTENSION SUITE", "INTEGRATION SUITE"],
    CPI: ["CPI", "CLOUD PLATFORM INTEGRATION", "CLOUD INTEGRATION", "INTEGRATION SUITE", "IFLOW", "I-FLOW"],
    "PI/PO": ["PI/PO", "PI PO", "PROCESS INTEGRATION", "PROCESS ORCHESTRATION", "XI"],
    SAC: ["SAC", "SAP ANALYTICS CLOUD", "ANALYTICS CLOUD", "SAC PLANNING"],
    GR: ["GROUP REPORTING", "S/4HANA GROUP REPORTING", "CONSOLIDATION"],
    BCM: ["BCM", "BANK COMMUNICATION MANAGEMENT"],
    FSCM: ["FSCM", "CREDIT MANAGEMENT", "COLLECTIONS", "DISPUTE MANAGEMENT"],
    TRM: ["TRM", "TREASURY", "TREASURY AND RISK MANAGEMENT", "CASH MANAGEMENT"],
    CFIN: ["CFIN", "CENTRAL FINANCE", "S/4 CENTRAL FINANCE"],
    PPDS: ["PPDS", "PP/DS", "DETAILED SCHEDULING"],
    MDG: ["MDG", "MASTER DATA GOVERNANCE"],
    GRC: ["GRC", "GOVERNANCE RISK", "ACCESS CONTROL", "PROCESS CONTROL", "RISK MANAGEMENT"],
    FIORI: ["FIORI", "LAUNCHPAD", "FIORI ELEMENTS"],
    UI5: ["UI5", "SAPUI5", "SAP UI5", "OPENUI5"],
    CONCUR: ["CONCUR", "TRAVEL AND EXPENSE", "EXPENSE MANAGEMENT"],
    FIELDGLASS: ["FIELDGLASS", "EXTERNAL WORKFORCE", "VENDOR MANAGEMENT"],
  };
  const values = aliases[module] || [module.replace(/-/g, " "), module];
  return values.map(escapeRegExp).join("|");
}

function buildGenericModuleRules(module: Exclude<SapPrimaryModule, "UNKNOWN">) {
  const p = escapedModulePattern(module);
  return {
    title: [new RegExp(`\\b(SAP\\s+)?(${p})\\b`, "i")],
    body: [new RegExp(`\\b(SAP\\s+)?(${p})\\b`, "i")],
    project: [
      new RegExp(`\\b(${p}).{0,100}\\b(IMPLEMENTATION|ROLLOUT|ROLL\\s*OUT|SUPPORT|AMS|MIGRATION|UPGRADE|CONFIGURATION|INTEGRATION|DESIGN|BUILD|DEPLOYMENT|S/4HANA|S4HANA|GREENFIELD|BROWNFIELD)\\b`, "i"),
      new RegExp(`\\b(IMPLEMENTATION|ROLLOUT|ROLL\\s*OUT|SUPPORT|AMS|MIGRATION|UPGRADE|CONFIGURATION|INTEGRATION|DESIGN|BUILD|DEPLOYMENT|S/4HANA|S4HANA|GREENFIELD|BROWNFIELD).{0,100}\\b(${p})\\b`, "i"),
    ],
  };
}

function moduleRules(module: Exclude<SapPrimaryModule, "UNKNOWN">) {
  return MODULE_RULES[module] || buildGenericModuleRules(module);
}

export function textOf(...values: any[]) {
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

function upper(...values: any[]) {
  return textOf(...values).toUpperCase();
}

function clamp(v: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(v)));
}


function safeNumber(value: any, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}


function countRegex(text: string, re: RegExp, cap = 4) {
  const flags = re.flags.includes("g") ? re.flags : `${re.flags}g`;
  const matcher = new RegExp(re.source, flags);
  return Math.min(Array.from(text.matchAll(matcher)).length, cap);
}

function hasAny(text: string, rules: RegExp[]) {
  return rules.some((rule) => rule.test(text));
}

function titleText(candidate: any) {
  return upper(
    candidate?.title,
    candidate?.current_title,
    candidate?.headline,
    candidate?.position,
    candidate?.designation,
    candidate?.job_title
  );
}

function topText(candidate: any) {
  return upper(
    candidate?.name,
    candidate?.title,
    candidate?.current_title,
    candidate?.headline,
    candidate?.summary,
    candidate?.sap_modules,
    candidate?.skills
  );
}

function bodyText(candidate: any) {
  return upper(
    candidate?.title,
    candidate?.current_title,
    candidate?.headline,
    candidate?.summary,
    candidate?.experience,
    candidate?.primary_module,
    candidate?.primaryModule,
    candidate?.secondary_modules,
    candidate?.secondaryModules,
    candidate?.sap_modules,
    candidate?.sap_submodules,
    candidate?.modules,
    candidate?.skills,
    candidate?.raw_text,
    candidate?.resume_text,
    candidate?.raw_cv,
    candidate?.rawText
  );
}

export function hasExplicitIsuSignal(text: string) {
  return (
    /\bSAP\s*IS[-\s]?U\b/i.test(text) ||
    /\bIS[-\s]?U\s+(FUNCTIONAL|CONSULTANT|ANALYST|BILLING|DEVICE|DM|FICA|PRINT|INVOICING|METER|UTILITIES)\b/i.test(text) ||
    /\bSAP\s+ISU\b/i.test(text) ||
    /\bISU\s+(FUNCTIONAL|CONSULTANT|ANALYST|BILLING|DEVICE|DM|FICA|PRINT|INVOICING|METER|UTILITIES)\b/i.test(text)
  );
}

export function isWeakCandidateNameProduction(value: any) {
  const name = textOf(value).trim();
  const up = name.toUpperCase().replace(/[.,:;()]/g, " ");

  if (!name) return true;

  if (/^(UNKNOWN CANDIDATE|REVIEW REQUIRED|CANDIDATE|CONSULTANT|MANAGER|PROFILE|RESUME|CV|NO TITLE|JOB TITLE|JOB TARGET)$/i.test(name)) return true;

  if (
    /\b(ACCENTURE|DELOITTE|PWC|IBM|CAPGEMINI|NTT|CBS|CORPORATE BUSINESS|WALLDORF|UNIVERSITY|COLLEGE|COMPANY|CLIENT|PROJECT|INDUSTRIES|TRANSFORMATION|TRANSITION|RESOLUTION|IMPLEMENTATION|APPLICATION DEVELOPMENT|WORK STREAM|JOB TARGET|EMPLOYMENT|UTILITIES COMPANIES|FOREIGN MONIKER|DESIGNATION|SEAMLESS TRANSITION|ISSUE RESOLUTION|PERSONAL DETAIL|WORK HISTORY|DIGITAL TRANSFORMATION|MAGELLAN DATA MIGRATION|ORDER TO CASH TESTING|LOGISTICS WAREHOUSE|BODS DATA MIGRATION|OLIVAREZ HOMES|CITY LAGUNA|AS A CONSULTANT|WORKED AS|PROVIDED SERVICES|THE IMPLEMENTATION)\b/i.test(up)
  ) return true;

  if (WEAK_NAME_PHRASES.some((phrase) => up.includes(phrase))) return true;
  if (/\b(CONSULTANT|CANDIDATE|NAME|TITLE|DESIGNATION|EMPLOYMENT)\s*:/i.test(name)) return true;
  if (/[0-9@]/.test(name)) return true;

  const words = name.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 5) return true;

  const titleWords = words.filter((w) =>
    /^(SAP|FICO|FI|CO|ABAP|BASIS|BW|BI|MM|SD|EWM|TM|PP|PM|PS|CONSULTANT|MANAGER|LEAD|SENIOR|JUNIOR|ASSOCIATE|SPECIALIST|ARCHITECT|ANALYST|DEVELOPER|APPLICATION|DEVELOPMENT|DESIGNATION|LOGISTICS|WAREHOUSE|DATA|MIGRATION|MATERIAL|MANAGEMENT|SALES|DISTRIBUTION)$/i.test(w)
  );
  if (titleWords.length >= Math.max(2, words.length - 1)) return true;

  // Person-name sanity: reject names ending with obvious SAP/company/title fragments.
  if (/\b(SAC|BODS|DATASPHERE|MATERIAL|CALAMBA|DESIGNATION|CONSULTANT|MANAGER|ARCHITECT|SPECIALIST)\b$/i.test(name)) return true;

  return false;
}

function titleCase(value: string) {
  return value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function fallbackNameFromEmail(email: any) {
  const local = textOf(email).split("@")[0] || "";
  const cleaned = local
    .replace(/\b(cv|resume|profile|sap|fico|fi|co|consultant|senior|sr|final|updated)\b/gi, " ")
    .replace(/[._-]+/g, " ")
    .replace(/\d+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const known: Record<string, string> = {
    rmpangilinan: "Ronald Pangilinan",
    "r m pangilinan": "Ronald Pangilinan",
    pelobillomichelle: "Michelle Pelobillo",
    michellepelobillo: "Michelle Pelobillo",
    doriecb: "Review Required",
    harvindhakshan: "Review Required",
    romelpangilinanona: "Romel Pangilinan",
    hilarioallanpaul: "Hilario Allan Paul",
    allanpaulhilario: "Allan Paul Hilario",
    mohdazam: "Mohd Azam",
    shilitengs: "Shili Tengs",
  };

  const compact = cleaned.replace(/\s+/g, "").toLowerCase();
  if (known[compact]) return known[compact];

  const parts = cleaned.split(/\s+/).filter((p) => /^[a-zA-Z'’-]{2,}$/.test(p)).slice(0, 4);
  if (parts.length < 2) return null;

  const candidate = titleCase(parts.join(" "));
  return isWeakCandidateNameProduction(candidate) ? null : candidate;
}


export function normalizePersonNameProduction(name: any, email?: any) {
  const original = textOf(name)
    .replace(/[|•]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const emailFallback = email ? fallbackNameFromEmail(email) : null;

  if (!original || isWeakCandidateNameProduction(original)) {
    return emailFallback || "Review Required";
  }

  let cleaned = original
    .replace(/\b(CV|RESUME|PROFILE|UPDATED|FINAL|SAP|FICO|FI\/CO|FI CO)\b/gi, " ")
    .replace(/\b(ACCENTURE INC DESIGNATION|ACCENTURE INC|APPLICATION DEVELOPMENT MANAGER|JOB TARGET|FOREIGN MONIKER|UTILITIES COMPANIES|DESIGNATION)\b/gi, " ")
    .replace(/[,_]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (isWeakCandidateNameProduction(cleaned)) {
    return emailFallback || "Review Required";
  }

  return cleaned;
}

export function normalizeCandidateFingerprint(name: any, email?: any, phone?: any) {
  const normalizedName = textOf(name)
    .toLowerCase()
    .replace(/\b(cv|resume|profile|sap|fico|fi|co|consultant|senior|lead|manager|updated|final)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  const normalizedEmail = textOf(email).toLowerCase().trim();
  const normalizedPhone = textOf(phone).replace(/\D/g, "");

  return {
    normalizedName,
    normalizedEmail,
    normalizedPhone,
    key:
      normalizedEmail ||
      normalizedPhone ||
      normalizedName.split(/\s+/).sort().join(" "),
  };
}


export function normalizeSapModule(value: any): SapPrimaryModule {
  const t = upper(value);

  if (!t) return "UNKNOWN";
  if (hasExplicitIsuSignal(t)) return "IS-U";

  const checks: Array<[SapPrimaryModule, RegExp]> = [
    ["BTP", /\b(BTP|BUSINESS\s+TECHNOLOGY\s+PLATFORM|EXTENSION\s+SUITE|INTEGRATION\s+SUITE)\b/i],
    ["CPI", /\b(CPI|CLOUD\s+PLATFORM\s+INTEGRATION|CLOUD\s+INTEGRATION|IFLOW|I-FLOW|INTEGRATION\s+SUITE)\b/i],
    ["PI/PO", /\b(PI\/PO|PI\s+PO|PROCESS\s+INTEGRATION|PROCESS\s+ORCHESTRATION|SAP\s+XI)\b/i],
    ["MDG", /\b(MDG|MASTER\s+DATA\s+GOVERNANCE)\b/i],
    ["GRC", /\b(GRC|ACCESS\s+CONTROL|PROCESS\s+CONTROL|RISK\s+MANAGEMENT|SOD)\b/i],
    ["SECURITY", /\b(SAP\s+SECURITY|AUTHORI[ZS]ATION|PFCG|SECURITY)\b/i],
    ["FIORI", /\b(FIORI|LAUNCHPAD|FIORI\s+ELEMENTS)\b/i],
    ["UI5", /\b(UI5|SAPUI5|SAP\s+UI5|OPENUI5)\b/i],
    ["DATASPHERE", /\b(DATASPHERE|DATA\s+WAREHOUSE\s+CLOUD|DWC)\b/i],
    ["SAC", /\b(SAC|SAP\s+ANALYTICS\s+CLOUD|ANALYTICS\s+CLOUD|SAC\s+PLANNING)\b/i],
    ["BW/4HANA", /\b(BW\/4HANA|BW4HANA|BW\s+4HANA)\b/i],
    ["BPC", /\b(BPC|BUSINESS\s+PLANNING\s+AND\s+CONSOLIDATION)\b/i],
    ["BOBJ", /\b(BOBJ|BUSINESS\s+OBJECTS|WEBI|CRYSTAL\s+REPORTS)\b/i],
    ["BODS", /\b(BODS|DATA\s+SERVICES|SAP\s+DS|ETL)\b/i],
    ["CFIN", /\b(CFIN|CENTRAL\s+FINANCE|S\/4\s*CENTRAL\s+FINANCE)\b/i],
    ["FSCM", /\b(FSCM|CREDIT\s+MANAGEMENT|COLLECTIONS?|DISPUTE\s+MANAGEMENT)\b/i],
    ["TRM", /\b(TRM|TREASURY|TREASURY\s+AND\s+RISK\s+MANAGEMENT|CASH\s+MANAGEMENT)\b/i],
    ["BCM", /\b(BCM|BANK\s+COMMUNICATION\s+MANAGEMENT)\b/i],
    ["GR", /\b(GROUP\s+REPORTING|S\/4HANA\s+GROUP\s+REPORTING|CONSOLIDATION)\b/i],
    ["ARIBA", /\b(ARIBA|SOURCE\s+TO\s+PAY|S2P|SOURCE\s+TO\s+CONTRACT|GUIDED\s+BUYING)\b/i],
    ["IBP", /\b(IBP|INTEGRATED\s+BUSINESS\s+PLANNING|DEMAND\s+PLANNING|SUPPLY\s+PLANNING)\b/i],
    ["APO", /\b(APO|ADVANCED\s+PLANNING|DP|SNP|GATP)\b/i],
    ["PPDS", /\b(PPDS|PP\/DS|DETAILED\s+SCHEDULING)\b/i],
    ["SUCCESSFACTORS", /\b(SUCCESSFACTORS|SUCCESS\s+FACTORS|HXM|SAP\s+SF)\b/i],
    ["EC", /\b(EMPLOYEE\s+CENTRAL|SF\s+EC|EC\s+CORE)\b/i],
    ["ECP", /\b(ECP|EMPLOYEE\s+CENTRAL\s+PAYROLL)\b/i],
    ["RCM", /\b(RCM|RECRUITING\s+MANAGEMENT)\b/i],
    ["ONB", /\b(ONB|ONBOARDING)\b/i],
    ["LMS", /\b(LMS|LEARNING\s+MANAGEMENT)\b/i],
    ["PMGM", /\b(PMGM|PERFORMANCE\s+AND\s+GOALS)\b/i],
    ["CONCUR", /\b(CONCUR|TRAVEL\s+AND\s+EXPENSE|EXPENSE\s+MANAGEMENT)\b/i],
    ["FIELDGLASS", /\b(FIELDGLASS|EXTERNAL\s+WORKFORCE|VENDOR\s+MANAGEMENT)\b/i],
    ["BRIM", /\b(BRIM|BILLING\s+AND\s+REVENUE\s+INNOVATION)\b/i],
    ["CX", /\b(CX|C\/4HANA|CUSTOMER\s+EXPERIENCE)\b/i],
    ["CRM", /\b(CRM|CUSTOMER\s+RELATIONSHIP)\b/i],
    ["FICO", /\b(FICO|FI\/CO|FI CO|FI-CO|SAP FI\b|SAP CO\b|FINANCE|FINANCIAL\s+ACCOUNTING|CONTROLLING|RTR|R2R|RECORD\s+TO\s+REPORT)\b/i],
    ["ABAP", /\b(ABAP|DEVELOPER|RICEF|WRICEF|BAPI|BADI|IDOC|CDS|AMDP)\b/i],
    ["BASIS", /\b(BASIS|SOLUTION\s+MANAGER|SOLMAN|NETWEAVER|HANA\s+ADMIN|SYSTEM\s+ADMIN)\b/i],
    ["BW", /\b(BW|SAP\s+BW|BI|BUSINESS\s+WAREHOUSE)\b/i],
    ["EWM", /\b(EWM|EXTENDED\s+WAREHOUSE)\b/i],
    ["TM", /\b(TM|TRANSPORTATION\s+MANAGEMENT|FREIGHT)\b/i],
    ["MM", /\b(MM|MATERIALS?\s+MANAGEMENT|PROCUREMENT|PURCHASING|INVENTORY|P2P|PROCURE\s+TO\s+PAY)\b/i],
    ["SD", /\b(SD|SALES\s+(&|AND)\s+DISTRIBUTION|ORDER\s+TO\s+CASH|OTC|O2C|PRICING|BILLING)\b/i],
    ["PP", /\b(PP|PRODUCTION\s+PLANNING|MRP|MANUFACTURING)\b/i],
    ["PM", /\b(PM|PLANT\s+MAINTENANCE|EAM|ENTERPRISE\s+ASSET)\b/i],
    ["PS", /\b(PS|PROJECT\s+SYSTEMS?|WBS)\b/i],
    ["QM", /\b(QM|QUALITY\s+MANAGEMENT|INSPECTION\s+LOT)\b/i],
    ["GTS", /\b(GTS|GLOBAL\s+TRADE\s+SERVICES|CUSTOMS\s+MANAGEMENT)\b/i],
  ];

  for (const [module, rule] of checks) {
    if (rule.test(t)) return module;
  }

  return "UNKNOWN";
}

function keywordScore(text: string, rules: RegExp[], points: number, cap: number) {
  return rules.reduce((total, rule) => total + countRegex(text, rule, cap) * points, 0);
}

function projectMentions(text: string, module: Exclude<SapPrimaryModule, "UNKNOWN">) {
  const rules = moduleRules(module);
  return rules.project.reduce((total, rule) => total + countRegex(text, rule, 6), 0);
}

function moduleScore(candidate: any, module: Exclude<SapPrimaryModule, "UNKNOWN">) {
  const title = titleText(candidate);
  const top = topText(candidate);
  const body = bodyText(candidate);
  const rules = moduleRules(module);

  let score = 0;

  const titleHit = hasAny(title, rules.title);
  const topHit = hasAny(top, rules.title);
  const projectHits = projectMentions(body, module);
  const bodyHits = keywordScore(body, rules.body, 4, 2);

  const explicitTitleBoost = module === "FICO" ? 34 : 42;
  const topBoost = module === "FICO" ? 20 : 26;

  if (titleHit) score += explicitTitleBoost;
  if (!titleHit && topHit) score += topBoost;

  score += Math.min(bodyHits, module === "FICO" ? 20 : 26);
  score += Math.min(projectHits * 14, 42);

  // FICO is often mentioned as submodule or keyword; require strong evidence.
  if (module === "FICO") {
    const ficoTitle = /\b(FICO|FI\/CO|FI CO|SAP\s+FI\b|SAP\s+CO\b|FI\s+CONSULTANT|FINANCE\s+CONSULTANT|FINANCIAL\s+ACCOUNTING|CONTROLLING)\b/i.test(title);
    const ficoProject = projectHits >= 1;
    const ficoDepth = countRegex(body, /\b(GL|AP|AR|AA|COPA|CO-PA|FSCM|TRM|CFIN|CENTRAL\s+FINANCE|GENERAL\s+LEDGER|ACCOUNTS\s+PAYABLE|ACCOUNTS\s+RECEIVABLE|ASSET\s+ACCOUNTING)\b/i, 10);

    if (!ficoTitle && !ficoProject) score = Math.min(score, 32);
    if (ficoTitle && ficoDepth >= 3) score += 10;
    if (ficoProject && ficoDepth >= 4) score += 10;
  }

  // Technical modules must be explicit in title or project, not only skill list.
  if (["ABAP", "BASIS", "BW", "BTP", "CPI", "PI/PO", "FIORI", "UI5", "MDG", "GRC", "SECURITY", "DATASPHERE", "SAC", "BW/4HANA"].includes(module)) {
    if (!titleHit && projectHits === 0) score = Math.min(score, 38);
  }

  // IS-U false positive guard.
  if (module === "IS-U" && !hasExplicitIsuSignal(body)) {
    score = 0;
  }

  // Anti-keyword stuffing: repeating same module name does not create authority.
  const exactRepeats = countRegex(body, new RegExp(`\\b${module.replace("-", "[-\\\\s]?")}\\b`, "i"), 12);
  if (exactRepeats > 6 && projectHits === 0 && !titleHit) {
    score = Math.min(score, 45);
  }

  return clamp(score, 0, 100);
}

function projectAuthorityByType(text: string): SapProjectAuthority {
  const t = upper(text);

  const c = (re: RegExp, cap = 8) => countRegex(t, re, cap);

  const implementation = c(/\b(IMPLEMENTATION|IMPLEMENTED|FULL\s+CYCLE|END[-\s]?TO[-\s]?END|E2E|GREENFIELD|BROWNFIELD)\b/i);
  const rollout = c(/\b(ROLLOUT|ROLL\s*OUT|GLOBAL\s+TEMPLATE|LOCALI[ZS]ATION|LOCALIZATION)\b/i);
  const support = c(/\b(SUPPORT|PRODUCTION\s+SUPPORT|L2|L3|INCIDENT|TICKET|BUG\s+FIX)\b/i);
  const ams = c(/\b(AMS|APPLICATION\s+MANAGED\s+SERVICES|APPLICATION\s+MAINTENANCE|MAINTENANCE\s+SUPPORT)\b/i);
  const enhancement = c(/\b(ENHANCEMENT|CHANGE\s+REQUEST|CR\b|IMPROVEMENT|OPTIMI[ZS]ATION)\b/i);
  const migration = c(/\b(MIGRATION|DATA\s+MIGRATION|LTMC|LSMW|BODS|CONVERSION)\b/i);
  const upgrade = c(/\b(UPGRADE|CONVERSION|S\/4HANA\s+CONVERSION|ECC\s+TO\s+S\/4|BROWNFIELD)\b/i);
  const brownfield = c(/\b(BROWNFIELD|SYSTEM\s+CONVERSION|ECC\s+TO\s+S\/4)\b/i);
  const greenfield = c(/\b(GREENFIELD|NEW\s+IMPLEMENTATION|FULL\s+CYCLE\s+IMPLEMENTATION)\b/i);

  return {
    implementation,
    rollout,
    support,
    ams,
    enhancement,
    migration,
    upgrade,
    brownfield,
    greenfield,
  };
}

export function calculateImplementationAuthority(candidate: any) {
  const text = bodyText(candidate);
  const p = projectAuthorityByType(text);

  const explicitCount =
    safeNumber(candidate?.implementation_projects) ||
    safeNumber(candidate?.implementationProjects) ||
    safeNumber(candidate?.project_experience?.implementation) ||
    safeNumber(candidate?.projectExperience?.implementation);

  const rolloutCount =
    safeNumber(candidate?.rollout_projects) ||
    safeNumber(candidate?.project_experience?.rollout) ||
    safeNumber(candidate?.projectExperience?.rollout);

  const amsCount =
    safeNumber(candidate?.ams_projects) ||
    safeNumber(candidate?.support_projects) ||
    safeNumber(candidate?.project_experience?.ams) ||
    safeNumber(candidate?.projectExperience?.amsSupport);

  const implementation = Math.max(p.implementation, explicitCount);
  const rollout = Math.max(p.rollout, rolloutCount);
  const supportAms = Math.max(p.support + p.ams, amsCount);

  let score = 24;
  score += Math.min(implementation, 10) * 5.0;
  score += Math.min(Math.max(implementation - 10, 0), 5) * 1.5;
  score += Math.min(rollout, 6) * 2.6;
  score += Math.min(p.greenfield, 4) * 4.2;
  score += Math.min(p.brownfield, 4) * 3.8;
  score += Math.min(p.migration, 5) * 2.4;
  score += Math.min(p.upgrade, 5) * 2.0;
  score += Math.min(p.enhancement, 5) * 1.0;
  score += Math.min(supportAms, 10) * 0.45;

  if (implementation === 0 && rollout === 0) score = Math.min(score, 38);
  if (implementation === 1 && supportAms >= 8) score = Math.min(score, 58);
  if (implementation === 2 && supportAms >= 8) score = Math.min(score, 66);
  if (implementation >= 4 && (p.greenfield + p.brownfield + rollout) >= 2) score += 4;
  if (implementation >= 8) score += 5;
  if (implementation >= 12) score += 3;

  // Do not let generic repeated project keywords create elite score.
  if (implementation <= 3 && p.greenfield + p.brownfield + p.migration + p.upgrade <= 1) {
    score = Math.min(score, 74);
  }

  return clamp(Math.round(score), 15, 92);
}

export function calculateConsultingDNA(candidate: any) {
  const text = bodyText(candidate);

  const brandHits = CONSULTING_BRANDS.filter((brand) => text.includes(brand)).length;
  const deliveryHits =
    countRegex(text, /\bSAP\s+ACTIVATE\b/i, 4) * 3 +
    countRegex(text, /\bWORKSHOP\b/i, 6) * 3 +
    countRegex(text, /\bBLUEPRINT\b/i, 5) * 4 +
    countRegex(text, /\bFIT[-\s]?GAP\b/i, 5) * 4 +
    countRegex(text, /\bCUTOVER\b/i, 5) * 4 +
    countRegex(text, /\bGO[-\s]?LIVE\b/i, 5) * 3 +
    countRegex(text, /\bHYPERCARE\b/i, 5) * 4 +
    countRegex(text, /\bUAT\b/i, 5) * 2 +
    countRegex(text, /\bSTAKEHOLDER\b/i, 5) * 2 +
    countRegex(text, /\bCLIENT[-\s]?FACING\b/i, 4) * 3 +
    countRegex(text, /\bPRESALES|PROPOSAL|RFP\b/i, 4) * 4;

  const consultingTitle = /\b(CONSULTANT|SENIOR CONSULTANT|LEAD CONSULTANT|MANAGER|SOLUTION ARCHITECT)\b/i.test(text) ? 8 : 0;
  const brandBoost = Math.min(brandHits * 10, 25);

  return clamp(35 + brandBoost + deliveryHits + consultingTitle, 35, 90);
}

export function calculateFinanceDepth(candidate: any) {
  const text = bodyText(candidate);
  const title = titleText(candidate);

  const buckets: Array<[string, RegExp, number]> = [
    ["GL", /\bGENERAL\s+LEDGER\b|\bNEW\s+GL\b|\bGL\b/i, 7],
    ["AP", /\bACCOUNTS\s+PAYABLE\b|\bAP\b/i, 6],
    ["AR", /\bACCOUNTS\s+RECEIVABLE\b|\bAR\b/i, 6],
    ["AA", /\bASSET\s+ACCOUNTING\b|\bAA\b/i, 6],
    ["COPA", /\bCO-?PA\b|\bCOPA\b/i, 8],
    ["FSCM", /\bFSCM\b|\bCREDIT\s+MANAGEMENT\b|\bCOLLECTIONS?\b|\bDISPUTE\s+MANAGEMENT\b/i, 8],
    ["TRM", /\bTRM\b|\bTREASURY\b|\bCASH\s+MANAGEMENT\b|\bBANK\s+ACCOUNTING\b/i, 8],
    ["CFIN", /\bCENTRAL\s+FINANCE\b|\bCFIN\b/i, 9],
    ["GROUP", /\bGROUP\s+REPORTING\b|\bCONSOLIDATION\b/i, 8],
    ["CO", /\bCONTROLLING\b|\bCOST\s+CENTER\b|\bPROFIT\s+CENTER\b|\bINTERNAL\s+ORDER\b/i, 6],
    ["TAX", /\bTAX\b|\bWITHHOLDING\s+TAX\b/i, 4],
  ];

  let score = 18;
  let uniqueBuckets = 0;

  for (const [, rule, points] of buckets) {
    const hits = countRegex(text, rule, 3);
    if (hits > 0) {
      uniqueBuckets += 1;
      score += Math.min(hits, 3) * points;
    }
  }

  if (/\b(FICO|FI\/CO|SAP\s+FI|SAP\s+CO|FI\s+CONSULTANT|FINANCE\s+CONSULTANT)\b/i.test(title)) score += 10;
  if (uniqueBuckets >= 3) score += 6;
  if (uniqueBuckets >= 5) score += 8;
  if (uniqueBuckets >= 7) score += 5;

  // Cap non-FICO titles so ABAP/BW profiles do not become finance experts due to FI words in projects.
  if (!/\b(FICO|FI\/CO|SAP\s+FI|SAP\s+CO|FI\s+CONSULTANT|FINANCE\s+CONSULTANT)\b/i.test(title) && uniqueBuckets < 4) {
    score = Math.min(score, 68);
  }

  return clamp(Math.round(score), 15, 92);
}

function secondaryModules(candidate: any, scores: Record<string, number>, primary: SapPrimaryModule) {
  const text = bodyText(candidate);
  const modules: string[] = [];

  for (const mod of MODULE_PRIORITY) {
    if (mod === primary) continue;
    const score = scores[mod] || 0;
    const hasProject = projectMentions(text, mod) > 0;
    const hasTitle = hasAny(titleText(candidate), moduleRules(mod).title);

    // Secondary module must have real evidence. This prevents keyword stuffing from adding everything.
    const strongSecondary = score >= 74 && (hasProject || hasTitle);
    const explicitSecondary = hasTitle && score >= 60;

    if (strongSecondary || explicitSecondary) {
      modules.push(mod);
    }
  }

  // FICO submodules as detail, only for FICO-related profiles.
  const isFicoRelated = primary === "FICO" || (scores.FICO || 0) >= 55;
  if (isFicoRelated) {
    const detailRules: Array<[string, RegExp]> = [
      ["GL", /\bGENERAL\s+LEDGER\b|\bNEW\s+GL\b|\bGL\b/i],
      ["AP", /\bACCOUNTS\s+PAYABLE\b|\bAP\b/i],
      ["AR", /\bACCOUNTS\s+RECEIVABLE\b|\bAR\b/i],
      ["AA", /\bASSET\s+ACCOUNTING\b|\bAA\b/i],
      ["COPA", /\bCO-?PA\b|\bCOPA\b/i],
      ["FSCM", /\bFSCM\b/i],
      ["TRM", /\bTRM\b|\bTREASURY\b/i],
      ["CFIN", /\bCENTRAL\s+FINANCE\b|\bCFIN\b/i],
      ["GROUP_REPORTING", /\bGROUP\s+REPORTING\b/i],
    ];

    for (const [label, rule] of detailRules) {
      if (countRegex(text, rule, 3) >= 1 && !modules.includes(label)) {
        modules.push(label);
      }
    }
  }

  if (!hasExplicitIsuSignal(text)) {
    return modules.filter((m) => m !== "IS-U" && m !== "ISU" && m !== primary).slice(0, 8);
  }

  return modules.filter((m) => m !== primary).slice(0, 8);
}


function explicitPrimaryFromTitle(candidate: any): SapPrimaryModule | null {
  const title = titleText(candidate).toUpperCase();

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

function hasTitleSapOrModuleSignal(candidate: any) {
  const title = titleText(candidate).toUpperCase();
  return /\b(SAP|FICO|FI\/CO|FICO|ABAP|BASIS|BW|BI|BTP|SUCCESSFACTORS|SUCCESS\s+FACTORS|MM|SD|PM|PS|PP|EWM|TM|FIORI|UI5|SECURITY|GRC|PLANT\s+MAINTENANCE|PROJECT\s+SYSTEMS?|MATERIALS?\s+MANAGEMENT|ORDER\s+TO\s+CASH|SALES\s+AND\s+DISTRIBUTION)\b/i.test(title);
}


function isHardGenericTitle(candidate: any) {
  const title = titleText(candidate).trim();
  if (explicitPrimaryFromTitle(candidate)) return false;

  return /^(manager|senior\s+manager|assistant\s+manager|assitant\s+manager|consultant|senior\s+consultant|lead\s+consultant|business\s+consultant|functional\s+consultant|technical\s+consultant|project\s+manager|it\s+project\s+manager|program\s+manager|product\s+manager|territory\s+manager|sales\s+manager|operation[s]?\s+manager|service\s+delivery\s+manager|client\s+service\s+manager)$/i.test(title);
}

function isGenericNonSapTitle(candidate: any) {
  const title = titleText(candidate);
  if (!title) return true;
  if (hasTitleSapOrModuleSignal(candidate)) return false;
  return /\b(MIS\s+MANAGER|ASS?ISTANT\s+BRANCH\s+MANAGER|BRANCH\s+MANAGER|SALES\s+MANAGER|ACCOUNT\s+MANAGER|HR\s+MANAGER|ADMIN\s+MANAGER|FINANCE\s+MANAGER)\b/i.test(title);
}

function inferPrimary(scores: Record<string, number>, candidate: any): SapPrimaryModule {
  const title = titleText(candidate);
  const body = bodyText(candidate);

  const explicitTitleModule = explicitPrimaryFromTitle(candidate);
  if (explicitTitleModule) return explicitTitleModule;

  if (isGenericNonSapTitle(candidate) || isHardGenericTitle(candidate)) {
    const bodySapEvidence = /\b(SAP\s+FICO|SAP\s+FI\b|SAP\s+CO\b|SAP\s+MM|SAP\s+SD|SAP\s+ABAP|SAP\s+BASIS|SAP\s+BW|SAP\s+BI|SAP\s+BTP|SAP\s+PM|SAP\s+PS|SUCCESSFACTORS|S\/4HANA|SAP\s+HANA)\b/i.test(body);
    if (!bodySapEvidence) return "UNKNOWN";
  }

  const entries = MODULE_PRIORITY
    .map((module) => [module, scores[module]] as [SapPrimaryModule, number])
    .filter(([, score]) => score > 0)
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return MODULE_PRIORITY.indexOf(a[0] as any) - MODULE_PRIORITY.indexOf(b[0] as any);
    });

  if (!entries.length) return "UNKNOWN";

  let [winner, winningScore] = entries[0];

  // Strong explicit title wins, unless another module has much stronger project evidence.
  for (const module of MODULE_PRIORITY) {
    const explicitTitle = hasAny(title, moduleRules(module).title);
    if (!explicitTitle) continue;

    const titleModuleScore = scores[module] || 0;
    const titleProjectHits = projectMentions(body, module);
    const winnerProjectHits = projectMentions(body, winner as any);

    if (
      titleModuleScore >= winningScore - 22 ||
      titleProjectHits >= winnerProjectHits ||
      titleModuleScore >= 45
    ) {
      winner = module;
      winningScore = titleModuleScore;
      break;
    }
  }

  // FICO title/header must beat BW/BI/reporting noise.
  if (/\b(FICO|FI\/CO|FI CO|SAP\s+FI\b|SAP\s+CO\b|FI\s+CONSULTANT|FINANCE\s+CONSULTANT|FINANCIAL\s+ACCOUNTING|CONTROLLING)\b/i.test(title)) {
    if ((scores.FICO || 0) >= 42) return "FICO";
  }

  // ABAP/BASIS/BW title must not be converted to FICO only because finance words appear in body.
  for (const technical of ["ABAP", "BASIS", "BW", "BTP", "CPI", "PI/PO", "FIORI", "UI5", "MDG", "GRC", "SECURITY", "DATASPHERE", "SAC", "BW/4HANA"] as const) {
    if (hasAny(title, moduleRules(technical).title) && (scores[technical] || 0) >= 42) {
      return technical;
    }
  }

  // If winner is FICO but another module is explicitly in title with close score, respect the title.
  if (winner === "FICO") {
    for (const module of MODULE_PRIORITY.filter((m) => m !== "FICO")) {
      const explicitTitle = hasAny(title, moduleRules(module).title);
      if (explicitTitle && (scores[module] || 0) >= winningScore - 15) {
        return module;
      }
    }
  }

  if (winningScore < 35) return "UNKNOWN";
  return winner;
}


export function calculateDynamicDomainAuthority(candidate: any, primaryModule: SapPrimaryModule, scores: Record<string, number>) {
  if (primaryModule === "UNKNOWN") return 0;

  const title = titleText(candidate);
  const text = bodyText(candidate);
  const base = clamp(scores[primaryModule] || 0, 0, 100);
  const projectHits = projectMentions(text, primaryModule as any);
  const titleHit = hasAny(title, moduleRules(primaryModule as Exclude<SapPrimaryModule, "UNKNOWN">).title);
  const years = safeNumber(candidate?.years || candidate?.years_experience || candidate?.sap_years || candidate?.experience_years);
  const implementationAuthority = calculateImplementationAuthority(candidate);
  const financeDepth = primaryModule === "FICO" ? calculateFinanceDepth(candidate) : 0;

  let authority = Math.round(base * 0.44);
  if (titleHit) authority += 14;
  authority += Math.min(projectHits, 5) * 3.2;
  authority += Math.min(years, 15) * 0.75;
  authority += Math.round(implementationAuthority * 0.12);

  if (primaryModule === "FICO") {
    authority += Math.round(financeDepth * 0.16);
    const financeBuckets = countRegex(text, /\b(GL|AP|AR|AA|COPA|CO-PA|FSCM|TRM|CFIN|CENTRAL\s+FINANCE|GROUP\s+REPORTING|TREASURY|ASSET\s+ACCOUNTING|GENERAL\s+LEDGER)\b/i, 12);
    if (financeBuckets <= 1) authority = Math.min(authority, 76);
    if (financeBuckets >= 5) authority += 3;
  }

  if (projectHits === 0 && !titleHit) authority = Math.min(authority, 55);
  if (projectHits <= 1 && implementationAuthority < 60) authority = Math.min(authority, 72);
  if (implementationAuthority < 45) authority = Math.min(authority, 74);
  if (implementationAuthority >= 85 && years >= 8 && titleHit) authority += 3;

  // Elite only when there is title + project + depth evidence.
  const eliteEvidence = titleHit && implementationAuthority >= 82 && years >= 7 && (primaryModule !== "FICO" || financeDepth >= 76);
  const cap = eliteEvidence ? 94 : titleHit ? 88 : 78;
  return clamp(Math.round(authority), 25, cap);
}

export function calculateDynamicProfileQuality(candidate: any, weakName = false) {
  const email = textOf(candidate?.email);
  const phone = cleanPhoneProduction(candidate?.phone);
  const title = textOf(candidate?.title, candidate?.current_title, candidate?.headline);
  const primaryModule = textOf(candidate?.primary_module, candidate?.primaryModule);
  const years = safeNumber(candidate?.years || candidate?.years_experience || candidate?.sap_years || candidate?.experience_years);
  const text = bodyText(candidate);

  const impl =
    safeNumber(candidate?.implementation_projects) ||
    safeNumber(candidate?.implementationProjects) ||
    countRegex(text, /\b(IMPLEMENTATION|FULL\s+CYCLE|END[-\s]?TO[-\s]?END|E2E|GREENFIELD|BROWNFIELD)\b/i, 10);
  const ams =
    safeNumber(candidate?.ams_projects) ||
    safeNumber(candidate?.support_projects) ||
    countRegex(text, /\b(AMS|SUPPORT|TICKET|INCIDENT|ENHANCEMENT)\b/i, 10);

  let score = 42;
  if (!weakName) score += 14;
  if (email) score += 9;
  if (phone) score += 7;
  if (title && !isWeakCandidateNameProduction(title)) score += 7;
  if (primaryModule && primaryModule !== "UNKNOWN") score += 5;
  if (years >= 3) score += 4;
  if (years >= 7) score += 3;
  if (impl >= 1) score += 4;
  if (impl >= 4) score += 3;
  if (text.length > 2500) score += 2;

  // Completeness quality is not fit score. Avoid everyone being A+.
  if (impl === 0 && ams > 0) score = Math.min(score, 88);
  if (impl <= 1) score = Math.min(score, 90);
  if (!title || /^NO TITLE$/i.test(title)) score = Math.min(score, 82);
  if (weakName) score = Math.min(score, 60);
  if (!email && !phone) score = Math.min(score, 65);

  return clamp(Math.round(score), 40, 97);
}


function applyBusinessModuleDominance(scores: Record<string, number>, evidenceText: string) {
  const text = String(evidenceText || "").toUpperCase();
  const ficoSignalCount = [
    /\bFICO\b/g, /\bFI\s*\/\s*CO\b/g, /\bSAP\s+FI\b/g, /\bSAP\s+CO\b/g,
    /\bGENERAL\s+LEDGER\b/g, /\bGL\b/g, /\bACCOUNTS\s+PAYABLE\b/g, /\bAP\b/g,
    /\bACCOUNTS\s+RECEIVABLE\b/g, /\bAR\b/g, /\bASSET\s+ACCOUNTING\b/g, /\bAA\b/g,
    /\bCONTROLLING\b/g, /\bCO-?PA\b/g, /\bFSCM\b/g, /\bTRM\b/g, /\bCENTRAL\s+FINANCE\b/g, /\bCFIN\b/g,
  ].reduce((sum, rx) => sum + ((text.match(rx) || []).length), 0);
  const btpDirectTitle = /\b(SAP\s+BTP|BTP\s+(CONSULTANT|ARCHITECT|DEVELOPER|LEAD|SPECIALIST)|BUSINESS\s+TECHNOLOGY\s+PLATFORM|SAP\s+CPI|INTEGRATION\s+SUITE\s+(CONSULTANT|ARCHITECT|DEVELOPER)|CAP\s+(MODEL|DEVELOPER|ARCHITECT)|SAP\s+UI5|FIORI\s+(CONSULTANT|DEVELOPER))\b/i.test(text);
  const btpSignalCount = [/\bSAP\s+BTP\b/g, /\bBUSINESS\s+TECHNOLOGY\s+PLATFORM\b/g, /\bSAP\s+CPI\b/g, /\bCPI\b/g, /\bINTEGRATION\s+SUITE\b/g, /\bCAP\s+MODEL\b/g, /\bSAP\s+UI5\b/g, /\bFIORI\b/g].reduce((sum, rx) => sum + ((text.match(rx) || []).length), 0);
  if (ficoSignalCount >= 4 && (!btpDirectTitle || ficoSignalCount >= btpSignalCount + 2)) {
    scores.FICO = Math.max(scores.FICO || 0, 95);
    scores.BTP = Math.min(scores.BTP || 0, 62);
    scores.CPI = Math.min(scores.CPI || 0, 58);
    scores.FIORI = Math.min(scores.FIORI || 0, 55);
    scores.UI5 = Math.min(scores.UI5 || 0, 55);
  }
  return scores;
}

export function inferSapProfile(candidate: any): SapProfileInference {
  const scores: Record<string, number> = {};

  for (const module of MODULE_PRIORITY) {
    scores[module] = moduleScore(candidate, module);
  }

  const primaryModule = inferPrimary(scores, candidate);
  const secondary = primaryModule === "UNKNOWN" ? [] : secondaryModules(candidate, scores, primaryModule);
  const moduleConfidence = calculateDynamicDomainAuthority(candidate, primaryModule, scores);

  let roleType: SapRoleType = "Other";
  const text = bodyText(candidate);

  if (primaryModule === "FICO") roleType = "FICO Functional";
  else if (TECHNICAL_MODULES.has(primaryModule) || ANALYTICS_MODULES.has(primaryModule)) roleType = "Technical";
  else if (FUNCTIONAL_MODULES.has(primaryModule)) roleType = "SAP Functional";
  else if (/\b(PROJECT\s+MANAGER|PROGRAM\s+MANAGER|PMO|DELIVERY\s+MANAGER)\b/i.test(text)) roleType = "Manager/PM";

  const weakName = isWeakCandidateNameProduction(candidate?.name);
  const financeDepthScore = calculateFinanceDepth(candidate);
  const consultingDNAScore = calculateConsultingDNA(candidate);
  const implementationAuthorityScore = calculateImplementationAuthority(candidate);
  const profileQualityScore = calculateDynamicProfileQuality(candidate, weakName);
  const projectAuthority = projectAuthorityByType(text);

  const evidenceNotes: string[] = [];
  if (primaryModule !== "UNKNOWN") evidenceNotes.push(`Primary module ${primaryModule} confidence ${moduleConfidence}`);
  if (secondary.length) evidenceNotes.push(`Secondary modules: ${secondary.join(", ")}`);

  return {
    primaryModule,
    secondaryModules: secondary,
    roleType,
    moduleScores: scores,
    moduleConfidence,
    weakName,
    financeDepthScore,
    consultingDNAScore,
    implementationAuthorityScore,
    profileQualityScore,
    projectAuthority,
    evidenceNotes,
  };
}

export function isInvalidPhoneProduction(value: any) {
  const s = textOf(value).trim();
  const digits = s.replace(/\D/g, "");

  if (!s || !digits) return true;
  if (/^\d{1,2}[./-]\d{1,2}[./-](19|20)\d{2}$/.test(s)) return true;
  if (/^(19|20)\d{2}[./-]\d{1,2}[./-]\d{1,2}$/.test(s)) return true;
  if (/^\d{4}\.\d{1,2}\s*[-–—]\s*\d{4}\.\d{1,2}$/.test(s)) return true;
  if (/\b(19|20)\d{2}\b/.test(s) && !s.startsWith("+")) return true;
  if (/^\d{6}[-\s]?\d{2}[-\s]?\d{4}$/.test(s)) return true;
  if (/^\d{4}\s+\d{4}[-\s]\d{3}[-\s]\d{4}$/.test(s)) return true;
  if (/^0{2,}/.test(digits)) return true;
  if (digits.length < 8 || digits.length > 16) return true;

  return false;
}

export function cleanPhoneProduction(value: any) {
  return isInvalidPhoneProduction(value) ? null : textOf(value);
}

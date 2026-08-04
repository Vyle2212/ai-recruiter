export type SubmissionConfidenceLabel =
  | "Ready"
  | "Strong"
  | "Needs Light Validation"
  | "Needs Validation"
  | "Not Ready";

export type ConfidenceDimension = {
  score: number;
  max: number;
  label: string;
  reasons: string[];
};

export type SubmissionConfidenceResult = {
  score: number;
  label: SubmissionConfidenceLabel;
  completed: string[];
  pending: string[];
  blockers: string[];
  dimensions: {
    evidenceQuality: ConfidenceDimension;
    jdCoverage: ConfidenceDimension;
    implementationEvidence: ConfidenceDimension;
    architectureEvidence: ConfidenceDimension;
    validationCompletion: ConfidenceDimension;
    dataCompleteness: ConfidenceDimension;
  };
  primaryBlocker?: string;
  summary: string;
};

export type SubmissionConfidenceContext = {
  requiredModule?: string;
  jdCoverageScore?: number;
};

type AnyRecord = Record<string, any>;

const UNKNOWN_RE = /^(unknown|to confirm|to be confirmed|not confirmed|needs verification|needs review|n\/a|na|null|none|new|pending)$/i;
const GENERIC_ROLE_RE = /^(sap candidate|candidate|consultant|engineer|sap consultant|sap engineer|profile under review|role to verify)$/i;

const IMPLEMENTATION_TERMS = [
  "implementation",
  "full cycle",
  "full-cycle",
  "greenfield",
  "brownfield",
  "rollout",
  "cutover",
  "hypercare",
  "go-live",
  "go live",
  "configuration",
  "design",
  "blueprint",
  "uat",
  "sit",
];

const ARCHITECTURE_TERMS = [
  "solution architect",
  "enterprise architect",
  "lead consultant",
  "module lead",
  "project lead",
  "stream lead",
  "workstream lead",
  "design authority",
  "workshop lead",
  "pre-sales",
  "presales",
  "solution design",
];

function textOf(value: any): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map(textOf).join(" ");
  if (typeof value === "object") return Object.values(value).map(textOf).join(" ");
  return String(value);
}

function clean(value: any) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function firstValue(candidate: AnyRecord, keys: string[]) {
  for (const key of keys) {
    const value = candidate[key];
    if (value !== null && value !== undefined && clean(value) !== "") return value;
  }
  return "";
}

function hasMeaningfulValue(value: any) {
  const text = clean(value);
  return Boolean(text && !UNKNOWN_RE.test(text));
}

function numberValue(candidate: AnyRecord, keys: string[]) {
  for (const key of keys) {
    const n = Number(candidate[key]);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

function hasSalaryValue(value: any) {
  if (typeof value === "number") return Number.isFinite(value) && value > 0;
  const text = clean(value);
  if (!text || UNKNOWN_RE.test(text)) return false;
  const amount = Number(text.replace(/[^0-9.]/g, ""));
  return Number.isFinite(amount) && amount > 0;
}

function normalizedModule(candidate: AnyRecord) {
  const value = clean(firstValue(candidate, ["primary_module", "primaryModule", "module", "sap_module", "primarySapModule", "sapModule"]));
  return value.replace(/^SAP\s+/i, "").toUpperCase();
}

function isUnknownModule(module: string) {
  return !module || ["UNKNOWN", "SAP UNKNOWN", "SAP", "N/A", "NA", "NONE"].includes(module);
}

function currentRole(candidate: AnyRecord) {
  return clean(firstValue(candidate, ["current_title", "currentTitle", "current_position", "currentPosition", "current_job_title", "title", "position", "role", "headline"]));
}

function currentEmployer(candidate: AnyRecord) {
  return clean(firstValue(candidate, ["current_company", "currentCompany", "company", "employer", "current_employer", "currentEmployer"]));
}

function candidateName(candidate: AnyRecord) {
  return clean(firstValue(candidate, ["full_name", "preferred_name", "name", "candidate_name", "display_name", "parsed_name", "resume_header_name"]));
}

function textIncludes(blob: string, terms: string[]) {
  return terms.some((term) => blob.includes(term));
}

function countMatches(blob: string, terms: string[]) {
  return terms.reduce((count, term) => count + (blob.includes(term) ? 1 : 0), 0);
}

function dimension(score: number, max: number, label: string, reasons: string[]): ConfidenceDimension {
  return { score: Math.max(0, Math.min(max, Math.round(score))), max, label, reasons };
}

function confidenceLabel(score: number): SubmissionConfidenceLabel {
  if (score >= 95) return "Ready";
  if (score >= 85) return "Strong";
  if (score >= 70) return "Needs Light Validation";
  if (score >= 50) return "Needs Validation";
  return "Not Ready";
}

function addUnique(items: string[], value: string) {
  if (value && !items.includes(value)) items.push(value);
}

export function calculateSubmissionConfidence(candidate: AnyRecord, context: SubmissionConfidenceContext = {}): SubmissionConfidenceResult {
  const blob = textOf(candidate).toLowerCase();
  const module = normalizedModule(candidate);
  const years = numberValue(candidate, ["sap_years", "years", "experience_years", "total_years", "years_experience"]);
  const implementations = numberValue(candidate, ["implementation_project_count", "implementationProjects", "implementation_projects", "implementation_count", "implementations"]);
  const s4hana = numberValue(candidate, ["s4hana_project_count", "s4_implementation_count", "s4hanaProjects", "s4hana_projects", "s4_count", "s4hana_count"]);
  const salary = firstValue(candidate, ["expected_salary", "expectedSalary", "salary_expectation", "expectedPackage", "current_salary", "currentSalary", "salary", "monthly_salary"]);
  const availability = firstValue(candidate, ["availability", "available_from", "openStatus", "open_status", "availability_status"]);
  const notice = firstValue(candidate, ["notice_period", "noticePeriod", "notice", "available_notice"]);
  const email = firstValue(candidate, ["email", "contact_email"]);
  const phone = firstValue(candidate, ["phone", "mobile", "contact_phone"]);
  const role = currentRole(candidate);
  const employer = currentEmployer(candidate);
  const name = candidateName(candidate);

  const hasModule = !isUnknownModule(module);
  const roleGeneric = !hasMeaningfulValue(role) || GENERIC_ROLE_RE.test(role);
  const hasContact = hasMeaningfulValue(email) || hasMeaningfulValue(phone);
  const salaryComplete = hasSalaryValue(salary);
  const availabilityComplete = hasMeaningfulValue(availability);
  const noticeComplete = hasMeaningfulValue(notice);
  const hasImplementationText = textIncludes(blob, IMPLEMENTATION_TERMS);
  const hasImplementation = implementations > 0 || hasImplementationText;
  const hasArchitecture = textIncludes(blob, ARCHITECTURE_TERMS) || /architect|lead consultant|module lead|project lead/i.test(role);
  const hasS4 = s4hana > 0 || textIncludes(blob, ["s/4", "s4hana", "s4 hana", "s/4hana"]);
  const hasEmployerHistory = hasMeaningfulValue(employer) || hasMeaningfulValue(firstValue(candidate, ["previous_company", "previousEmployer", "employer_history", "companies"]));
  const moduleEvidence = hasModule || textIncludes(blob, ["fico", " fi ", " co ", " sd ", " mm ", "abap", "basis", "ewm", "tm", "btp", "cpi", "successfactors"]);

  let evidenceScore = 0;
  const evidenceReasons: string[] = [];
  if (implementations > 0) {
    evidenceScore += 5;
    evidenceReasons.push(`${implementations} implementation${implementations === 1 ? "" : "s"} recorded.`);
  } else if (hasImplementationText) {
    evidenceScore += 3;
    evidenceReasons.push("Implementation delivery terms are available.");
  }
  if (hasS4) {
    evidenceScore += 4;
    evidenceReasons.push("S/4HANA evidence is available.");
  }
  if (!roleGeneric) {
    evidenceScore += 4;
    evidenceReasons.push("Current role is specific.");
  }
  if (hasEmployerHistory) {
    evidenceScore += 4;
    evidenceReasons.push("Employer history is available.");
  }
  if (moduleEvidence) {
    evidenceScore += 3;
    evidenceReasons.push("Module evidence is explicit.");
  }

  let jdScore = typeof context.jdCoverageScore === "number" ? Math.round(context.jdCoverageScore / 5) : 0;
  const jdReasons: string[] = [];
  const requiredModule = clean(context.requiredModule).replace(/^SAP\s+/i, "").toUpperCase();
  if (!jdScore) {
    if (hasModule && (!requiredModule || requiredModule === module || module.includes(requiredModule) || requiredModule.includes(module))) {
      jdScore += 6;
      jdReasons.push("Module match found.");
    }
    if (years >= 8) {
      jdScore += 4;
      jdReasons.push("Seniority and years are aligned.");
    }
    if (hasS4) {
      jdScore += 4;
      jdReasons.push("S/4HANA evidence found.");
    }
    if (hasImplementation) {
      jdScore += 4;
      jdReasons.push("Implementation evidence found.");
    }
    if (hasArchitecture) {
      jdScore += 2;
      jdReasons.push("Architecture or lead evidence found.");
    }
  } else {
    jdReasons.push("Existing JD coverage score used.");
  }

  let implementationScore = 0;
  const implementationReasons: string[] = [];
  if (implementations > 0) {
    implementationScore = Math.min(15, 11 + Math.min(4, implementations));
    implementationReasons.push(`${implementations} implementation${implementations === 1 ? "" : "s"} and delivery ownership support readiness.`);
  } else if (hasImplementationText && textIncludes(blob, ["lead", "owner", "owned", "responsible", "design", "configuration", "go-live", "hypercare"])) {
    implementationScore = 10;
    implementationReasons.push("Implementation is mentioned, with partial ownership indicators.");
  } else if (textIncludes(blob, ["ams", "support", "application management"])) {
    implementationScore = 5;
    implementationReasons.push("AMS or support evidence exists, but implementation ownership is unclear.");
  } else {
    implementationScore = 1;
    implementationReasons.push("No clear implementation delivery evidence is available.");
  }

  let architectureScore = 0;
  const architectureReasons: string[] = [];
  if (textIncludes(blob, ["solution architect", "enterprise architect", "design authority"])) {
    architectureScore = 9;
    architectureReasons.push("Solution or enterprise architecture evidence found.");
  } else if (hasArchitecture) {
    architectureScore = 7;
    architectureReasons.push("Lead or solution design evidence found.");
  } else if (hasImplementation) {
    architectureScore = 3;
    architectureReasons.push("Delivery evidence exists, but architecture ownership is not clear.");
  } else {
    architectureScore = 1;
    architectureReasons.push("No architecture or lead evidence is available.");
  }

  const completed: string[] = [];
  const pending: string[] = [];
  if (hasImplementation) addUnique(completed, "Implementation Ownership"); else addUnique(pending, "Implementation Ownership");
  if (hasArchitecture) addUnique(completed, "Architecture Ownership"); else addUnique(pending, "Architecture Ownership");
  if (jdScore >= 12) addUnique(completed, "JD Match"); else addUnique(pending, "JD Match");
  if (salaryComplete) addUnique(completed, "Salary Confirmation"); else addUnique(pending, "Salary Confirmation");
  if (availabilityComplete) addUnique(completed, "Availability Confirmation"); else addUnique(pending, "Availability Confirmation");
  if (noticeComplete) addUnique(completed, "Notice Period Confirmation"); else addUnique(pending, "Notice Period Confirmation");
  if (hasContact) addUnique(completed, "Contact Verified"); else addUnique(pending, "Contact Verified");
  if (hasEmployerHistory) addUnique(completed, "Current Employer Verified"); else addUnique(pending, "Current Employer Verified");

  const validationScore =
    (salaryComplete ? 4 : 0) +
    (availabilityComplete ? 4 : 0) +
    (noticeComplete ? 3 : 0) +
    (hasContact ? 3 : 0) +
    (hasImplementation ? 3 : 0) +
    (hasArchitecture ? 1 : 0) +
    (hasEmployerHistory ? 2 : 0);

  const validationReasons = [
    completed.length ? `${completed.slice(0, 3).join(", ")} completed.` : "No submission validations are complete.",
    pending.length ? `${pending.slice(0, 3).join(", ")} pending.` : "No core submission validations are pending.",
  ];

  const completenessChecks = [
    hasMeaningfulValue(name),
    !roleGeneric,
    hasEmployerHistory,
    hasMeaningfulValue(firstValue(candidate, ["display_location", "location", "country", "current_location"])),
    hasMeaningfulValue(email),
    hasMeaningfulValue(phone),
    hasModule,
    years > 0,
    implementations > 0,
    salaryComplete,
    availabilityComplete,
    noticeComplete,
  ];
  const completenessScore = Math.round((completenessChecks.filter(Boolean).length / completenessChecks.length) * 15);
  const completenessReasons = [
    completenessScore >= 12
      ? "Profile is mostly complete."
      : completenessScore >= 8
        ? "Profile is usable, but commercial data may be incomplete."
        : completenessScore >= 4
          ? "Profile has limited recruiter-ready data."
          : "Profile is incomplete.",
  ];

  const dimensions = {
    evidenceQuality: dimension(evidenceScore, 20, "Evidence Quality", evidenceReasons.length ? evidenceReasons : ["Evidence is limited."]),
    jdCoverage: dimension(jdScore, 20, "JD Coverage", jdReasons.length ? jdReasons : ["JD coverage requires validation."]),
    implementationEvidence: dimension(implementationScore, 15, "Implementation Evidence", implementationReasons),
    architectureEvidence: dimension(architectureScore, 10, "Architecture Evidence", architectureReasons),
    validationCompletion: dimension(validationScore, 20, "Validation Completion", validationReasons),
    dataCompleteness: dimension(completenessScore, 15, "Data Completeness", completenessReasons),
  };

  let score = Object.values(dimensions).reduce((sum, item) => sum + item.score, 0);
  const blockers: string[] = [];
  const capReasons: Array<{ cap: number; label: string }> = [];

  if (!salaryComplete) {
    score -= 10;
    blockers.push("Salary Confirmation");
  }
  if (!availabilityComplete) {
    score -= 10;
    blockers.push("Availability Confirmation");
  }
  if (!noticeComplete) {
    score -= 5;
    blockers.push("Notice Period Confirmation");
  }
  if (!hasEmployerHistory) {
    score -= 3;
    blockers.push("Current Employer Verification");
  }
  if (!hasImplementation) {
    score -= 15;
    blockers.push("Implementation Ownership");
    capReasons.push({ cap: 75, label: "Implementation Ownership" });
  }
  if (!hasModule) {
    score -= 20;
    blockers.push("Module Confirmation");
    capReasons.push({ cap: 60, label: "Module Confirmation" });
  }
  if (!hasContact) {
    score -= 10;
    blockers.push("Contact Verification");
    capReasons.push({ cap: 80, label: "Contact Verification" });
  }
  if (roleGeneric) {
    score -= 5;
    blockers.push("Current Role Confirmation");
    capReasons.push({ cap: 75, label: "Current Role Confirmation" });
  }
  if (!hasMeaningfulValue(name)) {
    blockers.push("Candidate Name Confirmation");
    capReasons.push({ cap: 50, label: "Candidate Name Confirmation" });
  }
  if (!salaryComplete && !availabilityComplete && !noticeComplete) {
    capReasons.push({ cap: 85, label: "Salary Confirmation" });
  }

  const cap = capReasons.reduce((min, item) => Math.min(min, item.cap), 100);
  score = Math.max(0, Math.min(cap, Math.round(score)));
  const uniqueBlockers = Array.from(new Set(blockers));
  const primaryBlocker = capReasons.sort((a, b) => a.cap - b.cap)[0]?.label || uniqueBlockers[0];
  const label = confidenceLabel(score);

  return {
    score,
    label,
    completed,
    pending,
    blockers: uniqueBlockers,
    dimensions,
    primaryBlocker,
    summary: primaryBlocker
      ? `Submission Confidence is ${score}% (${label}). Primary Blocker: ${primaryBlocker}.`
      : `Submission Confidence is ${score}% (${label}). Ready for Client Submission.`,
  };
}

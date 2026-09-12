import {
  canonicalSearchConcept,
  conceptsInText,
  searchConceptRelation,
  searchConceptSemanticEvidence,
} from "./candidateSearchConcepts";
import type {
  CandidateSearchV2Document,
  CandidateTargetEvidence,
  TrustedCandidateEvidenceValue,
} from "./candidateSearchV2Types";

export const CENTRAL_NICHE_TARGETS = new Set([
  "OTC",
  "CPI",
  "MBC",
  "DATASPHERE",
  "PPDS",
  "EWM",
  "P2P",
  "RTR",
]);
export type QualifiedNicheTargetLevel = CandidateTargetEvidence["tier"];
export type QualifiedNicheTargetEvidence = CandidateTargetEvidence & {
  level: QualifiedNicheTargetLevel;
  professionalContext: boolean;
  matchedEvidence: string[];
  source:
    | "professional_title"
    | "professional_source"
    | "target_cluster"
    | "related_context"
    | "none";
};
type QualificationInput = Pick<
  CandidateSearchV2Document,
  | "candidateId"
  | "currentTitle"
  | "historicalTitles"
  | "skills"
  | "sapModules"
  | "trustedCandidateEvidence"
>;
const professionalAction =
  /\b(?:implemented|implementing|implementation|configured|configuring|delivered|delivering|developed|developing|designed|designing|built|building|led|leading|owned|ownership|responsible\s+for|worked\s+on|supported|supporting|deployed|deploying|integrated|integrating|experience\s+(?:in|with)|project\s+(?:work|delivery|experience))\b/i;
const normalize = (value: unknown) =>
  String(value || "")
    .normalize("NFKC")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
const escaped = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const bounded = (source: string, phrase: string) =>
  new RegExp(
    `(?:^|[^a-z0-9])${escaped(normalize(phrase))}(?:$|[^a-z0-9])`,
    "i",
  ).test(source);
const unique = (values: string[]) => [...new Set(values.filter(Boolean))];
const tierStrength = (tier: QualifiedNicheTargetLevel) =>
  tier === "exact_verified"
    ? 1
    : tier === "exact_supported"
      ? 0.84
      : tier === "related"
        ? 0.4
        : 0;

const titleTerms: Record<string, string[]> = {
  OTC: ["order to cash", "order-to-cash", "order2cash"],
  CPI: [
    "sap cpi",
    "cpi",
    "sap cloud platform integration",
    "cloud platform integration",
  ],
  MBC: [
    "sap mbc",
    "mbc",
    "sap multi-bank connectivity",
    "multi-bank connectivity",
    "multi bank connectivity",
  ],
  DATASPHERE: ["sap datasphere", "datasphere"],
  PPDS: ["sap pp/ds", "pp/ds", "ppds"],
  EWM: ["sap ewm", "ewm", "extended warehouse management"],
  P2P: ["sap p2p", "p2p", "procure to pay", "procure-to-pay"],
  RTR: ["sap rtr", "rtr", "r2r", "record to report"],
};
const explicitTerms: Record<string, string[]> = {
  OTC: [
    "order to cash",
    "order-to-cash",
    "order2cash",
    "end-to-end otc",
    "end to end otc",
  ],
  CPI: [
    "sap cpi",
    "sap cloud platform integration",
    "cloud platform integration",
  ],
  MBC: [
    "sap mbc",
    "multi-bank connectivity",
    "multi bank connectivity",
    "sap multi-bank connectivity",
  ],
  DATASPHERE: ["sap datasphere", "datasphere"],
  PPDS: [
    "sap pp/ds",
    "sap ppds",
    "pp/ds",
    "ppds",
    "production planning and detailed scheduling",
  ],
  EWM: [
    "sap ewm",
    "extended warehouse management",
    "embedded ewm",
    "decentralized ewm",
  ],
  P2P: [
    "sap p2p",
    "procure to pay",
    "procure-to-pay",
    "source to pay",
    "source-to-pay",
  ],
  RTR: ["sap rtr", "sap r2r", "record to report", "record-to-report"],
};

function strongestProfessionalWindow(
  source: string,
  terms: string[],
  radius = 260,
) {
  let best = { terms: [] as string[], professional: false, text: "" };
  for (const term of terms) {
    const normalizedTerm = normalize(term);
    let index = source.indexOf(normalizedTerm);
    while (index >= 0) {
      const text = source.slice(
        Math.max(0, index - radius),
        index + normalizedTerm.length + radius,
      );
      const matches = unique(
        terms.filter((candidate) => bounded(text, candidate)),
      );
      const professional = professionalAction.test(text);
      if (
        Number(professional) * 100 + matches.length >
        Number(best.professional) * 100 + best.terms.length
      )
        best = { terms: matches, professional, text };
      index = source.indexOf(normalizedTerm, index + normalizedTerm.length);
    }
  }
  return best;
}

function result(
  target: string,
  tier: QualifiedNicheTargetLevel,
  options: {
    sourceType?: CandidateTargetEvidence["evidenceSourceType"];
    sourceField?: string | null;
    literal?: string | null;
    indicators?: string[];
    relatedConcepts?: string[];
    professional?: boolean;
    professionalContextType?: CandidateTargetEvidence["professionalContextType"];
  } = {},
): QualifiedNicheTargetEvidence {
  const indicators = unique(options.indicators || []);
  const relatedConcepts = unique(options.relatedConcepts || []);
  const source =
    tier === "exact_verified"
      ? options.sourceType === "raw_title"
        ? "professional_title"
        : "professional_source"
      : tier === "exact_supported"
        ? "target_cluster"
        : tier === "related"
          ? "related_context"
          : "none";
  return {
    target,
    tier,
    level: tier,
    strength: tierStrength(tier),
    professionalContext: Boolean(options.professional),
    evidenceSourceType:
      options.sourceType || (tier === "related" ? "related_concept" : "none"),
    matchedLiteral: options.literal || null,
    matchedIndicators: indicators,
    sourceField: options.sourceField || null,
    trusted: tier === "exact_verified" || tier === "exact_supported",
    reasonCode:
      tier === "exact_verified"
        ? "trusted_literal"
        : tier === "exact_supported"
          ? "trusted_professional_cluster"
          : tier === "related"
            ? "candidate_related_concept"
            : "no_candidate_target_evidence",
    relatedConcepts,
    sourceRecordId: null,
    sourceValueProvenance: null,
    professionalContextType:
      options.professionalContextType ||
      (tier === "related" ? "related" : "none"),
    matchedEvidence: options.literal ? [options.literal] : indicators,
    source,
  };
}

function relatedConcepts(
  target: string,
  candidate: QualificationInput,
  trustedText: string,
) {
  const mappings: Record<string, Array<[string, RegExp]>> = {
    OTC: [
      [
        "SD",
        /\b(?:sap\s+sd|sales and distribution|sales order processing|sales order management)\b/i,
      ],
    ],
    CPI: [
      ["PIPO", /\b(?:sap\s+pi\/?po|pi\/?po)\b/i],
      [
        "BTP",
        /\b(?:sap\s+btp|business technology platform)\b[^.\n]{0,100}\bintegration\b|\bintegration\b[^.\n]{0,100}\b(?:sap\s+btp|business technology platform)\b/i,
      ],
      ["INTEGRATION_SUITE", /\bsap integration suite\b/i],
      [
        "INTEGRATION",
        /\b(?:integration middleware|enterprise integration|integration architecture|integration lead)\b/i,
      ],
    ],
    MBC: [
      ["TRM", /\b(?:sap\s+trm|treasury|treasury and risk management)\b/i],
      ["FICO", /\b(?:sap\s+fico|sap\s+fi\/?co)\b/i],
      ["BCM", /\b(?:bank communication management|bcm)\b/i],
      [
        "CASH_MANAGEMENT",
        /\b(?:cash management|bank integration|bank connectivity|payments?|swift|host-to-host)\b/i,
      ],
    ],
    DATASPHERE: [
      [
        "BW",
        /\b(?:sap\s+bw|bw\/?4hana|business warehouse|business intelligence|data warehouse|data warehousing)\b/i,
      ],
      [
        "SAC",
        /\b(?:sap\s+sac|sap analytics cloud|analytics cloud|sac planning)\b/i,
      ],
      ["DWC", /\b(?:sap\s+data warehouse cloud|dwc)\b/i],
    ],
  };
  if (mappings[target])
    return unique(
      mappings[target]
        .filter(([, pattern]) => pattern.test(trustedText))
        .map(([concept]) => concept),
    );
  return unique(
    [
      ...conceptsInText(trustedText),
      ...(candidate.skills || []).flatMap((value) => [
        canonicalSearchConcept(value),
        ...conceptsInText(value),
      ]),
      ...(candidate.sapModules || []).flatMap((value) => [
        canonicalSearchConcept(value),
        ...conceptsInText(value),
      ]),
    ]
      .filter((concept): concept is string => Boolean(concept))
      .filter((concept) =>
        ["PARENT", "CHILD", "RELATED", "ADJACENT"].includes(
          searchConceptRelation(target, concept),
        ),
      ),
  );
}

function literalIn(source: string, terms: string[]) {
  return terms.find((term) => bounded(source, term)) || null;
}

export function isCentralNicheTarget(target: string | null | undefined) {
  return CENTRAL_NICHE_TARGETS.has(String(target || "").toUpperCase());
}

const allowedTrustedField =
  /^(?:candidates\.(?:title|current_title|raw_text|resume_text|summary|professional_summary|experience|projects|certifications|skills)|candidate_profile\.language_section|request_candidate\.(?:title|currentTitle|summary|professionalSummary|experience|work_experience|projects|project_experience|responsibilities|raw_text|resume_text|raw_cv|certifications|certificates|skills|technicalSkills|technical_skills|languages))$/;

export function identityBoundTrustedCandidateValues(
  candidate: QualificationInput,
) {
  const envelope = candidate.trustedCandidateEvidence;
  if (!envelope || envelope.candidateId !== candidate.candidateId)
    return [] as TrustedCandidateEvidenceValue[];
  return envelope.values.filter(
    (entry) =>
      entry.trusted &&
      entry.provenance === "candidate_record_raw" &&
      entry.sourceRecordId === candidate.candidateId &&
      Boolean(entry.sourceField) &&
      allowedTrustedField.test(entry.sourceField) &&
      Boolean(normalize(entry.value)),
  );
}

function withProvenance(
  evidence: QualifiedNicheTargetEvidence,
  entry: TrustedCandidateEvidenceValue | null,
) {
  if (!entry) return evidence;
  return {
    ...evidence,
    sourceField: entry.sourceField,
    sourceRecordId: entry.sourceRecordId,
    evidenceSourceType: (evidence.tier === "exact_supported"
      ? "professional_cluster"
      : entry.sourceType) as CandidateTargetEvidence["evidenceSourceType"],
    sourceValueProvenance: entry.provenance,
    trusted: true,
  };
}

export function buildTrustedProfessionalSegments(
  valueInput: unknown,
  sourceType: TrustedCandidateEvidenceValue["sourceType"],
) {
  const value = String(valueInput || "").normalize("NFKC");
  if (["raw_title", "raw_certification", "direct_skill"].includes(sourceType))
    return [normalize(value)].filter(Boolean);
  const structural = value
    .split(/(?:\r?\n|\s+-\s+)/)
    .flatMap((part) => part.split(/(?<=[.!?;])\s+/));
  return structural
    .map(normalize)
    .filter((part) => part.length >= 3)
    .flatMap((part) => {
      if (part.length <= 600) return [part];
      const segments: string[] = [];
      for (let offset = 0; offset < part.length; offset += 500)
        segments.push(part.slice(offset, offset + 600));
      return segments;
    });
}

function professionalSegments(entry: TrustedCandidateEvidenceValue) {
  return entry.normalizedSegments?.length
    ? [...entry.normalizedSegments]
    : buildTrustedProfessionalSegments(entry.value, entry.sourceType);
}
function contextType(
  entry: TrustedCandidateEvidenceValue,
): CandidateTargetEvidence["professionalContextType"] {
  if (entry.sourceType === "raw_title") return "title";
  if (entry.sourceType === "raw_certification") return "certification";
  if (entry.sourceType === "direct_skill") return "direct_skill";
  if (entry.sourceType === "raw_project") return "project";
  if (entry.sourceType === "raw_experience") return "experience";
  return "sentence";
}

function exactContext(
  target: string,
  entry: TrustedCandidateEvidenceValue,
  segment: string,
) {
  const literalWindow = (literal: string) => {
    const index = segment.indexOf(normalize(literal));
    return segment.slice(
      Math.max(0, index - 140),
      Math.max(0, index) + normalize(literal).length + 140,
    );
  };
  const professionalNear = (literal: string) => {
    const context = literalWindow(literal);
    return (
      professionalAction.test(context) ||
      /\b(?:consultant|developer|lead|specialist|owner|responsib(?:le|ility))\b/i.test(
        context,
      )
    );
  };
  if (target === "OTC") {
    const long = ["order to cash", "order-to-cash", "order2cash"].find((term) =>
      bounded(segment, term),
    );
    const acronym = segment.match(/\b(?:otc|o2c)\b/i)?.[0] || null;
    if (entry.sourceType === "raw_title" && (long || acronym))
      return { literal: long || acronym!, verified: true };
    if (entry.sourceType === "raw_certification" && (long || acronym))
      return { literal: long || acronym!, verified: true };
    if (entry.sourceType === "direct_skill" && (long || acronym))
      return { literal: long || acronym!, verified: false };
    if (long && professionalNear(long))
      return { literal: long, verified: true };
    const processIndicators = acronym
      ? [
          "sales order management",
          "pricing",
          "delivery",
          "billing",
          "credit management",
          "returns",
          "atp",
          "aatp",
        ].filter((term) => bounded(literalWindow(acronym), term))
      : [];
    if (acronym && (professionalNear(acronym) || processIndicators.length >= 2))
      return { literal: acronym, verified: true };
    return null;
  }
  if (target === "CPI") {
    const literal =
      [
        "sap cloud platform integration",
        "sap cloud integration",
        "sap cpi",
      ].find((term) => bounded(segment, term)) ||
      (bounded(segment, "cpi") ? "cpi" : null) ||
      (bounded(segment, "cloud integration") ? "cloud integration" : null);
    const sapBound = /\b(?:sap|btp|integration suite|cpi)\b/i.test(
      (literal ? literalWindow(literal) : "").replace(/\bnon[- ]sap\b/gi, ""),
    );
    if (
      literal &&
      ["raw_title", "raw_certification", "direct_skill"].includes(
        entry.sourceType,
      ) &&
      (literal !== "cloud integration" || sapBound)
    )
      return { literal, verified: true };
    if (literal && professionalNear(literal) && sapBound)
      return { literal, verified: true };
    const iflow =
      segment.match(
        /\b(?:developed|implemented|configured|built|deployed|supported)\s+(?:(?:sap\s+)?cpi\s+)?iflows?\b/i,
      )?.[0] || null;
    if (iflow && /\b(?:sap|cpi)\b/i.test(segment))
      return { literal: iflow, verified: true };
    return null;
  }
  if (target === "MBC") {
    const literal =
      [
        "sap multi-bank connectivity",
        "sap mbc",
        "multi-bank connectivity",
        "multi bank connectivity",
      ].find((term) => bounded(segment, term)) || null;
    if (
      literal &&
      ["raw_title", "raw_certification", "direct_skill"].includes(
        entry.sourceType,
      )
    )
      return { literal, verified: true };
    return literal && professionalNear(literal)
      ? { literal, verified: true }
      : null;
  }
  if (target === "DATASPHERE") {
    const literal =
      ["sap datasphere", "datasphere"].find((term) => bounded(segment, term)) ||
      null;
    if (
      literal &&
      ["raw_title", "raw_certification", "direct_skill"].includes(
        entry.sourceType,
      )
    )
      return { literal, verified: true };
    return literal && professionalNear(literal)
      ? { literal, verified: true }
      : null;
  }
  const literal = literalIn(segment, explicitTerms[target] || []);
  return literal &&
    (entry.sourceType === "raw_title" ||
      entry.sourceType === "raw_certification" ||
      professionalNear(literal))
    ? { literal, verified: true }
    : null;
}

function supportedCluster(
  target: string,
  segment: string,
  parentProfessionalTitle: boolean,
) {
  if (target === "CPI") {
    const terms = [
      "cloud integration",
      "integration flow",
      "integration flows",
      "message mapping",
      "integration package",
      "integration packages",
      "integration adapter",
      "integration adapters",
    ];
    const evidenceWindow = strongestProfessionalWindow(segment, terms);
    return (evidenceWindow.professional || parentProfessionalTitle) &&
      bounded(evidenceWindow.text, "cloud integration") &&
      evidenceWindow.terms.filter((term) => term !== "cloud integration")
        .length >= 2
      ? evidenceWindow.terms
      : [];
  }
  if (target === "OTC") {
    const evidenceWindow = strongestProfessionalWindow(segment, [
      "sales order management",
      "pricing",
      "delivery",
      "billing",
      "credit management",
      "returns",
      "atp",
      "aatp",
    ]);
    return (evidenceWindow.professional || parentProfessionalTitle) &&
      evidenceWindow.terms.length >= 4
      ? evidenceWindow.terms
      : [];
  }
  if (target === "MBC") {
    const terms = [
      "bank connectivity",
      "bank communication management",
      "bcm",
      "swift connectivity",
      "host-to-host connectivity",
      "host to host connectivity",
      "payment factory",
      "payment integration",
    ];
    const evidenceWindow = strongestProfessionalWindow(segment, terms);
    return (evidenceWindow.professional || parentProfessionalTitle) &&
      bounded(evidenceWindow.text, "bank connectivity") &&
      evidenceWindow.terms.filter((term) => term !== "bank connectivity")
        .length >= 2
      ? evidenceWindow.terms
      : [];
  }
  if (target === "DATASPHERE") {
    const terms = [
      "data warehouse cloud",
      "dwc",
      "space",
      "spaces",
      "data builder",
      "business builder",
      "replication flow",
      "replication flows",
      "analytic model",
      "analytic models",
    ];
    const evidenceWindow = strongestProfessionalWindow(segment, terms);
    return evidenceWindow.professional &&
      ["data warehouse cloud", "dwc"].some((term) =>
        bounded(evidenceWindow.text, term),
      ) &&
      evidenceWindow.terms.filter(
        (term) => !["data warehouse cloud", "dwc"].includes(term),
      ).length >= 2
      ? evidenceWindow.terms
      : [];
  }
  const semantic = searchConceptSemanticEvidence(target, segment);
  const matched = unique([
    ...semantic.strongMatches,
    ...semantic.clusteredPartialMatches,
    ...semantic.exactMatches,
  ]);
  const evidenceWindow = strongestProfessionalWindow(segment, matched);
  return semantic.supported &&
    (evidenceWindow.professional || parentProfessionalTitle)
    ? matched
    : [];
}

function qualifiedFromValues(target: string, candidate: QualificationInput) {
  const values = identityBoundTrustedCandidateValues(candidate);
  let directSkillSupport: {
    entry: TrustedCandidateEvidenceValue;
    literal: string;
  } | null = null;
  for (const entry of values) {
    for (const segment of professionalSegments(entry)) {
      const exact = exactContext(target, entry, segment);
      if (!exact) continue;
      if (!exact.verified) {
        directSkillSupport ||= { entry, literal: exact.literal };
        continue;
      }
      return withProvenance(
        result(target, "exact_verified", {
          sourceType: entry.sourceType,
          literal: normalize(exact.literal),
          professional: true,
          professionalContextType: contextType(entry),
        }),
        entry,
      );
    }
  }
  const titleText = values
    .filter((entry) => entry.sourceType === "raw_title")
    .map((entry) => normalize(entry.value));
  const parentProfessionalTitle = titleText.some((title) =>
    conceptsInText(title).some(
      (concept) => searchConceptRelation(target, concept) === "PARENT",
    ),
  );
  for (const entry of values.filter((value) =>
    ["raw_professional_text", "raw_experience", "raw_project"].includes(
      value.sourceType,
    ),
  )) {
    for (const segment of professionalSegments(entry)) {
      const indicators = supportedCluster(
        target,
        segment,
        parentProfessionalTitle,
      );
      if (indicators.length)
        return withProvenance(
          result(target, "exact_supported", {
            sourceType: "professional_cluster",
            indicators,
            professional: true,
            professionalContextType: "professional_cluster",
          }),
          entry,
        );
    }
  }
  if (directSkillSupport)
    return withProvenance(
      result(target, "exact_supported", {
        sourceType: "professional_cluster",
        indicators: [directSkillSupport.literal],
        professional: false,
        professionalContextType: "direct_skill",
      }),
      directSkillSupport.entry,
    );
  const trustedText = values.map((entry) => normalize(entry.value)).join(" ");
  const related = relatedConcepts(target, candidate, trustedText);
  return result(target, related.length ? "related" : "none", {
    relatedConcepts: related,
    professionalContextType: related.length ? "related" : "none",
  });
}

export function hasStableNicheEligibility(
  targetValue: string,
  candidate: QualificationInput,
) {
  const target = String(targetValue || "").toUpperCase();
  if (!isCentralNicheTarget(target)) return true;
  const values = identityBoundTrustedCandidateValues(candidate);
  if (!values.length) return false;
  const trustedText = values.map((entry) => normalize(entry.value)).join(" ");
  if (literalIn(trustedText, explicitTerms[target] || [])) return true;
  if (relatedConcepts(target, candidate, trustedText).length) return true;
  if (
    values
      .filter((entry) => entry.sourceType === "raw_title")
      .flatMap((entry) => conceptsInText(entry.value))
      .some((concept) =>
        ["EXACT", "PARENT", "CHILD", "RELATED", "ADJACENT"].includes(
          searchConceptRelation(target, concept),
        ),
      )
  )
    return true;
  return values
    .filter((entry) =>
      ["raw_professional_text", "raw_experience", "raw_project"].includes(
        entry.sourceType,
      ),
    )
    .some((entry) =>
      professionalSegments(entry).some(
        (segment) =>
          searchConceptSemanticEvidence(target, segment).supported ||
          supportedCluster(target, segment, false).length > 0,
      ),
    );
}

export function qualifyNicheTargetEvidence(
  targetValue: string,
  candidate: QualificationInput,
): QualifiedNicheTargetEvidence {
  const target = String(targetValue || "").toUpperCase();
  if (!isCentralNicheTarget(target)) return result(target, "none");
  const evidence = qualifiedFromValues(target, candidate);
  const identityBound =
    evidence.sourceRecordId === candidate.candidateId &&
    evidence.sourceValueProvenance === "candidate_record_raw" &&
    Boolean(
      evidence.sourceField && allowedTrustedField.test(evidence.sourceField),
    );
  if (
    evidence.tier === "exact_verified" &&
    (!identityBound ||
      !evidence.trusted ||
      !evidence.matchedLiteral ||
      ["professional_cluster", "related_concept", "none"].includes(
        evidence.evidenceSourceType,
      ))
  ) {
    const values = identityBoundTrustedCandidateValues(candidate);
    const related = relatedConcepts(
      target,
      candidate,
      values.map((entry) => normalize(entry.value)).join(" "),
    );
    return result(target, related.length ? "related" : "none", {
      relatedConcepts: related,
      professionalContextType: related.length ? "related" : "none",
    });
  }
  if (
    evidence.tier === "exact_supported" &&
    (!identityBound ||
      !evidence.trusted ||
      evidence.evidenceSourceType !== "professional_cluster" ||
      !evidence.matchedIndicators.length ||
      evidence.matchedLiteral)
  ) {
    const values = identityBoundTrustedCandidateValues(candidate);
    const related = relatedConcepts(
      target,
      candidate,
      values.map((entry) => normalize(entry.value)).join(" "),
    );
    return result(target, related.length ? "related" : "none", {
      relatedConcepts: related,
      professionalContextType: related.length ? "related" : "none",
    });
  }
  return evidence;
}

export function safeTargetEvidenceAudit(evidence: CandidateTargetEvidence) {
  return {
    tier: evidence.tier,
    sourceType: evidence.evidenceSourceType,
    sourceField: evidence.sourceField,
    sourceRecordId: evidence.sourceRecordId,
    matchedLiteral: evidence.matchedLiteral,
    matchedIndicators: evidence.matchedIndicators,
    reasonCode: evidence.reasonCode,
    trusted: evidence.trusted,
    provenance: evidence.sourceValueProvenance,
    professionalContextType: evidence.professionalContextType,
  };
}

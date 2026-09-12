import type {
  CandidateSearchV2Document,
} from "./candidateSearchV2Types";

import type {
  NormalizedCandidateSearchV2Request,
} from "./candidateSearchV2Request";
import { canonicalSearchConcept, conceptsInText, mostSpecificSearchConcepts, searchConceptRelation, searchConceptRelationStrength, searchConceptSemanticEvidence } from "./candidateSearchConcepts";
import { SAP_SEARCH_CONCEPT_IDS } from "./sapSearchTaxonomy";

function normalize(
  value:
    | string
    | null
    | undefined,
) {
  return String(
    value ||
    "",
  )
    .normalize("NFKC")
    .toUpperCase()
    .replace(
      /^SAP\s+/,
      "",
    )
    .replace(
      /[\s_-]+/g,
      "",
    )
    .replace(
      /\//g,
      "",
    )
    .trim();
}

const SAP_MODULE_ALIASES:
  Record<
    string,
    string[]
  > = {
    FICO: [
      "FICO",
      "FICO",
      "FI",
      "CO",
      "FINANCECONTROLLING",
    ],

    SD: [
      "SD",
      "SALESDISTRIBUTION",
    ],

    MM: [
      "MM",
      "MATERIALSMANAGEMENT",
    ],

    PP: [
      "PP",
      "PRODUCTIONPLANNING",
    ],

    PS: [
      "PS",
      "PROJECTSYSTEM",
    ],

    PM: [
      "PM",
      "PLANTMAINTENANCE",
      "EAM",
    ],

    EWM: [
      "EWM",
      "WM",
      "WAREHOUSEMANAGEMENT",
    ],

    ABAP: [
      "ABAP",
      "RAP",
      "CDS",
      "WRICEF",
    ],

    BASIS: [
      "BASIS",
    ],

    BTP: [
      "BTP",
      "BUSINESSTECHNOLOGYPLATFORM",
      "CPI",
      "CAP",
      "UI5",
      "FIORI",
    ],

    BW: [
      "BW",
      "BI",
      "BW4HANA",
      "ANALYTICS",
    ],

    SUCCESSFACTORS: [
      "SUCCESSFACTORS",
      "SF",
      "HCM",
      "HXM",
    ],
  };

function canonicalModule(
  value:
    | string
    | null
    | undefined,
) {
  const semanticConcept = canonicalSearchConcept(value);
  if (semanticConcept && SAP_SEARCH_CONCEPT_IDS.has(semanticConcept)) return semanticConcept;

  const normalized =
    normalize(
      value,
    );

  if (!normalized) {
    return "";
  }

  for (const [
    canonical,
    aliases,
  ] of Object.entries(
    SAP_MODULE_ALIASES,
  )) {
    if (
      aliases.some(
        (alias) =>
          normalize(
            alias,
          ) ===
          normalized,
      )
    ) {
      return canonical;
    }
  }

  return normalized;
}

function moduleFromFreeText(
  value: string,
) {
  const text =
    String(
      value ||
      "",
    )
      .normalize("NFKC")
      .toUpperCase();

  const detected: string[] = conceptsInText(value).filter((concept) => SAP_SEARCH_CONCEPT_IDS.has(concept));
  if (detected.length) return Array.from(new Set(detected));

  if (
    /\b(?:SAP\s*)?(?:FI\s*[\/-]\s*CO|FICO|FINANCE\s*(?:AND|&)\s*CONTROLLING)\b/i.test(
      text,
    )
  ) {
    detected.push(
      "FICO",
    );
  }

  const patterns:
    Array<
      [
        string,
        RegExp,
      ]
    > = [
      [
        "SD",
        /\bSAP\s+SD\b|\bSALES\s+(?:AND|&)\s+DISTRIBUTION\b/i,
      ],

      [
        "MM",
        /\bSAP\s+MM\b|\bMATERIALS?\s+MANAGEMENT\b/i,
      ],

      [
        "PP",
        /\bSAP\s+PP\b|\bPRODUCTION\s+PLANNING\b/i,
      ],

      [
        "PS",
        /\bSAP\s+PS\b|\bPROJECT\s+SYSTEM\b/i,
      ],

      [
        "PM",
        /\bSAP\s+PM\b|\bPLANT\s+MAINTENANCE\b|\bSAP\s+EAM\b/i,
      ],

      [
        "EWM",
        /\bSAP\s+EWM\b|\bSAP\s+WM\b|\bWAREHOUSE\s+MANAGEMENT\b/i,
      ],

      [
        "ABAP",
        /\bSAP\s+ABAP\b|\bABAP\b/i,
      ],

      [
        "BASIS",
        /\bSAP\s+BASIS\b|\bBASIS\s+CONSULTANT\b/i,
      ],

      [
        "BTP",
        /\bSAP\s+BTP\b|\bBUSINESS\s+TECHNOLOGY\s+PLATFORM\b/i,
      ],

      [
        "BW",
        /\bSAP\s+BW\b|\bBW\/4HANA\b|\bSAP\s+BI\b/i,
      ],

      [
        "SUCCESSFACTORS",
        /\bSAP\s+SUCCESSFACTORS\b|\bSUCCESSFACTORS\b/i,
      ],
    ];

  for (const [
    moduleName,
    pattern,
  ] of patterns) {
    if (
      pattern.test(
        text,
      )
    ) {
      detected.push(
        moduleName,
      );
    }
  }

  return Array.from(
    new Set(
      detected,
    ),
  );
}

function hasRetrievalConceptSupport(requestedConcept: string, evidenceConcept: string) {
  if (requestedConcept === evidenceConcept) return true;
  const relation = searchConceptRelation(requestedConcept, evidenceConcept);
  return relation === "PARENT" || relation === "CHILD";
}

export function requestedCandidateSearchV2SapModules(
  request:
    NormalizedCandidateSearchV2Request,
) {
  const structured =
    [
      ...(
        request.filters
          .sapModules ||
        []
      ),

      ...(
        request.filters
          .skills ||
        []
      ),
    ]
      .flatMap(
        (value) =>
          moduleFromFreeText(
            value,
          ),
      );

  const queryModules =
    moduleFromFreeText(
      request.query,
    );

  return mostSpecificSearchConcepts(Array.from(
    new Set(
      [
        ...structured,
        ...queryModules,
      ],
    ),
  ));
}

export function candidateSearchV2PrimaryModule(
  candidate:
    CandidateSearchV2Document,
) {
  const modules =
    candidate.sapModules ||
    [];

  return canonicalModule(
    modules[0],
  );
}

function titleHasModuleEvidence(
  candidate:
    CandidateSearchV2Document,
  requestedModule:
    string,
) {
  const title =
    String(
      candidate.currentTitle ||
      "",
    );

  return moduleFromFreeText(
    title,
  ).includes(
    requestedModule,
  );
}

function candidateRetrievalConcepts(candidate: CandidateSearchV2Document) {
  const strong = new Set([
    candidateSearchV2PrimaryModule(candidate),
    ...conceptsInText(candidate.currentTitle),
  ].filter((value): value is string => typeof value === "string" && Boolean(value) && SAP_SEARCH_CONCEPT_IDS.has(value)));
  const all = new Set([
    ...strong,
    ...(candidate.sapModules || []).flatMap((value) => [canonicalModule(value), ...conceptsInText(value)]),
    ...(candidate.skills || []).flatMap((value) => [canonicalSearchConcept(value), ...conceptsInText(value)]),
    ...conceptsInText(candidate.searchableText),
  ].filter((value): value is string => typeof value === "string" && Boolean(value) && SAP_SEARCH_CONCEPT_IDS.has(value)));
  return { strong, all };
}

export type CandidateSearchV2ModuleRelevanceContext = {
  requested: readonly string[];
};

const candidateRetrievalConceptCache = new WeakMap<CandidateSearchV2Document, ReturnType<typeof candidateRetrievalConcepts>>();

function cachedCandidateRetrievalConcepts(candidate: CandidateSearchV2Document) {
  const cached = candidateRetrievalConceptCache.get(candidate);
  if (cached) return cached;
  const concepts = candidateRetrievalConcepts(candidate);
  candidateRetrievalConceptCache.set(candidate, concepts);
  return concepts;
}

export function prepareCandidateSearchV2ModuleRelevance(
  request: NormalizedCandidateSearchV2Request,
): CandidateSearchV2ModuleRelevanceContext {
  return { requested: requestedCandidateSearchV2SapModules(request) };
}
export function candidateHasSearchV2PrimaryModuleRelevance(
  candidate:
    CandidateSearchV2Document,
  request:
    NormalizedCandidateSearchV2Request,
  prepared?: CandidateSearchV2ModuleRelevanceContext,
) {
  const requested =
    prepared?.requested || requestedCandidateSearchV2SapModules(request);

  if (
    requested.length ===
    0
  ) {
    return true;
  }

  const evidenceConcepts = cachedCandidateRetrievalConcepts(candidate);

  return requested.every(
    (requestedModule) => {
      if (evidenceConcepts.all.has(requestedModule) || titleHasModuleEvidence(candidate, requestedModule)) return true;
      if (searchConceptSemanticEvidence(requestedModule, candidate.searchableText).supported) return true;
      const hasOtherExactRequest = requested.some((other) => other !== requestedModule && evidenceConcepts.all.has(other));
      return [...evidenceConcepts.all].some((evidence) => {
        const relation = searchConceptRelation(requestedModule, evidence);
        const isStrongEvidence = evidenceConcepts.strong.has(evidence);
        return (isStrongEvidence && hasRetrievalConceptSupport(requestedModule, evidence))
          || (relation === "RELATED" && (requested.length === 1 || hasOtherExactRequest) && (isStrongEvidence || searchConceptRelationStrength(relation) > 0));
      });
    },
  );
}

export function candidateSearchV2PrimaryModuleScore(
  candidate:
    CandidateSearchV2Document,
  request:
    NormalizedCandidateSearchV2Request,
) {
  const requested =
    requestedCandidateSearchV2SapModules(
      request,
    );

  if (
    requested.length ===
    0
  ) {
    return 0;
  }

  const primary =
    candidateSearchV2PrimaryModule(
      candidate,
    );

  let score =
    0;

  for (const requestedModule of requested) {
    if (
      primary ===
      requestedModule
    ) {
      score =
        Math.max(
          score,
          100,
        );

      continue;
    }

    if (hasRetrievalConceptSupport(requestedModule, primary)) {
      score = Math.max(score, searchConceptRelationStrength(searchConceptRelation(requestedModule, primary)) * 100);
    }

    if (
      titleHasModuleEvidence(
        candidate,
        requestedModule,
      )
    ) {
      score =
        Math.max(
          score,
          88,
        );
    }
  }

  return score;
}

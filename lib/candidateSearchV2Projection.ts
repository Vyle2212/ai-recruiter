import { canonicalTalentSearchIdentity } from "./talentSearchDisplay";
import type {
  CandidateEvidenceLevel,
  CandidateSearchV2Document,
} from "./candidateSearchV2Types";

export const SEARCH_V2_PROJECTION_FIELDS = [
  "candidate_id",
  "display_name",
  "display_title",
  "display_company",
  "display_location",
  "country",
  "city",
  "years",
  "primary_module",
  "all_modules",
  "all_submodules",
  "project_types",
  "greenfield_count",
  "brownfield_count",
  "rollout_count",
  "ams_count",
  "quality_score",
  "search_text",
  "source_updated_at",
  "email_masked",
  "phone_masked",
].join(",");

function evidenceLevel(value: boolean): CandidateEvidenceLevel {
  return value ? "verified_structured_evidence" : "unverified";
}
export function normalizedDisplayCompany(value: unknown) {
  const raw = String(value || "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
  if (
    !raw ||
    /^(?:not disclosed|company not provided|unknown|null|undefined)$/i.test(raw)
  )
    return null;
  const repaired = raw
    .replace(
      /([a-z])(?=(?:Malaysia|Singapore|Indonesia|Vietnam|Thailand)(?:sdn|bhd|pte|ltd))/gi,
      "$1 ",
    )
    .replace(
      /\b(Malaysia|Singapore|Indonesia|Vietnam|Thailand)(?=sdn|bhd|pte|ltd)/gi,
      "$1 ",
    )
    .replace(/\b(sdn|pte)(?=bhd|ltd\b)/gi, "$1 ")
    .replace(/\bsdn\s*bhd\b/gi, "Sdn Bhd")
    .replace(/\bpte\s*ltd\b/gi, "Pte Ltd")
    .replace(/\s+form\b.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  return repaired && !/@|(?:\+?\d[\s().-]*){7,}/.test(repaired)
    ? repaired
    : null;
}

export function normalizedDisplayTitle(value: unknown, employerValue: unknown) {
  const title = String(value || "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
  const employer = String(employerValue || "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
  if (!title) return null;
  const marker = title.toLowerCase().lastIndexOf(" in ");
  if (marker > 0 && employer) {
    const suffixKey = title
      .slice(marker + 4)
      .replace(/[^a-z0-9]/gi, "")
      .toLowerCase();
    const employerKey = employer.replace(/[^a-z0-9]/gi, "").toLowerCase();
    if (suffixKey === employerKey) return title.slice(0, marker).trim() || null;
  }
  if (employer) {
    for (const separator of [" - ", " – ", " — "]) {
      const suffix = `${separator}${employer}`;
      if (title.toLocaleLowerCase().endsWith(suffix.toLocaleLowerCase()))
        return title.slice(0, title.length - suffix.length).trim() || null;
    }
  }
  return title;
}

export function candidateSearchV2ProjectionDocument(
  row: Record<string, unknown>,
): CandidateSearchV2Document {
  const invalidModules = new Set(
    Array.isArray(row._invalid_ambiguous_modules)
      ? row._invalid_ambiguous_modules.map((value) =>
          String(value).toUpperCase(),
        )
      : [],
  );
  const modules = Array.isArray(row.all_modules)
    ? row.all_modules
        .map(String)
        .filter(
          (value) =>
            Boolean(value) && !invalidModules.has(String(value).toUpperCase()),
        )
    : [];
  const projectTypes = Array.isArray(row.project_types)
    ? row.project_types.map(String).filter(Boolean)
    : [];
  const ficoRelevance = projectTypes
    .find((value) => /^FICO_CLASS_/i.test(value))
    ?.replace(
      /^FICO_CLASS_/i,
      "",
    ) as CandidateSearchV2Document["ficoRelevance"];
  const domainEvidence = Object.fromEntries(
    projectTypes.flatMap((value) => {
      const match = value.match(
        /^DOMAIN_CLASS_([A-Z0-9_]+)_(PRIMARY|STRONG|SUPPORTED|EXPOSURE|UNVERIFIED)$/i,
      );
      return match ? [[match[1].toUpperCase(), match[2].toUpperCase()]] : [];
    }),
  ) as NonNullable<CandidateSearchV2Document["domainEvidence"]>;
  const domainImplementationEvidence = Object.fromEntries(
    projectTypes.flatMap((value) => {
      const match = value.match(
        /^DOMAIN_IMPLEMENTATION_([A-Z0-9_]+)_(VERIFIED|SUPPORTED)$/i,
      );
      return match ? [[match[1].toUpperCase(), match[2].toUpperCase()]] : [];
    }),
  ) as NonNullable<CandidateSearchV2Document["domainImplementationEvidence"]>;
  for (const module of invalidModules) domainEvidence[module] = "UNVERIFIED";
  const domainSkillLabels: Record<string, string> = {
    FICO: "FICO",
    MM: "MM",
    SD: "SD",
    OTC: "OTC",
    ABAP: "ABAP",
    BW: "BW",
    BASIS: "BASIS",
    HCM: "HCM",
    JAVA: "Java",
    MICROSERVICES: "Microservices",
    DATA_ENGINEERING: "Data Engineer",
    AZURE_DATABRICKS: "Azure Databricks",
    FINANCE: "Finance",
    IFRS: "IFRS",
  };
  const supportedDomains = Object.entries(domainEvidence || {})
    .filter(([, classification]) => classification !== "UNVERIFIED")
    .map(([domain]) => domainSkillLabels[domain] || domain);
  const seniorityClass = projectTypes
    .find((value) => /^SENIORITY_CLASS_/i.test(value))
    ?.replace(/^SENIORITY_CLASS_/i, "");
  const locationEvidenceState = projectTypes
    .find((value) => /^LOCATION_STATE_/i.test(value))
    ?.replace(
      /^LOCATION_STATE_/i,
      "",
    ) as CandidateSearchV2Document["locationEvidenceState"];
  const directImplementation = projectTypes.some((value) =>
    /^(?:IMPLEMENTATION|GREENFIELD|BROWNFIELD)_(?:DIRECT_STRUCTURED|PROJECT_CONTEXT|EXPLICIT_SOURCE_TEXT)_VERIFIED$/i.test(
      value,
    ),
  );
  const supportedImplementation = projectTypes.some((value) =>
    /^(?:IMPLEMENTATION|GREENFIELD|BROWNFIELD)_(?:DIRECT_STRUCTURED|PROJECT_CONTEXT|EXPLICIT_SOURCE_TEXT)_SUPPORTED$/i.test(
      value,
    ),
  );
  const validSupportedImplementation =
    supportedImplementation && row._invalid_ambiguous_implementation !== true;
  const sourceImplementation = projectTypes.some((value) =>
    /^(?:IMPLEMENTATION|GREENFIELD|BROWNFIELD)_EXPLICIT_SOURCE_TEXT_MENTION_ONLY$/i.test(
      value,
    ),
  );
  const years =
    typeof row.years === "number" && Number.isFinite(row.years) && row.years > 0
      ? row.years
      : null;
  const title = normalizedDisplayTitle(row.display_title, row.display_company);
  const explicitSeniority =
    /\b(?:senior|sr\.?|lead|principal|manager|architect|director|head)\b/i.test(
      title || "",
    );
  const seniority =
    seniorityClass === "VERIFIED_SENIOR" ||
    seniorityClass === "SUPPORTED_SENIOR" ||
    explicitSeniority ||
    (years || 0) >= 8;
  const rawName = String(row.display_name || "").trim();
  const canonicalIdentity = canonicalTalentSearchIdentity(
    row.candidate_id,
    rawName,
  );
  const name = canonicalIdentity.nameAvailable
    ? canonicalIdentity.displayName
    : null;
  const company = normalizedDisplayCompany(row.display_company);
  const location =
    String(row.display_location || row.city || row.country || "").trim() ||
    null;
  const resolvedCanonicalId =
    String(row._resolved_canonical_candidate_id || "").trim() || null;
  const persistedCanonicalId =
    String(row.search_text || "").match(
      /\bcanonical_candidate_id:(canonical-[a-f0-9]{32})\b/i,
    )?.[1] || null;
  return {
    candidateId: String(row.candidate_id),
    canonicalCandidateId:
      resolvedCanonicalId || persistedCanonicalId || undefined,
    sourceCandidateIds: Array.isArray(row._resolved_source_candidate_ids)
      ? row._resolved_source_candidate_ids.map(String)
      : undefined,
    candidateName: name,
    currentTitle: title,
    currentEmployer: company,
    country: String(row.country || "").trim() || null,
    location,
    totalYearsExperience: years,
    relevantYearsExperience: null,
    implementationEvidenceCount:
      directImplementation || sourceImplementation ? 1 : 0,
    implementationEvidenceLevel: directImplementation
      ? evidenceLevel(true)
      : validSupportedImplementation
        ? "source_text_evidence"
        : sourceImplementation
          ? "inferred_evidence"
          : "unverified",
    seniorityEvidenceLevel: seniority
      ? explicitSeniority
        ? "verified_structured_evidence"
        : "inferred_evidence"
      : "unverified",
    ficoRelevance: ficoRelevance || "NO_FICO",
    domainEvidence,
    domainImplementationEvidence,
    locationEvidenceState: locationEvidenceState || "UNKNOWN",
    skills: [
      ...modules,
      ...supportedDomains,
      ...(directImplementation || validSupportedImplementation
        ? ["Implementation"]
        : []),
      ...(projectTypes.some((value) =>
        /ROLLOUT_(?:DIRECT_STRUCTURED|PROJECT_CONTEXT).*_(?:VERIFIED|SUPPORTED)$/i.test(
          value,
        ),
      )
        ? ["Rollout"]
        : []),
      ...(projectTypes.some((value) =>
        /AMS_(?:DIRECT_STRUCTURED|PROJECT_CONTEXT).*_(?:VERIFIED|SUPPORTED)$/i.test(
          value,
        ),
      )
        ? ["AMS"]
        : []),
    ],
    sapModules: modules,
    industries: [],
    languages: [],
    identitySignals: {
      email: String(row.email_masked || "") || null,
      phone: String(row.phone_masked || "") || null,
      normalizedName: name?.normalize("NFKC").toLowerCase() || null,
      employer: company?.normalize("NFKC").toLowerCase() || null,
      location: location?.normalize("NFKC").toLowerCase() || null,
      title: title?.normalize("NFKC").toLowerCase() || null,
    },
    profileQualityScore:
      typeof row.quality_score === "number" ? row.quality_score : null,
    updatedAt: String(row.source_updated_at || "") || null,
    searchableText: String(row.search_text || ""),
    trustedCandidateEvidence: {
      candidateId: String(row.candidate_id),
      values: Array.isArray(row._trusted_candidate_evidence_values)
        ? row._trusted_candidate_evidence_values.filter(
            (
              entry,
            ): entry is NonNullable<
              CandidateSearchV2Document["trustedCandidateEvidence"]
            >["values"][number] => Boolean(entry && typeof entry === "object"),
          )
        : [],
    },
    evidence: [
      {
        label: "Canonical search projection",
        value: "candidate_search_index",
        source: "candidate_search_index",
      },
    ],
    profileEvidence: {
      name: Boolean(name),
      title: Boolean(title),
      employer: Boolean(company),
      location: Boolean(location),
      experienceDuration: years !== null,
      employmentHistory: years !== null,
      projectHistory: projectTypes.length > 0,
      education: false,
      certifications: false,
      skills: modules.length > 0 || projectTypes.length > 0,
    },
  };
}

export const CANDIDATE_PERSON_IDENTITY_VERSION =
  "candidate-person-v11-project-identity-separation";

const normalizedPersonName = (document: CandidateSearchV2Document) =>
  String(document.candidateName || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\b(?:mr|mrs|ms|dr)\.?\b/g, " ")
    .replace(
      /\b(?:malaysian|indonesian|filipino|singaporean|indian|vietnamese|thai|australian|british|american)\b/g,
      " ",
    )
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const normalizedIdentityTitle = (document: CandidateSearchV2Document) =>
  String(document.identitySignals?.title || document.currentTitle || "")
    .toLowerCase()
    .replace(/\b(?:contract|contractor|permanent|freelance)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const normalizedIdentityLocation = (document: CandidateSearchV2Document) =>
  String(
    document.identitySignals?.location ||
      document.location ||
      document.country ||
      "",
  )
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const intersects = (
  left: readonly string[] = [],
  right: readonly string[] = [],
) => {
  const rightSet = new Set(right);
  return left.some((value) => rightSet.has(value));
};
const overlap = (
  left: readonly string[] = [],
  right: readonly string[] = [],
) => {
  if (!left.length || !right.length) return 0;
  const rightSet = new Set(right);
  return (
    left.filter((value) => rightSet.has(value)).length /
    Math.min(new Set(left).size, rightSet.size)
  );
};
function sameCanonicalPerson(
  left: CandidateSearchV2Document,
  right: CandidateSearchV2Document,
) {
  const a = left.identitySignals || {},
    b = right.identitySignals || {};
  const hasExplicitIdentitySignals = Boolean(
    left.identitySignals || right.identitySignals,
  );
  if (a.sourceProfileId && a.sourceProfileId === b.sourceProfileId) return true;
  if (
    left.canonicalCandidateId &&
    left.canonicalCandidateId === right.canonicalCandidateId
  )
    return true;
  if (a.verifiedEmailHash && a.verifiedEmailHash === b.verifiedEmailHash)
    return true;
  if (a.verifiedPhoneHash && a.verifiedPhoneHash === b.verifiedPhoneHash)
    return true;
  if (a.sourceDocumentHash && a.sourceDocumentHash === b.sourceDocumentHash)
    return true;
  const name = normalizedPersonName(left);
  if (
    !name ||
    name !== normalizedPersonName(right) ||
    name.split(" ").length < 2
  )
    return false;
  const sameLocation = Boolean(
    normalizedIdentityLocation(left) &&
    normalizedIdentityLocation(left) === normalizedIdentityLocation(right),
  );
  const sameTitle = Boolean(
    normalizedIdentityTitle(left) &&
    normalizedIdentityTitle(left) === normalizedIdentityTitle(right),
  );
  const employmentOverlap = intersects(a.employmentKeys, b.employmentKeys);
  const projectOverlap = intersects(a.projectKeys, b.projectKeys);
  const documentOverlap = overlap(
    a.documentEvidenceKeys,
    b.documentEvidenceKeys,
  );
  // Request-supplied legacy documents have no source provenance object. Keep
  // their established name + title + location collapse, while projected
  // source records must satisfy one of the provenance-backed rules below.
  if (!hasExplicitIdentitySignals && sameLocation && sameTitle) return true;
  return (
    (sameLocation &&
      (employmentOverlap || projectOverlap || documentOverlap >= 0.2)) ||
    (sameLocation && sameTitle && documentOverlap >= 0.1) ||
    (sameTitle && (employmentOverlap || projectOverlap))
  );
}
function stableCanonicalPersonId(sourceIds: readonly string[]) {
  const value = [...new Set(sourceIds)].sort().join("|");
  const hash = (seed: number) => {
    let result = seed;
    for (const character of value)
      result = Math.imul(result ^ character.charCodeAt(0), 16777619);
    return (result >>> 0).toString(16).padStart(8, "0");
  };
  return `canonical-${[2166136261, 2246822507, 3266489909, 668265263].map(hash).join("")}`;
}

function documentStrength(document: CandidateSearchV2Document) {
  return (
    [
      document.candidateName,
      document.currentTitle,
      document.currentEmployer,
      document.location,
      document.totalYearsExperience,
    ].filter((value) => value !== null && value !== undefined && value !== "")
      .length *
      100 +
    (document.implementationEvidenceLevel === "verified_structured_evidence"
      ? 40
      : document.implementationEvidenceLevel === "source_text_evidence"
        ? 20
        : 0) +
    Number(document.profileQualityScore || 0)
  );
}

export function dedupeCandidateSearchV2Documents(
  documents: CandidateSearchV2Document[],
) {
  const parent = documents.map((_, index) => index);
  const find = (index: number): number =>
    parent[index] === index ? index : (parent[index] = find(parent[index]));
  const union = (left: number, right: number) => {
    const a = find(left),
      b = find(right);
    if (a !== b) parent[Math.max(a, b)] = Math.min(a, b);
  };
  for (let left = 0; left < documents.length; left += 1)
    for (let right = left + 1; right < documents.length; right += 1)
      if (sameCanonicalPerson(documents[left], documents[right]))
        union(left, right);
  const groups = new Map<string, CandidateSearchV2Document[]>();
  documents.forEach((document, index) => {
    const key = String(find(index));
    groups.set(key, [...(groups.get(key) || []), document]);
  });
  const duplicateGroups = [...groups.entries()].filter(
    ([, rows]) => rows.length > 1,
  );
  const deduped = [...groups.entries()].map(([, rows]) => {
    const ordered = [...rows].sort(
      (a, b) =>
        documentStrength(b) - documentStrength(a) ||
        a.candidateId.localeCompare(b.candidateId),
    );
    const sourceCandidateIds = [
      ...new Set(
        rows.flatMap((row) =>
          row.sourceCandidateIds?.length
            ? row.sourceCandidateIds
            : [row.candidateId],
        ),
      ),
    ].sort();
    const mergedProfileEvidence = Object.fromEntries(
      Object.keys(ordered[0].profileEvidence || {}).map((field) => [
        field,
        rows.some((row) =>
          Boolean(
            row.profileEvidence?.[
              field as keyof NonNullable<
                CandidateSearchV2Document["profileEvidence"]
              >
            ],
          ),
        ),
      ]),
    ) as CandidateSearchV2Document["profileEvidence"];
    return {
      ...ordered[0],
      canonicalCandidateId:
        rows.length > 1
          ? stableCanonicalPersonId(sourceCandidateIds)
          : ordered[0].canonicalCandidateId || ordered[0].candidateId,
      sourceCandidateIds,
      alternateNames: [
        ...new Set(
          rows
            .flatMap((row) => [
              row.candidateName || "",
              ...(row.alternateNames || []),
            ])
            .filter(Boolean),
        ),
      ],
      historicalEmployers: [
        ...new Set(
          rows.flatMap((row) => row.historicalEmployers || []).filter(Boolean),
        ),
      ],
      skills: [...new Set(rows.flatMap((row) => row.skills || []))],
      sapModules: [...new Set(rows.flatMap((row) => row.sapModules || []))],
      languages: [...new Set(rows.flatMap((row) => row.languages || []))],
      industries: [...new Set(rows.flatMap((row) => row.industries || []))],
      lifecycleEvidence: [
        ...new Map(
          rows
            .flatMap((row) => row.lifecycleEvidence || [])
            .map((item) => [`${item.projectId}:${item.lifecycleType}`, item]),
        ).values(),
      ],
      historicalTitles: [
        ...new Set(rows.flatMap((row) => row.historicalTitles || [])),
      ],
      canonicalRoleEvidence: [
        ...new Map(
          rows
            .flatMap((row) => row.canonicalRoleEvidence || [])
            .map((item) => [
              `${item.sourceType}|${item.sourceRecordId}|${item.title.toLocaleLowerCase()}`,
              item,
            ]),
        ).values(),
      ],
      // Candidate Details loads the canonical representative, so its profile
      // confidence is the canonical cross-surface value as well.
      dataConfidenceScore: ordered[0].dataConfidenceScore ?? null,
      trustedCandidateEvidence: {
        candidateId: ordered[0].candidateId,
        values: [
          ...new Map(
            rows
              .flatMap((row) => row.trustedCandidateEvidence?.values || [])
              .map((item) => [
                `${item.sourceRecordId}|${item.sourceField}|${item.normalizedValue || item.value}`,
                item,
              ]),
          ).values(),
        ],
      },
      implementationEvidenceCount: Math.max(
        ...rows.map((row) => Number(row.implementationEvidenceCount || 0)),
      ),
      profileEvidence: mergedProfileEvidence,
      evidence: rows
        .flatMap((row) => row.evidence || [])
        .map((entry) => ({ ...entry })),
    };
  });
  return {
    documents: deduped,
    rawRows: documents.length,
    uniqueCanonicalCandidates: deduped.length,
    duplicateGroups: duplicateGroups.length,
    duplicateRowsCollapsed: documents.length - deduped.length,
    duplicateGroupDetails: duplicateGroups.map(([, rows]) => ({
      key: stableCanonicalPersonId(
        rows.flatMap((row) =>
          row.sourceCandidateIds?.length
            ? row.sourceCandidateIds
            : [row.candidateId],
        ),
      ),
      candidateIds: rows.map((row) => row.candidateId).sort(),
      displayName: rows[0].candidateName || null,
    })),
  };
}

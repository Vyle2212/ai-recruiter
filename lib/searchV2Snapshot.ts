export type SearchV2SnapshotPayload<Document extends { candidateId: string }> = {
  schemaVersion: string;
  createdAt: number;
  sourceCreatedAt?: number;
  revision: string;
  sourceRows: number;
  documents: Document[];
  snapshotBacked?: boolean;
};

export function searchV2SnapshotSchemaVersion(cacheVersion: string) {
  return [
    cacheVersion,
    CANDIDATE_CANONICAL_VERSION,
    CANDIDATE_EXPERIENCE_EXTRACTOR_VERSION,
    CANDIDATE_PROJECT_EXTRACTOR_VERSION,
    CANDIDATE_PERSON_IDENTITY_VERSION,
    SEARCH_V2_PUBLIC_IDENTITY_VERSION,
    SEARCH_V2_REQUIREMENT_ONTOLOGY_VERSION,
    SEARCH_V2_VERSION,
    SEARCH_V2_LIFECYCLE_INDEX_VERSION,
    SEARCH_V2_CRITERIA_SCORING_VERSION,
    COMMITTED_SEARCH_REQUIREMENTS_VERSION,
    SEARCH_V2_NORMALIZATION_VERSION,
  ].join(":");
}

export function validateSearchV2SnapshotPayload<
  Document extends { candidateId: string },
>(value: unknown, expectedSchemaVersion: string): value is SearchV2SnapshotPayload<Document> {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<SearchV2SnapshotPayload<Document>>;
  return (
    candidate.schemaVersion === expectedSchemaVersion &&
    typeof candidate.revision === "string" &&
    candidate.revision.length > 8 &&
    Number.isInteger(candidate.sourceRows) &&
    Number(candidate.sourceRows) > 0 &&
    Array.isArray(candidate.documents) &&
    candidate.documents.length > 0 &&
    candidate.documents.every(
      (document) =>
        document &&
        typeof document.candidateId === "string" &&
        document.candidateId.length > 0 &&
        Array.isArray(
          (document as Document & { lifecycleEvidence?: unknown })
            .lifecycleEvidence,
        ),
    )
  );
}
import {
  CANDIDATE_CANONICAL_VERSION,
  CANDIDATE_EXPERIENCE_EXTRACTOR_VERSION,
  CANDIDATE_PROJECT_EXTRACTOR_VERSION,
} from "./candidate360SchemaNormalize";
import { CANDIDATE_PERSON_IDENTITY_VERSION } from "./candidateSearchV2Projection";
import { SEARCH_V2_PUBLIC_IDENTITY_VERSION } from "./searchV2PublicIdentity";
import { COMMITTED_SEARCH_REQUIREMENTS_VERSION } from "./searchV2CommittedRequirements";
import { SEARCH_V2_CRITERIA_SCORING_VERSION } from "./searchV2Criteria";
import { SEARCH_V2_LIFECYCLE_INDEX_VERSION } from "./searchV2Lifecycle";
import { SEARCH_V2_REQUIREMENT_ONTOLOGY_VERSION } from "./searchV2RequirementOntology";
import { SEARCH_V2_VERSION } from "./searchV2Shared";

export const SEARCH_V2_NORMALIZATION_VERSION = "search-normalization-v16-embedded-header-client-boundaries";

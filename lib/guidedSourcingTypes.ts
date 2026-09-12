export const GUIDED_SOURCING_SCHEMA_VERSION =
  "guided-sourcing-plan-v1" as const;
export type GuidedCriterionType =
  | "target_role"
  | "sap_concept"
  | "must_have"
  | "nice_to_have"
  | "location"
  | "work_preference"
  | "seniority"
  | "minimum_years"
  | "preferred_years"
  | "industry"
  | "certification"
  | "project_context"
  | "exclusion"
  | "unresolved";
export type GuidedCriterionStatus =
  "proposed" | "confirmed" | "edited" | "removed" | "unresolved";
export type GuidedCriterion = {
  id: string;
  type: GuidedCriterionType;
  value: string;
  supportingExcerpt: string;
  evidenceSegmentIds?: string[];
  reason: string;
  confidence: number;
  status: GuidedCriterionStatus;
  ambiguityExplanation?: string;
  taxonomyConceptId?: string;
};
export type GuidedSourcingPlan = {
  schemaVersion: typeof GUIDED_SOURCING_SCHEMA_VERSION;
  briefFingerprint: string;
  criteria: GuidedCriterion[];
  generatedAt: string;
};
export type ConfirmedGuidedSourcingPlan = GuidedSourcingPlan & {
  criteria: Array<
    GuidedCriterion & { status: "confirmed" | "edited" | "removed" }
  >;
};
export type GuidedSearchHandoff = {
  query: string;
  filters: { countries: string[]; skills: string[]; sapModules: string[] };
  integrityPlan: {
    version: "search-integrity-v20";
    planIdentity: string;
    requirements: Array<{
      id: string;
      criterionId: string;
      label: string;
      kind:
        | "role"
        | "location"
        | "experience"
        | "language"
        | "sap"
        | "implementation"
        | "migration"
        | "local_regulation"
        | "presales"
        | "manual";
      required: boolean;
      values: string[];
      minimum?: number;
      city?: string;
      country?: string;
    }>;
    includeRelocationRemote: boolean;
  };
  provenance: {
    schemaVersion: string;
    confirmedCriterionIds: string[];
    sourceType?: "guided" | "posted_job_jd" | "uploaded_jd";
    jobId?: string;
    sourceIdentity?: string;
    sourceFingerprint?: string;
  };
  savePreviewParams: Record<string, string>;
};
export type GuidedIntentResponse =
  | {
      ok: true;
      plan: GuidedSourcingPlan;
      telemetry: {
        latencyMs: number;
        status: "success";
        model: string;
        inputCharacters: number;
        outputTokens: number | null;
      };
    }
  | {
      ok: false;
      error: { code: string; message: string; fallbackAvailable: true };
      telemetry: {
        latencyMs: number;
        status:
          | "disabled"
          | "rejected"
          | "config_error"
          | "auth_error"
          | "source_error"
          | "timeout"
          | "model_error"
          | "invalid_output"
          | "rate_limited"
          | "aborted"
          | "internal_error";
        model: string | null;
        inputCharacters: number;
        outputTokens: number | null;
      };
    };

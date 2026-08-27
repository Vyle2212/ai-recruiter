import { GUIDED_SOURCING_SCHEMA_VERSION } from "./guidedSourcingTypes";
export const GUIDED_SOURCING_MAX_INPUT = 12000;
export const GUIDED_SOURCING_MAX_CRITERIA = 12;
export const GUIDED_SOURCING_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "criteria"],
  properties: {
    schemaVersion: { type: "string", const: GUIDED_SOURCING_SCHEMA_VERSION },
    criteria: {
      type: "array",
      maxItems: GUIDED_SOURCING_MAX_CRITERIA,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "id",
          "type",
          "value",
          "evidenceSegmentIds",
          "reason",
          "confidence",
          "status",
          "ambiguityExplanation",
          "taxonomyConceptId",
        ],
        properties: {
          id: { type: "string", maxLength: 80 },
          type: {
            type: "string",
            enum: [
              "target_role",
              "sap_concept",
              "must_have",
              "nice_to_have",
              "location",
              "work_preference",
              "seniority",
              "minimum_years",
              "preferred_years",
              "industry",
              "certification",
              "project_context",
              "exclusion",
              "unresolved",
            ],
          },
          value: { type: "string", minLength: 1, maxLength: 300 },
          evidenceSegmentIds: {
            type: "array",
            minItems: 1,
            maxItems: 4,
            items: { type: "string", pattern: "^S\\d{3}-[a-f0-9]{6}$" },
          },
          reason: { type: "string", maxLength: 300 },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          status: { type: "string", enum: ["proposed", "unresolved"] },
          ambiguityExplanation: { type: ["string", "null"], maxLength: 300 },
          taxonomyConceptId: { type: ["string", "null"], maxLength: 80 },
        },
      },
    },
  },
} as const;

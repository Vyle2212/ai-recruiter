export const SUPPORTED_BATCH_TARGET_FIELDS = [
  "currentCompany",
  "title",
  "primarySapModule",
  "sapModules",
  "sapSkills",
  "location",
  "email",
  "phone",
  "salary",
  "noticePeriod",
] as const;

export type BatchTargetField = typeof SUPPORTED_BATCH_TARGET_FIELDS[number];
export type BatchProviderMode = "mock" | "cached" | "fallback" | "openai";

export type BatchGuardrailResult = {
  ok: boolean;
  batchSize: number;
  targetFields: BatchTargetField[];
  provider: BatchProviderMode;
  maxAiCalls?: number;
  warnings: string[];
  errors: string[];
  safetyStatus: "safe" | "warning" | "blocked";
};

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

export function parseTargetFields(value?: string | string[]): string[] {
  if (Array.isArray(value)) return unique(value.flatMap((item) => item.split(",")));
  return unique(String(value || "currentCompany,title,primarySapModule").split(","));
}

export function validateBatchGuardrails(options: { batchSize?: number; targetFields?: string[]; provider?: string; maxAiCalls?: number; confirmOpenAi?: boolean } = {}): BatchGuardrailResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  const batchSize = Number(options.batchSize || 10);
  const provider = (options.provider || "mock") as BatchProviderMode;
  const requestedFields = options.targetFields?.length ? options.targetFields : parseTargetFields();
  const supported = new Set<string>(SUPPORTED_BATCH_TARGET_FIELDS);
  const targetFields = requestedFields.filter((field): field is BatchTargetField => supported.has(field));
  const unknownFields = requestedFields.filter((field) => !supported.has(field));

  if (!Number.isFinite(batchSize) || batchSize <= 0) errors.push("batch size must be a positive number");
  if (batchSize > 50) errors.push("batch size greater than 50 is rejected");
  if (batchSize === 50) warnings.push("batch size 50 is allowed but should be reviewed carefully");
  if (batchSize > 20 && batchSize < 50) warnings.push("large batch greater than 20 should be reviewed carefully");
  if (unknownFields.length) errors.push(`unsupported target fields blocked: ${unknownFields.join(", ")}`);
  if (!targetFields.length) errors.push("at least one supported target field is required");
  if (!["mock", "cached", "fallback", "openai"].includes(provider)) errors.push(`unsupported provider: ${provider}`);
  if (provider === "openai") {
    if (!options.confirmOpenAi) errors.push("provider=openai requires --confirmOpenAi");
    if (!options.maxAiCalls || options.maxAiCalls <= 0) errors.push("provider=openai requires --maxAiCalls");
  }

  return {
    ok: errors.length === 0,
    batchSize,
    targetFields,
    provider,
    maxAiCalls: options.maxAiCalls,
    warnings,
    errors,
    safetyStatus: errors.length ? "blocked" : warnings.length ? "warning" : "safe",
  };
}
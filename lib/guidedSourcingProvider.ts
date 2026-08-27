import { GUIDED_SOURCING_JSON_SCHEMA } from "./guidedSourcingSchema";
import { GUIDED_SOURCING_SCHEMA_VERSION } from "./guidedSourcingTypes";
import {
  guidedPromptInjectionSafeInstructions,
  validateGuidedSourcingPlan,
} from "./guidedSourcingValidation";
import {
  buildGuidedSourceSegments,
  formatGuidedSegmentsForPrompt,
} from "./guidedSourcingEvidence";

const trim = (value: string | undefined) => String(value ?? "").trim();
export const GUIDED_SOURCING_MODEL =
  trim(process.env.AI_GUIDED_SOURCING_MODEL) || "gpt-4.1-mini";
export function guidedSourcingTimeoutMs(env: NodeJS.ProcessEnv = process.env) {
  const parsed = Number.parseInt(trim(env.AI_GUIDED_SOURCING_TIMEOUT_MS), 10);
  return Number.isFinite(parsed)
    ? Math.min(30_000, Math.max(20_000, parsed))
    : 30_000;
}
export const GUIDED_SOURCING_TIMEOUT_MS = guidedSourcingTimeoutMs();
export type GuidedRuntimeReason =
  | "GUIDED_CONFIG_MISSING"
  | "GUIDED_AUTH_FAILED"
  | "GUIDED_SOURCE_EMPTY"
  | "GUIDED_FILE_EXTRACTION_FAILED"
  | "GUIDED_UPSTREAM_TIMEOUT"
  | "GUIDED_UPSTREAM_RATE_LIMITED"
  | "GUIDED_UPSTREAM_ERROR"
  | "GUIDED_RESPONSE_INVALID"
  | "GUIDED_REQUEST_ABORTED"
  | "GUIDED_INTERNAL_ERROR";

export function guidedProviderConfigured(env: NodeJS.ProcessEnv = process.env) {
  return Boolean(
    trim(env.OPENAI_API_KEY) &&
    (trim(env.AI_GUIDED_SOURCING_MODEL) || GUIDED_SOURCING_MODEL),
  );
}
export function classifyGuidedProviderError(
  error: unknown,
  deadlineExpired = false,
  requestAborted = false,
): GuidedRuntimeReason {
  const known = String((error as { code?: unknown })?.code || "");
  if (known.startsWith("GUIDED_")) return known as GuidedRuntimeReason;
  if (deadlineExpired) return "GUIDED_UPSTREAM_TIMEOUT";
  if (requestAborted || (error as { name?: unknown })?.name === "AbortError")
    return "GUIDED_REQUEST_ABORTED";
  const status = Number((error as { status?: unknown })?.status);
  if (status === 401 || status === 403) return "GUIDED_AUTH_FAILED";
  if (status === 429) return "GUIDED_UPSTREAM_RATE_LIMITED";
  if (status === 404 || status >= 500) return "GUIDED_UPSTREAM_ERROR";
  return "GUIDED_INTERNAL_ERROR";
}
export function guidedTimeoutFaultEnabled(
  env: NodeJS.ProcessEnv = process.env,
) {
  const safeEnvironment =
    trim(env.APP_ENV) === "staging" || trim(env.NODE_ENV) === "test";
  const productionDeployment =
    trim(env.APP_ENV) === "production" ||
    trim(env.VERCEL_ENV) === "production" ||
    trim(env.PRODUCTION_AUTH_ENABLED) === "true";
  return (
    trim(env.AI_GUIDED_SOURCING_TEST_FAULT) === "timeout" &&
    safeEnvironment &&
    !productionDeployment
  );
}
function failure(code: GuidedRuntimeReason, message: string, status?: number) {
  return Object.assign(new Error(message), {
    code,
    ...(status ? { status } : {}),
  });
}
function waitForInjectedTimeout(signal: AbortSignal, timeoutMs: number) {
  return new Promise<never>((_resolve, reject) => {
    const timer = setTimeout(
      () =>
        reject(
          failure(
            "GUIDED_UPSTREAM_TIMEOUT",
            "Injected operation exceeded its deadline.",
          ),
        ),
      timeoutMs + 2_000,
    );
    const abort = () => {
      clearTimeout(timer);
      reject(
        Object.assign(new Error("Provider operation aborted."), {
          name: "AbortError",
        }),
      );
    };
    if (signal.aborted) abort();
    else signal.addEventListener("abort", abort, { once: true });
  });
}

async function requestStructuredPlan(
  brief: string,
  signal: AbortSignal,
  timeoutMs: number,
) {
  if (guidedTimeoutFaultEnabled())
    return waitForInjectedTimeout(signal, timeoutMs);
  const apiKey = trim(process.env.OPENAI_API_KEY);
  const model =
    trim(process.env.AI_GUIDED_SOURCING_MODEL) || GUIDED_SOURCING_MODEL;
  if (!apiKey || !model)
    throw failure(
      "GUIDED_CONFIG_MISSING",
      "Guided provider configuration is incomplete.",
    );
  const promptStarted = performance.now();
  const segments = buildGuidedSourceSegments(brief);
  const messages = [
    {
      role: "system" as const,
      content: guidedPromptInjectionSafeInstructions(),
    },
    {
      role: "user" as const,
      content: `Schema version: ${GUIDED_SOURCING_SCHEMA_VERSION}\nBEGIN UNTRUSTED LABELED SOURCE SEGMENTS\n${formatGuidedSegmentsForPrompt(segments)}\nEND UNTRUSTED LABELED SOURCE SEGMENTS`,
    },
  ];
  const promptMs = performance.now() - promptStarted;
  const { default: OpenAI } = await import("openai");
  const providerTimeout = Math.max(4_000, timeoutMs - 750);
  const client = new OpenAI({
    apiKey,
    timeout: providerTimeout,
    maxRetries: 0,
  });
  const providerStarted = performance.now();
  const response = await client.chat.completions.create(
    {
      model,
      max_completion_tokens: 3_200,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "guided_sourcing_plan",
          strict: true,
          schema: GUIDED_SOURCING_JSON_SCHEMA,
        },
      },
      messages,
    },
    { signal },
  );
  return {
    response,
    segments,
    promptMs,
    providerMs: performance.now() - providerStarted,
  };
}

export async function proposeGuidedSourcingPlan(
  brief: string,
  signal?: AbortSignal,
) {
  if (!guidedProviderConfigured())
    throw failure(
      "GUIDED_CONFIG_MISSING",
      "Guided provider configuration is incomplete.",
    );
  const timeoutMs = guidedSourcingTimeoutMs();
  const controller = new AbortController();
  let deadlineExpired = false;
  const timer = setTimeout(() => {
    deadlineExpired = true;
    controller.abort();
  }, timeoutMs);
  const forward = () => controller.abort();
  signal?.addEventListener("abort", forward, { once: true });
  try {
    const requested = await requestStructuredPlan(
      brief,
      controller.signal,
      timeoutMs,
    );
    const parseStarted = performance.now();
    const choice = requested.response.choices[0];
    if (choice?.finish_reason === "length")
      throw Object.assign(
        failure(
          "GUIDED_RESPONSE_INVALID",
          "The provider output exceeded its safe limit.",
        ),
        { detailCode: "output_truncated" },
      );
    const content = choice?.message?.content || "";
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw failure(
        "GUIDED_RESPONSE_INVALID",
        "The provider returned invalid structured output.",
      );
    }
    const parseMs = performance.now() - parseStarted;
    const normalizationStarted = performance.now();
    const validated = validateGuidedSourcingPlan(
      parsed,
      brief,
      requested.segments,
    );
    const normalizationMs = performance.now() - normalizationStarted;
    if (!validated.ok)
      throw Object.assign(
        failure(
          "GUIDED_RESPONSE_INVALID",
          "The provider output failed safety validation.",
        ),
        { detailCode: validated.code },
      );
    return {
      plan: validated.plan,
      outputTokens: requested.response.usage?.completion_tokens ?? null,
      timing: {
        promptMs: requested.promptMs,
        providerMs: requested.providerMs,
        parseMs,
        normalizationMs,
      },
      timeoutMs,
    };
  } catch (error) {
    const code = classifyGuidedProviderError(
      error,
      deadlineExpired,
      Boolean(signal?.aborted),
    );
    if (String((error as { code?: unknown })?.code || "").startsWith("GUIDED_"))
      throw error;
    const status = Number((error as { status?: unknown })?.status) || undefined;
    const messages: Record<GuidedRuntimeReason, string> = {
      GUIDED_CONFIG_MISSING: "Guided provider configuration is incomplete.",
      GUIDED_AUTH_FAILED: "Guided provider authentication failed.",
      GUIDED_SOURCE_EMPTY: "Guided source is empty.",
      GUIDED_FILE_EXTRACTION_FAILED: "Guided file extraction failed.",
      GUIDED_UPSTREAM_TIMEOUT: "Guided provider exceeded its deadline.",
      GUIDED_UPSTREAM_RATE_LIMITED: "Guided provider rate limited the request.",
      GUIDED_UPSTREAM_ERROR: "Guided provider request failed.",
      GUIDED_RESPONSE_INVALID: "Guided provider response was invalid.",
      GUIDED_REQUEST_ABORTED: "Guided request was cancelled.",
      GUIDED_INTERNAL_ERROR: "Guided provider request failed.",
    };
    throw failure(code, messages[code], status);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", forward);
  }
}

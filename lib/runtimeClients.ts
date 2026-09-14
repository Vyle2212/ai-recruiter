import "server-only";

import OpenAI from "openai";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type OpenAiProvider = "openai" | "openrouter";

function lazyProxy<T extends object>(factory: () => T): T {
  let instance: T | undefined;
  const getInstance = () => (instance ??= factory());
  return new Proxy({} as T, {
    get(_target, property) {
      const value = Reflect.get(getInstance(), property);
      return typeof value === "function" ? value.bind(getInstance()) : value;
    },
  });
}

function runtimeCredential(
  value: string | undefined,
  unavailableMessage: string,
) {
  const normalized = value?.trim();
  if (!normalized) throw new Error(unavailableMessage);
  return normalized;
}

export function createLazyOpenAiClient(
  provider: OpenAiProvider = "openai",
): OpenAI {
  return lazyProxy(() => {
    const isOpenRouter = provider === "openrouter";
    const apiKey = runtimeCredential(
      isOpenRouter
        ? process.env.OPENROUTER_API_KEY
        : process.env.OPENAI_API_KEY,
      "The requested AI provider is not configured.",
    );
    return new OpenAI({
      apiKey,
      ...(isOpenRouter ? { baseURL: "https://openrouter.ai/api/v1" } : {}),
    });
  });
}

export function createLazySupabaseServiceClient(): SupabaseClient {
  return lazyProxy(() => {
    const url = runtimeCredential(
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
      "The candidate data service is not configured.",
    );
    const serviceKey = runtimeCredential(
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      "The candidate data service is not configured.",
    );
    return createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  });
}

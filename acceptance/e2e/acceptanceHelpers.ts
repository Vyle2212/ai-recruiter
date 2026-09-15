import { readFile } from "node:fs/promises";

import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import {
  request as playwrightRequest,
  type APIRequestContext,
  type APIResponse,
  type BrowserContext,
} from "@playwright/test";

import {
  acceptanceBridgeConfigurationFromProcess,
  acceptanceRequestHeaders,
  VERCEL_PROTECTION_BYPASS_HEADER,
} from "../../lib/acceptanceDeploymentBridge";

type AcceptanceApiRequestOptions = NonNullable<
  Parameters<APIRequestContext["get"]>[1]
>;

import type {
  AcceptanceCredentialBundle,
  AcceptanceIdentityKey,
} from "../../lib/acceptanceSyntheticIdentityContract";

type CookieToSet = {
  name: string;
  value: string;
  options?: {
    domain?: string;
    path?: string;
    expires?: Date | string | number;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: boolean | "lax" | "strict" | "none";
  };
};

export function acceptanceRequired(name: string) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`acceptance_configuration_missing:${name}`);
  return value;
}

export async function credentialBundle() {
  const file = acceptanceRequired("ACCEPTANCE_CREDENTIAL_BUNDLE_PATH");
  return JSON.parse(await readFile(file, "utf8")) as AcceptanceCredentialBundle;
}

function sameSite(value: unknown): "Lax" | "Strict" | "None" {
  if (value === "strict") return "Strict";
  if (value === "none") return "None";
  return "Lax";
}

export async function authenticatedSession(role: AcceptanceIdentityKey) {
  const bundle = await credentialBundle();
  const identity = bundle.identities[role];
  const cookieJar = new Map<string, CookieToSet>();
  const supabase = createServerClient(
    acceptanceRequired("ACCEPTANCE_SUPABASE_URL"),
    acceptanceRequired("ACCEPTANCE_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return [...cookieJar.values()].map(({ name, value }) => ({
            name,
            value,
          }));
        },
        setAll(cookies) {
          for (const cookie of cookies) cookieJar.set(cookie.name, cookie);
        },
      },
    },
  );
  const { data, error } = await supabase.auth.signInWithPassword({
    email: identity.email,
    password: identity.password,
  });
  if (error || !data.session)
    throw new Error(`acceptance_session_create_failed:${role}`);
  const base = new URL(acceptanceRequired("ACCEPTANCE_BASE_URL"));
  return {
    accessToken: data.session.access_token,
    storageState: {
      cookies: [...cookieJar.values()].map(({ name, value, options = {} }) => ({
        name,
        value,
        domain: options.domain || base.hostname,
        path: options.path || "/",
        expires:
          options.expires instanceof Date
            ? options.expires.getTime() / 1000
            : typeof options.expires === "number"
              ? options.expires
              : -1,
        httpOnly: options.httpOnly ?? true,
        secure: options.secure ?? true,
        sameSite: sameSite(options.sameSite),
      })),
      origins: [],
    },
  };
}

export async function authenticatedStorageState(role: AcceptanceIdentityKey) {
  return (await authenticatedSession(role)).storageState;
}

export async function authenticatedApi(
  role: AcceptanceIdentityKey,
  storageState?: Awaited<ReturnType<typeof authenticatedStorageState>>,
) {
  const context = await playwrightRequest.newContext({
    storageState: storageState || (await authenticatedStorageState(role)),
  });
  return bridgedApi(context);
}

export async function anonymousAcceptanceApi() {
  return bridgedApi(await playwrightRequest.newContext());
}

function bridgedApi(context: APIRequestContext) {
  const send = (
    method: "get" | "post" | "put" | "patch" | "delete",
    target: string,
    options: AcceptanceApiRequestOptions = {},
  ) => {
    const request = acceptanceRequestHeaders(
      target,
      acceptanceBridgeConfigurationFromProcess(),
      {
        Origin: new URL(acceptanceRequired("ACCEPTANCE_BASE_URL")).origin,
        "X-Acceptance-Run": "synthetic",
        ...(options.headers || {}),
      },
    );
    return context[method](request.url.toString(), {
      ...options,
      headers: Object.fromEntries(request.headers.entries()),
      maxRedirects: 0,
    });
  };
  return {
    get: (target: string, options?: AcceptanceApiRequestOptions) =>
      send("get", target, options),
    post: (target: string, options?: AcceptanceApiRequestOptions) =>
      send("post", target, options),
    put: (target: string, options?: AcceptanceApiRequestOptions) =>
      send("put", target, options),
    patch: (target: string, options?: AcceptanceApiRequestOptions) =>
      send("patch", target, options),
    delete: (target: string, options?: AcceptanceApiRequestOptions) =>
      send("delete", target, options),
    dispose: () => context.dispose(),
  };
}

export async function installAcceptanceBrowserBridge(context: BrowserContext) {
  const config = acceptanceBridgeConfigurationFromProcess();
  const origin = new URL(acceptanceRequired("ACCEPTANCE_BASE_URL")).origin;
  await context.route("**/*", async (route) => {
    const request = route.request();
    const target = new URL(request.url());
    const headers = { ...request.headers() };
    delete headers[VERCEL_PROTECTION_BYPASS_HEADER];
    if (target.origin === origin) {
      const bridged = acceptanceRequestHeaders(target, config, headers);
      await route.continue({
        headers: Object.fromEntries(bridged.headers.entries()),
      });
      return;
    }
    if (request.isNavigationRequest()) {
      await route.abort("blockedbyclient");
      return;
    }
    await route.continue({ headers });
  });
}

export function acceptanceAdminClient() {
  return createClient(
    acceptanceRequired("ACCEPTANCE_SUPABASE_URL"),
    acceptanceRequired("ACCEPTANCE_SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function installAuthenticatedBrowserState(
  context: BrowserContext,
  role: AcceptanceIdentityKey,
) {
  const state = await authenticatedStorageState(role);
  await context.addCookies(state.cookies);
}

export async function expectPrivateErrorOnly(
  response: APIResponse,
  expectedStatus: 401 | 403,
) {
  if (response.status() !== expectedStatus)
    throw new Error(`expected_${expectedStatus}_received_${response.status()}`);
  const cacheControl = response.headers()["cache-control"] || "";
  if (!cacheControl.includes("private") || !cacheControl.includes("no-store"))
    throw new Error("denied_response_cache_control_invalid");
  const body = await response.json();
  if (
    !body ||
    typeof body !== "object" ||
    Object.keys(body).some((key) => key !== "error") ||
    !body.error?.code
  )
    throw new Error("denied_response_not_error_only");
  const serialized = JSON.stringify(body);
  if (/candidate|provider|continuation|cacheKey|stack/i.test(serialized))
    throw new Error("denied_response_contains_protected_fields");
}

export async function attachSanitized(
  testInfo: {
    attach(
      name: string,
      options: { body: string; contentType: string },
    ): Promise<void>;
  },
  name: string,
  value: unknown,
) {
  await testInfo.attach(name, {
    body: JSON.stringify(value, null, 2),
    contentType: "application/json",
  });
}

// Retry only the explicit transient readiness contract, never authorization or
// terminal index failures. Do not include response bodies in CI diagnostics.
export async function waitForAcceptanceSearchReady(
  api: Pick<APIRequestContext, "get">,
) {
  const deadline = Date.now() + 20_000;
  while (true) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error("acceptance_search_readiness_timeout");
    const response = await api.get("/api/recruiter/search-v2", {
      timeout: remaining,
    });
    const httpStatus = response.status();
    const body = await response.json().catch(() => null);
    await response.dispose();
    if (
      httpStatus === 200 &&
      body?.ready === true &&
      body?.sources?.internal_profiles?.available === true &&
      body?.sources?.internal_profiles?.population > 0
    )
      return;
    const warming =
      httpStatus === 503 &&
      body?.ready === false &&
      (body?.status === "cold" || body?.status === "warming") &&
      body?.error?.code === "SEARCH_INDEX_WARMING";
    if (!warming) {
      const state = ["cold", "warming", "ready", "failed"].includes(
        body?.status,
      )
        ? body.status
        : "unknown";
      const code = [
        "SEARCH_INDEX_WARMING",
        "SEARCH_INDEX_WARM_FAILED",
        "SEARCH_INDEX_WARM_TIMEOUT",
      ].includes(body?.error?.code)
        ? body.error.code
        : "unknown";
      throw new Error(
        `acceptance_search_not_ready http=${httpStatus} state=${state} code=${code}`,
      );
    }
    await new Promise((resolve) =>
      setTimeout(resolve, Math.min(1_000, Math.max(0, deadline - Date.now()))),
    );
  }
}

import type { StagingAuthActorRole } from "./stagingAuthAdapterTypes";

const allowedPrefixes: Record<StagingAuthActorRole, readonly string[]> = {
  admin: ["/admin", "/recruiter"],
  recruiter_manager: ["/recruiter"],
  recruiter: ["/recruiter"],
  client: ["/client"],
  candidate: ["/candidate"],
  guest: [],
};

const defaultRoute: Record<StagingAuthActorRole, string> = {
  admin: "/admin/portal",
  recruiter_manager: "/recruiter/dashboard",
  recruiter: "/recruiter/dashboard",
  client: "/client/portal",
  candidate: "/candidate/portal",
  guest: "/auth/login",
};

export function safeRequestedAuthRoute(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const route = value.trim();
  if (!route.startsWith("/") || route.startsWith("//") || route.includes("\\") || /[\u0000-\u001f]/.test(route)) return null;
  try {
    const parsed = new URL(route, "http://local.invalid");
    if (parsed.origin !== "http://local.invalid" || parsed.username || parsed.password) return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

export function resolvePostLoginRoute(role: StagingAuthActorRole, requested: unknown): string {
  const safe = safeRequestedAuthRoute(requested);
  if (!safe) return defaultRoute[role];
  const pathname = safe.split(/[?#]/, 1)[0];
  return allowedPrefixes[role].some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`)) ? safe : defaultRoute[role];
}
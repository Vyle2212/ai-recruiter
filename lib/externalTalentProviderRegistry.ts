import { ExaPeopleSearchProvider } from "@/lib/exaPeopleSearchProvider";
import type { ExternalCandidateSourceProvider } from "@/lib/externalCandidateSourceProvider";
let override: ExternalCandidateSourceProvider | null = null;
export function externalTalentProvider() { return override || new ExaPeopleSearchProvider(); }
export function setExternalTalentProviderForTests(provider: ExternalCandidateSourceProvider | null) { override = provider; }

export type SearchV2TalentPool = "internal_profiles" | "linkedin_talent_pool";

export type ExternalSearchCapability = {
  available: boolean;
  connected?: boolean;
  reason: string | null;
  status?: string;
  providerName?: string | null;
};

export type SearchV2SourceReadiness = {
  ready: boolean;
  message: string | null;
  status?: "ready" | "warming" | "failed";
};

export function resolveSearchV2SourceReadiness({
  talentPool,
  internalReady,
  internalFailure,
  external,
}: {
  talentPool: SearchV2TalentPool;
  internalReady: boolean;
  internalFailure?: string | null;
  external: ExternalSearchCapability | null;
}): SearchV2SourceReadiness {
  if (talentPool === "internal_profiles") {
    if (internalFailure)
      return { ready: false, status: "failed", message: internalFailure };
    return internalReady
      ? { ready: true, status: "ready", message: null }
      : {
          ready: false,
          status: "warming",
          message:
            "Preparing candidate search. This should only take a moment.",
        };
  }

  if (!external) {
    return {
      ready: false,
      message: "Checking External Talent Network availability...",
    };
  }

  if (!external.available || !external.connected) {
    const message =
      external.status === "authentication_expired"
        ? "External Talent Network authentication has expired. Reconnect Exa People Search."
        : external.connected === false || external.status === "not_connected"
          ? "External Talent Network is disconnected. Connect Exa People Search to continue."
          : "External Talent Network is unavailable. Try again when the provider is available.";
    return {
      ready: false,
      message,
    };
  }

  return { ready: true, message: null };
}

export async function loadSearchV2SourceReadiness({
  talentPool,
  loadInternal,
  loadExternal,
}: {
  talentPool: SearchV2TalentPool;
  loadInternal: () => Promise<boolean>;
  loadExternal: () => Promise<ExternalSearchCapability | null>;
}) {
  if (talentPool === "linkedin_talent_pool") {
    const external = await loadExternal();
    return resolveSearchV2SourceReadiness({
      talentPool,
      internalReady: false,
      external,
    });
  }

  const internalReady = await loadInternal();
  return resolveSearchV2SourceReadiness({
    talentPool,
    internalReady,
    external: null,
  });
}

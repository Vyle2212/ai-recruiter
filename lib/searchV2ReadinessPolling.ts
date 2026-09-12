export type InternalSearchReadinessResponse = {
  ready: boolean;
  status?: "cold" | "warming" | "ready" | "failed";
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
  sources?: {
    internal_profiles?: {
      available: boolean;
      population: number;
      reason: string | null;
    };
  };
};

export type SearchV2ReadinessPollState =
  | { status: "warming"; message: string }
  | { status: "ready"; value: InternalSearchReadinessResponse }
  | { status: "failed"; message: string; code: string };

export function startSearchV2ReadinessPolling({
  load,
  onState,
  backoffMs = [250, 500, 1_000, 2_000, 3_000, 5_000],
  maxElapsedMs = 15_000,
}: {
  load: (
    signal: AbortSignal,
    retryFailed: boolean,
  ) => Promise<InternalSearchReadinessResponse>;
  onState: (state: SearchV2ReadinessPollState) => void;
  backoffMs?: readonly number[];
  maxElapsedMs?: number;
}) {
  const controller = new AbortController();
  const startedAt = Date.now();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let attempt = 0;
  let stopped = false;
  let inFlight = false;

  const stop = () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    timer = null;
    controller.abort();
  };
  const schedule = () => {
    if (stopped) return;
    const delay = backoffMs[Math.min(attempt, backoffMs.length - 1)] || 1_000;
    attempt += 1;
    timer = setTimeout(() => void probe(false), delay);
  };
  const probe = async (retryFailed: boolean) => {
    if (stopped || inFlight) return;
    if (Date.now() - startedAt >= maxElapsedMs) {
      onState({
        status: "failed",
        code: "SEARCH_INDEX_CLIENT_TIMEOUT",
        message: "Candidate search could not be prepared. Please try again.",
      });
      stop();
      return;
    }
    inFlight = true;
    try {
      const value = await load(controller.signal, retryFailed);
      if (stopped) return;
      const ready =
        value.ready && value.sources?.internal_profiles?.available !== false;
      if (ready) {
        onState({ status: "ready", value });
        stop();
        return;
      }
      if (
        value.status === "failed" ||
        value.error?.code?.includes("FAILED") ||
        value.error?.code?.includes("TIMEOUT")
      ) {
        onState({
          status: "failed",
          code: value.error?.code || "SEARCH_INDEX_WARM_FAILED",
          message:
            value.error?.message ||
            "Candidate search could not be prepared. Please try again.",
        });
        stop();
        return;
      }
      onState({
        status: "warming",
        message:
          value.error?.message ||
          "Preparing candidate search. This should only take a moment.",
      });
      schedule();
    } catch (error) {
      if (
        stopped ||
        (error instanceof DOMException && error.name === "AbortError")
      )
        return;
      onState({
        status: "failed",
        code: "SEARCH_INDEX_READINESS_UNAVAILABLE",
        message: "Candidate search could not be prepared. Please try again.",
      });
      stop();
    } finally {
      inFlight = false;
    }
  };

  void probe(true);
  return { stop };
}

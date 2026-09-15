type Attempt = { status?: string; duration?: number };
type PlaywrightSuite = {
  suites?: PlaywrightSuite[];
  title?: string;
  specs?: Array<{
    title?: string;
    tests?: Array<{ status?: string; results?: Attempt[] }>;
  }>;
};
export type PlaywrightResult = { suites?: PlaywrightSuite[] };

export function collect(
  result: PlaywrightResult,
): Array<{ suite: string; test: string; status: string; durationMs: number }> {
  return (result.suites || []).flatMap((suite) => [
    ...(suite.specs || []).map((spec) => {
      const attempts = (spec.tests || []).flatMap((item) => item.results || []);
      return {
        suite: suite.title || "authenticated acceptance",
        test: spec.title || "unnamed acceptance",
        status:
          attempts.at(-1)?.status || spec.tests?.at(-1)?.status || "unknown",
        durationMs: attempts.reduce(
          (sum, attempt) => sum + (attempt.duration || 0),
          0,
        ),
      };
    }),
    ...collect({ suites: suite.suites }),
  ]);
}

import type { RecruiterSearchAuthAdapter } from "./recruiterSearchAuthorizationCore";

/** Request-local overlap only. The fresh getUser result still controls identity;
 * verified claims are used solely to start the RLS-bound profile read earlier.
 */
export function recruiterSearchProfilePrefetch(
  adapter: RecruiterSearchAuthAdapter,
  verifiedSubject: () => Promise<string | null>,
): RecruiterSearchAuthAdapter {
  let prefetched: {
    subject: string;
    result: ReturnType<RecruiterSearchAuthAdapter["getProfile"]>;
  } | null = null;
  return {
    async getUser() {
      const freshUser = adapter.getUser();
      let acceptingHint = true;
      // Claims are an optional latency hint, never a prerequisite for fresh Auth.
      // Ignore late hints so they cannot start an unused profile read afterward.
      try {
        void verifiedSubject().then((subject) => {
          if (acceptingHint && subject) {
            prefetched = {
              subject,
              result: adapter.getProfile(subject).catch(() => ({
                profile: null, error: "profile_read_failed",
              })),
            };
          }
        }).catch(() => {});
      } catch {
        // A synchronous claims failure uses the original fresh Auth path too.
      }
      try {
        return await freshUser;
      } finally {
        acceptingHint = false;
      }
    },
    getProfile(subject) {
      return prefetched?.subject === subject
        ? prefetched.result
        : adapter.getProfile(subject);
    },
  };
}

import type { RecruiterSearchAuthAdapter } from "./recruiterSearchAuthorizationCore";

/** Request-local overlap only. The subject hint may be stale or untrusted and
 * is used solely to start an RLS-bound profile read earlier. Fresh getUser
 * controls identity, revocation, and exact reuse of the prefetched result.
 */
export function recruiterSearchProfilePrefetch(
  adapter: RecruiterSearchAuthAdapter,
  profileSubjectHint: () => Promise<string | null>,
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
        void profileSubjectHint().then((subject) => {
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

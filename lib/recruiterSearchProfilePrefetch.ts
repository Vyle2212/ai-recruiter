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
      await Promise.all([
        freshUser,
        verifiedSubject().then((subject) => {
          if (subject) {
            prefetched = {
              subject,
              result: adapter.getProfile(subject).catch(() => ({
                profile: null, error: "profile_read_failed",
              })),
            };
          }
        }).catch(() => {}),
      ]);
      return freshUser;
    },
    getProfile(subject) {
      return prefetched?.subject === subject
        ? prefetched.result
        : adapter.getProfile(subject);
    },
  };
}

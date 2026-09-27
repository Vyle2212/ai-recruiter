/** Live Data API check after the supervised private-helper cutover.
 * SUPABASE_URL and SUPABASE_ANON_KEY are required. An optional
 * SUPABASE_ACCESS_TOKEN checks the same endpoints with a signed-in session.
 * Never print credentials or response bodies.
 */
const base = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY || "";
const token = process.env.SUPABASE_ACCESS_TOKEN || key;
if (!base || !key) throw new Error("Supabase URL and key required");
const url = new URL(base);
if (
  url.protocol !== "https:" ||
  !/^[a-z0-9-]+\.supabase\.co$/.test(url.hostname) ||
  url.pathname !== "/"
)
  throw new Error("Unexpected Supabase project URL");

const functions = [
  "current_user_profile_id",
  "current_user_role",
  "current_user_organization_id",
  "current_user_client_id",
  "current_user_candidate_id",
  "current_user_is_admin",
];
if (process.env.CHECK_RLS_EVENT_TRIGGER === "1")
  functions.push("rls_auto_enable");

async function main() {
  const results = await Promise.all(
    functions.map(async (name) => {
      const response = await fetch(new URL(`/rest/v1/rpc/${name}`, url), {
        method: "POST",
        headers: {
          apikey: key,
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: "{}",
        cache: "no-store",
      });
      let code: unknown;
      try {
        code = (await response.json()).code;
      } catch {
        code = null;
      }
      const denied =
        ((response.status === 401 || response.status === 403) &&
          code === "42501") ||
        (response.status === 404 && code === "PGRST202");
      return { name, status: response.status, code, denied };
    }),
  );

  console.log(
    JSON.stringify({
      project: url.hostname.split(".")[0],
      session: process.env.SUPABASE_ACCESS_TOKEN ? "authenticated" : "anon",
      results,
    }),
  );
  if (results.some((result) => !result.denied)) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "RPC probe failed");
  process.exitCode = 1;
});

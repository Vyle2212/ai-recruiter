import "server-only";

import {
  createClient,
} from "@supabase/supabase-js";

function requireEnv(
  name: string,
) {
  const value =
    process.env[name]?.trim();

  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}`,
    );
  }

  return value;
}

export function createCandidateSupabaseAdminClient() {
  return createClient(
    requireEnv(
      "CANDIDATE_SUPABASE_URL",
    ),
    requireEnv(
      "CANDIDATE_SUPABASE_SERVICE_ROLE_KEY",
    ),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}
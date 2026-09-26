import "server-only";

import { createLazySupabaseServiceClient } from "@/lib/runtimeClients";

// Legacy API handlers import this shared client. Keep it server-only so
// candidate and recruiter data never depends on browser/anon table grants.
// Route authorization is enforced by the policy-aware proxy before any of
// these handlers run; the database client is initialized lazily at runtime.
export const supabase = createLazySupabaseServiceClient();

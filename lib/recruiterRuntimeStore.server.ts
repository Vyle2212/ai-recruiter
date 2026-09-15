import "server-only";
import { createClient } from "@supabase/supabase-js";
import { recruiterRuntimeStore } from "./recruiterRuntimeStore";
import {
  supabaseStateRepository,
  RecruiterStateUnavailable,
  type StateScope,
} from "./recruiterDurableState";

export function createRecruiterRuntimeStore(scope: StateScope) {
  // Use the authenticated application's database, never the candidate source database.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new RecruiterStateUnavailable();
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return recruiterRuntimeStore(supabaseStateRepository(client), scope);
}

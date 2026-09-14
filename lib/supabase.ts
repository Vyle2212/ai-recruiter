import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | undefined;

function getPublicSupabaseClient() {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonymousKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonymousKey) {
    throw new Error("The application data service is not configured.");
  }
  client = createClient(url, anonymousKey);
  return client;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, property) {
    const instance = getPublicSupabaseClient();
    const value = Reflect.get(instance, property);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});

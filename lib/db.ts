import { createLazySupabaseServiceClient } from "./runtimeClients";

export const supabase = createLazySupabaseServiceClient();

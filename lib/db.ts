import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL?.trim();
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

console.log("DEBUG URL:", supabaseUrl);

if (!supabaseUrl || !supabaseUrl.startsWith("https://")) {
  throw new Error("❌ SUPABASE_URL INVALID");
}

if (!supabaseKey) {
  throw new Error("❌ SUPABASE_SERVICE_ROLE_KEY MISSING");
}

export const supabase = createClient(supabaseUrl, supabaseKey);
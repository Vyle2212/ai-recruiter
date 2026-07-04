import { supabase } from "./db";

export async function autoEnrich(text: string) {
  const matches = text.toLowerCase().match(/sap\s?[a-z0-9\-\/]+/g) || [];

  for (const m of matches) {
    const module = m.replace("sap", "").trim().toUpperCase();
    if (module.length < 2) continue;

    const { data } = await supabase
      .from("sap_modules")
      .select("id")
      .ilike("module", module)
      .limit(1);

    if (!data || data.length === 0) {
      await supabase.from("sap_modules").insert({
        module,
        submodules: [],
        category: "auto",
      });
    }
  }
}
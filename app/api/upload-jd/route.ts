import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { detectPrimaryModuleForJdV2, detectSecondaryModulesForJdV2, normalizeSapModuleV2 } from "@/lib/jdModuleDetection";

type AnyObj = Record<string, any>;

function n(v: any): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function text(v: any): string {
  return String(v ?? "").trim();
}

function clean(v: any): string | null {
  const s = text(v);
  return s || null;
}

function arr(v: any): string[] {
  if (Array.isArray(v)) return v.filter(Boolean).map(String);
  if (typeof v === "string" && v.trim()) {
    return v.split(",").map((x) => x.trim()).filter(Boolean);
  }
  return [];
}

async function getParser() {
  const mod: AnyObj = await import("@/lib/jd-parser");

  const parser =
    mod.parseJd ||
    mod.parseJD ||
    mod.parseJDText ||
    mod.parseJob ||
    mod.parseJobDescription ||
    mod.default;

  if (typeof parser !== "function") {
    throw new Error(
      "No JD parser found in lib/jd-parser.ts. Please export parseJd or parseJD."
    );
  }

  return parser;
}

function inferRequiredYears(raw: string, parsed: AnyObj): number {
  return (
    n(parsed.years_required) ||
    n(parsed.yearsRequired) ||
    n(parsed.requiredYears) ||
    n(parsed.years) ||
    n(raw.match(/(\d{1,2})\+?\s*years?/i)?.[1]) ||
    7
  );
}

function inferPrimaryModule(raw: string, parsed: AnyObj, title: string): string {
  const explicit =
    clean(parsed.required_primary_module) ||
    clean(parsed.requiredPrimaryModule) ||
    clean(parsed.primary_module) ||
    clean(parsed.primaryModule);

  return detectPrimaryModuleForJdV2(raw, title, explicit);
}

function inferSecondaryModules(raw: string, parsed: AnyObj, primaryModule: string): string[] {
  return detectSecondaryModulesForJdV2(
    raw,
    primaryModule,
    parsed.required_secondary_modules ||
      parsed.requiredSecondaryModules ||
      parsed.secondary_modules ||
      parsed.secondaryModules ||
      parsed.modules ||
      parsed.sap_modules ||
      parsed.sapModules
  );
}

function toJobPayload(parsed: AnyObj, raw: string) {
  const title =
    clean(parsed.title) ||
    clean(parsed.jobTitle) ||
    clean(parsed.positionTitle) ||
    "Untitled Job";

  const location =
    clean(parsed.location) ||
    clean(parsed.jobLocation) ||
    clean(parsed.country) ||
    null;

  const primaryModule = inferPrimaryModule(raw, parsed, title);
  const yearsRequired = inferRequiredYears(raw, parsed);
  const secondaryModules = inferSecondaryModules(raw, parsed, primaryModule);

  const modules = Array.from(new Set([
    primaryModule,
    ...secondaryModules,
    ...arr(parsed.modules || parsed.sap_modules || parsed.sapModules),
  ].filter(Boolean)));

  return {
    title,
    company: clean(parsed.company) || null,
    location,

    summary: clean(parsed.summary) || null,
    description: clean(parsed.description) || raw,
    jd_text: raw,
    raw_text: raw,
    raw_jd: raw,

    requirements: arr(parsed.requirements),
    responsibilities: arr(parsed.responsibilities),

    skills: modules.join(", "),
    sap_modules: modules,
    modules,
    sap_submodules: arr(parsed.sap_submodules || parsed.sapSubmodules),

    years: yearsRequired,
    years_required: yearsRequired,

    level: clean(parsed.level) || "Senior",
    language: clean(parsed.language) || "English",
    languages: arr(parsed.languages || ["English"]),

    primary_module: primaryModule,
    secondary_modules: secondaryModules,
    required_primary_module: primaryModule,
    required_secondary_modules: secondaryModules,
    required_module_authority:
      n(parsed.required_module_authority) ||
      n(parsed.requiredModuleAuthority) ||
      90,
    required_module_authorities:
      parsed.required_module_authorities ||
      parsed.requiredModuleAuthorities ||
      {},

    project_types: arr(parsed.project_types || parsed.projectTypes),

    requires_implementation:
      Boolean(parsed.requires_implementation) ||
      /implementation|implement|realization|configuration|go-live|cutover|uat|sit/i.test(raw),

    requires_ams_support:
      Boolean(parsed.requires_ams_support) ||
      /ams|support|incident|ticket|sla|production support/i.test(raw),

    requires_rollout:
      Boolean(parsed.requires_rollout) ||
      /rollout|roll-out|deployment/i.test(raw),

    requires_migration:
      Boolean(parsed.requires_migration) ||
      /migration|data migration|conversion/i.test(raw),

    requires_apac_delivery:
      Boolean(parsed.requires_apac_delivery) ||
      /apac|asia pacific|asia-pacific/i.test(raw),

    requires_regional_delivery:
      Boolean(parsed.requires_regional_delivery) ||
      /regional|asia pacific|asia-pacific|apac/i.test(raw),

    requires_presales:
      Boolean(parsed.requires_presales) ||
      /pre[-\s]?sales|presales|rfp|rfq|proposal|solutioning|demo|poc/i.test(raw),

    requires_workshop:
      Boolean(parsed.requires_workshop) ||
      /workshop|client workshop|business process/i.test(raw),

    requires_blueprint:
      Boolean(parsed.requires_blueprint) ||
      /blueprint/i.test(raw),

    requires_fit_gap:
      Boolean(parsed.requires_fit_gap) ||
      /fit[-\s]?gap|fit gap/i.test(raw),

    requires_s4hana:
      Boolean(parsed.requires_s4hana) ||
      /s\/4hana|s4hana|s4 hana/i.test(raw),

    requires_transformation:
      Boolean(parsed.requires_transformation) ||
      /transformation|greenfield|conversion|global template|process redesign/i.test(raw),

    requires_consulting:
      Boolean(parsed.requires_consulting) ||
      /consulting|consultant|client|workshop|advisory|advise|guide/i.test(raw),

    target_role_type:
      clean(parsed.target_role_type) ||
      clean(parsed.targetRoleType) ||
      (["ABAP", "BASIS", "BW"].includes(primaryModule) ? "Technical" : primaryModule === "FICO" ? "FICO Functional" : "SAP Functional"),

    target_consulting_level:
      clean(parsed.target_consulting_level) ||
      clean(parsed.targetConsultingLevel) ||
      "SENIOR_CONSULTANT",

    required_country_coverage:
      n(parsed.required_country_coverage) ||
      n(parsed.requiredCountryCoverage) ||
      2,

    required_regional_delivery_score:
      n(parsed.required_regional_delivery_score) ||
      n(parsed.requiredRegionalDeliveryScore) ||
      7,

    parsed_data: {
      ...parsed,
      primary_module: primaryModule,
      primaryModule,
      required_primary_module: primaryModule,
      requiredPrimaryModule: primaryModule,
      secondary_modules: secondaryModules,
      secondaryModules,
      required_secondary_modules: secondaryModules,
      requiredSecondaryModules: secondaryModules,
    },
    status: "active",
    updated_at: new Date().toISOString(),
  };
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No JD file uploaded" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const parser = await getParser();
    const parsed = await parser(buffer, file.name);

    const raw =
      clean(parsed.raw_jd) ||
      clean(parsed.rawJd) ||
      clean(parsed.raw_text) ||
      clean(parsed.rawText) ||
      clean(parsed.jd_text) ||
      clean(parsed.text) ||
      buffer.toString("utf8");

    const payload = toJobPayload(parsed, raw || "");

    const { data: existing, error: findError } = await supabase
      .from("jobs")
      .select("id")
      .eq("title", payload.title)
      .maybeSingle();

    if (findError) throw new Error(findError.message);

    if (existing?.id) {
      const { data, error } = await supabase
        .from("jobs")
        .update(payload)
        .eq("id", existing.id)
        .select("*")
        .single();

      if (error) throw new Error(error.message);

      await supabase.from("matches").delete().eq("job_id", existing.id);

      return NextResponse.json({
        success: true,
        mode: "updated",
        job: data,
      });
    }

    const { data, error } = await supabase
      .from("jobs")
      .insert(payload)
      .select("*")
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({
      success: true,
      mode: "inserted",
      job: data,
    });
  } catch (error: any) {
    console.error("Upload JD error:", error);

    return NextResponse.json(
      { error: error?.message || "Failed to upload JD" },
      { status: 500 }
    );
  }
}
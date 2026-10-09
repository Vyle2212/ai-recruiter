import { supportedLinkedInProfileUrl } from "../lib/linkedinProfileUrl";
import { buildSearchV2RecruiterCandidateDetail } from "../lib/searchV2CandidateDetailContract";
import { buildCandidateSearchV2ProfilePreview } from "../lib/candidateSearchV2ProfilePreview";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
import { enrichCandidateUpload } from "../lib/candidateUploadEnrichment";
import { normalizeActualCandidateSchema } from "../lib/candidate360SchemaNormalize";
import { buildCandidate360Profile } from "../lib/candidate360Profile";
import { candidateLanguagesForStorage } from "../lib/candidateLanguageEvidence";

function moduleWithStubs(
  path: string,
  stubs: Record<string, unknown>,
  suffix = "",
) {
  const url = new URL(path, import.meta.url);
  const require = createRequire(url);
  const module = { exports: {} as any };
  const compiled = ts.transpileModule(fs.readFileSync(url, "utf8") + suffix, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  vm.runInNewContext(compiled, {
    module,
    exports: module.exports,
    require: (id: string) => (id in stubs ? stubs[id] : require(id)),
    process,
    Buffer,
    console,
    __dirname: new URL(".", url).pathname,
  });
  return module.exports;
}

async function main() {
  const id = "00000000-0000-4000-8000-000000000001";
  let persisted: any;
  const { saveCandidate } = moduleWithStubs("../lib/saveCandidate.ts", {
    "./supabase": {
      supabase: {
        rpc: async (_name: string, input: any) => {
          persisted = input.p_payload;
          return { data: { ...persisted, id }, error: null };
        },
      },
    },
  });
  const source = [
    "A l ex S m it h",
    "Address: South Jakarta",
    "PROFESSIONAL EXPERIENCE",
    "SAP FICO Consultant | Example Consulting (June 2024 – Present)",
    "SAP FICO S/4HANA implementation finance controlling data migration UAT SIT configuration and support.",
    "LANGUAGES SKILLS",
    "Bahasa Indonesia",
    "Reading, Speaking, and Writing: Native",
    "English",
    "Reading, Speaking, and Writing: Fluent",
    "EDUCATION",
    "Master Degree",
    "Master of Business Administration",
    "Finance | Example University",
    "2015 – 2017",
  ].join("\n");
  const candidate = enrichCandidateUpload(
    {
      name: "South Jakarta",
      email: "alex@example.com",
      current_title: "SAP FICO Consultant",
      primary_module: "FICO",
      file_name: "Alex_Smith_Expert_ITSAPFICO.pdf",
      source_file: "Alex_Smith_Expert_ITSAPFICO.pdf",
      raw_text: source,
    },
    source,
  );
  assert.equal(candidate.name, "Alex Smith");
  await saveCandidate({
    ...candidate,
    profile_source_type: "candidate_upload",
    candidate_owned_update_context: {
      auth_user_id: id,
      user_profile_id: id,
      candidate_id: id,
      expected_updated_at: "2026-10-09T00:00:00Z",
    },
  });
  assert.equal(
    persisted.name,
    "Alex Smith",
    "saving must not replace the verified tracked header with the address",
  );
  assert.ok(
    persisted.languages.every((entry: unknown) => typeof entry === "string"),
    "existing text[] storage stays compatible",
  );
  const canonical = normalizeActualCandidateSchema(persisted);
  const { normalizeForTest } = moduleWithStubs(
    "../lib/candidate360Data.ts",
    { "server-only": {}, "./candidateSupabase": {} },
    "\nexport { normalizeCandidate as normalizeForTest };\n",
  );
  const profile = buildCandidate360Profile(
    normalizeForTest({ ...persisted, ...canonical }),
  );
  assert.equal(profile.displayName.value, "Alex Smith");
  const confirmedEmployment = buildCandidate360Profile(
    normalizeForTest({
      ...normalizeActualCandidateSchema({
        id,
        name: "Alex Smith",
        experience: [
          {
            employer: "Example Consulting",
            title: "SAP FICO Consultant",
            start_date: "2024-06",
            end_date: null,
            current: true,
          },
          {
            employer: "Previous Employer",
            title: "Consultant",
            start_date: "2022-01",
            end_date: "2024-05",
            current: false,
          },
        ],
      }),
    }),
  );
  assert.equal(
    confirmedEmployment.workExperience[0].current,
    true,
    "confirmed current employment survives canonical profile readback even when end date is null",
  );
  assert.equal(confirmedEmployment.workExperience[1].current, false);

  const confirmedWithoutPhone = buildCandidate360Profile(
    normalizeForTest({
      ...persisted,
      ...canonical,
      phone: null,
      profile_source_state: { field_sources: { phone: "candidate_confirmed" } },
    }),
  );
  assert.equal(
    confirmedWithoutPhone.contactInfo.phone.value,
    "",
    "provenance must not become a phone number",
  );
  assert.deepEqual(
    profile.languages.map((entry: any) => [
      entry.language.value,
      entry.proficiency.value,
    ]),
    [
      ["Bahasa Indonesia", "Native"],
      ["English", "Fluent"],
    ],
  );
  const projects = Array.from({ length: 7 }, (_, index) => ({
    project: [
      "SAP HCM Greenfield",
      "SAP Finance Rollout",
      "SAP Insurance AMS",
      "SAP Plantation Support",
      "SAP Port Transformation",
      "SAP Treasury Automation",
      "SAP Paper Brownfield",
    ][index],
    client: [
      "North River Telecom",
      "Blue Ocean Insurance",
      "Green Forest Plantation",
      "Harbor Port Services",
      "City Road Operator",
      "Mountain Auto Group",
      "Paper Manufacturing Group",
    ][index],
    role: "SAP FICO Consultant",
    start_date: "",
    end_date: null,
  }));
  const sharedIdentity = {
    id: "project-parity-fixture",
    name: "Alex Smith",
    updated_at: "2026-10-09T00:00:00Z",
  };
  assert.equal(
    normalizeActualCandidateSchema(sharedIdentity).enterpriseProfile.projects
      .length,
    0,
  );
  const projectCanonical = normalizeActualCandidateSchema({
    ...sharedIdentity,
    projects,
  });
  const projectProfile = buildCandidate360Profile(
    normalizeForTest(projectCanonical),
  );
  assert.equal(
    buildSearchV2RecruiterCandidateDetail(projectProfile).enterpriseProfile
      .projects.length,
    7,
    "a limited search projection must not poison full profile cache",
  );
  assert.equal(
    buildCandidateSearchV2ProfilePreview(projectProfile.canonicalOverview!)
      .projectCount,
    7,
  );
  assert.ok(
    projectProfile.enterpriseProfile.projects.every(
      (project) => !project.start && !project.end && !project.employer,
    ),
  );
  assert.equal(
    supportedLinkedInProfileUrl(
      "https://www.linkedin.com/in/alex-",
      "https://www.linkedin.com/in/alex-\nsmith/\nSKILLS",
    ),
    "https://www.linkedin.com/in/alex-smith",
  );
  assert.equal(
    supportedLinkedInProfileUrl(
      "https://www.linkedin.com/in/alex-",
      "https://www.linkedin.com/in/alex-\nSKILLS",
    ),
    null,
  );
  assert.equal(
    supportedLinkedInProfileUrl(
      "https://www.linkedin.com/in/verified",
      "https://www.linkedin.com/in/alex-\nsmith/",
    ),
    "https://www.linkedin.com/in/verified",
  );
  assert.deepEqual(candidateLanguagesForStorage(["English"]), ["English"]);
  assert.ok(!JSON.stringify(profile.languages).includes("[object Object]"));
  console.log(
    "Candidate CV save, canonical readback and portal language evidence passed.",
  );
}
void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

import Module from "node:module";

const runtime = Module as unknown as {
  _load: (request: string, parent: unknown, isMain: boolean) => unknown;
};
const originalLoad = runtime._load;
runtime._load = function (request, parent, isMain) {
  if (request === "server-only") return {};
  return originalLoad.call(this, request, parent, isMain);
};

const normalize = (value: unknown) =>
  String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const redact = (value: unknown) =>
  String(value || "")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email redacted]")
    .replace(/(?:\+?\d[\d\s().-]{7,}\d)/g, "[phone redacted]")
    .replace(/\s+/g, " ")
    .trim();

async function main() {
  const [{ createCandidateSupabaseAdminClient }, normalizer, { fetchCandidateSource }, { dedupeCandidateSearchV2Documents }, { canonicalTalentSearchIdentity }, lifecycle] = await Promise.all([
    import("../lib/candidateSupabase"),
    import("../lib/candidate360SchemaNormalize"),
    import("../lib/searchV2Dataset"),
    import("../lib/candidateSearchV2Projection"),
    import("../lib/talentSearchDisplay"),
    import("../lib/searchV2Lifecycle"),
  ]);
  const dataset = await fetchCandidateSource();
  const canonical = dedupeCandidateSearchV2Documents(dataset.documents).documents;
  const requestedFixture = normalize(process.env.SEARCH_AUDIT_FIXTURE);
  const requestedToken = String(process.env.SEARCH_AUDIT_TOKEN || "").trim().toUpperCase().replace(/^#?/, "#");
  const selected = canonical.filter((document) => {
    const name = normalize(document.candidateName);
    const token = canonicalTalentSearchIdentity(document.candidateId).identityToken;
    if (requestedToken) return token === requestedToken;
    if (requestedFixture) return name === requestedFixture;
    return ["indra permana", "teck chiewlim", "gunawan lie"].includes(name)
      || /sap ps team lead/i.test(document.currentTitle || "")
      || ["#A8CCB8", "#C551A3", "#0BD318"].includes(token);
  });
  const ids = [...new Set(selected.flatMap((document) => document.sourceCandidateIds || [document.candidateId]))];
  const response = await createCandidateSupabaseAdminClient()
    .from("candidates")
    .select("id,name,title,current_title,current_company,raw_text,resume_text,experience,education")
    .in("id", ids);
  if (response.error) throw response.error;
  const rows = (response.data || []) as Array<Record<string, unknown>>;
  const output = rows.map((row) => {
    const profile = normalizer.normalizeActualCandidateSchema(row);
    const source = String(row.raw_text || row.resume_text || "");
    const cues = [
      "RESPONSIBILITY:",
      "Company Name:",
      "Magnus",
      "IBM Consulting",
      "Pipe Industry",
      "Krakatau Nippon",
      "EDUCATION, TRAINING",
      "Capgemini",
      "Accenture Malaysia",
      "Exxon Mobil",
      "Unilever Kenya",
      "U2K2",
      "TechMahindra",
      "Hewlett Packet",
      "IBM Malaysia",
    ];
    return {
      candidateId: row.id,
      name: profile.candidateName || "Name unavailable",
      token: canonicalTalentSearchIdentity(row.id).identityToken,
      currentTitle: profile.currentTitle,
      currentCompany: profile.currentCompany,
      employment: profile.enterpriseProfile.employmentTimeline.map((item) => ({
        id: item.id,
        company: item.company,
        title: item.title,
        start: item.start,
        end: item.end,
        current: item.current,
        sourceRefs: item.provenance?.map((entry) => entry.sourceRef),
      })),
      projects: profile.enterpriseProfile.projects.map((item) => ({
        id: item.id,
        name: item.name,
        client: item.client,
        role: item.role,
        modules: item.modules,
        start: item.start,
        end: item.end,
        type: item.projectType,
        sourceIds: item.sourceAssignmentIds,
        sourceRefs: Object.values(item.fieldEvidence).flatMap((field) => field?.provenance.map((entry) => entry.sourceRef) || []),
        classification: lifecycle.canonicalProjectRequirementClassification(String(row.id), item, "SAP FICO implementation"),
      })),
      extractedExplicitProjects: normalizer.extractExplicitResponsibilityProjects([row]).map((item) => ({ id: item.id, client: item.client, role: item.role, start: item.start, end: item.end })),
      explicitAssignmentBlocks: [...source.normalize("NFKC").replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").matchAll(/\bDATE\s*:\s*([^]{2,60}?)\s+(?:CLIENT)\s*:\s*([^]{2,140}?)\s+PROJECT\s+DESCRIPTION\s*:\s*([^]{2,240}?)\s+RESPONSIBILIT(?:Y|IES)\s*:\s*([^]{2,180}?)(?=\s+[A-Za-z][A-Za-z &/()-]{2,80}\s+DATE\s*:|$)/gi)].map((match) => ({
        dates: redact(match[1]),
        client: redact(match[2]),
        description: redact(match[3]),
        responsibility: redact(match[4]),
      })),
      sourceCues: process.env.SEARCH_AUDIT_SUMMARY_ONLY === "1" ? [] : cues.flatMap((cue) => {
        const at = source.toLowerCase().indexOf(cue.toLowerCase());
        return at < 0 ? [] : [redact(source.slice(Math.max(0, at - 160), at + 760))];
      }),
    };
  });
  console.log(JSON.stringify({ sourceRows: dataset.sourceRows, canonicalPeople: canonical.length, fixtures: output }, null, 2));
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

import assert from "node:assert/strict";
import fs from "node:fs";
import Module from "node:module";

const runtime = Module as unknown as {
  _load: (request: string, parent: unknown, isMain: boolean) => unknown;
};
const originalLoad = runtime._load;
runtime._load = function (request, parent, isMain) {
  if (request === "server-only") return {};
  return originalLoad.call(this, request, parent, isMain);
};

const { canonicalizeEnterpriseProjects, normalizeActualCandidateSchema } =
  require("../lib/candidate360SchemaNormalize") as typeof import("../lib/candidate360SchemaNormalize");
const {
  cleanEmploymentResponsibilities,
  cleanProjectResponsibilities,
  credentialPresentation,
  formatCandidateProfilePeriod,
} =
  require("../lib/candidateProfilePresentation") as typeof import("../lib/candidateProfilePresentation");

const profile = normalizeActualCandidateSchema({
  id: "project-identity-fixture",
  name: "Project Identity Fixture",
  resume_text: [
    "SAP FI Senior Analyst — Accenture Malaysia Sdn Bhd (Feb 2009 – May 2012)",
    "SAP ECC 6.0 Deployment project Client-Unilever Kenya Limited (U2K2 Central Africa Deployment) - (Feb to May 2012) Data Migration and Cutover Specific Responsibilities Role as FI SAP Consultant during the project.",
    "Support after go-live activities Dec 2009- Dec 2011 (2 years contract) Company : Accenture Malaysia Sdn Bhd Position : SAP FI Analyst Client – Exxon Mobil Business Support Center Sdn Bhd (SAP Application Services) Specific Responsibilities Provided post-go-live FI application support.",
  ].join(" "),
});

const projects = profile.enterpriseProfile.projects;
assert.equal(projects.length, 2);
const unilever = projects.find((item) => /Unilever/i.test(item.client));
assert.ok(unilever);
assert.equal(
  unilever!.name,
  "SAP ECC 6.0 Deployment Project – U2K2 Central Africa Deployment",
);
assert.equal(unilever!.role, "FI SAP Consultant");
assert.equal(unilever!.start, "Feb 2012");
assert.equal(unilever!.end, "May 2012");
const exxon = projects.find((item) => /Exxon/i.test(item.client));
assert.ok(exxon);
assert.equal(exxon!.name, "", "an unnamed engagement stays unnamed");
assert.equal(exxon!.employer, "Accenture Malaysia Sdn Bhd");
assert.equal(exxon!.role, "SAP FI Analyst");
assert.doesNotMatch(
  projects.map((item) => item.name).join("|"),
  /(?:Migration|Rollout|Support \/ Enhancement|Integration) assignment/i,
);

const employmentOnly = normalizeActualCandidateSchema({
  id: "employment-only-project-copy",
  name: "Employment Boundary Fixture",
  resume_text:
    "SAP Manager — Sharp Electronics (M) Sdn Bhd (Mar 2015 – Dec 2016) Supported regional subsidiaries. PROJECT PROFILE Year: 2015-2016 Client: Sharp Electronics (M) Sdn Bhd Role: SAP Manager System: SAP ECC Highlights: Supported regional subsidiaries and managed SAP upgrades.",
});
assert.equal(
  employmentOnly.enterpriseProfile.projects.length,
  0,
  "an unnamed client fragment duplicating employment is not a project",
);

const projectTemplate = (id: string, client: string, start: string) => ({
  id,
  name: "SAP ERP ECC 6.0 Reimplementation for PSAK10",
  client,
  employer: "",
  industry: "",
  country: "",
  role: "FI/CO Team Member",
  modules: ["FICO"],
  projectType: "Implementation",
  implementationType: "Implementation",
  start,
  end: start,
  duration: null,
  responsibilities: ["Configured FI/CO for the named client."],
  teamSize: null,
  environment: "SAP ECC",
  evidenceState: "source_extracted" as const,
  fieldEvidence: {},
});
assert.equal(
  canonicalizeEnterpriseProjects([
    projectTemplate("latinusa", "PT Latinusa", "Jul 2012"),
    projectTemplate("khi", "PT KHI Pipe Industries", "Feb 2013"),
  ]).length,
  2,
  "same-titled projects remain distinct when client and dates differ",
);
assert.equal(
  canonicalizeEnterpriseProjects([
    projectTemplate("one", "PT Latinusa", "Jul 2012"),
    projectTemplate("two", "PT Latinusa", "Jul 2012"),
  ]).length,
  1,
  "duplicate fragments merge when assignment identity is the same",
);

assert.deepEqual(
  cleanEmploymentResponsibilities([
    "Yunanda Indra Permana has 3 years of SAP FI/CO experience and has successfully delivered multiple implementations.",
    "Configured FI/CO processes for the employer.",
  ]),
  ["Configured FI/CO processes for the employer."],
);
assert.deepEqual(
  cleanEmploymentResponsibilities([
    "OTHER SKILLS Excellent communication and collaboration skills. Microsoft Office, Visio, MYOB and ACCPAC.",
  ]),
  [],
);
assert.deepEqual(
  cleanProjectResponsibilities([
    "Company: Accenture Malaysia Sdn Bhd Position: SAP FI Analyst Client: Exxon Mobil Business Support Center Sdn Bhd. Responsibilities: Provided post-go-live FI application support.",
  ]),
  ["Provided post-go-live FI application support."],
);
const credential = credentialPresentation(
  "Solution Consultant mySAP Financials&Managerial Accounting 1 (TFIN10) - Genovate Training Academy (Kuala Lumpur) 2002-2003 [phone redacted]",
);
assert.doesNotMatch(JSON.stringify(credential), /redacted/i);
assert.match(credential.name, /Financials & Managerial Accounting 1/);
assert.equal(
  formatCandidateProfilePeriod("November 2008", "July 2009"),
  "Nov 2008 – Jul 2009",
);
assert.equal(formatCandidateProfilePeriod("2017", "2018"), "2017 – 2018");

const drawer = fs.readFileSync(
  "app/recruiter/talent-search/v2/CandidateDetailsDrawer.tsx",
  "utf8",
);
assert.match(drawer, /Project name not provided in source/);
assert.match(drawer, /event\.pointerType === "mouse"/);
assert.match(drawer, /event\.preventDefault\(\)/);
assert.match(drawer, /event\.detail > 0/);
assert.match(drawer, /event\.currentTarget\.blur\(\)/);
assert.match(drawer, /focus-visible:/);
assert.doesNotMatch(drawer, /From profile/);

console.log("Search V2 exact project identity semantics tests passed.");

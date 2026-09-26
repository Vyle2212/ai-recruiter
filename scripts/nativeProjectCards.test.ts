import assert from "node:assert/strict";
import { nativeProjectCards } from "../lib/nativeProjectCards";
import { normalizeActualCandidateSchema } from "../lib/candidate360SchemaNormalize";

const card = `Role: Application Specialist
Page 6 of 8

Project : Procurement Portal Support Team
Environment : SAP R3, SQL Server 2005
Client : Example Energy, Kuala Lumpur
Duration: May 2008 – Dec 2010
Roles & Responsibilities:
• Provide  application  support and operations functions.
`;
const source = `ACADEMIC QUALIFICATIONS
Computer Science
DETAILED WORK EXPERIENCES
${card}`;
const parsed = nativeProjectCards(source);
assert.equal(parsed.length, 1);
assert.equal(parsed[0].name, "Procurement Portal Support Team");
assert.equal(parsed[0].client, "Example Energy, Kuala Lumpur");
assert.equal(parsed[0].role, "Application Specialist");
assert.equal(parsed[0].start, "May 2008");
assert.equal(parsed[0].end, "Dec 2010");
const profile = normalizeActualCandidateSchema({
  raw_text: source,
}).enterpriseProfile;
assert.equal(profile.projects.length, 1);
assert.equal(profile.projects[0].name, parsed[0].name);
assert.equal(profile.projects[0].employer, "");
assert.equal(profile.projects[0].environment, "SAP R3, SQL Server 2005");
assert.equal(profile.projects[0].projectType, "Support / Enhancement");
for (const invalid of [
  source.replace("May 2008 – Dec 2010", "May 2012 – Dec 2010"),
  source.replace("May 2008 – Dec 2010", "Unknown"),
  source.replace("Client : Example Energy, Kuala Lumpur\n", ""),
  source.replace("Duration: May 2008 – Dec 2010\n", ""),
  source.replace("DETAILED WORK EXPERIENCES", "EDUCATION"),
  source.replace("Project :", "Responsibilities for Project :"),
])
  assert.equal(nativeProjectCards(invalid).length, 0);
const second = card
  .replace("Procurement Portal", "Finance Portal")
  .replace("Example Energy", "Example Manufacturing")
  .replace("May 2008 – Dec 2010", "Jan 2011 – Feb 2012");
const two = nativeProjectCards(source + second);
assert.equal(two.length, 2);
assert.equal(two[0].end, "Dec 2010");
assert.equal(two[1].start, "Jan 2011");
assert.equal(
  nativeProjectCards(
    source.replace("Duration: May 2008 – Dec 2010\n", "") + second,
  ).length,
  1,
);
assert.equal(nativeProjectCards(source + "REFERENCES\n" + second).length, 1);

const labelled = `PROJECTS
Project Name:
Finance Transformation
Client: Example Bank
Role: SAP FICO Consultant
Duration: Jan 2020 to Dec 2021
Responsibilities:
Configured SAP FICO and supported integration testing and cutover.
`;
const labelledCard = nativeProjectCards(labelled);
assert.equal(labelledCard.length, 1);
assert.equal(labelledCard[0].name, "Finance Transformation");
assert.equal(labelledCard[0].client, "Example Bank");
assert.equal(labelledCard[0].role, "SAP FICO Consultant");
assert.equal(labelledCard[0].start, "Jan 2020");
assert.equal(labelledCard[0].end, "Dec 2021");
assert.equal(
  nativeProjectCards(labelled.replace("Client: Example Bank\n", "")).length,
  0,
);
assert.equal(
  nativeProjectCards(
    labelled.replace("Jan 2020 to Dec 2021", "Jan 2022 to Dec 2021"),
  ).length,
  0,
);
const clientOnly = labelled
  .replace("PROJECTS", "PROJECT EXPERIENCE")
  .replace("Project Name:\nFinance Transformation\n", "");
assert.equal(nativeProjectCards(clientOnly).length, 1);
assert.equal(nativeProjectCards(clientOnly)[0].name, "");
const flattened = labelled.replace(/\n/g, " ");
assert.equal(nativeProjectCards(flattened).length, 0);
const flattenedUnderHeading = `PROJECT HISTORY\n${flattened}`;
assert.equal(nativeProjectCards(flattenedUnderHeading).length, 1);
assert.equal(
  nativeProjectCards(flattenedUnderHeading)[0].client,
  "Example Bank",
);
for (const delimiter of [" | ", "; ", "|", ";", "•"]) {
  const inline = [
    "Project: Finance Transformation",
    "End Client: Example Bank",
    "Role: SAP FICO Consultant",
    "Duration: Jan 2020 to Dec 2021",
    "Scope: SAP implementation, integration testing and cutover",
  ].join(delimiter);
  const cards = nativeProjectCards(`PROJECT HISTORY\n${inline}`);
  assert.equal(cards.length, 1);
  assert.equal(cards[0].name, "Finance Transformation");
  assert.equal(cards[0].client, "Example Bank");
  assert.equal(cards[0].role, "SAP FICO Consultant");
}
for (const [range, start, end] of [
  ["01/2020 to 12/2021", "01/2020", "12/2021"],
  ["2020-01 to 2021-12", "2020-01", "2021-12"],
  ["Jan'20 to Dec'21", "Jan'20", "Dec'21"],
  ["2020 to 2021", "2020", "2021"],
  ["Jan 2020 to Present", "Jan 2020", "Present"],
  ["Jan 2020 ~ Till date", "Jan 2020", "Till date"],
  ["Jan 2020 to To date", "Jan 2020", "To date"],
  ["Jan 2020 to Now", "Jan 2020", "Now"],
] as const) {
  const cards = nativeProjectCards(
    labelled.replace("Jan 2020 to Dec 2021", range),
  );
  assert.equal(cards.length, 1);
  assert.equal(cards[0].client, "Example Bank");
  assert.equal(cards[0].start, start);
  assert.equal(cards[0].end, end);
}
const canonicalPolluted = normalizeActualCandidateSchema({
  projects: [
    {
      project_name: "Finance Transformation•End",
      client:
        "Example Bank|Role: SAP FICO Consultant|Duration: Jan 2020 to Dec 2021",
      role: "SAP FICO Consultant|Duration: Jan 2020 to Dec 2021",
      start_date: "Jan 2020",
      end_date: "Dec 2021",
    },
  ],
}).enterpriseProfile.projects[0];
assert.equal(canonicalPolluted.name, "Finance Transformation");
assert.equal(canonicalPolluted.client, "Example Bank");
assert.equal(canonicalPolluted.role, "SAP FICO Consultant");

const multipleSapProjects = `PROFESSIONAL EXPERIENCE
Example Systems Ltd
SAP Consultant
Jan 2020 - Current
PROJECT HISTORY
Project: SAP FI Implementation
Client: Buyer One
Role: SAP FI Consultant
Duration: Jan 2020 - Dec 2021
Responsibilities: Configured FI implementation
Project: SAP FI Rollout
Client: Buyer Two
Role: SAP FI Consultant
Duration: Feb 2022 - Aug 2025
Responsibilities: Led SAP rollout`;
const distinctCards = nativeProjectCards(multipleSapProjects);
assert.deepEqual(
  distinctCards.map(({ client, start, end }) => [client, start, end]),
  [
    ["Buyer One", "Jan 2020", "Dec 2021"],
    ["Buyer Two", "Feb 2022", "Aug 2025"],
  ],
);
const multiProfile = normalizeActualCandidateSchema({
  raw_text: multipleSapProjects,
}).enterpriseProfile;
assert.deepEqual(
  multiProfile.projects
    .map(({ client, start, end }) => [client, start, end])
    .sort(),
  [
    ["Buyer One", "Jan 2020", "Dec 2021"],
    ["Buyer Two", "Feb 2022", "Aug 2025"],
  ],
);
assert.equal(multiProfile.employmentTimeline.length, 1);
assert.deepEqual(
  [
    multiProfile.employmentTimeline[0].company,
    multiProfile.employmentTimeline[0].title,
    multiProfile.employmentTimeline[0].start,
    multiProfile.employmentTimeline[0].end,
  ],
  ["Example Systems Ltd", "SAP Consultant", "Jan 2020", "Current"],
  "project end dates never replace the current employer's end",
);
assert.equal(multiProfile.employmentTimeline[0].current, true);
assert.deepEqual(
  multiProfile.projects.map((p) => p.responsibilities[0]).sort(),
  ["Configured FI implementation", "Led SAP rollout"],
);
const directProjectDates = normalizeActualCandidateSchema({
  raw_text:
    "SAP Consultant — Example Systems Ltd (Jan 2020 – Current) Client: Project Renewal | Buyer One (Jan 2020 – Dec 2021) Led SAP rollout.",
  projects: [
    {
      project_name: "Project Renewal",
      client: "Buyer One",
      employer: "Example Systems Ltd",
      role: "SAP Consultant",
      start_date: "Feb 2022",
      end_date: "Aug 2025",
      responsibilities: ["Led SAP enhancement"],
    },
  ],
}).enterpriseProfile.projects[0];
assert.deepEqual(
  [directProjectDates.start, directProjectDates.end],
  ["Feb 2022", "Aug 2025"],
);
assert.deepEqual(directProjectDates.fieldEvidence.dates?.value, [
  "Feb 2022",
  "Aug 2025",
]);
const repeatedProject = normalizeActualCandidateSchema({
  raw_text:
    "SAP Consultant — Example Systems Ltd (Jan 2020 – Current) Client: Project Renewal | Buyer One (Jan 2020 – Dec 2021) Led SAP rollout. Client: Project Renewal | Buyer One (Feb 2022 – Aug 2025) Led SAP enhancement.",
  projects: [
    {
      project_name: "Project Renewal",
      client: "Buyer One",
      employer: "Example Systems Ltd",
      role: "SAP Consultant",
    },
  ],
}).enterpriseProfile.projects[0];
assert.deepEqual(
  [repeatedProject.start, repeatedProject.end],
  ["", ""],
  "a repeated project name cannot borrow an arbitrary date range",
);
console.log("Native project card ownership and section boundaries: PASS");

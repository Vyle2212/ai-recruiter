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
console.log("Native project card ownership and section boundaries: PASS");

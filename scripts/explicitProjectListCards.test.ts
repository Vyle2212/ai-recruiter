import assert from "node:assert/strict";
import { explicitProjectListCards } from "../lib/explicitProjectListCards";
import { normalizeActualCandidateSchema } from "../lib/candidate360SchemaNormalize";

const source = `EMPLOYMENT HISTORY
Example Consulting Ltd – SAP Architect
Jan 2021 – Present
OTHER ROLES SAP Data Transformation Solution Architect, Data Lead
Project: Buyer One Group, January 2024 - Current
Project: Buyer Two (Project Alpha) September 2023 - Current
• Configured data migration and validation for both clients.
EDUCATION
Bachelor of Science`;
const cards = explicitProjectListCards(source);
assert.equal(cards.length, 2);
assert.deepEqual(cards.map(({start,end})=>[start,end]), [["January 2024","Current"],["September 2023","Current"]]);
const profile = normalizeActualCandidateSchema({raw_text:source}).enterpriseProfile;
assert.ok(profile.projects.some(project=>project.name === "Buyer One Group" && !project.employer && !project.client));
assert.ok(profile.employmentTimeline.every(job=>job.company !== "Buyer One Group" && job.company !== "Buyer Two"));
assert.deepEqual(explicitProjectListCards(source.replace("OTHER ROLES SAP Data Transformation Solution Architect, Data Lead", "OTHER ROLES")), []);
console.log("Explicit project list keeps projects separate from employers: PASS");

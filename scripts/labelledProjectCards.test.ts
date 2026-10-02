import assert from "node:assert/strict";
import { labelledProjectCards } from "../lib/labelledProjectCards";
import { normalizeActualCandidateSchema } from "../lib/candidate360SchemaNormalize";

const source=`EMPLOYMENT HISTORY
Example Delivery Ltd – SAP Consultant
Jan 2022 – Present
PROJECT EXPERIENCE
Project: SAP finance implementation
Client: Buyer One Ltd
Role: SAP FICO Consultant
Responsibilities: Configured FI/CO.
Project: SAP support rollout
Client: Buyer Two Ltd
Role: SAP MM Consultant
Project Duration: Jan 2023 – Dec 2023
EDUCATION
Bachelor of Science`;
const cards=labelledProjectCards(source);
assert.equal(cards.length,1);
assert.deepEqual(cards.map(card=>[card.client,card.start,card.end]),[["Buyer One Ltd","",""]]);
const profile=normalizeActualCandidateSchema({raw_text:source}).enterpriseProfile;
assert.ok(profile.projects.some(project=>project.client==="Buyer One Ltd"&&!project.start&&!project.end&&!project.employer));
assert.ok(profile.employmentTimeline.every(job=>!job.company.startsWith("Buyer")));
assert.deepEqual(labelledProjectCards(source.replace("Role: SAP FICO Consultant","Responsibilities: SAP FICO Consultant").replace("Role: SAP MM Consultant","Role: unsupported")),[]);
assert.deepEqual(labelledProjectCards(source.replace("Project Duration: Jan 2023 – Dec 2023","Project Duration: Jan 2023 – unknown")).map(card=>card.client),["Buyer One Ltd"]);
const aliases = source.replace("Project: SAP finance implementation", "Project Name: SAP finance implementation")
  .replace("Project: SAP support rollout", "Project Title: SAP support rollout");
assert.deepEqual(labelledProjectCards(aliases).map(card => [card.name, card.client, card.start, card.end]),
  [["SAP finance implementation", "Buyer One Ltd", "", ""]]);
const aliasProfile = normalizeActualCandidateSchema({raw_text: aliases}).enterpriseProfile;
assert.ok(aliasProfile.projects.some(project => project.client === "Buyer One Ltd" && !project.employer && !project.start));
assert.ok(aliasProfile.employmentTimeline.every(job => !job.company.startsWith("Buyer")));
const adjacentClients = `PROJECT EXPERIENCE
Project Name: Finance deployment
Client: Buyer One Ltd
Role: SAP FICO Consultant
Client: Buyer Two Ltd
Role: SAP MM Consultant
Duration: Jan 2023 - Dec 2023`;
assert.deepEqual(labelledProjectCards(adjacentClients).map(card => [card.client, card.start, card.end]),
  [["Buyer One Ltd", "", ""]], "a later client's dates cannot be borrowed by the first project");
const partialDates = `PROJECT EXPERIENCE
Project Title: Finance deployment
Client: Buyer One Ltd
Role: SAP FICO Consultant
Start Date: Jan 2023`;
assert.deepEqual(labelledProjectCards(partialDates), [], "a partial explicit date card stays under review");
console.log("Explicit project cards preserve source boundaries: PASS");

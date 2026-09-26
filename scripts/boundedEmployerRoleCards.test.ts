import assert from "node:assert/strict";
import { boundedEmployerRoleCards } from "../lib/boundedEmployerRoleCards";
import { normalizeActualCandidateSchema } from "../lib/candidate360SchemaNormalize";

const projectDetails = "WORK EXPERIENCE & PROJECT DETAILS: SAP PS Lead @ Example Systems, Malaysia (4 months, Jan 2022-Apr 2022) Key Role, Responsibilities & Scope: Client: Buyer Industries, Malaysia. Project: SAP rollout (May 2022-Nov 2022). Sr. SAP Consultant @ Example Advice, UAE (8 months; May 2021-Dec 2021) Key Roles, Responsibilities & Scope: Client: Buyer Ltd. QUALIFICATION: BSc";
assert.deepEqual(boundedEmployerRoleCards(projectDetails).map(({company,title,start,end}) => ({company,title,start,end})), [
  {company:"Example Systems",title:"SAP PS Lead",start:"Jan 2022",end:"Apr 2022"},
  {company:"Example Advice",title:"Sr. SAP Consultant",start:"May 2021",end:"Dec 2021"},
]);
assert.deepEqual(boundedEmployerRoleCards("WORK EXPERIENCE & PROJECT DETAILS: SAP Consultant @ Example Systems, Malaysia (4 months; Sep 2018-March2019) Key Roles, Responsibilities & Scope: delivered consulting").map(({start,end}) => ({start,end})), [{start:"Sep 2018",end:"March 2019"}]);
const profile = normalizeActualCandidateSchema({raw_text:projectDetails}).enterpriseProfile;
assert.equal(profile.employmentTimeline.length, 2);
assert.equal(profile.employmentTimeline.some(row => /Buyer/.test(row.company)), false);

const bullets = "WORK EXPERIENCE Manager, SuccessFactors AMS Example Advisory, Kuala Lumpur, Malaysia May 2023-Present - Led support for Buyer Corp.  SAP SuccessFactors Senior Consultant Example Technology, Dubai, UAE Jan 2021-Apr 2023 Delivered payroll integrations for clients.  Client: Buyer Corp, India May 2020-Dec 2020 SAP Consultant.  Technical Associate – Software Testing Example Services Ltd, Pune, India Dec 2010-Feb 2013 Provided QA for clients. EDUCATION: Degree";
assert.deepEqual(boundedEmployerRoleCards(bullets).map(({company,title,start,end}) => ({company,title,start,end})), [
  {company:"Example Advisory",title:"Manager, SuccessFactors AMS",start:"May 2023",end:"Present"},
  {company:"Example Technology",title:"SAP SuccessFactors Senior Consultant",start:"Jan 2021",end:"Apr 2023"},
  {company:"Example Services Ltd",title:"Technical Associate – Software Testing",start:"Dec 2010",end:"Feb 2013"},
]);
assert.deepEqual(boundedEmployerRoleCards("PROJECT EXPERIENCE SAP Consultant @ Buyer Ltd, Malaysia (Jan 2020-Feb 2020) Key Roles, Responsibilities & Scope: client work"), []);
assert.deepEqual(boundedEmployerRoleCards("WORK EXPERIENCE & PROJECT DETAILS: SAP Consultant @ Buyer Ltd, Malaysia (Mar 2023-Feb 2022) Key Roles, Responsibilities & Scope: invalid dates"), []);
assert.deepEqual(boundedEmployerRoleCards("WORK EXPERIENCE & PROJECT DETAILS: SAP Consultant @ Buyer Ltd, Malaysia (Mar 2023-Feb 2024) Client: Example Corp. Key Roles, Responsibilities & Scope: not an employer card"), []);
assert.deepEqual(boundedEmployerRoleCards("WORK EXPERIENCE Consultant Example Ltd, Dubai, UAE Jan 2020-Feb 2021.  Buyer Ltd, Dubai, UAE Mar 2021-Apr 2022 duties").map(row => row.company), ["Example Ltd"]);
const employerHeadings = "Work Experience: Example Systems – Kuala Lumpur, Malaysia, India Duration: Nov 2024 – Till date SAP FI/CO Specialist Project#15: Client: Buyer Finance. Project: rollout Duration: Nov 2024 to Till date Project Description: Client duties. Example Advice - Hyderabad, India Duration: Aug 2021 – Dec 2023 Senior Consultant Project #12: Client: Other Buyer. Project: upgrade Duration: Jun 2023 to Nov 2023 Project Description: duties. Education: degree";
assert.deepEqual(boundedEmployerRoleCards(employerHeadings).map(({company,title,start,end}) => ({company,title,start,end})), [
  {company:"Example Systems",title:"SAP FI/CO Specialist",start:"Nov 2024",end:"Present"},
  {company:"Example Advice",title:"Senior Consultant",start:"Aug 2021",end:"Dec 2023"},
]);
assert.deepEqual(boundedEmployerRoleCards("Work Experience: Client: Buyer Ltd - Kuala Lumpur, Malaysia Duration: Jan 2020 - Feb 2020 SAP Consultant Project#1: Assignment only"), []);
console.log("Bounded employer role cards, project/client and date isolation: PASS");

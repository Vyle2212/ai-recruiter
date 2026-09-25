import assert from "node:assert/strict";
import { boundedCareerTables } from "../lib/boundedCareerTables";
import { companyDurationRoleCards, datedRoleCompanyCards, labelledEmploymentFieldCards, multilineEmploymentTriples } from "../lib/boundedEmploymentFieldCards";
import { extractCanonicalEmploymentFromResume } from "../lib/candidate360Employment";

const headed = `Professional Experience: Company Name Designation Client Duration
Example Advice Sdn Bhd, Malaysia Senior SAP Consultant Buyer One May 2015 to Till Date
Example Technology Sdn Bhd SAP FI Consultant Buyer Two Sept 2013 to Feb 2014
Buyer Three SAP FI Consultant Buyer Three Feb 2014 to Sept 2014
Example Staffing Ltd FI Analyst Buyer Four May 2012 to Oct 2012
PROJECT DETAILS Company Buyer Five Designation Consultant Client Buyer Duration Jan 2001 to Dec 2001`;
assert.deepEqual(boundedCareerTables(headed).map(x => [x.company, x.start, x.end]), [
  ["Example Technology Sdn Bhd", "Sept 2013", "Feb 2014"],
  ["Example Staffing Ltd", "May 2012", "Oct 2012"],
]);
assert.equal(boundedCareerTables(headed).some(x => x.company.includes("Buyer")), false);
assert.equal(boundedCareerTables(headed).some(x => x.end === "Present"), false);
assert.deepEqual(boundedCareerTables("Project Experience: Company Name Designation Client Duration Example Advice Ltd SAP Consultant Buyer Jan 2013 to Feb 2014"), []);
assert.deepEqual(boundedCareerTables("Professional Experience: Company Name Designation Client Duration Example Advice Ltd SAP Consultant Buyer Dec 2014 to Feb 2014"), []);
assert.deepEqual(boundedCareerTables("Professional Experience: Company Name Designation Client Duration Example Advice Ltd Buyer Jan 2013 to Feb 2014"), []);

const dated = `Work Details September 2021 – now Role: Senior SAP Consultant Company: Example Consultancy (IT company) Duties: ongoing.
December 2017 – June 2021 Role: SAP FI Consultant Company: Example Systems (consulting company) Duties: delivered.
May 2013 – February 2017 Role: ERP Consultant Company: Example Advisory (IT company) Duties: delivered.
Project Experience January 2011 – February 2012 Role: SAP Consultant Company: Buyer (IT company) Duties: client project only.`;
assert.deepEqual(datedRoleCompanyCards(dated).map(x => x.company), ["Example Systems (consulting company)", "Example Advisory (IT company)"]);
assert.deepEqual(datedRoleCompanyCards(dated + " " + dated).map(x => x.company), ["Example Systems (consulting company)", "Example Advisory (IT company)"]);
assert.deepEqual(datedRoleCompanyCards("Project Experience December 2017 – June 2021 Role: SAP Consultant Company: Buyer (IT company) Duties: project. May 2013 – February 2017 Role: SAP Consultant Company: Buyer Two (IT company) Duties: project."), []);
assert.deepEqual(datedRoleCompanyCards("Work Details December 2017 – June 2021 Role: SAP Consultant Client: Buyer Company: Example Consulting (IT company) Duties: assignment. May 2013 – February 2017 Role: SAP Consultant Company: Buyer Details: not an employer."), []);

const duration = `Professional Working Experience
Company: Example Services Duration: Jan 2018 – Current Project: support Role: SAP Consultant Responsibilities: duties.
Company: Example Advice Duration: Jan 2016 – Dec 2017 Project: implementation Role: SAP MM Consultant Responsibilities: duties.
Company: Example Third Sdn Bhd Duration: Aug 2015 – Dec 2015 Role: SAP FICO Consultant Responsibilities: duties.
Company: Buyer Client Duration: May 2014 – Feb 2015 Project: one Role: SAP Consultant Responsibilities: client.
Company: Example Fourth Duration: May 2014 – Feb 2015 Project: two Role: SAP Consultant Responsibilities: concurrent.
Education: degree`;
assert.deepEqual(companyDurationRoleCards(duration).map(x => [x.company, x.start]), [
  ["Example Advice", "Jan 2016"], ["Example Third Sdn Bhd", "Aug 2015"],
]);
assert.deepEqual(companyDurationRoleCards("Project Experience Company: Buyer Duration: Jan 2016 – Dec 2017 Project: rollout Role: SAP Consultant Responsibilities: customer only."), []);
assert.deepEqual(companyDurationRoleCards("Professional Working Experience Company: Example Services Duration: Dec 2017 – Jan 2017 Role: SAP Consultant Responsibilities: reversed."), []);
assert.deepEqual(companyDurationRoleCards("Professional Working Experience Company: Example Services Duration: Jan 2017 – Dec 2017 Role: Responsibilities: no owned role."), []);

const labelled = `EMPLOYMENT HISTORY
Company: Example Alpha Sdn Bhd
Position: Senior SAP FICO Consultant
Duration: Jan 2020 - Present
Client: Synthetic Bank
Company Name: Example Beta Pte Ltd
Designation: SAP Analyst
Period: Mar 2017 - Dec 2019
PROJECT EXPERIENCE
Company: Synthetic Customer Ltd
Role: SAP Consultant
Duration: Jan 2021 - Dec 2022`;
assert.deepEqual(labelledEmploymentFieldCards(labelled).map(item => [item.company, item.title, item.start, item.end]), [
  ["Example Alpha Sdn Bhd", "Senior SAP FICO Consultant", "Jan 2020", "Present"],
  ["Example Beta Pte Ltd", "SAP Analyst", "Mar 2017", "Dec 2019"],
]);
assert.deepEqual(labelledEmploymentFieldCards("PROJECT EXPERIENCE Company: Synthetic Customer Ltd Role: SAP Consultant Duration: Jan 2021 - Dec 2022"), []);
assert.deepEqual(labelledEmploymentFieldCards("EMPLOYMENT HISTORY Company: Example Reversed Ltd Role: SAP Consultant Duration: Dec 2024 - Jan 2024"), []);
assert.deepEqual(labelledEmploymentFieldCards("EMPLOYMENT HISTORY Company: Example Numeric Ltd Role: SAP Consultant Period: 03/2019 - 12/2022").map(item => [item.company, item.title, item.start, item.end]), [
  ["Example Numeric Ltd", "SAP Consultant", "03/2019", "12/2022"],
]);
assert.deepEqual(labelledEmploymentFieldCards("Employer: Example Standalone Ltd Role: SAP Consultant Date Joined: Jan 2020 Date Left: Dec 2022").map(item => [item.company, item.title]), [
  ["Example Standalone Ltd", "SAP Consultant"],
]);
assert.deepEqual(labelledEmploymentFieldCards("Company: Synthetic Customer Ltd Role: SAP Consultant Duration: Jan 2021 - Dec 2022"), []);

const multiline = `WORK EXPERIENCE
Example Alpha Sdn Bhd
Senior SAP FICO Consultant
Jan 2020 - Present
Example Beta Pte Ltd
SAP Analyst
Mar 2017 - Dec 2019
PROJECT EXPERIENCE
Synthetic Customer Ltd
SAP Consultant
Jan 2021 - Dec 2022`;
assert.deepEqual(multilineEmploymentTriples(multiline).map(item => [item.company, item.title, item.start, item.end]), [
  ["Example Alpha Sdn Bhd", "Senior SAP FICO Consultant", "Jan 2020", "Present"],
  ["Example Beta Pte Ltd", "SAP Analyst", "Mar 2017", "Dec 2019"],
]);
assert.deepEqual(multilineEmploymentTriples("PROJECT EXPERIENCE\nSynthetic Customer Ltd\nSAP Consultant\nJan 2021 - Dec 2022"), []);
assert.deepEqual(multilineEmploymentTriples("WORK EXPERIENCE\nClient: Synthetic Customer Ltd\nSAP Consultant\nJan 2021 - Dec 2022"), []);
assert.deepEqual(multilineEmploymentTriples("WORK EXPERIENCE\nExample Reversed Ltd\nSAP Consultant\nDec 2024 - Jan 2024"), []);
assert.deepEqual(multilineEmploymentTriples("WORK EXPERIENCE\nCompany: Example Labelled Systems Ltd\nPosition: SAP Basis Administrator\nJan 2018 - Dec 2020").map(item => [item.company, item.title]), [
  ["Example Labelled Systems Ltd", "Position: SAP Basis Administrator"],
]);

const canonical = extractCanonicalEmploymentFromResume(duration);
assert.deepEqual(canonical.map(x => [x.company, x.start]), [
  ["Example Advice", "Jan 2016"], ["Example Third Sdn Bhd", "Aug 2015"],
]);
console.log("bounded career table and employment field cards: PASS");

import assert from "node:assert/strict";
import { boundedCareerSummary } from "../lib/boundedCareerSummary";
import { normalizeActualCandidateSchema } from "../lib/candidate360SchemaNormalize";

const workSummary = "WORK SUMMARY Example Advisory Malaysia – Senior Consultant (July 2023 to till to date). Example Technology. – Senior Software Engineer (January - 2020 to November - 2021). Example Machinery Pvt. Ltd. – SAP Core User & Senior Design Engineer (April - 2013 to February - 2016) Handled Project Details Client: Buyer Ltd Role: SAP Consultant (March 2017 to April 2018).";
assert.deepEqual(boundedCareerSummary(workSummary).map(({company,title,start,end})=>({company,title,start,end})), [
  {company:"Example Advisory Malaysia",title:"Senior Consultant",start:"July 2023",end:"Present"},
  {company:"Example Technology",title:"Senior Software Engineer",start:"January 2020",end:"November 2021"},
  {company:"Example Machinery Pvt. Ltd",title:"SAP Core User & Senior Design Engineer",start:"April 2013",end:"February 2016"},
]);
const summaryProfile = normalizeActualCandidateSchema({raw_text:workSummary}).enterpriseProfile;
assert.equal(summaryProfile.employmentTimeline.length,3);
assert.equal(summaryProfile.employmentTimeline.find(row=>row.title.includes("Core User"))?.start,"April 2013");
assert.equal(summaryProfile.experienceSummary.sapExperienceYears || 0,0,"core-user and generic roles do not add SAP delivery years");

const progression = "CAREER PROGRESSION Example Minerals Asia Pacific, Kuala Lumpur, Malaysia - Nov 2022 - Present SAP Project Management & SAP MM Solution Lead Example Data Solutions, Mumbai - June 2018 - April 2020 SAP Sr. Functional Consultant Example Cement Ltd - Feb 2012 - Sept 2012 Senior Manager – IT & ERP Detailed Work Experience: Client: Buyer Ltd - Jan 2020 - Jan 2021 SAP Consultant";
assert.deepEqual(boundedCareerSummary(progression).map(({company,title,start,end})=>({company,title,start,end})), [
  {company:"Example Minerals Asia Pacific",title:"SAP Project Management & SAP MM Solution Lead",start:"Nov 2022",end:"Present"},
  {company:"Example Data Solutions",title:"SAP Sr. Functional Consultant",start:"June 2018",end:"April 2020"},
  {company:"Example Cement Ltd",title:"Senior Manager – IT & ERP",start:"Feb 2012",end:"Sept 2012"},
]);

const experiences = "EXPERIENCES IT Coordinator – SAP FICO Example Steel Centre Sdn. Bhd. (March 2016 – Present) Responsibilities: Supported finance. SAP CO Analyst Example Global Services Asia Sdn. Bhd (April 2013 – November 2014) Responsibilities: Configured SAP. Project Experience: Project Consultant – Buyer Holdings Ltd (January 2012 – February 2013)";
assert.deepEqual(boundedCareerSummary(experiences).map(({company,title,start,end})=>({company,title,start,end})), [
  {company:"Example Steel Centre Sdn. Bhd",title:"IT Coordinator – SAP FICO",start:"March 2016",end:"Present"},
  {company:"Example Global Services Asia Sdn. Bhd",title:"SAP CO Analyst",start:"April 2013",end:"November 2014"},
]);

const background = "PROFESSIONAL BACKGROUND 1. Example Outsourcing Sdn. Bhd., Selangor Darul Ehsan, Malaysia. Position Title : Senior SAP ABAP Consultant Joined Since : June 2012 (formerly Example Legacy Sdn. Bhd.) Job Description : Delivered support. 2. Example Technologies Sdn. Bhd., Kuala Lumpur, Malaysia. Position Title : Senior SAP ABAP Consultant Date Joined : June 2008 Date Left : May 2012 Job Description : Delivered projects. 3. Buyer Client Ltd. Position Title: SAP Consultant Date Joined: April 2007 Job Description: missing end.";
assert.deepEqual(boundedCareerSummary(background).map(({company,title,start,end})=>({company,title,start,end})), [
  {company:"Example Outsourcing Sdn. Bhd",title:"Senior SAP ABAP Consultant",start:"June 2012",end:""},
  {company:"Example Technologies Sdn. Bhd",title:"Senior SAP ABAP Consultant",start:"June 2008",end:"May 2012"},
]);

assert.deepEqual(boundedCareerSummary("PROJECT EXPERIENCE Example Client Ltd – SAP Consultant (Jan 2020 - Jan 2021)"),[]);
assert.deepEqual(boundedCareerSummary("WORK SUMMARY Example Services Ltd – SAP Consultant (Jan 2022 - Jan 2020)."),[]);
assert.deepEqual(boundedCareerSummary("CAREER PROGRESSION Client: Buyer Ltd - Jan 2020 - Jan 2021 SAP Consultant"),[]);
assert.deepEqual(boundedCareerSummary("PROFESSIONAL BACKGROUND 1. Example Ltd. Position Title: SAP Consultant Date Joined: Jan 2020 Job Description: no end"),[]);

console.log("Bounded repeated career summaries and operational SAP-user exclusions: PASS");

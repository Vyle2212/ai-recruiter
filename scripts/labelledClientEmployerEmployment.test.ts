import assert from "node:assert/strict";
import { extractCanonicalEmploymentFromResume } from "../lib/candidate360Employment";

const rows = extractCanonicalEmploymentFromResume(
  "WORK EXPERIENCE DURATION: FEB/25 TILL DATE CLIENT: Example Buyer (Retail) COMPANY: Example Consulting GROUP ROLE Candidate was assigned as a Senior Consultant (SAP MM) RESPONSIBILITIES Led delivery. " +
    "DURATION: OCT/19 TO APR/20 CLIENT: Example Energy COMPANY: Example Technical ROLE Candidate was assigned as a SAP MM Functional Consultant RESPONSIBILITIES Configured SAP. " +
    "DURATION: AUG/10 TO SEP/12 CLIENT: Example Supplier COMPANY: Example Manufacturing ROLE Clerk of Work RESPONSIBILITIES Documented construction. " +
    "DURATION: MAY/06 JULY/10 CLIENT: Example Buyer COMPANY: Example Group ROLE Sales Engineer RESPONSIBILITIES Sold products. PROJECT SUMMARY " +
    "DURATION: JAN/20 TO FEB/20 CLIENT: Example Client COMPANY: Example Project ROLE SAP Consultant RESPONSIBILITIES Project detail.",
);
assert.deepEqual(
  rows.map(({ company, title, start, end, current }) => ({
    company, title, start, end, current,
  })),
  [
    { company: "Example Consulting GROUP", title: "Senior Consultant (SAP MM)", start: "FEB 2025", end: "Present", current: true },
    { company: "Example Technical", title: "SAP MM Functional Consultant", start: "OCT 2019", end: "APR 2020", current: false },
    { company: "Example Manufacturing", title: "Clerk of Work", start: "AUG 2010", end: "SEP 2012", current: false },
  ],
);
assert.equal(
  extractCanonicalEmploymentFromResume(
    "PROJECT EXPERIENCE DURATION: FEB/25 TILL DATE CLIENT: Example Buyer COMPANY: Example Supplier ROLE SAP Consultant RESPONSIBILITIES Project work.",
  ).length,
  0,
  "A project-only table cannot supply employment",
);
assert.equal(
  extractCanonicalEmploymentFromResume(
    "WORK EXPERIENCE DURATION: FEB/25 TILL DATE CLIENT: Example Buyer ROLE SAP Consultant RESPONSIBILITIES Project work.",
  ).length,
  0,
  "The client is never used as a fallback employer",
);
assert.equal(
  extractCanonicalEmploymentFromResume(
    "WORK EXPERIENCE DURATION: FEB/25 TILL DATE CLIENT: Example Buyer COMPANY: Example Consulting ROLE SAP Consultant RESPONSIBILITIES Owns project. DURATION: MAY/26 TO APR/26 CLIENT: Example Other COMPANY: Example Group ROLE Analyst RESPONSIBILITIES Invalid date.",
  ).length,
  1,
  "The second row cannot donate its role or reverse-date range to the first",
);
assert.deepEqual(
  extractCanonicalEmploymentFromResume(
    "WORK EXPERIENCE DURATION: JAN/21 TO MAR/21 CLIENT: Example Buyer " +
      "DURATION: APR/21 TO MAY/21 CLIENT: Example Supplier COMPANY: Example Consultancy " +
      "ROLE SAP Consultant RESPONSIBILITIES Implemented SAP.",
  ).map(({ company, start, end }) => ({ company, start, end })),
  [{ company: "Example Consultancy", start: "APR 2021", end: "MAY 2021" }],
  "A missing Company in one row must never borrow the next row's employer",
);
console.log("Labelled client/employer employment boundaries: passed");

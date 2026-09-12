import assert from "node:assert/strict";
import {
  isPlausibleCandidateName,
  normalizeActualCandidateSchema,
} from "../lib/candidate360SchemaNormalize";

const normalizeName = (name: string, rawText: string) =>
  normalizeActualCandidateSchema({
    id: `fixture-${name}`,
    name,
    raw_text: rawText,
  }).enterpriseProfile.identity.name;

assert.equal(
  normalizeName(
    "Naveen Kumar Age",
    "CANDIDATE REF DATE: MAY 2025 Position: SAP Project Manager Name: Naveen Kumar Age: 38 years old Nationality: Malaysian",
  ),
  "Naveen Kumar",
  "a following Age field is a bounded label, not part of the person name",
);
assert.equal(
  normalizeName(
    "Nicholas Chang Role",
    "Nicholas Chang Name: Nicholas Chang Role: SAP HANA Professional Consultant Years of SAP Experience: 8",
  ),
  "Nicholas Chang",
  "a following Role field is a bounded label, not part of the person name",
);
assert.equal(
  normalizeName(
    "Samsol Bin Awang Role",
    "REFEREE Name: Samsol Bin Awang Role: Supervisor Company: Webe Digital Sdn Bhd",
  ),
  "",
  "a referee identity must never become the candidate identity",
);
assert.equal(
  normalizeName(
    "Weir Minerals March",
    "WORKING EXPERIENCE Company Name: Weir Minerals March 2015 – Present Role: SAP Data Consultant",
  ),
  "",
  "an employer and employment month must never become the candidate identity",
);
assert.equal(
  normalizeName(
    "Folie A Trois Solution Position",
    "Company Name: Folie A Trois Solution Position: Game Developer Duration: January 2022 to December 2022",
  ),
  "",
  "an organization and Position boundary must never become the candidate identity",
);
assert.equal(
  normalizeName(
    "And Driving High-impact Digital Outcomes.",
    "MOHAMED SHAKEER ABDUL RAHIM | SAP Senior Consultant | ERP Solutions Leader | Project Manager | Petaling Jaya, Selangor, Malaysia Client: Jollibee Food Corporation",
  ),
  "MOHAMED SHAKEER ABDUL RAHIM",
  "a malformed database name must yield to an explicitly bounded CV identity header",
);
assert.equal(isPlausibleCandidateName("Naveen Kumar Age"), false);
assert.equal(isPlausibleCandidateName("Weir Minerals March"), false);
assert.equal(isPlausibleCandidateName("A challenging"), false);
assert.equal(
  isPlausibleCandidateName("Khairolridzuan Jun"),
  true,
  "a directly sourced name is not rejected solely because a surname is also a month abbreviation",
);

console.log("Search V2 bounded canonical identity regressions passed.");

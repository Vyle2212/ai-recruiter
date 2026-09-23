import assert from "node:assert/strict";
import {
  canonicalEmploymentTimeline,
  extractCanonicalEmploymentFromResume,
} from "../lib/candidate360Employment";

const consulting = extractCanonicalEmploymentFromResume(
  "WORK EXPERIENCE EXAMPLE CONSULTING, INDONESIA SAP MM CONSULTANT – FREELANCE JOB ALPHA – BETA - as MM Consultant (Apr 2024 – Aug 2024) SAP AMS PROJECT – SAP SUPPORT",
);
assert.deepEqual(
  consulting.map(({ company, title, start, end }) => ({
    company,
    title,
    start,
    end,
  })),
  [
    {
      company: "EXAMPLE CONSULTING",
      title: "INDONESIA SAP MM CONSULTANT",
      start: "Apr 2024",
      end: "Aug 2024",
    },
  ],
  "a dated freelance client assignment must not become a second employer",
);
assert.equal(
  extractCanonicalEmploymentFromResume(
    "PROJECT EXPERIENCE SAP MM Consultant – Freelance Job Client Alpha – Client Beta - as MM Consultant (Apr 2024 – Aug 2024)",
  ).length,
  0,
  "a project-only assignment supplies no employer",
);

const roles = extractCanonicalEmploymentFromResume(
  "Employment History 4. Jan 2008 until May 2008 Company : Example Resort Bhd. Job position : Casino Dealer Responsibility : - card games dealer - Learn customer services 5. Jan 2006 until March 2006 Company : Example Apparel Sdn. Bhd. Job Position : Part time sales assistant Responsibility: - Promote products to customers",
);
assert.deepEqual(
  roles.map((row) => row.title),
  ["Casino Dealer", "Part time sales assistant"],
);

const duplicates = extractCanonicalEmploymentFromResume(
  "Employment History Senior SAP HCM Consultant - Lead at Example Consulting SG – Example Delivery S/B, Singapore May 2017 — October 2017 Lead consultant for SAP HCM SAP HR Consultant at Example Partner Sdn Bhd, Kuala Lumpur March 2008 — July 2010",
);
assert.equal(duplicates.length, 2);
assert.equal(
  duplicates[0].company,
  "Example Consulting SG – Example Delivery S/B",
);
assert.equal(duplicates[0].title, "Senior SAP HCM Consultant - Lead");
assert.ok((duplicates[0].provenance?.length || 0) >= 2);
assert.equal(duplicates[1].company, "Example Partner Sdn Bhd");
assert.ok((duplicates[1].provenance?.length || 0) >= 2);

const differentRoles = extractCanonicalEmploymentFromResume(
  "Employment History Senior SAP HCM Consultant at Example Partner Sdn Bhd, Singapore May 2017 — October 2017 SAP HR Analyst at Example Partner Sdn Bhd, Singapore May 2017 — October 2017",
);
assert.equal(
  differentRoles.length,
  2,
  "different titles with the same employer and dates remain distinct",
);
const differentCities = canonicalEmploymentTimeline({
  structuredRecords: ["Singapore", "Bangkok"].map((city) => ({
    record: {
      company: `Example Partner, ${city}`,
      title: "SAP Consultant",
      start_date: "Jan 2020",
      end_date: "Dec 2020",
    },
    sourceRef: `structured.${city}`,
  })),
  resumeText: "",
  currentRole: { title: "", company: "", location: "", start: "", end: "" },
});
assert.equal(
  differentCities.length,
  2,
  "distinct stated cities must not be silently consolidated",
);
console.log("Career source ownership and role boundary regression: passed");

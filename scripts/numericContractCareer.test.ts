import assert from "node:assert/strict";
import { extractCanonicalEmploymentFromResume as read } from "../lib/candidate360Employment";
import { boundedEmploymentBatch as bounded } from "../lib/boundedEmploymentBatch";
import {
  normalizeActualCandidateSchema,
  CANDIDATE_CANONICAL_VERSION,
  CANDIDATE_DETAIL_PROJECTION_VERSION,
  CANDIDATE_EXPERIENCE_EXTRACTOR_VERSION,
  CANDIDATE_PROJECT_EXTRACTOR_VERSION,
} from "../lib/candidate360SchemaNormalize";
const tuples = (text: string) =>
  read(text).map((r) => [
    r.company,
    r.title,
    r.start.toLowerCase(),
    r.end.toLowerCase(),
  ]);
for (const [start, end, expectedStart, expectedEnd] of [
  ["01/2019", "04/2021", "Jan 2019", "Apr 2021"],
  ["2019-01", "2021-04", "Jan 2019", "Apr 2021"],
  ["2019-1", "2021-4", "Jan 2019", "Apr 2021"],
  ["2019-01", "Present", "Jan 2019", "Present"],
])
  assert.deepEqual(
    tuples(
      `Work History Example Corporation Duration: ${start} - ${end} Position: SAP Consultant Tools & Systems: SAP`,
    ),
    [
      [
        "Example Corporation",
        "SAP Consultant",
        expectedStart.toLowerCase(),
        expectedEnd.toLowerCase(),
      ],
    ],
  );
for (const dates of [
  "2020-13 - 2022-02",
  "00/2020 - 02/2022",
  "2022-04 - 2020-01",
  "01/2020 -",
  "31/01/2020 - 30/04/2021",
  "2020-01-31 - 2021-04-30",
]) {
  assert.equal(
    bounded(
      `Work History Example Corporation Duration: ${dates} Position: SAP Consultant Tools & Systems: SAP`,
    ).filter((r) => r.group === "heading-duration-position-tools").length,
    0,
    dates,
  );
}
const contract =
  "SAP SD Senior Consultant (Contract) Example Sdn Bhd (for Buyer Sdn Bhd) Jul 2022 – Dec 2023";
assert.deepEqual(tuples(contract + " SAP System Support"), [
  [
    "Example Sdn Bhd",
    "SAP SD Senior Consultant (Contract)",
    "jul 2022",
    "dec 2023",
  ],
]);
assert.equal(
  bounded("Client: " + contract).filter(
    (r) => r.group === "contract-employer-client-annotation",
  ).length,
  0,
);
assert.equal(
  bounded(contract.replace("(Contract)", "")).filter(
    (r) => r.group === "contract-employer-client-annotation",
  ).length,
  0,
);
assert.equal(
  bounded(contract.replace("(for Buyer Sdn Bhd)", "(Client project)")).filter(
    (r) => r.group === "contract-employer-client-annotation",
  ).length,
  0,
);
assert.equal(
  bounded(contract.replace("Jul 2022 – Dec 2023", "Jul 2024 – Dec 2023"))
    .length,
  0,
);
assert.deepEqual(
  tuples(
    "Work Experience Year Description 2017 - Present SAP Supply Specialist Example Shared Service Centre MM consultant Responsible for implementation 2015 - 2016 SAP MM Functional Lead SECOND INTERNATIONAL Functional Lead for design Key Projects & Assignments 2001 - 2010 SAP Consultant Buyer Corporation Responsible for delivery",
  ),
  [
    [
      "Example Shared Service Centre",
      "SAP Supply Specialist",
      "2017",
      "present",
    ],
    ["SECOND INTERNATIONAL", "SAP MM Functional Lead", "2015", "2016"],
  ],
);
assert.equal(
  bounded(
    "Project Experience Year Description 2017 - Present SAP Supply Specialist Example Corporation MM consultant Responsible for delivery",
  ).filter((r) => r.group === "year-description-career-table").length,
  0,
);
// Simulate an older extractor's process-global cache surviving a hot reload.
const cache = (globalThis as any).__candidateCanonicalProjectionV42 as Map<
  string,
  unknown
>;
const raw = {
  id: "synthetic-versioned-cache",
  updated_at: "2026-01-01T00:00:00Z",
  raw_text:
    "Work History Example Corporation Duration: Jan 2020 - Dec 2022 Position: SAP Consultant Tools & Systems: SAP",
};
const obsolete = { obsolete: true };
cache.set(
  `${CANDIDATE_CANONICAL_VERSION}:${raw.id}:${raw.updated_at}`,
  obsolete,
);
const result = normalizeActualCandidateSchema(raw);
assert.notEqual(result, obsolete);
assert.equal(result.enterpriseProfile.employmentTimeline.length, 1);
const expectedKey = `${CANDIDATE_CANONICAL_VERSION}:${CANDIDATE_DETAIL_PROJECTION_VERSION}:${CANDIDATE_EXPERIENCE_EXTRACTOR_VERSION}:${CANDIDATE_PROJECT_EXTRACTOR_VERSION}:${raw.id}:${raw.updated_at}`;
assert.equal(cache.get(expectedKey), result);
assert.equal(normalizeActualCandidateSchema(raw), result);
cache.clear();

assert.deepEqual(
  tuples(
    "Professional Experience\nExample Savings Association, Inc\nOct 2023 - Dec 2023\nInternal Audit Intern\nConduct comprehensive background checks and verification processes to validate\napplicant information.\nProfessional Certificates",
  ),
  [
    [
      "Example Savings Association, Inc",
      "Internal Audit Intern",
      "oct 2023",
      "dec 2023",
    ],
  ],
);

const headerIdentity = normalizeActualCandidateSchema({
  raw_text:
    "EXAMPLE, SYNTHETIC C.\nQuezon City\nsynthetic@example.com\nProfessional Summary\nSAP FICO Consultant",
});
assert.equal(
  headerIdentity.enterpriseProfile.identity.name,
  "EXAMPLE, SYNTHETIC C.",
);
const unknownChronology = normalizeActualCandidateSchema({
  raw_text:
    "Work Experience\nExample Corporation\tJan 2019 - Dec 2020\nSAP Consultant\nRole\tSAP Project Lead\nEmployer\tSecond Corporation\nClient\tBuyer Corporation - Apr 2024 - Present\nProject\tImplementation",
});
assert.equal(unknownChronology.enterpriseProfile.identity.currentCompany, "");

console.log(
  "Numeric dates, contract ownership, bounded career table and versioned cache: PASS",
);

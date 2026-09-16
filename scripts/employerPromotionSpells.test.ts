import assert from "node:assert/strict";
import { extractCanonicalEmploymentFromResume as read } from "../lib/candidate360Employment";
const tuples = (text: string) =>
  read(text).map((j) => [
    j.company,
    j.title,
    j.start.toLowerCase(),
    j.end.toLowerCase(),
  ]);
const promotion = `WORK EXPERIENCE 1) Example Consulting Sdn Bhd (MALAYSIA) Company Description: A consulting firm. Length of Employment: 3 years 9 months (Nov 2013 – Jul 2017) SAP Senior Consultant (Jan 2016 – Jul 2017) Provided support. SAP Consultant (Nov 2013 – Dec 2015) Delivered projects. 2) Earlier Services Sdn Bhd (MALAYSIA) Company Description: A consulting firm. Length of Employment: 2 years (Mar 2011 – Feb 2013) SAP Junior Consultant (Mar 2011 – Feb 2013) EDUCATION SAP Consultant (Jan 2009 – Dec 2009)`;
assert.deepEqual(tuples(promotion), [
  [
    "Example Consulting Sdn Bhd",
    "SAP Senior Consultant",
    "jan 2016",
    "jul 2017",
  ],
  ["Example Consulting Sdn Bhd", "SAP Consultant", "nov 2013", "dec 2015"],
  ["Earlier Services Sdn Bhd", "SAP Junior Consultant", "mar 2011", "feb 2013"],
]);
assert.equal(
  tuples(
    promotion.replace(
      "SAP Senior Consultant (Jan 2016 – Jul 2017)",
      "SAP Senior Consultant (Jan 2016 – Dec 2018)",
    ),
  ).filter((j) => j[1] === "SAP Senior Consultant").length,
  0,
);
assert.equal(
  tuples(promotion.replaceAll("Length of Employment:", "Project duration:"))
    .length,
  0,
);
assert.deepEqual(
  tuples(
    "Worked in in Example India as a FICO Consultant from 05-2015 to 10/2017 Worked in Earlier Systems India.as a Associate consultant from 03/2014 to 05/2015",
  ),
  [
    ["Example India", "FICO Consultant", "may 2015", "oct 2017"],
    ["Earlier Systems India", "Associate consultant", "mar 2014", "may 2015"],
  ],
);
for (const period of [
  "13-2015 to 10/2017",
  "05-2019 to 10/2017",
  "01/05/2015 to 01/10/2017",
]) {
  assert.equal(
    tuples(`Worked in Example India as a FICO Consultant from ${period}`)
      .length,
    0,
  );
}
assert.deepEqual(
  tuples(
    "WORK EXPERIENCE Example Technology Sdn Bhd 2019-Present - SAP local IT consultant in PP & MM module. - Resolve user daily issues.",
  ),
  [
    [
      "Example Technology Sdn Bhd",
      "SAP local IT consultant",
      "2019",
      "present",
    ],
  ],
);
const heading = "EMPLOYMENT HISTORY/EXPERIENCE ";
const card =
  heading +
  "01.10.2017 till 31.10.2018 (Permanent) Senior SAP Consultant Employer : Example Sdn Bhd (formerly known as Previous Sdn Bhd) Client : Buyer Corporation";
assert.deepEqual(tuples(card), [
  ["Example Sdn Bhd", "Senior SAP Consultant", "1 oct 2017", "31 oct 2018"],
]);
assert.equal(tuples(card.replace("01.10.2017", "31.02.2017")).length, 0);
assert.equal(tuples(card.replace("Employer :", "Customer :")).length, 0);
assert.equal(tuples(card.replace(heading, "PROJECT EXPERIENCE ")).length, 0);
const spells =
  heading +
  "May 2015 till 31.08.2016 (Professional Contract) 01.09.2016 till 30.09.2017 (Permanent) Senior SAP Consultant Employer : Example Services Client : Buyer Corporation";
assert.deepEqual(tuples(spells), [
  ["Example Services", "Senior SAP Consultant", "1 sep 2016", "30 sep 2017"],
  ["Example Services", "Senior SAP Consultant", "may 2015", "31 aug 2016"],
]);
console.log(
  "Employer promotion spans, numeric statements and contract spells: PASS",
);

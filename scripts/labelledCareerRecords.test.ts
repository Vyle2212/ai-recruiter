import assert from "node:assert/strict";
import { extractCanonicalEmploymentFromResume as read } from "../lib/candidate360Employment";
import { boundedEmploymentBatch } from "../lib/boundedEmploymentBatch";

// Synthetic representations of reviewed source families, never candidate data.
const tuples = (source: string) =>
  read(source).map((r) => [r.company, r.title, r.start, r.end]);
assert.deepEqual(
  tuples(
    "Career History (From) (To) (Description) Jan 2019 - Feb 2020 Example Corporation, Example City SAP Advisor March 2020 - April 2022 Second Corporation SAP Project Manager Project Experience Jan 2010 - Dec 2018 Buyer Corporation SAP Consultant",
  ),
  [
    ["Second Corporation", "SAP Project Manager", "March 2020", "April 2022"],
    ["Example Corporation", "SAP Advisor", "Jan 2019", "Feb 2020"],
  ],
);
assert.deepEqual(
  boundedEmploymentBatch(
    "Work Experience Example Corporation (formerly known as Previous Corporation) - Example City, Country April 2017 - Present Held multiple roles: Senior SAP Consultant Nov 2019 - Present",
  ).map((r) => [r.company, r.title, r.start, r.end]),
  [["Example Corporation", "", "April 2017", "Present"]],
);
assert.deepEqual(
  tuples(
    "Work History Example Corporation Duration: Jan 2020 - Dec 2022 Position Title (level): SAP Consultant Tools & Systems: SAP Project Client: Buyer Corporation Jan 2018 - Dec 2019",
  ),
  [["Example Corporation", "SAP Consultant", "Jan 2020", "Dec 2022"]],
);
const snapshot =
  "Career Snapshot Company: Example Corporation - Example City, Country Client: Buyer Corporation Position: Solution Lead & Project Manager – SAP HCM Duration: Jan 2020 till date Responsibilities: Delivery";
assert.deepEqual(tuples(snapshot), [
  [
    "Example Corporation",
    "Solution Lead & Project Manager – SAP HCM",
    "Jan 2020",
    "Present",
  ],
]);
assert.equal(read(snapshot)[0].location, "Example City, Country");
assert.deepEqual(
  tuples(
    "Professional Experience Worked as a “SAP Consultant” at Example Corporation from July 13th 2015 to July 1st 2016. Worked as “SAP Analyst” at Second Corporation from Jan 11 - Feb 14.",
  ),
  [
    ["Example Corporation", "SAP Consultant", "13 July 2015", "1 July 2016"],
    ["Second Corporation", "SAP Analyst", "Jan 2011", "Feb 2014"],
  ],
);
assert.deepEqual(
  tuples(
    "Professional Experience Year Designation Example Corporation 2020 - 2022 Project Manager Second Corporation 2018 - 2020 SAP Consultant Education",
  ),
  [
    ["Example Corporation", "Project Manager", "2020", "2022"],
    ["Second Corporation", "SAP Consultant", "2018", "2020"],
  ],
);
assert.deepEqual(
  tuples(
    "Professional Experience Year Designation Example Corporation 2020 - 2022 Project Manager for Brownfield Migrations Second Corporation 2018 - 2020 SAP Consultant Third Corporation 2016 - 2018 SAP Architect Education",
  ),
  [["Third Corporation", "SAP Architect", "2016", "2018"]],
);
// A labelled employer may survive as undated; reversed tenure is never repaired.
assert.deepEqual(
  tuples(
    "Career Snapshot Company: Example Corporation Position: SAP Consultant Duration: Jan 2025 - Jan 2024 Responsibilities: Delivery",
  ),
  [["Example Corporation", "SAP Consultant", "", ""]],
);
for (const source of [
  "Project Experience Company: Buyer Corporation Position: SAP Consultant Duration: Jan 2020 - Jan 2024 Responsibilities: Delivery",
  "Career History (From) (To) (Description) Jan 2025 - Jan 2024 Example Corporation SAP Consultant Project Details Jan 2020 - Jan 2022 Buyer Corporation SAP Analyst",
  "Work History Example Corporation Duration: Jan 2020 Position: SAP Consultant Tools & Systems: SAP Project Client: Buyer Corporation Jan 2018 - Dec 2019",
])
  assert.deepEqual(tuples(source), [], source);
// Expanding one prose range must not create a header-as-company row in a
// separate, already supported short-year table.
assert.deepEqual(
  tuples(
    "Employment History Date Company Name Role Jan 14 – Till date Example Services Consultant Nov 09 – Dec 13 Example Services Servicedesk Lead / Analyst Apr 08 – May 09 Second Services Sdn Bhd Customer Support ACADEMIC Qualifications",
  ),
  [
    ["Example Services", "Consultant", "Jan 2014", "Present"],
    ["Example Services", "Servicedesk Lead / Analyst", "Nov 2009", "Dec 2013"],
    ["Second Services Sdn Bhd", "Customer Support", "Apr 2008", "May 2009"],
  ],
);
console.log("labelled career records: PASS");

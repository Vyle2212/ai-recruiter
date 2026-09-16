import assert from "node:assert/strict";
import { exportedCareerEmployment as read } from "../lib/exportedCareerEmployment";
import {
  extractCanonicalEmploymentFromResume,
  employmentTimelineDiagnostics,
} from "../lib/candidate360Employment";

const text =
  "Career historySenior SAP consultant at Example Systems Sdn Bhd Jan 2022 - Present (4 years 0 months) SAP Consultant at Example Systems Sdn Bhd Jan 2019 - Dec 2021 (3 years) Business System Engineer 1 at Example Devices Mar 2017 - Dec 2018 (1 year 10 months) Responsibilities: Developed interfaces. EducationBachelor of Engineering from Example University Finished 2016 SkillsSAP";
const jobs = read(text);
assert.equal(jobs.length, 3);
assert.deepEqual(
  jobs.map((j) => [j.company, j.title, j.start, j.end]),
  [
    ["Example Systems Sdn Bhd", "Senior SAP consultant", "Jan 2022", "Present"],
    ["Example Systems Sdn Bhd", "SAP Consultant", "Jan 2019", "Dec 2021"],
    ["Example Devices", "Business System Engineer 1", "Mar 2017", "Dec 2018"],
  ],
);
assert.equal(
  read(text.replace("(4 years 0 months)", "(99 years)"))[0].start,
  "Jan 2022",
  "reported duration cannot change dates",
);
assert.equal(
  read(
    "Career history: Project Manager at Example Systems Jan. 2020 - Dec. 2022 (3 years) EducationDegree",
  ).length,
  1,
);
assert.equal(
  read(
    "Career historyAccountant at Example Finance Jan 2020 - Dec 2022 (3 years) EducationDegree",
  )[0].title,
  "Accountant",
);
assert.equal(
  read(
    "Career historyIntern at Example Engineering Jun 2020 - Sep 2020 (4 months) EducationDegree",
  ).length,
  1,
);
assert.equal(
  read(
    "Career historySr.Consultant-SAP HCM at Example Systems Jan 2020 - Present (6 years) EducationDegree",
  )[0].title,
  "Sr.Consultant-SAP HCM",
);
assert.equal(
  read(
    "Career historySpeech Therapist at Example Hospital Jan 2020 - Present (6 years) EducationDegree",
  )[0].title,
  "Speech Therapist",
);
assert.equal(
  read(
    "Career historySAP Consultant at Example Systems Jan 2020 - Present (6 years) Description: Project Manager at Client Buyer Jan 2022 - Dec 2023 (2 years)",
  ).length,
  1,
  "narrative cannot become another card",
);
for (const negative of [
  "Project Career historySAP Consultant at Example Client Jan 2020 - Dec 2022 (3 years)",
  "Client Career historySAP Consultant at Example Client Jan 2020 - Dec 2022 (3 years)",
  "Career historyWorked as SAP Consultant at Example Client Jan 2020 - Dec 2022 (3 years)",
  "Career historySAP Consultant at Client Example Jan 2020 - Dec 2022 (3 years)",
  "Career historySAP Consultant at Example Systems Jan 2023 - Dec 2022 (3 years)",
  "Career historySAP Consultant at Example Systems Jan 2020 (6 years)",
  "Career historySAP Consultant at Example Systems (6 years)",
  "Career historyBachelor at Example University Jan 2020 - Dec 2022 (3 years)",
  "EducationCareer historySAP Consultant at Example Systems Jan 2020 - Dec 2022 (3 years)",
])
  assert.equal(read(negative).length, 0, negative);
const canonical = extractCanonicalEmploymentFromResume(text);
assert.equal(canonical.length, 3);
assert.equal(employmentTimelineDiagnostics(canonical).invalidRanges, 0);
assert.ok(
  canonical.every((j) =>
    j.provenance?.some((p) => p.excerpt?.includes(" at ")),
  ),
);
const dotted =
  "Career historySAP Consultant at Example Systems Sdn. Bhd. Jan 2022 - Present (4 years) Associate SAP Consultant at Example Labs Sdn. Bhd. Jan 2020 - Dec 2021 (2 years)";
assert.deepEqual(
  extractCanonicalEmploymentFromResume(dotted).map((j) => [j.company, j.title]),
  [
    ["Example Systems Sdn. Bhd.", "SAP Consultant"],
    ["Example Labs Sdn. Bhd.", "Associate SAP Consultant"],
  ],
  "each source card has one row with its complete company and role",
);
const repeatedPhrase =
  "Career historyConsultant at Example Systems Feb 2023 - Present (3 years) Duties: Build reports. SAP BW BI Consultant at Example Systems Feb 2023 - Present (3 years) Responsibilities: Support reporting.";
assert.ok(
  extractCanonicalEmploymentFromResume(repeatedPhrase).some(
    (j) => j.title === "SAP BW BI Consultant",
  ),
  "a card substring must not erase a separately evidenced role",
);
const projectAfterCard =
  "Career historySAP Sr. ABAP Consultant and Jr. EWM Consultant at Example Systems Mar 2014 - Oct 2018 (4 years 8 months) ABAP consultant at Example Systems Project : SAP EWM ( Oct 2017 - Oct 2018 ) Client : Example Buyer Job Role : ABAP / Functional";
assert.deepEqual(
  extractCanonicalEmploymentFromResume(projectAfterCard).map((j) => [
    j.company,
    j.start,
    j.end,
  ]),
  [["Example Systems", "Mar 2014", "Oct 2018"]],
  "project dates after a card cannot become employer tenure",
);
console.log("exported career card regressions PASS");

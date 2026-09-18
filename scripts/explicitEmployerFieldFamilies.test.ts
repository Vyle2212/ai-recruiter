import assert from "node:assert/strict";
import { boundedEmploymentBatch as read } from "../lib/boundedEmploymentBatch";

const tuples = (source: string) =>
  read(source).map((row) => [row.company, row.title, row.start, row.end]);

// Synthetic representations of reviewed source families. Client and project
// fields are deliberately populated to prove that they do not own employment.
assert.deepEqual(
  tuples(
    "Experience Profile Client: Buyer Group Company: Example Staffing Limited Duration: Dec-2021 to Still Date Environment: SAP BW Project Role: SAP BW Consultant Team Size: 6 Project Description: delivery",
  ),
  [["Example Staffing Limited", "SAP BW Consultant", "Dec 2021", "Present"]],
);
assert.deepEqual(
  tuples(
    "CURRENT ASSIGNMENT Company: Example Technology Solutions Sdn. Bhd. Role: SAP BASIS Consultant Designation: Application Manager Duration: From Sept-2022 to till now PROJECT #1 Company: Buyer Corporation Role: SAP BASIS Consultant Duration: Nov-2017 to Sept-2018",
  ),
  [
    [
      "Example Technology Solutions Sdn. Bhd.",
      "SAP BASIS Consultant",
      "Sept 2022",
      "Present",
    ],
  ],
);
assert.deepEqual(
  tuples(
    "Job Experience Company: Example Consulting Duration: April 2010 up to Present Company: Example Consulting - Buyer Project Role: Software Business Analyst",
  ),
  [["Example Consulting", "", "April 2010", "Present"]],
);
assert.deepEqual(
  tuples(
    "PROFESSIONAL OVERVIEW Company: Example Manufacturing Aug 10th2022 – Date- SAP MM/Ariba P2P Consultant Example City, Country",
  ),
  [
    [
      "Example Manufacturing",
      "SAP MM/Ariba P2P Consultant",
      "10 Aug 2022",
      "Present",
    ],
  ],
);
assert.deepEqual(
  tuples(
    "WORK EXPERIENCE. Example Consulting Sdn Bhd Senior SAP MM Consultant October 2017 ~ April 2018 Projects Involved: Project: Migration Company: Buyer Energy Berhad Period: October 2017 ~ April 2018 Project Role: SAP MM Consultant. Delivery complete. Second Consulting Sdn Bhd SAP MM Consultant September 2013 ~ October 2017 Projects Involved: Company: Second Buyer Ltd Period: June 2017 ~ October 2017 Project Role: SAP MM Consultant",
  ),
  [
    [
      "Example Consulting Sdn Bhd",
      "Senior SAP MM Consultant",
      "October 2017",
      "April 2018",
    ],
    [
      "Second Consulting Sdn Bhd",
      "SAP MM Consultant",
      "September 2013",
      "October 2017",
    ],
  ],
);
assert.deepEqual(
  tuples(
    "Key experience in SAP Security: Example Security Sdn. Bhd (Senior SAP Security Analyst) May 2018 – Current REASON FOR LEAVING Career growth. Project Company: Buyer Ltd Duration: Jan 2020 – Current",
  ),
  [
    [
      "Example Security Sdn. Bhd",
      "Senior SAP Security Analyst",
      "May 2018",
      "Present",
    ],
  ],
);
assert.deepEqual(
  tuples(
    "Work History 2022-06 – Current Fiori & UI5/ ABAP Consultant Example Digital GmbH Role: SAP HANA Cloud Consultant Responsibilities: delivery",
  ),
  [
    [
      "Example Digital GmbH",
      "Fiori & UI5/ ABAP Consultant",
      "Jun 2022",
      "Present",
    ],
  ],
);
assert.deepEqual(
  tuples(
    "Work Experience Credentials Example ERP Solution March 2021 - Present Permanent Position: Functional Consultant Field of Expertise: Procurement Job Details: delivery",
  ),
  [["Example ERP Solution", "Functional Consultant", "March 2021", "Present"]],
);
assert.deepEqual(
  tuples(
    "EMPLOYMENT HISTORY EXAMPLE MINERAL MALAYSIA – BUSINESS ANALYST / SAP BODS DEVELOPER September 2019 – Current Key highlight of my experience: delivery",
  ),
  [
    [
      "EXAMPLE MINERAL MALAYSIA",
      "BUSINESS ANALYST / SAP BODS DEVELOPER",
      "September 2019",
      "Present",
    ],
  ],
);
assert.deepEqual(
  tuples(
    "WORK EXPERIENCE Example Technology Malaysia Sdn Bhd 2019-Present - SAP local IT consultant - Resolve daily issues",
  ),
  [
    [
      "Example Technology Malaysia Sdn Bhd",
      "SAP local IT consultant",
      "2019",
      "Present",
    ],
  ],
);
assert.deepEqual(
  tuples(
    "WORK EXPERIENCE August 2018 – At Present IT ERP Project Manager | Actual Employer | City",
  ),
  [["Actual Employer", "IT ERP Project Manager", "August 2018", "Present"]],
);

for (const source of [
  "Project Experience Client: Buyer Group Company: Buyer Corporation Duration: Dec-2021 to Still Date Environment: SAP BW Project Role: SAP BW Consultant",
  "Project Work History 2022-06 – Current SAP Consultant Buyer Corporation Role: delivery",
  "WORK EXPERIENCE. Example Consulting Sdn Bhd Senior SAP MM Consultant October 2018 ~ April 2017 Projects Involved: Company: Buyer Ltd",
  "CURRENT ASSIGNMENT Company: Example Technology Solutions Role: SAP Consultant Designation: Consultant Duration: From Sept-2022",
  "Project Experience Example ERP Solution March 2021 - Present Permanent Position: Functional Consultant Field of Expertise: Procurement",
  "PROJECT WORK EXPERIENCE Oct 2021 – Present Example Software PROJECT MANAGER Managed delivery",
])
  assert.deepEqual(tuples(source), [], source);

console.log("explicit employer field families: PASS");

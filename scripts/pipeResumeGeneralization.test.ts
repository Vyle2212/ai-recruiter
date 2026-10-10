import assert from "node:assert/strict";
import { parseCvFromText } from "../lib/cv-parser";
import { enrichCandidateUpload } from "../lib/candidateUploadEnrichment";
import {
  contactHeaderName,
  pipeEmploymentCards,
  embeddedSapEmploymentProjects,
} from "../lib/positionedResumeEvidence";
const source = `Aruna
Open to Permanent and Contract Roles
+61 400000000 | test@example.invalid | linkedin.com/in/aruna-mba-pmp-123/
PROFILE SUMMARY
Finance transformation leadership delivering sustained
organisational value.
PROFESSIONAL EXPERIENCE
SAP Finance Team Lead | Example Consulting (Indonesia) | Jul 2025 – Present
Directed SAP finance design.
Solution Architect (Official Designation: Business Analyst) | Example Equipment (Australia)| Dec 2023 – Nov 2024
Led SAP FSCM Credit & Dispute Management automation.
SAP Finance Team Lead | Example Food (Australia) | Jan 2020 – Dec 2023
Directed the S/4HANA Finance and Project-wide Test Management teams, ensuring a defect-free Go-Live through SIT/UAT governance
EARLIER CAREER EXPERIENCE
• Senior SAP FICO Consultant – Example Partner (Singapore) | 2009
Delivered an SAP Finance implementation.
• SAP Senior Consultant – Example Group (Indonesia) | 2000 – 2003
Delivered 7 E2E SAP Finance implementations.
• Semi-Senior Auditor – Example Audit (Indonesia) | 1994 – 1996
Statutory audits, not SAP work.
EDUCATION
• Master of Business Administration (MBA) – Example University, Australia | 1998
• Bachelor of Economics in Accounting – Example College, Indonesia | 1994
Certifications & Training
• Project Management Professional (PMP) – Example Institute | 2016 (Active)
• SAP Business Planning and Consolidation – Consolidation (BPC440) – SAP | 2021
• SAP Financial Accounting and Controlling Consultant Certification – SAP | 1998`;
const result = enrichCandidateUpload(
  parseCvFromText(source, "unrelated.pdf"),
  source,
);
assert.equal(result.name, "Aruna");
assert.equal(
  result.location,
  "",
  "Employment/education countries cannot establish residence",
);
assert.equal(
  result.experience.length,
  6,
  "All career cards; credentials cannot become employment",
);
assert.equal(result.experience[3].start_date, "2009");
assert.equal(
  result.experience[3].end_date,
  "2009",
  "Year-only precision preserved",
);
assert.equal(
  result.experience[1].title,
  "Solution Architect (Official Designation: Business Analyst)",
);
assert.equal(result.experience[0].current, true);
assert.equal(result.education.length, 2);
assert.equal(
  (result.education[0] as { graduation_year: string }).graduation_year,
  "1998",
);
assert.equal(result.certifications.length, 3);
assert.equal(
  result.projects.length,
  2,
  "Only two explicit SAP delivery activities; no Project-wide or seven invented projects",
);
assert.equal(
  contactHeaderName(source.replace("aruna-mba", "another-mba")),
  undefined,
);
assert.equal(
  contactHeaderName(source.replace("Aruna\n", "Summary\n")),
  undefined,
);
assert.equal(
  pipeEmploymentCards(
    "CERTIFICATIONS & TRAINING\nSAP FICO Consultant Certification – SAP | 1998",
  ).length,
  0,
);
console.log("Pipe resume generalization and cross-section boundaries passed.");

const embedded = embeddedSapEmploymentProjects(source);
assert.equal(embedded.length, 2);
assert.equal(
  embedded[0].name,
  "SAP FSCM Credit & Dispute Management automation",
);
assert.equal(embedded[0].employer, "Example Equipment (Australia)");
assert.equal(embedded[0].client, "", "Employer must not become client");
assert.equal(embedded[0].start_date, "", "Never borrow employment dates");
assert.equal(embedded[0].end_date, "");
assert.equal(embedded[0].role, result.experience[1].title);
assert.ok(!embedded.some((row) => /Project-wide|7 E2E/.test(String(row.name))));
assert.equal(
  embeddedSapEmploymentProjects(
    "PROFILE SUMMARY\nLed SAP Finance implementation.\nEDUCATION\nSAP Finance implementation",
  ).length,
  0,
);
assert.equal(
  embeddedSapEmploymentProjects(
    source
      .replace(
        "Led SAP FSCM Credit & Dispute Management automation.",
        "Supported SAP FSCM user operations.",
      )
      .replace(
        "Delivered an SAP Finance implementation.",
        "Delivered multiple SAP Finance implementations.",
      ),
  ).length,
  0,
);

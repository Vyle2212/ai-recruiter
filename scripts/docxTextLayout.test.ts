import assert from "node:assert/strict";
import { renderDocxText } from "../lib/docxTextLayout";
import { normalizeActualCandidateSchema } from "../lib/candidate360SchemaNormalize";
const text = (value: string) => ({ type: "text", value });
const paragraph = (children: object[]) => ({ type: "paragraph", children });
const document = {
  type: "document",
  children: [
    paragraph([text("Employment History")]),
    paragraph([
      text("SAP Consultant"),
      { type: "break" },
      text("Example Ltd | January 2020 – March 2024"),
    ]),
    paragraph([text("Education")]),
    paragraph([
      text("MBA"),
      { type: "break" },
      text("Example University | 2010 – 2012"),
    ]),
  ],
};
const source = renderDocxText(document);
assert.ok(source.includes("SAP Consultant\nExample Ltd"));
const jobs = normalizeActualCandidateSchema({ raw_text: source })
  .enterpriseProfile.employmentTimeline;
assert.equal(jobs.length, 1);
assert.equal(jobs[0].company, "Example Ltd");
assert.equal(jobs[0].title, "SAP Consultant");
assert.equal(
  renderDocxText({
    type: "paragraph",
    children: [text("Employer"), { type: "tab" }, text("Example Ltd")],
  }),
  "Employer\tExample Ltd\n\n",
);
console.log(
  "DOCX soft line breaks, tabs and canonical employment boundary passed",
);
const cell = (...values: string[]) => ({
  type: "tableCell",
  children: values.map((v) => paragraph([text(v)])),
});
const row = (...children: ReturnType<typeof cell>[]) => ({
  type: "tableRow",
  children,
});
const table = {
  type: "table",
  children: [
    row(cell("Employment History:")),
    row(cell("Date"), cell("Company Name"), cell("Role")),
    row(
      cell("Jan 2023", "Feb 2021"),
      cell("Example Ltd", "Earlier Ltd"),
      cell("SAP Consultant", "Basis Consultant"),
    ),
    row(cell("Skills:")),
    row(cell("Jan 2020"), cell("Not Employment"), cell("SAP Consultant")),
  ],
};
const renderedTable = renderDocxText(table);
assert.ok(
  renderedTable.includes(
    "Jan 2023\tExample Ltd\tSAP Consultant\nFeb 2021\tEarlier Ltd\tBasis Consultant",
  ),
);
assert.equal(
  normalizeActualCandidateSchema({ raw_text: renderedTable }).enterpriseProfile
    .employmentTimeline.length,
  2,
);
const unequal = renderDocxText({
  type: "table",
  children: [
    table.children[0],
    table.children[1],
    row(
      cell("Jan 2023", "Feb 2021"),
      cell("Only One Ltd"),
      cell("SAP Consultant", "Basis Consultant"),
    ),
  ],
});
assert.ok(
  !unequal.includes("Jan 2023\tOnly One Ltd"),
  "Unequal cell counts must not be zipped or filled",
);
assert.ok(
  unequal.includes("Feb 2021") && unequal.includes("Only One Ltd"),
  "Retain unmatched source text for review",
);

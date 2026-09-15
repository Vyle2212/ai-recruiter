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

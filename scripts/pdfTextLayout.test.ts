import assert from "node:assert/strict";
import { createCvPdfRenderer, renderPdfTextItems } from "../lib/pdfTextLayout";
const item = (str: string, x: number, y: number, width = str.length * 5) => ({
  str,
  transform: [10, 0, 0, 10, x, y],
  width,
});
assert.equal(
  renderPdfTextItems([
    item("SAP Consultant", 20, 100),
    item("Feb 2025 - Present", 250, 120),
    item("Example Ltd", 20, 120),
  ]),
  "Example Ltd\tFeb 2025 - Present\nSAP Consultant",
);
assert.equal(
  renderPdfTextItems([item("Con", 20, 100, 15), item("sultant", 35, 100)]),
  "Consultant",
);
assert.equal(
  renderPdfTextItems([item("Example", 20, 100, 35), item("Ltd", 60, 100)]),
  "Example Ltd",
);
const page = (items: ReturnType<typeof item>[]) => ({
  getTextContent: async () => ({ items }),
});
async function main() {
  const render = createCvPdfRenderer();
  const result = await render(
    page([
      item("EMPLOYMENT HISTORY", 20, 500),
      item("Name of Company", 20, 470),
      item("Scope of ", 200, 470),
      item("Work", 245, 470),
      item("Year", 400, 470),
      item("Roles & Responsibilities", 200, 440),
      item("Roles", 200, 420),
      item("SAP Contractor", 200, 400),
      item("Jan 2020 – Dec 2022", 400, 420),
      item("Example Ltd", 20, 360),
      item("Responsibilities", 200, 370),
      item("Project: Customer", 200, 350),
    ]),
  );
  assert.ok(
    result.includes(
      "Example Ltd\tRoles & Responsibilities Roles SAP Contractor Responsibilities Project: Customer\tJan 2020 – Dec 2022",
    ),
  );
  const continuation = await render(
    page([
      item("Roles & Responsibilities", 200, 440),
      item("Roles", 200, 420),
      item("SAP Consultant", 200, 400),
      item("Feb 2023 – Dec 2024", 400, 420),
      item("Second Ltd", 20, 360),
    ]),
  );
  assert.ok(
    continuation.includes(
      "Second Ltd\tRoles & Responsibilities Roles SAP Consultant\tFeb 2023 – Dec 2024",
    ),
  );
  const isolated = await createCvPdfRenderer()(
    page([
      item("Roles & Responsibilities", 200, 440),
      item("Jan 2020 – Dec 2022", 400, 420),
      item("Example Ltd", 20, 360),
    ]),
  );
  assert.ok(
    !isolated.includes("Name of Company\tScope of Work\tYear"),
    "Renderer state must not leak between documents",
  );
  const table = await createCvPdfRenderer()(
    page([
      item("EMPLOYMENT HISTORY", 200, 760),
      item("Year", 20, 730),
      item("Employer /", 100, 730),
      item("Role", 220, 730),
      item("Responsibilities", 320, 730),
      item("Years in", 500, 730),
      item("Jan", 20, 690),
      item("Example Ltd", 100, 690),
      item("SAP Consultant", 220, 690),
      item("Configured SAP", 320, 690),
      item("Jan 2020 -", 500, 690),
      item("2020", 20, 675),
      item("and trained users", 320, 675),
      item("Present", 500, 675),
      item("Feb", 20, 630),
      item("Second Ltd", 100, 630),
      item("SAP Tester", 220, 630),
      item("Testing", 320, 630),
      item("3 months", 500, 630),
      item("2019", 20, 615),
      item("Page 1 of 1", 260, 30),
    ]),
  );
  assert.ok(
    table.includes(
      "Jan 2020\tExample Ltd\tSAP Consultant\tConfigured SAP and trained users\tJan 2020 - Present",
    ),
  );
  assert.ok(
    table.includes("Feb 2019\tSecond Ltd\tSAP Tester\tTesting\t3 months"),
  );
  assert.ok(table.includes("Page 1 of 1"));
  console.log(
    "PDF geometry ordering, word gaps, explicit table columns and document isolation passed",
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

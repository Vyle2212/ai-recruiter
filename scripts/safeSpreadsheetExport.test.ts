import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  prepareSpreadsheetSheets,
  sanitizeSpreadsheetCell,
  SPREADSHEET_EXPORT_LIMITS,
} from "../lib/safeSpreadsheetExport";

assert.equal(
  sanitizeSpreadsheetCell('=HYPERLINK("https://attacker.invalid")'),
  `'=HYPERLINK("https://attacker.invalid")`,
);
assert.equal(sanitizeSpreadsheetCell("  @SUM(A1:A2)"), "'  @SUM(A1:A2)");
assert.equal(
  sanitizeSpreadsheetCell("+cmd|' /C calc'!A0"),
  "'+cmd|' /C calc'!A0",
);
assert.equal(sanitizeSpreadsheetCell("-1+2"), "'-1+2");
assert.equal(sanitizeSpreadsheetCell(2026), 2026);
assert.equal(
  sanitizeSpreadsheetCell("Jos\u00e9 O\u2019Neil"),
  "Jos\u00e9 O\u2019Neil",
);
assert.equal(sanitizeSpreadsheetCell(new Date("not-a-date")), null);
assert.equal(sanitizeSpreadsheetCell("__proto__"), "__proto__");
assert.equal(
  String(sanitizeSpreadsheetCell("a".repeat(100_000))).length,
  SPREADSHEET_EXPORT_LIMITS.charactersPerCell,
);
assert.equal(
  sanitizeSpreadsheetCell(new Date("2026-09-14T00:00:00Z")) instanceof Date,
  true,
);
assert.equal(sanitizeSpreadsheetCell("Unicode: Trần"), "Unicode: Trần");
assert.equal(sanitizeSpreadsheetCell("safe\u0000text"), "safetext");

const prepared = prepareSpreadsheetSheets([
  {
    name: " People / Export ",
    rows: [
      ["name", "value"],
      ["Alice", "=1+1"],
      ["Empty", ""],
    ],
  },
]);
assert.equal(prepared[0].name, "People Export");
assert.deepEqual(prepared[0].rows[1], ["Alice", "'=1+1"]);
assert.equal(prepared[0].rows[2][1], "");

assert.throws(
  () =>
    prepareSpreadsheetSheets([
      {
        name: "Too many rows",
        rows: Array.from(
          { length: SPREADSHEET_EXPORT_LIMITS.rowsPerSheet + 1 },
          () => ["x"],
        ),
      },
    ]),
  /row limit/,
);
assert.throws(
  () =>
    prepareSpreadsheetSheets([
      {
        name: "Too many columns",
        rows: [
          Array.from(
            { length: SPREADSHEET_EXPORT_LIMITS.columnsPerSheet + 1 },
            () => "x",
          ),
        ],
      },
    ]),
  /column limit/,
);
assert.throws(
  () =>
    prepareSpreadsheetSheets([
      { name: "same", rows: [] },
      { name: "SAME", rows: [] },
    ]),
  /duplicate sheet names/,
);

const repositoryRoot = path.resolve(__dirname, "..");
const sources = fs
  .readFileSync(
    path.join(repositoryRoot, "components", "candidate-compare-workspace.tsx"),
    "utf8",
  )
  .concat(fs.readFileSync(path.join(repositoryRoot, "package.json"), "utf8"));
assert.doesNotMatch(
  sources,
  /(?:from\s+["']xlsx["']|require\(["']xlsx["']\)|"xlsx"\s*:)/,
);
assert.match(sources, /write-excel-file/);
assert.doesNotMatch(sources, /(?:XLSX\.(?:read|readFile)|readXlsxFile)\s*\(/);

const uploadSources = [
  "app/upload/page.tsx",
  "app/upload-cv/page.tsx",
  "app/upload-jd/page.tsx",
  "app/recruiter/talent-search/v2/GuidedSourcingPanel.tsx",
  "app/api/recruiter/search-v2/external-profile-import/route.ts",
  "lib/cv-parser.ts",
  "lib/guidedSourcingSource.ts",
]
  .map((file) => fs.readFileSync(path.join(repositoryRoot, file), "utf8"))
  .join("\n");
assert.doesNotMatch(
  uploadSources,
  /(?:\.xlsx?\b|application\/vnd\.(?:ms-excel|openxmlformats-officedocument\.spreadsheetml\.sheet))/i,
);

console.log(
  "Safe spreadsheet export regression passed (export-only; no ZIP/XML ingestion surface).",
);

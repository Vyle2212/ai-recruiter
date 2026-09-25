import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  compareOfflineCvAudits,
  createOfflineCvAudit,
} from "../lib/offlineCvParserAudit";
import { productionEmploymentGapQueue } from "../lib/productionEmploymentProjectionAudit";

const complete = Buffer.from(`
Jane Doe
Email: jane.doe@example.invalid
Phone: +65 9123 4567
Location: Singapore
SAP MM consultant delivering procurement and SAP S/4HANA implementation.
WORK EXPERIENCE
SAP MM Consultant | Example Consulting | Jan 2020 - Present
PROJECT EXPERIENCE
Client: Example Manufacturing
Role: SAP MM Consultant
Jan 2021 - Dec 2023
EDUCATION
Bachelor of Computing
SKILLS
SAP MM, Procurement
LANGUAGES
English
`);
const partial = Buffer.from(
  complete
    .toString()
    .replace(
      "Client: Example Manufacturing",
      "Client: Example Manufacturing\nClient: Synthetic Logistics",
    ),
);

function scannedSyntheticPdf() {
  const objects = [
    "",
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let i = 1; i < objects.length; i++) {
    offsets[i] = Buffer.byteLength(pdf, "latin1");
    pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < objects.length; i++)
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}

async function main() {
  const audit = createOfflineCvAudit();
  await audit.process(complete, "private-name-1.txt");
  await audit.process(complete, "same-bytes-another-name.txt");
  await audit.process(partial, "private-name-2.txt");
  await audit.process(
    Buffer.from("A plain cover letter about travel and food."),
    "private-name-3.txt",
  );
  await audit.process(Buffer.from("not a valid docx"), "private-name-4.docx");
  await audit.process(scannedSyntheticPdf(), "private-name-5.pdf");
  const r = audit.report;
  assert.equal(r.files, 6);
  assert.equal(r.uniqueFiles, 5);
  assert.equal(r.duplicateFiles, 1);
  assert.equal(r.sourceFailures, 1);
  assert.equal(r.ocrRequired, 1);
  assert.equal(r.classificationReview, 1);
  assert.equal(r.completeForValidation + r.needsReview, 2);
  assert.equal(r.artifact, "offline_cv_parser_audit_v2");
  assert.match(r.collectionFingerprint, /^[a-f0-9]{64}$/);
  assert.equal(r.databaseWrites, 0);
  assert.equal(r.readyForBulkUpload, false);
  assert.deepEqual(r.privacy, {
    filenamesSerialized: 0,
    candidateIdentifiersSerialized: 0,
    sourceExcerptsSerialized: 0,
    contactFieldsSerialized: 0,
    fileDigestsSerialized: 0,
  });
  assert.doesNotMatch(
    JSON.stringify(r),
    /Jane|private-name|example\.invalid|Example Manufacturing/i,
  );

  const outsideRepo = fs.mkdtempSync(
    path.join(os.tmpdir(), "private-parser-audit-"),
  );
  try {
    fs.writeFileSync(path.join(outsideRepo, "synthetic.txt"), complete);
    const run = spawnSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "scripts/auditOfflineCvParser.ts",
        "--directory",
        outsideRepo,
        "--minimum-unique",
        "1",
      ],
      { cwd: process.cwd(), encoding: "utf8" },
    );
    assert.equal(
      run.status,
      0,
      "aggregate audit should accept an external folder",
    );
    const cli = JSON.parse(run.stdout);
    assert.equal(cli.files, 1);
    assert.match(cli.targetCommitSha, /^[a-f0-9]{40}$/);
    assert.equal(cli.readyForBulkUpload, false);
    assert.doesNotMatch(
      run.stdout + run.stderr,
      /synthetic\.txt|Jane Doe|example\.invalid/,
    );

    const undersized = spawnSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "scripts/auditOfflineCvParser.ts",
        "--directory",
        outsideRepo,
      ],
      { cwd: process.cwd(), encoding: "utf8" },
    );
    assert.equal(undersized.status, 1);
    assert.equal(undersized.stdout, "");
    assert.equal(undersized.stderr, "offline_cv_audit_directory_invalid\n");

    const baselineDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), "private-parser-baseline-"),
    );
    const baselinePath = path.join(baselineDirectory, "baseline.json");
    fs.writeFileSync(baselinePath, JSON.stringify(cli), { mode: 0o600 });
    const compared = spawnSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "scripts/auditOfflineCvParser.ts",
        "--directory",
        outsideRepo,
        "--minimum-unique",
        "1",
        "--baseline",
        baselinePath,
      ],
      { cwd: process.cwd(), encoding: "utf8" },
    );
    assert.equal(compared.status, 0);
    const comparison = JSON.parse(compared.stdout).comparison;
    assert.equal(comparison.samePopulation, true);
    assert.equal(comparison.delta.employmentGapSources, 0);
    assert.equal(comparison.readyForBulkUpload, false);
    fs.unlinkSync(baselinePath);
    fs.rmdirSync(baselineDirectory);
  } finally {
    fs.unlinkSync(path.join(outsideRepo, "synthetic.txt"));
    fs.rmdirSync(outsideRepo);
  }

  const padding = " SAP delivery evidence".repeat(20);
  const queueFixtures = [
    ["Short SAP project", "short-or-missing-source"],
    [
      `Date Company Name Role 2020 Example Consulting SAP Consultant${padding}`,
      "headed-table-needs-layout-review",
    ],
    [
      `Employer: Example Consulting Role: SAP Consultant${padding}`,
      "explicit-employer-label-needs-field-review",
    ],
    [
      `Professional Experience 2020 to 2021 SAP Consultant${padding}`,
      "near-heading-date-needs-boundary-review",
    ],
    [
      `Project Experience Client: Example Buyer Project: Rollout${padding}`,
      "project-or-client-heavy-needs-employment-evidence",
    ],
    [
      `SAP transformation delivery narrative without owned career fields${padding}`,
      "other-narrative-or-layout-review",
    ],
  ] as const;
  for (const [source, expected] of queueFixtures)
    assert.equal(productionEmploymentGapQueue(source), expected);

  const before = { ...r, targetCommitSha: "a".repeat(40) };
  const after = {
    ...structuredClone(before),
    targetCommitSha: "b".repeat(40),
    completeForValidation: before.completeForValidation + 1,
    needsReview: before.needsReview - 1,
    employmentGapQueues: {
      ...before.employmentGapQueues,
      "project-or-client-heavy-needs-employment-evidence": 1,
    },
  };
  const delta = compareOfflineCvAudits(before, after);
  assert.equal(delta.samePopulation, true);
  assert.equal(delta.delta.completeForValidation, 1);
  assert.equal(delta.delta.needsReview, -1);
  assert.equal(delta.delta.employmentGapSources, 1);
  assert.equal(delta.readyForBulkUpload, false);
  assert.equal(
    compareOfflineCvAudits(before, {
      ...after,
      collectionFingerprint: "f".repeat(64),
    }).samePopulation,
    false,
  );
  console.log("offlineCvParserAudit.test.ts passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

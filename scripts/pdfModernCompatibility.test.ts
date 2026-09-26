import assert from "node:assert/strict";

import { extractCvPdf, pdfOcrReason } from "../lib/cvPdfExtraction";
import { prepareCandidateCv } from "../lib/candidateCvIngestion";
import { isValidEmploymentEntry } from "../lib/candidateProfileIngestion";

function pdfText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function pageContent(lines: string[]) {
  return [
    "BT",
    "/F1 10 Tf",
    "50 790 Td",
    ...lines.flatMap((line, index) =>
      index === 0
        ? [`(${pdfText(line)}) Tj`]
        : ["0 -14 Td", `(${pdfText(line)}) Tj`],
    ),
    "ET",
  ].join("\n");
}

function syntheticPdf(lines: string[], secondPageLines?: string[]) {
  const content = pageContent(lines);
  const secondContent =
    secondPageLines === undefined ? null : pageContent(secondPageLines);
  const objects = [
    "",
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [3 0 R${secondContent === null ? "" : " 6 0 R"}] /Count ${secondContent === null ? 1 : 2} >>`,
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  if (secondContent !== null)
    objects.push(
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 7 0 R >>",
      `<< /Length ${Buffer.byteLength(secondContent, "latin1")} >>\nstream\n${secondContent}\nendstream`,
    );
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let index = 1; index < objects.length; index++) {
    offsets[index] = Buffer.byteLength(pdf, "latin1");
    pdf += `${index} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let index = 1; index < objects.length; index++)
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}

async function main() {
  const native = await extractCvPdf(
    syntheticPdf([
      "SYNTHETIC SAP CONSULTANT",
      "Professional Experience",
      "Synthetic Consulting Ltd January 2020 - June 2025",
      "SAP FICO Consultant",
      "Implemented SAP S/4HANA finance configuration testing and go-live.",
      "Education Bachelor of Information Systems",
    ]),
    {
      ocr: async () => {
        throw new Error("OCR must not run for a readable synthetic PDF");
      },
    },
  );
  assert.equal(native.sourceExtraction.method, "native");
  assert.equal(native.sourceExtraction.pageCount, 1);
  assert.match(native.text, /Synthetic Consulting Ltd/);
  assert.match(native.text, /SAP FICO Consultant/);

  const labelledEmployment = syntheticPdf([
    "Jane Doe",
    "SYNTHETIC SAP MM CONSULTANT",
    "Email: synthetic@example.com",
    "Location: Singapore",
    "Employment History",
    "Employer: Example Consulting",
    "Role: SAP MM Consultant",
    "Start Date: Jan 2020",
    "End Date: Curr",
    "Implemented SAP MM procurement configuration, migration, testing and go-live support.",
    "Project Experience",
    "Client: Example Manufacturing",
    "Role: SAP MM Consultant",
    "Duration: Jan 2022 - Dec 2023",
    "SAP S/4HANA rollout, integration, workshops and cutover.",
    "Education: Bachelor of Computing",
    "Skills: SAP MM, Procurement, Inventory Management",
    "Languages: English",
  ]);
  for (const source of ["admin_upload", "candidate_upload"] as const) {
    const prepared = await prepareCandidateCv({
      buffer: labelledEmployment,
      fileName: "synthetic-employment.pdf",
      source,
      pdfOcr: async () => {
        throw new Error(
          "shared employment evidence must avoid unnecessary OCR",
        );
      },
    });
    assert.equal(prepared.accepted, true);
    if (!prepared.accepted) throw new Error("synthetic employment rejected");
    assert.equal(prepared.sourceExtraction.method, "native");
    assert.ok(
      prepared.candidatePayload.experience.some(isValidEmploymentEntry),
    );
  }

  const narrowReaderMiss = syntheticPdf([
    "Employment History",
    "unreadable employment layout ".repeat(10),
  ]);
  const recoveredBySharedReader = await extractCvPdf(narrowReaderMiss, {
    nativeEmploymentRecoverable: (text) => {
      assert.equal(pdfOcrReason(text), "PDF_EMPLOYMENT_UNRESOLVED");
      return true;
    },
    ocr: async () => {
      throw new Error("shared employment evidence must avoid unnecessary OCR");
    },
  });
  assert.equal(recoveredBySharedReader.sourceExtraction.method, "native");

  let ocrCalls = 0;
  const recovered = await extractCvPdf(
    syntheticPdf(["SCANNED IMAGE PLACEHOLDER"]),
    {
      ocr: async (buffer, pages, _requiredPages, fallbackReason) => {
        ocrCalls++;
        assert.ok(buffer.length > 100);
        assert.equal(pages, 1);
        assert.equal(fallbackReason, "PDF_TEXT_EMPTY_OR_TOO_SHORT");
        return [
          "SYNTHETIC SAP CONSULTANT",
          "Employment History",
          "Synthetic Services Ltd January 2021 - Present",
          "SAP SD Consultant",
          "Education Bachelor Degree",
        ].join("\n");
      },
    },
  );
  assert.equal(ocrCalls, 1);
  assert.equal(recovered.sourceExtraction.method, "ocr");
  assert.equal(
    recovered.sourceExtraction.reason,
    "PDF_TEXT_EMPTY_OR_TOO_SHORT",
  );
  assert.match(recovered.text, /Synthetic Services Ltd/);

  const mixed = await extractCvPdf(
    syntheticPdf(
      [
        "SYNTHETIC SAP CONSULTANT",
        "Professional Experience",
        "Synthetic Consulting Ltd January 2020 - June 2025",
        "SAP FICO Consultant",
        "Implemented SAP S/4HANA finance configuration testing and go-live.",
      ],
      [],
    ),
    {
      nativeEmploymentRecoverable: () => true,
      ocr: async (_buffer, pages, pagesRequiringOcrText) => {
        assert.equal(pages, 2);
        assert.deepEqual(pagesRequiringOcrText, [1, 2]);
        return [
          "SYNTHETIC SAP CONSULTANT",
          "Employment History",
          "Synthetic Consulting Ltd January 2020 - June 2025",
          "SAP FICO Consultant",
          "Second page SAP project details recovered by OCR.",
        ].join("\n");
      },
    },
  );
  assert.equal(mixed.sourceExtraction.method, "ocr");
  assert.equal(mixed.sourceExtraction.pageCount, 2);
  assert.equal(mixed.sourceExtraction.reason, "PDF_PAGE_TEXT_INCOMPLETE");
  assert.match(mixed.text, /Second page SAP project details/);

  await assert.rejects(
    extractCvPdf(Buffer.from("not-a-pdf"), { ocr: async () => "" }),
    (error: unknown) =>
      error instanceof Error &&
      error.message.includes("could not be read safely") &&
      (error as { code?: string }).code === "PDF_PARSE_FAILED",
  );
  console.log("Modern PDF compatibility and OCR fallback regression passed.");
}

void main();

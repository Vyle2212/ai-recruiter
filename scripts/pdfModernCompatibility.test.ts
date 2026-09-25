import assert from "node:assert/strict";

import { extractCvPdf } from "../lib/cvPdfExtraction";

function pdfText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function syntheticPdf(lines: string[]) {
  const content = [
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
  const objects = [
    "",
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
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

  let ocrCalls = 0;
  const recovered = await extractCvPdf(
    syntheticPdf(["SCANNED IMAGE PLACEHOLDER"]),
    {
      ocr: async (buffer, pages) => {
        ocrCalls++;
        assert.ok(buffer.length > 100);
        assert.equal(pages, 1);
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

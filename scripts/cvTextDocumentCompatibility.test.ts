import assert from "node:assert/strict";

import { prepareCandidateCv } from "../lib/candidateCvIngestion";
import {
  decodeCvTxt,
  extractCvTextDocument,
} from "../lib/cvTextDocumentExtraction";

const syntheticCv = [
  "SYNTHETIC SAP CONSULTANT",
  "PROFESSIONAL SUMMARY",
  "SAP FICO consultant with configuration, testing, migration, cutover and go-live delivery.",
  "WORK EXPERIENCE",
  "SAP FICO Consultant | Synthetic Consulting Ltd | Jan 2020 - Jun 2025",
  "Implemented SAP S/4HANA finance configuration testing and go-live.",
  "PROJECT EXPERIENCE",
  "Client: Synthetic Manufacturing",
  "Role: SAP FICO Consultant",
  "Jan 2022 - Dec 2023",
  "Led workshops, configuration, testing, migration, training and go-live support.",
  "EDUCATION",
  "Bachelor of Information Systems",
  "CERTIFICATIONS",
  "SAP Certified Associate",
  "SKILLS",
  "SAP FICO, S/4HANA, Finance, Controlling",
  "LANGUAGES",
  "English",
].join("\r\n");

function utf16Be(value: string, bom = true) {
  const bytes = Buffer.from(value, "utf16le");
  bytes.swap16();
  return bom ? Buffer.concat([Buffer.from([0xfe, 0xff]), bytes]) : bytes;
}

const syntheticOleDoc = Buffer.concat([
  Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
  Buffer.alloc(512),
]);

async function main() {
  const utf8 = decodeCvTxt(Buffer.from(`\uFEFF${syntheticCv}`, "utf8"));
  assert.equal(utf8.encoding, "utf8");
  assert.equal(utf8.text, syntheticCv);

  const utf16Le = decodeCvTxt(
    Buffer.concat([
      Buffer.from([0xff, 0xfe]),
      Buffer.from(syntheticCv, "utf16le"),
    ]),
  );
  assert.equal(utf16Le.encoding, "utf16le");
  assert.equal(utf16Le.text, syntheticCv);

  const utf16LeWithoutBom = decodeCvTxt(Buffer.from(syntheticCv, "utf16le"));
  assert.equal(utf16LeWithoutBom.encoding, "utf16le");
  assert.equal(utf16LeWithoutBom.text, syntheticCv);

  const utf16BeDecoded = decodeCvTxt(utf16Be(syntheticCv));
  assert.equal(utf16BeDecoded.encoding, "utf16be");
  assert.equal(utf16BeDecoded.text, syntheticCv);

  const legacyDoc = await extractCvTextDocument(
    syntheticOleDoc,
    "synthetic.doc",
    { extractDoc: async () => syntheticCv },
  );
  assert.equal(legacyDoc.text, syntheticCv);
  assert.equal(legacyDoc.sourceExtraction.reason, "LEGACY_DOC_NATIVE");

  const prepared = await prepareCandidateCv({
    buffer: Buffer.concat([
      Buffer.from([0xff, 0xfe]),
      Buffer.from(syntheticCv, "utf16le"),
    ]),
    fileName: "synthetic.txt",
    source: "admin_upload",
  });
  assert.equal(prepared.sourceExtraction.reason, "TXT_UTF16LE");
  if (prepared.accepted)
    assert.match(prepared.rawText, /Synthetic Consulting Ltd/);

  await assert.rejects(
    extractCvTextDocument(Buffer.from([0, 1, 2, 3, 4, 5]), "broken.txt"),
    (error: unknown) =>
      error instanceof Error &&
      (error as { code?: string }).code === "CV_SOURCE_TEXT_INVALID",
  );
  await assert.rejects(
    extractCvTextDocument(Buffer.from("not-a-docx"), "broken.docx"),
    (error: unknown) =>
      error instanceof Error &&
      (error as { code?: string }).code === "CV_SOURCE_DOCX_INVALID",
  );
  await assert.rejects(
    extractCvTextDocument(Buffer.from("not-an-ole-doc"), "broken.doc", {
      extractDoc: async () => syntheticCv,
    }),
    (error: unknown) =>
      error instanceof Error &&
      (error as { code?: string }).code === "CV_SOURCE_DOC_INVALID",
  );
  await assert.rejects(
    extractCvTextDocument(syntheticOleDoc, "empty.doc", {
      extractDoc: async () => "",
    }),
    (error: unknown) =>
      error instanceof Error &&
      (error as { code?: string }).code === "CV_SOURCE_DOC_TEXT_INVALID",
  );
  await assert.rejects(
    extractCvTextDocument(Buffer.from(syntheticCv), "synthetic.rtf"),
    (error: unknown) =>
      error instanceof Error &&
      (error as { code?: string }).code === "CV_SOURCE_UNSUPPORTED",
  );

  console.log(
    "Shared TXT/DOCX/DOC encoding and corrupt-source compatibility regression passed.",
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

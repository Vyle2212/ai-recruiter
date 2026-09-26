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

  const syntheticRtf = Buffer.from(
    `{\\rtf1\\ansi ${syntheticCv.replace(/\r\n/g, "\\par\n")}\\par }`,
    "latin1",
  );
  const rtf = await extractCvTextDocument(syntheticRtf, "synthetic.rtf");
  assert.match(rtf.text, /Synthetic Consulting Ltd/);
  assert.equal(rtf.sourceExtraction.reason, "RTF_NATIVE");
  const disguisedRtf = await extractCvTextDocument(syntheticRtf, "legacy.doc");
  assert.equal(disguisedRtf.text, rtf.text);
  assert.equal(disguisedRtf.sourceExtraction.reason, "LEGACY_DOC_RTF_NATIVE");
  const adminRtf = await prepareCandidateCv({
    buffer: syntheticRtf,
    fileName: "synthetic.rtf",
    source: "admin_upload",
  });
  const candidateRtf = await prepareCandidateCv({
    buffer: syntheticRtf,
    fileName: "synthetic.rtf",
    source: "candidate_upload",
  });
  assert.equal(adminRtf.accepted, candidateRtf.accepted);
  if (adminRtf.accepted && candidateRtf.accepted) {
    assert.deepEqual(
      adminRtf.extractionCoverage,
      candidateRtf.extractionCoverage,
    );
    assert.deepEqual(adminRtf.parserQuality, candidateRtf.parserQuality);
    assert.equal(adminRtf.rawText, candidateRtf.rawText);
  }
  const imageRtf = Buffer.from(
    `{\\rtf1\\ansi SAP FICO consultant\\par {\\pict ${"deadbeef".repeat(200)}}\\par WORK EXPERIENCE}`,
    "latin1",
  );
  const imageText = (await extractCvTextDocument(imageRtf, "image.rtf")).text;
  assert.match(imageText, /SAP FICO consultant/);
  assert.doesNotMatch(imageText, /deadbeef/i);

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
    extractCvTextDocument(Buffer.from(syntheticCv), "invalid.rtf"),
    (error: unknown) =>
      error instanceof Error &&
      (error as { code?: string }).code === "CV_SOURCE_RTF_INVALID",
  );

  console.log(
    "Shared TXT/DOCX/DOC/RTF encoding and corrupt-source compatibility regression passed.",
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

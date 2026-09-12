import { NextResponse } from "next/server";
import { authorizeRecruiterJobsRead } from "@/lib/recruiterJobsAuthorization";
import {
  EXTERNAL_PROFILE_IMPORT_MAX_BYTES,
  parseExternalProfileImport,
  type ExternalProfileImportSourceKind,
} from "@/lib/externalProfileImport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie, Authorization",
};

async function extractText(file: File) {
  if (file.size <= 0 || file.size > EXTERNAL_PROFILE_IMPORT_MAX_BYTES)
    throw new Error("invalid_size");
  const name = file.name.toLocaleLowerCase();
  const bytes = Buffer.from(await file.arrayBuffer());

  if (name.endsWith(".pdf") && file.type === "application/pdf") {
    if (bytes.subarray(0, 5).toString() !== "%PDF-")
      throw new Error("invalid_pdf");
    if (bytes.includes(Buffer.from("/Encrypt")))
      throw new Error("encrypted_pdf");
    const parser = (await import("pdf-parse")).default;
    return String((await parser(bytes)).text || "");
  }

  if (
    name.endsWith(".docx") &&
    [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/octet-stream",
    ].includes(file.type)
  ) {
    if (bytes[0] !== 0x50 || bytes[1] !== 0x4b)
      throw new Error("invalid_docx");
    const mammoth = await import("mammoth");
    return String((await mammoth.extractRawText({ buffer: bytes })).value || "");
  }

  if (
    name.endsWith(".txt") &&
    ["text/plain", "application/octet-stream"].includes(file.type)
  ) {
    if (bytes.includes(0)) throw new Error("invalid_txt");
    return bytes.toString("utf8");
  }

  throw new Error("unsupported_file");
}

export async function POST(request: Request) {
  const authorization = await authorizeRecruiterJobsRead();
  if (!authorization.allowed)
    return NextResponse.json(
      { error: authorization.code },
      { status: authorization.status, headers },
    );

  try {
    const form = await request.formData();
    const file = form.get("file");
    const candidateId = String(form.get("candidateId") || "").trim();
    const sourceKind = String(form.get("sourceKind") || "");
    const consentConfirmed = form.get("consentConfirmed") === "true";
    if (!(file instanceof File) || !candidateId || !consentConfirmed)
      return NextResponse.json(
        {
          error:
            "A candidate-provided file and recruiter confirmation are required.",
        },
        { status: 400, headers },
      );
    if (
      !["candidate_cv", "candidate_provided_linkedin_pdf"].includes(sourceKind)
    )
      return NextResponse.json(
        { error: "Invalid profile source." },
        { status: 400, headers },
      );

    const profileText = await extractText(file);
    if (!profileText.trim())
      return NextResponse.json(
        { error: "No readable profile text was found in this file." },
        { status: 422, headers },
      );
    const preview = parseExternalProfileImport({
      candidateId,
      text: profileText,
      fileName: file.name,
      sourceKind: sourceKind as ExternalProfileImportSourceKind,
    });
    return NextResponse.json(
      { preview, persisted: false, affectsRanking: false },
      { headers },
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : "parse_failed";
    const message =
      reason === "invalid_size"
        ? "Profile file must be between 1 byte and 8 MB."
        : reason === "encrypted_pdf"
          ? "Encrypted PDF files are not supported."
          : reason === "unsupported_file"
            ? "Upload a PDF, DOCX or TXT profile file."
            : "The profile file could not be read safely.";
    return NextResponse.json(
      { error: message, reason },
      { status: 400, headers },
    );
  }
}

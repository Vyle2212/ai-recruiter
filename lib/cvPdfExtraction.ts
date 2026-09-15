import { extractCanonicalEmploymentFromResume } from "./candidate360Employment";
import { CvSourceError, googlePdfOcr } from "./cvPdfOcr";
import { createCvPdfRenderer } from "./pdfTextLayout";

export type PdfExtractionOptions = {
  ocr?: (buffer: Buffer, pages: number) => Promise<string>;
};
export type CvSourceExtraction = {
  method: "native" | "ocr";
  pageCount: number;
  reason: string;
};

export function pdfOcrReason(text: string): string {
  if (text.replace(/\s/g, "").length < 50) return "PDF_TEXT_EMPTY_OR_TOO_SHORT";
  if ((text.match(/\uFFFD/g) || []).length >= 5)
    return "PDF_TEXT_ENCODING_INVALID";
  if (
    /\b(?:employment history|professional experience|working experience|work experience)\b/i.test(
      text,
    ) &&
    !extractCanonicalEmploymentFromResume(text).length
  )
    return "PDF_EMPLOYMENT_UNRESOLVED";
  return "";
}

export async function extractCvPdf(
  buffer: Buffer,
  options: PdfExtractionOptions = {},
): Promise<{ text: string; sourceExtraction: CvSourceExtraction }> {
  const pdf = (await import("pdf-parse")).default;
  const result = await pdf(buffer, { pagerender: createCvPdfRenderer() });
  const native = result.text || "";
  const reason = pdfOcrReason(native);
  if (!reason)
    return {
      text: native,
      sourceExtraction: {
        method: "native",
        pageCount: result.numpages,
        reason: "",
      },
    };
  const text = await (options.ocr || googlePdfOcr)(buffer, result.numpages);
  if (
    pdfOcrReason(text) ||
    (reason === "PDF_EMPLOYMENT_UNRESOLVED" &&
      !extractCanonicalEmploymentFromResume(text).length)
  )
    throw new CvSourceError(
      "OCR_REVIEW_REQUIRED",
      "OCR could not recover a reliable CV with readable employment information. The original file needs review; no partial CV was saved.",
    );
  return {
    text,
    sourceExtraction: { method: "ocr", pageCount: result.numpages, reason },
  };
}

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
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // PDF.js may transfer/detach the supplied typed array. Always give it an
  // isolated copy so the original bytes remain available for OCR/archive.
  const loadingTask = getDocument({ data: Uint8Array.from(buffer) });
  try {
    const document = await loadingTask.promise;
    if (
      !Number.isSafeInteger(document.numPages) ||
      document.numPages < 1 ||
      document.numPages > 50
    )
      throw new CvSourceError(
        "OCR_PAGE_LIMIT",
        "PDF processing supports 1–50 pages per CV. Split longer documents before uploading.",
      );

    const renderPage = createCvPdfRenderer();
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
      const page = await document.getPage(pageNumber);
      pages.push(await renderPage(page));
      page.cleanup();
    }
    const native = pages.join("\n\n");
    const reason = pdfOcrReason(native);
    if (!reason)
      return {
        text: native,
        sourceExtraction: {
          method: "native",
          pageCount: document.numPages,
          reason: "",
        },
      };
    const text = await (options.ocr || googlePdfOcr)(buffer, document.numPages);
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
      sourceExtraction: {
        method: "ocr",
        pageCount: document.numPages,
        reason,
      },
    };
  } catch (error) {
    if (error instanceof CvSourceError) throw error;
    throw new CvSourceError(
      "PDF_PARSE_FAILED",
      "The PDF could not be read safely. The original file needs review; no partial CV was saved.",
    );
  } finally {
    await loadingTask.destroy().catch(() => undefined);
  }
}

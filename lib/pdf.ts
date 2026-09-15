import pdf from "pdf-parse";
import { createCvPdfRenderer } from "./pdfTextLayout";

export async function extractPDF(buffer: Buffer): Promise<string> {
  try {
    const data = await pdf(buffer, { pagerender: createCvPdfRenderer() });
    const text = data.text?.trim() || "";

    console.log("✅ PDF parsed, length:", text.length);

    return text;
  } catch (error) {
    console.error("❌ PDF parse error:", error);
    return "";
  }
}

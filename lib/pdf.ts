import pdf from "pdf-parse";

export async function extractPDF(buffer: Buffer): Promise<string> {
  try {
    const data = await pdf(buffer);

    const text = data.text?.trim() || "";

    console.log("✅ PDF parsed, length:", text.length);

    return text;
  } catch (error) {
    console.error("❌ PDF parse error:", error);
    return "";
  }
}
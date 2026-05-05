import pdf from "pdf-parse";

export async function extractPDF(buffer: Buffer) {
  try {
    const data = await pdf(buffer);

    if (data.text && data.text.length > 50) {
      return data.text;
    }

    return null;
  } catch {
    return null;
  }
}
import { ImageAnnotatorClient } from "@google-cloud/vision";

const client = new ImageAnnotatorClient({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS || "{}"),
});

export async function extractTextFromPDF(buffer: Buffer) {
  try {
    const [result] = await client.documentTextDetection({
      image: { content: buffer },
    });

    return result.fullTextAnnotation?.text || "";
  } catch (err) {
    console.error("OCR ERROR:", err);
    return "";
  }
}
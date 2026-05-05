import vision from "@google-cloud/vision";

function getCredentials() {
  if (!process.env.GOOGLE_CREDENTIALS) {
    throw new Error("Missing GOOGLE_CREDENTIALS");
  }
  return JSON.parse(process.env.GOOGLE_CREDENTIALS);
}

const client = new vision.ImageAnnotatorClient({
  credentials: getCredentials(),
});

export async function extractTextFromImage(buffer: Buffer): Promise<string> {
  try {
    const [result] = await client.documentTextDetection({
      image: { content: buffer },
    });

    const text = result.fullTextAnnotation?.text || "";

    console.log("✅ OCR (DOCUMENT) length:", text.length);

    return text;
  } catch (error) {
    console.error("❌ OCR error:", error);
    return "";
  }
}
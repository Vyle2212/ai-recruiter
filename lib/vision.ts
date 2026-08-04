import { ImageAnnotatorClient } from "@google-cloud/vision";

let client: ImageAnnotatorClient | null = null;

function getVisionClient(): ImageAnnotatorClient {
  if (client) {
    return client;
  }

  const rawCredentials = process.env.GOOGLE_CREDENTIALS;

  if (!rawCredentials) {
    throw new Error("Missing GOOGLE_CREDENTIALS");
  }

  let credentials: Record<string, unknown>;

  try {
    credentials = JSON.parse(rawCredentials) as Record<string, unknown>;
  } catch {
    throw new Error("Invalid GOOGLE_CREDENTIALS JSON");
  }

  client = new ImageAnnotatorClient({
    credentials,
  });

  return client;
}

export async function extractTextFromImage(
  buffer: Buffer,
): Promise<string> {
  try {
    const visionClient = getVisionClient();

    const [result] = await visionClient.documentTextDetection({
      image: { content: buffer },
    });

    const text = result.fullTextAnnotation?.text || "";

    console.log("OCR document length:", text.length);

    return text;
  } catch (error) {
    console.error("OCR error:", error);
    return "";
  }
}

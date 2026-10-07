import { configuredPdfOcr } from "./cvPdfOcr";

export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  const pdf = (await import("pdf-parse")).default;
  const metadata = await pdf(buffer, { max: 1 });
  return configuredPdfOcr(buffer, metadata.numpages);
}

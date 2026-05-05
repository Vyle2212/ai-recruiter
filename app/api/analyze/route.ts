import { extractPDF } from "@/lib/pdf";
import { extractTextFromImage } from "@/lib/vision";

export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get("file") as File;

  if (!file) {
    return Response.json({ error: "No file uploaded" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let text = "";

  // ✅ 1. Try PDF first
  try {
    text = await extractPDF(buffer);
    console.log("PDF TEXT LENGTH:", text?.length);
  } catch (e) {
    console.log("PDF FAILED:", e);
  }

  // ✅ 2. Fallback OCR
  if (!text || text.length < 50) {
    console.log("Using OCR fallback...");
    try {
      text = await extractTextFromImage(buffer);
      console.log("OCR TEXT LENGTH:", text?.length);
    } catch (e) {
      console.log("OCR FAILED:", e);
    }
  }

  if (!text) {
    return Response.json({ error: "Cannot extract text" }, { status: 500 });
  }

  return Response.json({ text });
}
import { extractPDF } from "@/lib/pdf";
import { extractTextFromImage } from "@/lib/vision";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    // ✅ nhận đúng structure
    const jd = formData.get("jd") as File;
    const cvs = formData.getAll("cvs") as File[];

    if (!jd || cvs.length === 0) {
      return Response.json({ error: "Missing JD or CVs" }, { status: 400 });
    }

    console.log("🔥 API RUNNING");
    console.log("JD:", jd.name);
    console.log("CV count:", cvs.length);

    // ======================
    // 1. EXTRACT JD TEXT
    // ======================
    const jdBuffer = Buffer.from(await jd.arrayBuffer());

    let jdText = await extractPDF(jdBuffer);

    if (!jdText || jdText.length < 50) {
      console.log("👉 JD fallback OCR");
      jdText = await extractTextFromImage(jdBuffer);
    }

    console.log("JD TEXT LENGTH:", jdText.length);

    // ======================
    // 2. EXTRACT CVs
    // ======================
    const results = [];

    for (const cv of cvs) {
      const buffer = Buffer.from(await cv.arrayBuffer());

      let text = await extractPDF(buffer);

      if (!text || text.length < 50) {
        console.log(`👉 OCR fallback for ${cv.name}`);
        text = await extractTextFromImage(buffer);
      }

      console.log(`CV ${cv.name} length:`, text.length);

      // ======================
      // 3. SIMPLE SCORING (mock)
      // ======================
      const score = Math.min(100, Math.floor(text.length / 50));

      results.push({
        name: cv.name,
        score,
        strengths: ["Auto extracted"],
        gaps: ["Need AI matching upgrade"],
      });
    }

    return Response.json({ results });
  } catch (err) {
    console.error("❌ API ERROR:", err);
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}
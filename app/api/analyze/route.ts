import OpenAI from "openai";
import { extractPDF } from "@/lib/pdf";
import { extractTextFromPDF } from "@/lib/ocr";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  const formData = await req.formData();

  const jdFile = formData.get("jd") as File;
  const cvs = formData.getAll("cvs") as File[];

  if (!jdFile || cvs.length === 0) {
    return Response.json({ error: "Missing files" }, { status: 400 });
  }

  // 👉 JD
  const jdBuffer = Buffer.from(await jdFile.arrayBuffer());
  let jdText = await extractPDF(jdBuffer);

  if (!jdText || jdText.length < 50) {
    jdText = await extractTextFromPDF(jdBuffer);
  }

  if (!jdText) {
    return Response.json({ error: "JD unreadable" }, { status: 400 });
  }

  const results = [];

  for (const cv of cvs) {
    const buffer = Buffer.from(await cv.arrayBuffer());

    // 🔥 HYBRID LOGIC
    let cvText = await extractPDF(buffer);

    if (!cvText || cvText.length < 50) {
      cvText = await extractTextFromPDF(buffer);
    }

    if (!cvText) {
      results.push({
        name: cv.name,
        score: 0,
        strengths: [],
        gaps: ["Cannot read CV"],
      });
      continue;
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
You are a strict recruiter.

Return ONLY JSON:
{
  "score": number (0-100),
  "strengths": string[],
  "gaps": string[]
}
          `,
        },
        {
          role: "user",
          content: `
JOB DESCRIPTION:
${jdText}

CANDIDATE CV:
${cvText}
          `,
        },
      ],
    });

    let parsed;

    try {
      parsed = JSON.parse(response.choices[0].message.content || "{}");
    } catch {
      parsed = {
        score: 0,
        strengths: [],
        gaps: ["Parsing error"],
      };
    }

    results.push({
      name: cv.name,
      ...parsed,
    });
  }

  // 🔥 SORT
  results.sort((a, b) => b.score - a.score);

  return Response.json({ results });
}
import OpenAI from "openai";
import pdf from "pdf-parse";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function truncate(text: string, max = 12000) {
  return text?.slice(0, max) || "";
}

async function readPDF(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const data = await pdf(buffer);
  return data.text;
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const jdFile = formData.get("jd") as File;
    const cvFile = formData.get("cv") as File;

    if (!jdFile || !cvFile) {
      return Response.json({ error: "Missing files" }, { status: 400 });
    }

    // 👉 đọc PDF
    const jdText = await readPDF(jdFile);
    const cvText = await readPDF(cvFile);

    // 👉 check PDF scan (không đọc được)
    if (!jdText || jdText.length < 50) {
      return Response.json(
        { error: "JD PDF không đọc được (có thể là scan)" },
        { status: 400 }
      );
    }

    if (!cvText || cvText.length < 50) {
      return Response.json(
        { error: "CV PDF không đọc được (có thể là scan)" },
        { status: 400 }
      );
    }

    // 👉 tránh token quá lớn
    const safeJD = truncate(jdText);
    const safeCV = truncate(cvText);

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: `
Compare this CV with Job Description.

Return:
- Match score (%)
- Key strengths
- Missing skills

JD:
${safeJD}

CV:
${safeCV}
          `,
        },
      ],
    });

    return Response.json({
      result: response.choices[0]?.message?.content || "No result",
    });

  } catch (err: any) {
    console.error("API ERROR:", err);

    return Response.json(
      { error: err.message || "Server error" },
      { status: 500 }
    );
  }
}
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function truncate(text: string, max = 12000) {
  return text?.slice(0, max) || "";
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const jdFile = formData.get("jd") as File;
    const cvFile = formData.get("cv") as File;

    if (!jdFile || !cvFile) {
      return Response.json({ error: "Missing files" }, { status: 400 });
    }

    // 👉 đọc file (tạm thời chỉ đọc text đơn giản)
    const jdText = await jdFile.text();
    const cvText = await cvFile.text();

    const safeJD = truncate(jdText);
    const safeCV = truncate(cvText);

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: `
Compare this CV with JD.

JD:
${safeJD}

CV:
${safeCV}

Give:
- Match score (%)
- Key strengths
- Missing skills
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
      {
        error: err.message || "Server error",
      },
      { status: 500 }
    );
  }
}
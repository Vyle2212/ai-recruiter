import OpenAI from "openai";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const jd = formData.get("jd") as File;
    const cv = formData.get("cv") as File;

    if (!jd || !cv) {
      return Response.json({ error: "Missing files" }, { status: 400 });
    }

    const jdText = await jd.text();
    const cvText = await cv.text();

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    });

    const prompt = `
Compare this CV with job description.
Return JSON with:
- score (0-100)
- strengths
- gaps

JD:
${jdText}

CV:
${cvText}
`;

    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
    });

    return Response.json({
      result: res.choices[0].message.content,
    });
  } catch (e) {
    return Response.json({ error: "Analyze failed" }, { status: 500 });
  }
}
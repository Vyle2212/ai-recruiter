import OpenAI from "openai";

export const runtime = "nodejs"; // bắt buộc cho pdf-parse

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file1 = formData.get("file1") as File;
    const file2 = formData.get("file2") as File;

    if (!file1 || !file2) {
      return Response.json({ error: "Missing files" }, { status: 400 });
    }

    const buffer1 = Buffer.from(await file1.arrayBuffer());
    const buffer2 = Buffer.from(await file2.arrayBuffer());

    // ✅ FIX pdf-parse (dynamic import)
    const pdfParse = (await import("pdf-parse")).default;

    const data1 = await pdfParse(buffer1);
    const data2 = await pdfParse(buffer2);

    const text1 = data1.text.slice(0, 8000);
    const text2 = data2.text.slice(0, 8000);

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    });

    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: "You are a recruitment AI that compares CV and JD",
        },
        {
          role: "user",
          content: `
Compare these two documents:

CV:
${text1}

JOB DESCRIPTION:
${text2}

Return:
- Match score %
- Strengths
- Missing skills
- Final recommendation
          `,
        },
      ],
    });

    return Response.json({
      result: response.choices[0].message.content,
    });
  } catch (err: any) {
    console.error(err);
    return Response.json(
      { error: err.message || "Server error" },
      { status: 500 }
    );
  }
}
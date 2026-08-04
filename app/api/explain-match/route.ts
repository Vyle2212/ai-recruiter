import OpenAI from "openai";
import { NextResponse } from "next/server";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { candidate, job } = body;

    const prompt = `
You are an expert AI recruiter.

Explain why this candidate matches this job.

JOB:
${job.title}

${job.description}

CANDIDATE:
${candidate.name}

Skills:
${candidate.skills?.join(", ")}

Summary:
${candidate.summary || ""}

Write:
- 5 concise bullet points
- recruiter-friendly
- professional tone
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const explanation =
      response.choices[0].message.content || "No explanation generated.";

    return NextResponse.json({
      explanation,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error: "Failed to explain match",
      },
      {
        status: 500,
      }
    );
  }
}
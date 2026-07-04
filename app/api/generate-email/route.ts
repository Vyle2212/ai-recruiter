import OpenAI from "openai";
import { NextResponse } from "next/server";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const candidate = body.candidate;

    const prompt = `
Generate a professional recruiter outreach email.

Candidate Name:
${candidate.name}

Experience:
${candidate.experience}

Skills:
${candidate.skills?.join(", ")}

Write a concise recruiter outreach email.
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const email =
      completion.choices[0].message.content;

    return NextResponse.json({
      email,
    });
  } catch (err: any) {
    console.error(err);

    return NextResponse.json(
      {
        error: err.message,
      },
      {
        status: 500,
      }
    );
  }
}
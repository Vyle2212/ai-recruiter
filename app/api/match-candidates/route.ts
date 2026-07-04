import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const { jobId } = body;

    const { data: job } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", jobId)
      .single();

    if (!job) {
      return NextResponse.json(
        { error: "Job not found" },
        { status: 404 }
      );
    }

    const { data: candidates } = await supabase
      .from("candidates")
      .select("*");

    const matches = [];

    for (const candidate of candidates || []) {
      const prompt = `
      Compare candidate and job.

      Return ONLY JSON:

      {
        "score": 0-100,
        "reason": "short reason"
      }

      JOB:
      ${JSON.stringify(job)}

      CANDIDATE:
      ${JSON.stringify(candidate)}
      `;

      const completion =
        await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
        });

      const content =
        completion.choices[0].message.content || "{}";

      const cleaned = content
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

      let parsed;

      try {
        parsed = JSON.parse(cleaned);
      } catch {
        parsed = {
          score: 0,
          reason: "Parse failed",
        };
      }

      matches.push({
        candidate_id: candidate.id,
        job_id: job.id,
        score: parsed.score || 0,
        reason: parsed.reason || "",
      });
    }

    const { error } = await supabase
      .from("matches")
      .insert(matches);

    if (error) {
      console.log(error);

      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(matches);
  } catch (err) {
    console.log(err);

    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}
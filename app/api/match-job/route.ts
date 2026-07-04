import { NextResponse } from "next/server";
import OpenAI from "openai";
import { supabase } from "@/lib/supabase";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const summary = body.summary;

    if (!summary) {
      return NextResponse.json(
        {
          error: "Missing summary",
        },
        {
          status: 400,
        }
      );
    }

    // CREATE EMBEDDING
    const embeddingResponse =
      await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: summary,
      });

    const embedding =
      embeddingResponse.data[0].embedding;

    // MATCH CANDIDATES
    const { data, error } =
      await supabase.rpc(
        "match_candidates",
        {
          query_embedding: embedding,
          match_threshold: 0.2,
          match_count: 10,
        }
      );

    if (error) {
      console.log(error);

      return NextResponse.json(
        {
          error: error.message,
        },
        {
          status: 500,
        }
      );
    }

    // ADD SCORE %
    const formatted =
      data?.map((candidate: any) => ({
        ...candidate,
        score:
          candidate.similarity || 0,
      })) || [];

    return NextResponse.json({
      success: true,
      matches: formatted,
    });
  } catch (error: any) {
    console.log(error);

    return NextResponse.json(
      {
        error: error.message,
      },
      {
        status: 500,
      }
    );
  }
}
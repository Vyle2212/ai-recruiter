import { loadCandidateSearchMutationEligibility } from "@/lib/candidateSearchMutationGate";
import { recruiterSearchAuthorizationDenied, recruiterSearchPrivateNoStoreHeaders, requireRecruiterSearchAuthorization } from "@/lib/recruiterSearchAuthorization";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { createLazyOpenAiClient } from "@/lib/runtimeClients";

const openai = createLazyOpenAiClient();

export async function POST(req: Request) {
  const authorization = await requireRecruiterSearchAuthorization({
    permission: "search:read",
    route: "/api/match-job",
  });
  if (!authorization.allowed)
    return recruiterSearchAuthorizationDenied(authorization);
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

    const lifecycle = await loadCandidateSearchMutationEligibility(
      supabase,
      (data || []).map((candidate: any) => candidate.candidate_id || candidate.id),
    );

    // An RPC result is only a ranking hint. Current candidate lifecycle state
    // remains authoritative before any candidate is returned.
    const formatted =
      data
        ?.filter((candidate: any) =>
          lifecycle.eligibleIds.has(
            String(candidate.candidate_id || candidate.id || "").trim(),
          ),
        )
        .map((candidate: any) => ({
          ...candidate,
          score: candidate.similarity || 0,
        })) || [];

    return NextResponse.json({
      success: true,
      matches: formatted,
    }, { headers: recruiterSearchPrivateNoStoreHeaders });
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

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  createCandidateSupabaseAdminClient,
} from "@/lib/candidateSupabase";

import {
  adaptCandidatesToSearchV2Documents,
} from "@/lib/candidateSearchV2Adapter";

import {
  searchCandidatesV2,
} from "@/lib/candidateSearchV2Engine";

import type {
  CandidateSearchV2Document,
  CandidateSearchV2Request,
} from "@/lib/candidateSearchV2Types";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

type SearchV2Body =
  CandidateSearchV2Request & {
    documents?:
      CandidateSearchV2Document[];

    candidates?:
      unknown[];
  };

function isRecord(
  value: unknown,
): value is Record<
  string,
  unknown
> {
  return Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value),
  );
}

async function readRequestBody(
  request: NextRequest,
): Promise<SearchV2Body> {
  const body: unknown =
    await request.json();

  if (
    !isRecord(body)
  ) {
    throw new Error(
      "Request body must be a JSON object.",
    );
  }

  return body as SearchV2Body;
}

async function fetchCandidateSource() {
  const supabase =
    createCandidateSupabaseAdminClient();

  const {
    data,
    error,
  } =
    await supabase
      .from("candidates")
      .select("*")
      .order(
        "updated_at",
        {
          ascending:
            false,
          nullsFirst:
            false,
        },
      )
      .limit(1000);

  if (error) {
    throw new Error(
      `Candidate Supabase query failed: ${error.message}`,
    );
  }

  return data || [];
}

export async function POST(
  request: NextRequest,
) {
  try {
    const body =
      await readRequestBody(
        request,
      );

    const rawCandidateSource =
      Array.isArray(
        body.documents,
      )
        ? body.documents
        : Array.isArray(
              body.candidates,
            )
          ? body.candidates
          : await fetchCandidateSource();

    const documents =
      Array.isArray(
        body.documents,
      )
        ? body.documents
        : adaptCandidatesToSearchV2Documents(
            rawCandidateSource,
          );

    const result =
      searchCandidatesV2(
        documents,
        {
          query:
            String(
              body.query ||
              "",
            ),

          mode:
            body.mode,

          filters:
            body.filters,

          page:
            body.page,

          pageSize:
            body.pageSize,

          semanticWeight:
            body.semanticWeight,

          keywordWeight:
            body.keywordWeight,

          qualityWeight:
            body.qualityWeight,

          recencyWeight:
            body.recencyWeight,

          minimumScore:
            body.minimumScore,
        },
      );

    return NextResponse.json(
      {
        ...result,

        source: {
          type:
            Array.isArray(
              body.documents,
            )
              ? "request_documents"
              : Array.isArray(
                    body.candidates,
                  )
                ? "request_candidates"
                : "candidate_api",

          adaptedDocuments:
            documents.length,
        },
      },
      {
        status:
          200,

        headers: {
          "Cache-Control":
            "no-store",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to perform Candidate Search V2.",

        safety: {
          readOnly:
            true,

          candidateWrites:
            0,

          workflowWrites:
            0,

          automaticShortlists:
            0,

          emailSends:
            0,
        },
      },
      {
        status:
          400,
      },
    );
  }
}
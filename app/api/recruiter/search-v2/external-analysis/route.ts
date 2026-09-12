import { NextRequest, NextResponse } from "next/server";
import { ExternalSourceError } from "@/lib/externalCandidateSourceProvider";
import { generateExternalTalentAnalysis } from "@/lib/externalTalentAnalysis";
import {
  externalTalentAnalysisCapability,
  hasSufficientExternalTalentEvidence,
} from "@/lib/externalTalentAnalysisCapability";
import { authorizeRecruiterJobsRead } from "@/lib/recruiterJobsAuthorization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const privateNoStoreHeaders = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie, Authorization",
};

async function authorize() {
  const authorization = await authorizeRecruiterJobsRead();
  if (authorization.allowed) return null;
  return NextResponse.json(
    { error: authorization.code },
    { status: authorization.status, headers: privateNoStoreHeaders },
  );
}

export async function GET() {
  const denied = await authorize();
  if (denied) return denied;
  return NextResponse.json(externalTalentAnalysisCapability(), {
    headers: privateNoStoreHeaders,
  });
}

export async function POST(request: NextRequest) {
  const denied = await authorize();
  if (denied) return denied;
  const started = performance.now();

  try {
    const capability = externalTalentAnalysisCapability();
    if (!capability.enabled)
      return NextResponse.json(
        {
          error: capability.message,
          reason: capability.reason,
          capability,
        },
        { status: 503, headers: privateNoStoreHeaders },
      );

    const body = await request.json();
    if (
      !body ||
      typeof body !== "object" ||
      typeof body.candidateId !== "string" ||
      !Array.isArray(body.evidence)
    )
      return NextResponse.json(
        { error: "Invalid analysis request." },
        { status: 400, headers: privateNoStoreHeaders },
      );

    const evidence = body.evidence
      .slice(0, 20)
      .map((item: unknown) => {
        const value =
          item && typeof item === "object"
            ? (item as Record<string, unknown>)
            : {};
        return {
          label: String(value.label || "Evidence").slice(0, 120),
          excerpt: String(value.excerpt || "")
            .normalize("NFKC")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 800),
        };
      })
      .filter((item: { excerpt: string }) => item.excerpt);

    if (!hasSufficientExternalTalentEvidence(evidence, capability))
      return NextResponse.json(
        {
          error:
            "More candidate-owned profile evidence is required before AI analysis.",
          reason: "insufficient_evidence",
          capability,
        },
        { status: 422, headers: privateNoStoreHeaders },
      );

    const analysis = await generateExternalTalentAnalysis(
      {
        candidateId: body.candidateId,
        headline: body.headline,
        location: body.location,
        employer: body.employer,
        evidence,
      },
      request.signal,
    );
    return NextResponse.json(
      {
        analysis,
        timing: { optionalClaudeMs: performance.now() - started },
      },
      { headers: privateNoStoreHeaders },
    );
  } catch (error) {
    const failure =
      error instanceof ExternalSourceError
        ? error
        : new ExternalSourceError(
            "PROVIDER_ERROR",
            "AI Match Analysis is temporarily unavailable.",
          );
    return NextResponse.json(
      { error: failure.message, reason: failure.code },
      {
        status: failure.code === "RATE_LIMITED" ? 429 : 503,
        headers: privateNoStoreHeaders,
      },
    );
  }
}

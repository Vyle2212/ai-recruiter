import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import {
  normalizeText,
  parseSkills,
} from "@/lib/candidate-utils";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;

    // =========================
    // GET JOB
    // =========================

    const { data: job, error: jobError } =
      await supabase
        .from("jobs")
        .select("*")
        .eq("id", jobId)
        .single();

    if (jobError || !job) {
      return NextResponse.json(
        { error: "Job not found" },
        { status: 404 }
      );
    }

    // =========================
    // GET CANDIDATES
    // =========================

    const {
      data: candidates,
      error: candidatesError,
    } = await supabase
      .from("candidates")
      .select("*");

    if (candidatesError) {
      return NextResponse.json(
        { error: candidatesError.message },
        { status: 500 }
      );
    }

    const jobSkills = parseSkills(job.skills);

    // =========================
    // MATCHING
    // =========================

    const matches = candidates.map(
      (candidate: any) => {
        const candidateSkills = parseSkills(
          candidate.skills
        );

        const matchedSkills =
          candidateSkills.filter((skill) =>
            jobSkills.includes(skill)
          );

        const score =
          jobSkills.length > 0
            ? Math.round(
                (matchedSkills.length /
                  jobSkills.length) *
                  100
              )
            : 0;

        return {
          id: candidate.id,
          name: candidate.name,
          email: candidate.email,
          phone: candidate.phone,
          location: candidate.location,
          score,
          matchedSkills,
          skills: candidateSkills,
          latestUpdated:
            candidate.latest_cv_uploaded_at,
          summary:
            matchedSkills.length > 0
              ? `Matched skills: ${matchedSkills.join(
                  ", "
                )}`
              : "No direct skill match",
        };
      }
    );

    // REMOVE DUPLICATES
    const uniqueMatches = matches.filter(
      (match, index, self) =>
        index ===
        self.findIndex((m) => {
          const sameEmail =
            m.email &&
            match.email &&
            normalizeText(m.email) ===
              normalizeText(match.email);

          const sameName =
            normalizeText(m.name) ===
            normalizeText(match.name);

          return sameEmail || sameName;
        })
    );

    // SORT DESC
    uniqueMatches.sort(
      (a, b) => b.score - a.score
    );

    return NextResponse.json(uniqueMatches);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
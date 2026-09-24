import { NextResponse } from "next/server";

import { loadCandidate360ProfileForOwner } from "@/lib/candidate360Data";
import { authorizeCandidateCvUpload } from "@/lib/candidateCvAuthorization";
import { evaluateCandidateProfileCompletion } from "@/lib/candidateProfileIngestion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie, Authorization",
};

export async function GET() {
  const authorization = await authorizeCandidateCvUpload();
  if (!authorization.allowed)
    return NextResponse.json(
      { error: authorization.code },
      { status: authorization.status, headers },
    );
  try {
    const profile = await loadCandidate360ProfileForOwner(
      authorization.scope.candidateId,
    );
    if (!profile)
      return NextResponse.json(
        { error: "candidate_record_missing" },
        { status: 404, headers },
      );
    const completion = evaluateCandidateProfileCompletion(
      {
        id: profile.candidateId,
        name: profile.displayName.value,
        email: authorization.scope.verifiedAuthEmail,
        phone: profile.contactInfo.phone.value,
        current_title: profile.currentTitle.value,
        current_company: profile.currentCompany.value,
        location: profile.location.value,
        experience: profile.workExperience,
        skills: profile.techSkills.map((item) => item.name.value),
        sap_modules: profile.sapModules.map((item) => item.name.value),
        projects: profile.projectExperience,
        education: profile.education,
        languages: profile.languages,
        profile_confirmation_status:
          authorization.scope.profileConfirmationStatus,
      },
      { requireCandidateConfirmation: true },
    );
    return NextResponse.json(
      {
        profile,
        verifiedEmail: authorization.scope.verifiedAuthEmail,
        version: authorization.scope.candidateUpdatedAt,
        profileStatus: authorization.scope.profileConfirmationStatus,
        searchable: completion.searchable,
        confirmationRequired: completion.confirmationRequired,
        missingRequiredFields: completion.missingRequiredFields,
      },
      { headers },
    );
  } catch {
    return NextResponse.json(
      { error: "candidate_profile_unavailable" },
      { status: 503, headers },
    );
  }
}

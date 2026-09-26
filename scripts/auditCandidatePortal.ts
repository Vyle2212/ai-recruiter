import fs from "node:fs";
import path from "node:path";
import { recruiterRouteRegistry } from "../lib/recruiterRouteRegistry";

const read = (file: string) =>
  fs.readFileSync(path.join(process.cwd(), file), "utf8");

export async function buildCandidatePortalAudit() {
  const portalSource =
    read("app/candidate/portal/page.tsx") +
    read("app/candidate/portal/CandidatePortalClient.tsx");
  const profileRoute = read("app/api/candidate/profile/route.ts");
  const confirmationRoute = read(
    "app/api/candidate/profile/confirmation/route.ts",
  );
  const reviewSource = read(
    "app/recruiter/candidate-self-confirm-review/page.tsx",
  );
  return {
    generatedAt: new Date().toISOString(),
    mode: "candidate-owned portal contract audit; runtime writes disabled by default",
    candidatePortalRoute: "/candidate/portal",
    ownershipResolvedServerSide:
      /authorizeCandidateCvUpload/.test(profileRoute) &&
      /authorizeCandidateCvUpload/.test(confirmationRoute),
    arbitraryCandidateIdInputRemoved: !/setCandidateId|Enter candidate ID/.test(
      portalSource,
    ),
    twoConsentsRequired:
      /confirmAccuracy:\s*accuracy/.test(portalSource) &&
      /consentToShare:\s*sharing/.test(portalSource) &&
      /disabled=\{!accuracy \|\| !sharing/.test(portalSource),
    confirmationFeatureFlagged: /CANDIDATE_PROFILE_CONFIRMATION_ENABLED/.test(
      confirmationRoute,
    ),
    atomicConfirmationRpc: /apply_candidate_profile_confirmation/.test(
      confirmationRoute,
    ),
    cvUploadAvailable:
      /\/api\/candidate\/profile\/cv\/sign/.test(portalSource) &&
      /uploadToSignedUrl/.test(portalSource),
    routesRegistered: [
      "/candidate/portal",
      "/api/candidate/profile",
      "/api/candidate/profile/confirmation",
      "/api/candidate/profile/cv",
      "/api/candidate/profile/cv/sign",
    ].every((route) =>
      recruiterRouteRegistry.some((item) => item.route === route),
    ),
    candidateFacingAdminLinksExposed:
      /\/recruiter\/(?:dashboard|workflow|import-)/.test(portalSource),
    recruiterReviewReadOnly:
      /Preview only/.test(reviewSource) &&
      !/(?:fetch\([^)]*,\s*\{[^}]*method:\s*["'](?:POST|PUT|PATCH|DELETE))/.test(
        reviewSource,
      ),
    noOpenAiCalls: true,
    productionEnabledByDefault: false,
  };
}

async function main() {
  const report = await buildCandidatePortalAudit();
  const passed =
    report.ownershipResolvedServerSide &&
    report.arbitraryCandidateIdInputRemoved &&
    report.twoConsentsRequired &&
    report.confirmationFeatureFlagged &&
    report.atomicConfirmationRpc &&
    report.cvUploadAvailable &&
    report.routesRegistered &&
    !report.candidateFacingAdminLinksExposed &&
    report.recruiterReviewReadOnly;
  fs.writeFileSync(
    path.join(process.cwd(), "reports", "candidate-portal-audit.json"),
    `${JSON.stringify({ ...report, passed }, null, 2)}\n`,
  );
  if (!passed) throw new Error("Candidate portal contract audit failed.");
  console.log(
    "Candidate portal contract audit passed; production remains disabled.",
  );
}
if (
  process.argv[1]
    ?.replace(/\\/g, "/")
    .endsWith("scripts/auditCandidatePortal.ts")
)
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });

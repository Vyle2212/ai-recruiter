import { AuthHeader, AuthLinks, DisabledForm } from "../AuthUiPreview";
import CandidateRegistrationForm from "./CandidateRegistrationForm";
import Link from "next/link";
import { buildAuthFormPreview } from "../../../lib/loginUiPreview";
import { candidateRegistrationUiConfiguration } from "../../../lib/candidateRegistrationRuntime";

const callbackMessages = {
  invalid:
    "We could not finish verification in this browser. If you already verified your email, sign in with your email and password to continue. Otherwise, open the latest verification link in the same browser window where you registered.",
  review_required:
    "Your verified identity needs manual review before profile access.",
  temporarily_unavailable:
    "Verification is temporarily unavailable. Please try the link again later.",
} as const;

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const registration = candidateRegistrationUiConfiguration();
  const status = (await searchParams).status;
  const callbackMessage =
    typeof status === "string" && status in callbackMessages
      ? callbackMessages[status as keyof typeof callbackMessages]
      : null;
  return (
    <main className="min-h-screen bg-[#05070A] text-slate-100">
      {registration.enabled ? (
        <header className="border-b border-slate-800 bg-[#070A0F] px-6 py-8">
          <div className="mx-auto max-w-3xl">
            <h1 className="text-4xl font-semibold">Candidate account</h1>
            <p className="mt-2 text-cyan-100">
              Create and verify your account before uploading your CV.
            </p>
          </div>
        </header>
      ) : (
        <AuthHeader
          title="Candidate account"
          subtitle="Create and verify your account before uploading your CV."
        />
      )}
      <div className="mx-auto max-w-3xl space-y-6 px-6 py-8">
        {registration.enabled ? (
          <CandidateRegistrationForm siteKey={registration.turnstileSiteKey} />
        ) : (
          <DisabledForm
            form={buildAuthFormPreview("signup")}
            buttonLabel="Candidate registration is not enabled"
          />
        )}
        <p className="text-sm text-slate-400">
          Verify your email before profile access. Existing imported profiles
          are never claimed automatically.
        </p>
        {callbackMessage ? (
          <p
            className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-100"
            role="status"
          >
            {callbackMessage}
          </p>
        ) : null}
        {registration.enabled ? (
          <Link
            className="inline-block text-sm text-cyan-300"
            href="/auth/login"
          >
            Already have an account? Sign in
          </Link>
        ) : (
          <AuthLinks />
        )}
      </div>
    </main>
  );
}

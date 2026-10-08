import { AuthHeader, AuthLinks, DisabledForm } from "../AuthUiPreview";
import CandidateRegistrationForm from "./CandidateRegistrationForm";
import { buildAuthFormPreview } from "../../../lib/loginUiPreview";
import { candidateRegistrationUiConfiguration } from "../../../lib/candidateRegistrationRuntime";

export default function SignupPage() {
  const registration = candidateRegistrationUiConfiguration();
  return (
    <main className="min-h-screen bg-[#05070A] text-slate-100">
      <AuthHeader
        title="Candidate account"
        subtitle="Create and verify your account before uploading your CV."
      />
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
        <AuthLinks />
      </div>
    </main>
  );
}

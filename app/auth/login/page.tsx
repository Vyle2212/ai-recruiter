import Link from "next/link";
import { safeRequestedAuthRoute } from "../../../lib/stagingAuthRedirect";

import {
  AuthHeader,
  card,
} from "../AuthUiPreview";
import {
  StagingRuntimeSignInForm,
} from "../staging/runtime/StagingRuntimeAuthForms";

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const requestedNext = safeRequestedAuthRoute(typeof query.next === "string" ? query.next : null);
  return (
    <main className="min-h-screen bg-[#05070A] text-slate-100">
      <AuthHeader
        title="Sign in"
        subtitle="Approved Supabase authentication for the staging environment."
      />

      <div className="mx-auto max-w-3xl space-y-6 px-6 py-8">
        <section className={card}>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-cyan-500/40 px-3 py-1 text-cyan-200">
              Staging only
            </span>

            <span className="rounded-full border border-rose-500/40 px-3 py-1 text-rose-200">
              Production blocked
            </span>
          </div>

          <p className="mt-4 text-sm text-slate-400">
            Successful authentication redirects to the portal assigned
            to the active staging profile role.
          </p>
        </section>

        <StagingRuntimeSignInForm redirectOnSuccess requestedNext={requestedNext} />

        <section className={card}>
          <div className="flex flex-wrap gap-4 text-sm text-cyan-300">
            <Link href="/auth/staging/runtime">
              Open runtime diagnostics
            </Link>

            <Link href="/auth/forgot-password">
              Forgot password
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
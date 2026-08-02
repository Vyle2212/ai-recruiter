import Link from "next/link";
import { notFound } from "next/navigation";

import { buildCurrentStagingAuthExecutionGate } from "../../../../lib/stagingAuthExecutionGateRuntime";
import { canUseSupabaseStagingRuntimeProvider } from "../../../../lib/stagingAuthRuntimeFactory";

import {
  StagingRuntimeAuthDiagnostics,
  StagingRuntimeSignInForm,
  StagingRuntimeSignOutForm,
} from "./StagingRuntimeAuthForms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const badge =
  "rounded-full border border-slate-700 px-3 py-1";

export default function StagingRuntimeAuthPage() {
  const gate = buildCurrentStagingAuthExecutionGate();

  if (!canUseSupabaseStagingRuntimeProvider(gate)) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[#05070A] text-slate-100">
      <header className="border-b border-slate-800 bg-[#070A0F] px-6 py-8">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap gap-2 text-xs">
            <span className={badge}>Staging only</span>
            <span className={badge}>Gate approved</span>
            <span className={badge}>
              Supabase runtime provider
            </span>
            <span className={badge}>
              Production blocked
            </span>
          </div>

          <h1 className="mt-4 text-4xl font-semibold">
            Staging Authentication Runtime
          </h1>

          <p className="mt-2 text-cyan-100">
            Real Supabase authentication for the approved staging
            environment.
          </p>

          <p className="mt-2 text-sm text-slate-400">
            Environment: {gate.environment} · Mode: {gate.mode} ·
            Status: {gate.status}
          </p>

          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <Link
              className="text-cyan-300"
              href="/auth/login"
            >
              Open preview login
            </Link>

            <Link
              className="text-cyan-300"
              href="/admin/staging-execution-gate"
            >
              Review execution gate
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-8 px-6 py-8">
        <StagingRuntimeSignInForm />

        <StagingRuntimeSignOutForm />

        <StagingRuntimeAuthDiagnostics />

        <section className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-5">
          <h2 className="font-semibold text-rose-100">
            Production protection
          </h2>

          <p className="mt-2 text-sm text-slate-300">
            This page returns 404 unless the current environment is
            staging and every required execution-gate approval is
            satisfied. Production authentication remains blocked.
          </p>
        </section>
      </div>
    </main>
  );
}
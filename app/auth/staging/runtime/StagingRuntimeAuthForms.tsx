"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { resolvePostLoginRoute } from "../../../../lib/stagingAuthRedirect";

import {
  stagingRuntimeProfileAction,
  stagingRuntimeRefreshAction,
  stagingRuntimeSessionAction,
  stagingRuntimeSignInAction,
  stagingRuntimeSignOutAction,
  stagingRuntimeUserAction,
} from "../../runtime-actions";

import {
  buildInitialStagingAuthRuntimeActionResult,
  type StagingAuthRuntimeActionResult,
} from "../../../../lib/stagingAuthRuntimeActionTypes";

import { StagingRuntimeAuthResultPanel } from "./StagingRuntimeAuthResultPanel";

const card =
  "rounded-2xl border border-slate-800 bg-[#0B0F16] p-6";

const input =
  "mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 p-3";

const button =
  "mt-5 w-full rounded-lg bg-cyan-300 px-4 py-3 font-semibold text-slate-950 disabled:opacity-50";

export function StagingRuntimeSignInForm({
  redirectOnSuccess = false,
  requestedNext,
}: {
  redirectOnSuccess?: boolean;
  requestedNext?: string | null;
} = {}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    stagingRuntimeSignInAction,
    buildInitialStagingAuthRuntimeActionResult("sign_in"),
  );

  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state.ok) return;

    formRef.current?.reset();

    if (redirectOnSuccess && state.role) {
      const destination = resolvePostLoginRoute(state.role, requestedNext);

      router.replace(destination);
    }
  }, [redirectOnSuccess, requestedNext, router, state.ok, state.role]);

  return (
    <section className={card}>
      <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-100">
        Staging runtime only. Credentials are submitted to the
        approved Supabase staging project only when the execution
        gate is fully approved.
      </div>

      <form action={action} ref={formRef}>
        <label className="block text-sm">
          Email
          <input
            autoComplete="email"
            className={input}
            name="email"
            type="email"
            required
          />
        </label>

        <label className="mt-4 block text-sm">
          Password
          <input
            autoComplete="current-password"
            className={input}
            name="password"
            type="password"
            required
          />
        </label>

        <button className={button} disabled={pending}>
          {pending ? "Signing inâ€¦" : "Sign in to staging"}
        </button>
      </form>

      <StagingRuntimeAuthResultPanel state={state} />
    </section>
  );
}

export function StagingRuntimeSignOutForm() {
  const [state, action, pending] = useActionState(
    stagingRuntimeSignOutAction,
    buildInitialStagingAuthRuntimeActionResult("sign_out"),
  );

  return (
    <section className={card}>
      <form action={action}>
        <button className={button + " mt-0"} disabled={pending}>
          {pending ? "Signing outâ€¦" : "Sign out of staging"}
        </button>
      </form>

      <StagingRuntimeAuthResultPanel state={state} />
    </section>
  );
}

function DiagnosticButton({
  label,
  operation,
  action,
}: {
  label: string;
  operation:
    | "get_session"
    | "get_user"
    | "get_profile"
    | "refresh_session";
  action: (
    previousState: StagingAuthRuntimeActionResult | null,
    formData: FormData,
  ) => Promise<StagingAuthRuntimeActionResult>;
}) {
  const [state, formAction, pending] = useActionState(
    action,
    buildInitialStagingAuthRuntimeActionResult(operation),
  );

  return (
    <article className={card}>
      <form action={formAction}>
        <button
          className={button + " mt-0"}
          disabled={pending}
        >
          {pending ? "Runningâ€¦" : label}
        </button>
      </form>

      <StagingRuntimeAuthResultPanel state={state} />
    </article>
  );
}

export function StagingRuntimeAuthDiagnostics() {
  return (
    <section>
      <h2 className="text-xl font-semibold">
        Staging session diagnostics
      </h2>

      <p className="mt-2 text-sm text-slate-400">
        Results are sanitized. Tokens, passwords, full emails and
        stack traces are never returned to the client.
      </p>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <DiagnosticButton
          action={stagingRuntimeSessionAction}
          label="Get staging session"
          operation="get_session"
        />

        <DiagnosticButton
          action={stagingRuntimeUserAction}
          label="Get authenticated user"
          operation="get_user"
        />

        <DiagnosticButton
          action={stagingRuntimeProfileAction}
          label="Get active profile"
          operation="get_profile"
        />

        <DiagnosticButton
          action={stagingRuntimeRefreshAction}
          label="Refresh staging session"
          operation="refresh_session"
        />
      </div>
    </section>
  );
}
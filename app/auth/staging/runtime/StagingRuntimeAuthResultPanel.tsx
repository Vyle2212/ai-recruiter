"use client";

import type { StagingAuthRuntimeActionResult } from "../../../../lib/stagingAuthRuntimeActionTypes";

export function StagingRuntimeAuthResultPanel({
  state,
}: {
  state: StagingAuthRuntimeActionResult;
}) {
  if (
    state.status === "disabled" &&
    !state.realActionExecuted &&
    state.blockerKeys.length === 0
  ) {
    return null;
  }

  return (
    <section
      aria-live="polite"
      className="mt-4 rounded-xl border border-cyan-500/25 bg-cyan-500/5 p-4 text-sm"
    >
      <h3 className="font-semibold text-cyan-100">
        Staging runtime result
      </h3>

      <div className="mt-3 space-y-1 text-slate-300">
        <p>Operation: {state.operation}</p>
        <p>Provider: {state.provider}</p>
        <p>Status: {state.status}</p>
        <p>Successful: {state.ok ? "yes" : "no"}</p>
        <p>{state.safeMessage}</p>

        {state.errorCode ? (
          <p>Error code: {state.errorCode}</p>
        ) : null}

        {state.emailMasked ? (
          <p>Masked email: {state.emailMasked}</p>
        ) : null}

        {state.role ? <p>Role: {state.role}</p> : null}

        {state.authenticated !== undefined ? (
          <p>
            Authenticated: {state.authenticated ? "yes" : "no"}
          </p>
        ) : null}

        {state.sessionStatus ? (
          <p>Session: {state.sessionStatus}</p>
        ) : null}

        <p>
          Blockers: {state.blockerKeys.join(", ") || "none"}
        </p>

        <p>
          Warnings: {state.warningKeys.join(", ") || "none"}
        </p>

        <p>
          Real staging action executed:{" "}
          {state.realActionExecuted ? "yes" : "no"}
        </p>

        <p>Sensitive input returned: no</p>
        <p>Token returned: no</p>
        <p>Production auth remains blocked: yes</p>
      </div>
    </section>
  );
}
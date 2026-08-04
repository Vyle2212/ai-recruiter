"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { stagingRuntimeSignOutAction } from "../../runtime-actions";
import {
  buildInitialStagingAuthRuntimeActionResult,
} from "../../../../lib/stagingAuthRuntimeActionTypes";

export function StagingRuntimeSignOutButton({
  className = "",
}: {
  className?: string;
}) {
  const router = useRouter();

  const [state, action, pending] = useActionState(
    stagingRuntimeSignOutAction,
    buildInitialStagingAuthRuntimeActionResult("sign_out"),
  );

  useEffect(() => {
    if (!state.ok) return;

    router.replace("/auth/login?reason=signed_out");
    router.refresh();
  }, [router, state.ok]);

  return (
    <form action={action}>
      <button
        className={
          "rounded-lg border border-rose-500/40 px-3 py-2 text-xs font-medium text-rose-100 hover:bg-rose-500/10 disabled:opacity-50 " +
          className
        }
        disabled={pending}
        type="submit"
      >
        {pending ? "Signing out..." : "Sign out"}
      </button>
    </form>
  );
}
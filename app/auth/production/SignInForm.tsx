"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { productionAdminSignIn } from "./actions";

export function ProductionAdminSignInForm() {
  const router = useRouter();
  const [state, action, pending] = useActionState(productionAdminSignIn, {
    ok: false,
    message: "",
  });

  useEffect(() => {
    if (state.ok) router.replace("/admin/production");
  }, [router, state.ok]);

  return (
    <form action={action} className="mt-6 space-y-4" autoComplete="on">
      <label className="block text-sm">
        Email
        <input
          className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 p-3"
          type="email"
          name="email"
          autoComplete="email"
          required
        />
      </label>
      <label className="block text-sm">
        Password
        <input
          className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 p-3"
          type="password"
          name="password"
          autoComplete="current-password"
          required
        />
      </label>
      <button
        className="rounded-lg bg-cyan-300 px-5 py-3 font-semibold text-slate-950 disabled:opacity-50"
        disabled={pending}
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
      {state.message && (
        <p role="status" className="text-sm">
          {state.message}
        </p>
      )}
    </form>
  );
}

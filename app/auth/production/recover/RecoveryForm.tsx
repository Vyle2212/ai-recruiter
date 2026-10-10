"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { productionAdminRequestRecovery } from "../actions";

export function ProductionRecoveryForm() {
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  async function requestRecovery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const email = String(new FormData(form).get("email") || "");
    setPending(true);
    await productionAdminRequestRecovery(email).catch(() => false);
    setPending(false);
    form.reset();
    setSent(true);
  }

  if (sent)
    return (
      <p className="mt-6" role="status">
        If this verified admin account exists, check its inbox for a password
        recovery link. Open the link on this production site.
      </p>
    );

  return (
    <form onSubmit={requestRecovery} className="mt-6 space-y-4">
      <p>Enter the email address of your verified admin account.</p>
      <label className="block text-sm">
        Email
        <input
          name="email"
          type="email"
          autoComplete="email"
          maxLength={254}
          required
          className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 p-3"
        />
      </label>
      <button
        disabled={pending}
        className="rounded-lg bg-cyan-300 px-5 py-3 font-semibold text-slate-950 disabled:opacity-50"
      >
        {pending ? "Sending…" : "Send recovery link"}
      </button>
      <Link className="block text-cyan-300 underline" href="/auth/login">
        Back to sign in
      </Link>
    </form>
  );
}

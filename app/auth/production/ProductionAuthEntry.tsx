"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ProductionInviteForm } from "./invite/InviteForm";

export function ProductionAuthEntry() {
  const [incomingLink, setIncomingLink] = useState<boolean | null>(null);

  useEffect(() => {
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const valid =
      (fragment.get("type") === "invite" ||
        fragment.get("type") === "recovery") &&
      Boolean(fragment.get("access_token") && fragment.get("refresh_token"));
    if (!valid && window.location.hash)
      window.history.replaceState(null, "", window.location.pathname);
    setIncomingLink(valid);
  }, []);

  return (
    <main className="min-h-screen bg-[#05070A] px-6 py-12 text-slate-100">
      <div className="mx-auto max-w-lg rounded-2xl border border-slate-800 bg-[#0B0F16] p-6">
        <h1 className="text-2xl font-semibold">AI Recruiter Admin</h1>
        {incomingLink === null ? (
          <p className="mt-6" role="status">
            Checking your link…
          </p>
        ) : incomingLink ? (
          <div className="mt-6">
            <ProductionInviteForm />
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            <p>Sign in with your verified admin account.</p>
            <Link className="block text-cyan-300 underline" href="/auth/login">
              Admin sign in
            </Link>
            <Link
              className="block text-cyan-300 underline"
              href="/auth/production/recover"
            >
              Set or reset password
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}

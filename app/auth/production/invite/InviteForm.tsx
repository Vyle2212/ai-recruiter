"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  productionAdminAcceptInvite,
  productionAdminSetPassword,
} from "../actions";

type State = "checking" | "ready" | "done" | "expired";

export function ProductionInviteForm() {
  const router = useRouter();
  const started = useRef(false);
  const [state, setState] = useState<State>("checking");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    // Never leave the session tokens visible in the address bar.
    window.history.replaceState(null, "", window.location.pathname);
    const accessToken = fragment.get("access_token") || undefined;
    const refreshToken = fragment.get("refresh_token") || undefined;
    const type = fragment.get("type");
    fragment.delete("access_token");
    fragment.delete("refresh_token");

    if (
      (accessToken || refreshToken) &&
      type !== "invite" &&
      type !== "recovery"
    ) {
      setState("expired");
      return;
    }
    void productionAdminAcceptInvite({ accessToken, refreshToken })
      .then((ok) => setState(ok ? "ready" : "expired"))
      .catch(() => setState("expired"));
  }, []);

  async function setPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const password = String(data.get("password") || "");
    const confirmation = String(data.get("confirmation") || "");
    if (password.length < 12 || password !== confirmation) {
      setMessage("Use at least 12 characters and matching passwords.");
      return;
    }
    setPending(true);
    const ok = await productionAdminSetPassword(password).catch(() => false);
    setPending(false);
    if (!ok) {
      setMessage("Could not set your password. Request a new recovery email.");
      return;
    }
    form.reset();
    setState("done");
    router.replace("/admin/production");
  }

  if (state === "checking")
    return <p role="status">Checking your invitation…</p>;
  if (state === "expired")
    return (
      <p role="alert">
        This link has expired or has already been used. Request a new password
        recovery email from the administrator.
      </p>
    );
  if (state === "done")
    return <p role="status">Password set. Opening your admin account…</p>;

  return (
    <form onSubmit={setPassword} className="space-y-4">
      <p>Your email is verified. Choose a password for this admin account.</p>
      <label className="block text-sm">
        New password
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={128}
          required
          className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 p-3"
        />
      </label>
      <label className="block text-sm">
        Confirm password
        <input
          name="confirmation"
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={128}
          required
          className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 p-3"
        />
      </label>
      <button
        disabled={pending}
        className="rounded-lg bg-cyan-300 px-5 py-3 font-semibold text-slate-950 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Set password"}
      </button>
      {message && (
        <p role="alert" className="text-amber-200">
          {message}
        </p>
      )}
    </form>
  );
}

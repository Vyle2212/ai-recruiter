"use client";

import Script from "next/script";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      theme: "dark";
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    },
  ) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const inputClass =
  "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-slate-100 outline-none transition focus:border-cyan-400";

export default function CandidateRegistrationForm({
  siteKey,
}: {
  siteKey: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState("");
  const [pending, setPending] = useState(false);
  const [complete, setComplete] = useState(false);
  const [message, setMessage] = useState("");

  const renderCaptcha = useCallback(() => {
    if (!containerRef.current || !window.turnstile || widgetRef.current) return;
    widgetRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      theme: "dark",
      callback: setCaptchaToken,
      "expired-callback": () => setCaptchaToken(""),
      "error-callback": () => setCaptchaToken(""),
    });
  }, [siteKey]);

  useEffect(
    () => () => {
      if (widgetRef.current && window.turnstile)
        window.turnstile.remove(widgetRef.current);
      widgetRef.current = null;
    },
    [],
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!captchaToken || pending || complete) return;
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") || "");
    if (password !== String(form.get("passwordConfirmation") || "")) {
      setMessage("Passwords do not match.");
      return;
    }
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/candidate/register", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: String(form.get("email") || ""),
          password,
          fullName: String(form.get("fullName") || ""),
          captchaToken,
        }),
      });
      if (response.status === 202) {
        setComplete(true);
        setMessage(
          "Check your email and open the verification link in this browser.",
        );
      } else {
        setMessage(
          response.status === 429
            ? "Too many attempts. Please wait before trying again."
            : "Registration is temporarily unavailable. Please try again later.",
        );
      }
    } catch {
      setMessage(
        "Registration is temporarily unavailable. Please try again later.",
      );
    } finally {
      setPending(false);
      setCaptchaToken("");
      if (widgetRef.current && window.turnstile)
        window.turnstile.reset(widgetRef.current);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl">
      <Script
        id="candidate-registration-turnstile"
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={renderCaptcha}
      />
      <form className="space-y-4" onSubmit={submit}>
        <label className="block text-sm text-slate-300">
          <span className="mb-2 block">Full name</span>
          <input
            className={inputClass}
            name="fullName"
            autoComplete="name"
            maxLength={120}
            required
            disabled={pending || complete}
          />
        </label>
        <label className="block text-sm text-slate-300">
          <span className="mb-2 block">Email</span>
          <input
            className={inputClass}
            name="email"
            type="email"
            autoComplete="email"
            maxLength={254}
            required
            disabled={pending || complete}
          />
        </label>
        <label className="block text-sm text-slate-300">
          <span className="mb-2 block">Password</span>
          <input
            className={inputClass}
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            required
            disabled={pending || complete}
          />
        </label>
        <label className="block text-sm text-slate-300">
          <span className="mb-2 block">Confirm password</span>
          <input
            className={inputClass}
            name="passwordConfirmation"
            type="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            required
            disabled={pending || complete}
          />
        </label>
        <div ref={containerRef} aria-label="Bot protection challenge" />
        <button
          className="w-full rounded-lg bg-cyan-500 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          type="submit"
          disabled={!captchaToken || pending || complete}
        >
          {pending ? "Creating account…" : "Create candidate account"}
        </button>
        <p
          className="min-h-6 text-sm text-slate-300"
          role="status"
          aria-live="polite"
        >
          {message}
        </p>
      </form>
    </section>
  );
}

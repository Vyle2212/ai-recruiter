"use client";

import Script from "next/script";
import { Eye, EyeOff } from "lucide-react";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      theme: "dark";
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": (code: string) => void;
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
  const [captchaError, setCaptchaError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirmation, setShowPasswordConfirmation] = useState(false);

  const renderCaptcha = useCallback(() => {
    if (!containerRef.current || !window.turnstile || widgetRef.current) return;
    widgetRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      theme: "dark",
      callback: (token) => {
        setCaptchaError("");
        setCaptchaToken(token);
      },
      "expired-callback": () => setCaptchaToken(""),
      "error-callback": (code) => {
        setCaptchaToken("");
        const configurationError = ["110100", "110110", "110200", "400020", "400021", "400070"].includes(code);
        setCaptchaError(configurationError
          ? `Security verification is unavailable due to website configuration. Please contact support. Code: ${code}.`
          : `Security verification could not connect or finish. Retry verification below without re-entering your details. Code: ${/^[0-9]{3,6}$/.test(code) ? code : "unknown"}.`);
      },
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
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
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
        formElement.reset();
        if (widgetRef.current && window.turnstile) {
          window.turnstile.remove(widgetRef.current);
          widgetRef.current = null;
        }
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

  if (complete) {
    return (
      <section
        className="rounded-2xl border border-emerald-400/50 bg-emerald-950/40 p-6 shadow-xl"
        role="status"
        aria-live="polite"
      >
        <h2 className="text-2xl font-semibold text-emerald-200">
          Check your email
        </h2>
        <p className="mt-3 text-base text-slate-100">
          Check your email and open the verification link in this browser.
        </p>
        <ol className="mt-5 list-decimal space-y-3 pl-5 text-slate-200">
          <li>Open the inbox for the email address you used to register.</li>
          <li>
            Find the verification email. Check Spam or Junk if it is not in your
            inbox.
          </li>
          <li>
            Open the verification link in this same browser, using the same
            window if you registered in incognito mode.
          </li>
        </ol>
        <p className="mt-5 text-sm text-slate-300">
          After verifying your email, you can sign in and upload your CV.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl">
      <Script
        id="candidate-registration-turnstile"
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={renderCaptcha}
        onError={() => {
          setCaptchaToken("");
          setCaptchaError("Security verification could not load. Check access to challenges.cloudflare.com, then retry verification.");
        }}
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
          <div className="relative">
            <input
              className={`${inputClass} pr-12`}
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
              disabled={pending || complete}
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-lg text-slate-300 hover:text-cyan-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400 disabled:opacity-50"
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              disabled={pending || complete}
              onClick={() => setShowPassword((visible) => !visible)}
            >
              {showPassword ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
            </button>
          </div>
        </label>
        <label className="block text-sm text-slate-300">
          <span className="mb-2 block">Confirm password</span>
          <div className="relative">
            <input
              className={`${inputClass} pr-12`}
              name="passwordConfirmation"
              type={showPasswordConfirmation ? "text" : "password"}
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
              disabled={pending || complete}
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-lg text-slate-300 hover:text-cyan-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400 disabled:opacity-50"
              aria-label={showPasswordConfirmation ? "Hide confirmation password" : "Show confirmation password"}
              aria-pressed={showPasswordConfirmation}
              disabled={pending || complete}
              onClick={() => setShowPasswordConfirmation((visible) => !visible)}
            >
              {showPasswordConfirmation ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
            </button>
          </div>
        </label>
        <div ref={containerRef} aria-label="Bot protection challenge" />
        {captchaError ? (
          <div role="alert" className="rounded-lg border border-red-400/50 p-3 text-sm text-red-200">
            <p>{captchaError}</p>
            <button type="button" className="mt-2 rounded border border-cyan-500 px-3 py-2 text-cyan-200 disabled:opacity-50"
              disabled={pending}
              onClick={() => {
                setCaptchaToken("");
                if (widgetRef.current && window.turnstile) {
                  setCaptchaError("");
                  window.turnstile.reset(widgetRef.current);
                } else {
                  setCaptchaError("Security verification script is unavailable. Check your connection or browser blocking before reloading this page.");
                }
              }}>Retry verification</button>
          </div>
        ) : null}
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

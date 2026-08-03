import Link from "next/link";

import { MockSessionBanner } from "./MockSessionBanner";

const primaryLinks = [
  ["Login", "/auth/login"],
  ["Request Access", "/auth/signup"],
  ["Password Reset", "/auth/forgot-password"],
  ["Staging Runtime", "/auth/staging/runtime"],
];

const diagnosticLinks = [
  ["Setup", "/auth/setup"],
  ["Migration", "/auth/migrations"],
  ["RLS", "/auth/rls"],
  ["Helpers", "/auth/helpers"],
  ["Route Guard", "/auth/middleware"],
  ["Staging Evidence", "/auth/staging"],
];

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <nav className="border-b border-violet-500/20 bg-violet-500/5 px-6 py-3">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <span className="font-semibold text-violet-100">
            Staging authentication
          </span>

          {primaryLinks.map(([label, href]) => (
            <Link
              className="text-cyan-300 hover:text-cyan-200"
              href={href}
              key={href}
            >
              {label}
            </Link>
          ))}

          <details className="relative">
            <summary className="cursor-pointer text-slate-400 hover:text-slate-200">
              Internal diagnostics
            </summary>

            <div className="absolute left-0 top-7 z-50 min-w-52 space-y-2 rounded-xl border border-slate-700 bg-slate-950 p-3 shadow-xl">
              {diagnosticLinks.map(([label, href]) => (
                <Link
                  className="block text-xs text-cyan-300 hover:text-cyan-200"
                  href={href}
                  key={href}
                >
                  {label}
                </Link>
              ))}
            </div>
          </details>

          <span className="ml-auto text-xs text-emerald-200">
            Staging auth active · production blocked
          </span>
        </div>
      </nav>

      <MockSessionBanner />

      {children}
    </>
  );
}
import Link from "next/link";

import {
  StagingRuntimeSignOutButton,
} from "../auth/staging/runtime/StagingRuntimeSignOutButton";

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="border-b border-cyan-500/20 bg-cyan-500/5 px-6 py-3 text-xs text-slate-300">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-semibold text-cyan-100">
              Client staging portal
            </span>

            <span className="text-emerald-200">
              Session and role guard active
            </span>

            <Link
              className="text-cyan-300"
              href="/auth/staging/runtime"
            >
              Auth diagnostics
            </Link>
          </div>

          <StagingRuntimeSignOutButton />
        </div>
      </div>

      {children}
    </>
  );
}
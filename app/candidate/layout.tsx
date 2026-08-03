import {
  StagingRuntimeSignOutButton,
} from "../auth/staging/runtime/StagingRuntimeSignOutButton";

export default function CandidateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="border-b border-violet-500/20 bg-violet-500/5 px-6 py-3 text-xs text-slate-300">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-semibold text-violet-100">
              Candidate staging portal
            </span>

            <span className="text-emerald-200">
              Session and role guard active
            </span>
          </div>

          <StagingRuntimeSignOutButton />
        </div>
      </div>

      {children}
    </>
  );
}
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
            <span className="font-semibold text-cyan-100">Client workspace</span>
          </div>

          <StagingRuntimeSignOutButton />
        </div>
      </div>

      {children}
    </>
  );
}

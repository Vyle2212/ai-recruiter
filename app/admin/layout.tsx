import Link from "next/link";

import {
  StagingRuntimeSignOutButton,
} from "../auth/staging/runtime/StagingRuntimeSignOutButton";

const links = [
  ["Admin Portal", "/admin/portal"],
  ["Platform Readiness", "/admin/platform-readiness"],
  ["Staging Readiness", "/admin/staging-readiness"],
  ["Staging Evidence", "/admin/staging-evidence"],
  ["Staging Runbook", "/admin/staging-runbook"],
  ["Execution Gate", "/admin/staging-execution-gate"],
  ["Auth Adapter", "/admin/staging-auth-adapter"],
  ["Auth Operations", "/admin/staging-auth-operations"],
  ["Auth E2E", "/admin/staging-auth-e2e"],
  ["Auth Security", "/admin/staging-auth-security"],
  ["Auth Go/No-Go", "/admin/staging-auth-go-no-go"],
  ["UI Binding", "/auth/login"],
  ["Product Health", "/recruiter/dashboard#product-health"],
  ["Data Import", "/recruiter/import-staging"],
  ["Merge Review", "/recruiter/import-merge"],
  ["Workflow", "/recruiter/workflow"],
  ["Auth Diagnostics", "/auth/staging/runtime"],
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="border-b border-amber-500/20 bg-amber-500/5 px-5 py-3 text-slate-200">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 text-xs">
          <span className="font-semibold text-amber-200">
            Admin staging
          </span>

          {links.map(([label, href]) => (
            <Link
              className="hover:text-amber-200"
              href={href}
              key={href}
            >
              {label}
            </Link>
          ))}

          <span className="ml-auto text-emerald-200">
            Session and role guard active
          </span>

          <StagingRuntimeSignOutButton />
        </div>
      </div>

      {children}
    </>
  );
}
"use client";

import Link from "next/link";

export default function Candidate360V2Error({ unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  return (
    <main className="min-h-screen bg-[#05070A] px-4 py-16 text-slate-100 md:px-6">
      <div role="alert" className="mx-auto max-w-2xl rounded-2xl border border-rose-400/40 bg-rose-950/30 p-6">
        <h1 className="text-xl font-semibold text-white">Candidate profile unavailable</h1>
        <p className="mt-2 text-sm leading-6 text-rose-100">The profile could not be displayed. Retry the request or return to candidate search.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" onClick={unstable_retry} className="min-h-11 rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300">Try again</button>
          <Link href="/recruiter/talent-search/v2" className="inline-flex min-h-11 items-center rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300">Back to search</Link>
        </div>
      </div>
    </main>
  );
}

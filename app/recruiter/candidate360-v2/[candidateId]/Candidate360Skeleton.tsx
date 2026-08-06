export default function Candidate360Skeleton() {
  return (
    <main aria-busy="true" aria-label="Loading candidate profile" className="min-h-screen bg-[#05070A] px-4 py-8 text-slate-100 md:px-6">
      <span className="sr-only" role="status">Loading candidate profile</span>
      <div className="mx-auto max-w-[1440px] space-y-6">
        <div className="h-44 animate-pulse rounded-2xl border border-slate-800 bg-[#0B0F16] motion-reduce:animate-none" />
        <div className="grid gap-6 lg:grid-cols-3"><div className="h-80 animate-pulse rounded-2xl border border-slate-800 bg-[#0B0F16] motion-reduce:animate-none lg:col-span-2" /><div className="h-80 animate-pulse rounded-2xl border border-slate-800 bg-[#0B0F16] motion-reduce:animate-none" /></div>
      </div>
    </main>
  );
}

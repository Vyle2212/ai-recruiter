export default function DashboardSidebar() {
  return (
    <div className="flex h-screen w-[260px] flex-col border-r border-zinc-800 bg-black p-6 text-white">
      <div className="mb-10 text-3xl font-bold">
        AI Recruiter
      </div>

      <div className="space-y-3">
        <div className="rounded-xl bg-zinc-900 p-4">
          Dashboard
        </div>

        <div className="rounded-xl p-4 text-zinc-400 hover:bg-zinc-900">
          Candidates
        </div>

        <div className="rounded-xl p-4 text-zinc-400 hover:bg-zinc-900">
          Jobs
        </div>

        <div className="rounded-xl p-4 text-zinc-400 hover:bg-zinc-900">
          Pipeline
        </div>

        <div className="rounded-xl p-4 text-zinc-400 hover:bg-zinc-900">
          Shortlist AI
        </div>

        <div className="rounded-xl p-4 text-zinc-400 hover:bg-zinc-900">
          Settings
        </div>
      </div>
    </div>
  )
}
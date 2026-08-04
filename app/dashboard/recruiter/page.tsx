import DashboardSidebar from '@/src/components/dashboard/DashboardSidebar'

import MetricCard from '@/src/components/dashboard/MetricCard'

import CandidateTable from '@/src/components/dashboard/CandidateTable'

export default function RecruiterDashboardPage() {
  return (
    <div className="flex min-h-screen bg-black">
      <DashboardSidebar />

      <div className="flex-1 p-10 text-white">
        <div className="mb-10 flex items-center justify-between">
          <div>
            <h1 className="text-5xl font-bold">
              Recruiter Dashboard
            </h1>

            <p className="mt-3 text-zinc-400">
              AI-powered SAP talent hub
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 px-5 py-3">
            Vy Recruiter
          </div>
        </div>

        <div className="mb-10 grid gap-5 md:grid-cols-4">
          <MetricCard
            title="Total Candidates"
            value="248"
          />

          <MetricCard
            title="Shortlisted"
            value="91"
          />

          <MetricCard
            title="Open Jobs"
            value="16"
          />

          <MetricCard
            title="Interviews"
            value="32"
          />
        </div>

        <div className="mb-6">
          <h2 className="text-3xl font-bold">
            Top SAP Candidates
          </h2>

          <p className="mt-2 text-zinc-400">
            AI-ranked candidates based on
            JD matching
          </p>
        </div>

        <CandidateTable />
      </div>
    </div>
  )
}
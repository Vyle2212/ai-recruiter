import { mockCandidates } from './mockCandidates'

export default function CandidateTable() {
  return (
    <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-950">
      <table className="min-w-full text-left text-sm text-white">
        <thead className="border-b border-zinc-800 bg-zinc-900">
          <tr>
            <th className="px-6 py-5 font-semibold">
              Candidate
            </th>

            <th className="px-6 py-5 font-semibold">
              Role
            </th>

            <th className="px-6 py-5 font-semibold">
              Experience
            </th>

            <th className="px-6 py-5 font-semibold">
              AI Score
            </th>

            <th className="px-6 py-5 font-semibold">
              Status
            </th>

            <th className="px-6 py-5 font-semibold">
              Location
            </th>
          </tr>
        </thead>

        <tbody>
          {mockCandidates.map((candidate) => (
            <tr
              key={candidate.id}
              className="border-b border-zinc-800 hover:bg-zinc-900 transition"
            >
              <td className="px-6 py-5 font-medium whitespace-nowrap">
                {candidate.name}
              </td>

              <td className="px-6 py-5 text-zinc-300 whitespace-nowrap">
                {candidate.role}
              </td>

              <td className="px-6 py-5 text-zinc-300 whitespace-nowrap">
                {candidate.experience}
              </td>

              <td className="px-6 py-5 whitespace-nowrap">
                <div className="inline-flex rounded-full bg-green-500/20 px-3 py-1 text-xs font-semibold text-green-400">
                  {candidate.score}%
                </div>
              </td>

              <td className="px-6 py-5 whitespace-nowrap">
                <div className="inline-flex rounded-full bg-blue-500/20 px-3 py-1 text-xs font-semibold text-blue-400">
                  {candidate.status}
                </div>
              </td>

              <td className="px-6 py-5 text-zinc-300 whitespace-nowrap">
                {candidate.location}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
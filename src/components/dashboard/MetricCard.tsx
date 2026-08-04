interface Props {
  title: string
  value: string
}

export default function MetricCard({
  title,
  value,
}: Props) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
      <div className="text-sm text-zinc-400">
        {title}
      </div>

      <div className="mt-3 text-4xl font-bold">
        {value}
      </div>
    </div>
  )
}
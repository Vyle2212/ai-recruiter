export default function LoadingCard() {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 animate-pulse">
      <div className="h-8 bg-zinc-800 rounded w-1/3 mb-4" />

      <div className="h-4 bg-zinc-800 rounded w-1/4 mb-2" />
      <div className="h-4 bg-zinc-800 rounded w-1/5 mb-6" />

      <div className="flex flex-wrap gap-2">
        <div className="h-8 w-24 bg-zinc-800 rounded-full" />
        <div className="h-8 w-20 bg-zinc-800 rounded-full" />
        <div className="h-8 w-28 bg-zinc-800 rounded-full" />
        <div className="h-8 w-16 bg-zinc-800 rounded-full" />
      </div>
    </div>
  );
}
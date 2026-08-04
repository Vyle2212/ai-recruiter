interface EmptyStateProps {
  title: string;
  description?: string;
}

export default function EmptyState({
  title,
  description,
}: EmptyStateProps) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-10 text-center">
      <h2 className="text-2xl font-bold mb-2">{title}</h2>

      {description && (
        <p className="text-zinc-400">{description}</p>
      )}
    </div>
  );
}
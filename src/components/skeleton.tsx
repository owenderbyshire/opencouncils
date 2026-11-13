/** Placeholder rows shown while a list streams in. Purely visual; the live region is the list itself. */
export function ListSkeleton({
  rows = 6,
  label,
}: {
  rows?: number;
  label?: string;
}) {
  return (
    <div aria-busy="true" aria-live="polite" className="animate-pulse">
      {label ? <span className="visually-hidden">{label}</span> : null}
      <div className="mb-6 flex gap-2">
        <span className="h-8 w-24 rounded-full bg-surface-2" />
        <span className="h-8 w-20 rounded-full bg-surface-2" />
        <span className="h-8 w-28 rounded-full bg-surface-2" />
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="grid gap-x-6 gap-y-2 border-t border-rule py-4 sm:grid-cols-[11rem_1fr]"
        >
          <span className="h-4 w-28 rounded bg-surface-2" />
          <span className="space-y-2">
            <span className="block h-4 w-2/3 rounded bg-surface-2" />
            <span className="block h-3 w-1/2 rounded bg-surface" />
          </span>
        </div>
      ))}
    </div>
  );
}

export function BlockSkeleton({
  lines = 8,
  label,
}: {
  lines?: number;
  label?: string;
}) {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="animate-pulse space-y-3 py-6"
    >
      {label ? <span className="visually-hidden">{label}</span> : null}
      <span className="block h-9 w-2/3 rounded bg-surface-2" />
      <span className="block h-4 w-1/3 rounded bg-surface-2" />
      <div className="space-y-2 pt-6">
        {Array.from({ length: lines }, (_, i) => (
          <span
            key={i}
            className="block h-3.5 rounded bg-surface"
            style={{ width: `${90 - ((i * 17) % 35)}%` }}
          />
        ))}
      </div>
    </div>
  );
}

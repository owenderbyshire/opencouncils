/**
 * A page's headline figures, each under a thin accent rule, as on the home
 * page. Four at most. Every label says what is counted, so a number never
 * stands alone.
 */
export function Figures({ items }: { items: Array<{ value: string; label: string }> }) {
  return (
    <dl className="grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-4">
      {items.slice(0, 4).map((f) => (
        <div key={f.label} className="border-t-2 border-accent pt-2">
          <dt className="visually-hidden">{f.label}</dt>
          <dd>
            <span className="block font-serif text-h2 font-semibold num">{f.value}</span>
            <span aria-hidden="true" className="text-small text-ink-2">
              {f.label}
            </span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

// Barras de conversaciones por día (una sola serie: sin leyenda; el título la nombra).
// Server Component: el tooltip es CSS (hover/focus), con tabla equivalente para lectores de pantalla.

export type DailyPoint = { key: string; label: string; shortLabel: string; value: number };

export function DailyChart({ points }: { points: DailyPoint[] }) {
  const max = Math.max(1, ...points.map((p) => p.value));
  const total = points.reduce((sum, p) => sum + p.value, 0);

  return (
    <figure>
      <div className="relative h-44 border-b border-line">
        <span className="absolute -top-1 left-0 text-xs text-ink-soft">{max}</span>
        <div className="absolute inset-x-0 top-2 border-t border-dashed border-line/80" aria-hidden />
        <div className="absolute inset-x-0 top-2 bottom-0 flex items-end gap-[2px] pl-6">
          {points.map((p) => (
            <div key={p.key} tabIndex={0} className="group relative flex h-full flex-1 items-end focus:outline-none">
              {p.value > 0 && (
                <div
                  className="w-full rounded-t-sm bg-chart group-hover:bg-royal-dark group-focus:bg-royal-dark"
                  style={{ height: `${(p.value / max) * 100}%` }}
                />
              )}
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 rounded-lg bg-ink px-2.5 py-1.5 text-xs whitespace-nowrap text-white shadow-lg group-hover:block group-focus:block">
                <span className="block font-semibold">{p.value} {p.value === 1 ? "conversación" : "conversaciones"}</span>
                <span className="block text-white/70">{p.label}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-1.5 flex justify-between pl-6 text-xs text-ink-soft" aria-hidden>
        <span>{points[0]?.shortLabel}</span>
        <span>{points[Math.floor(points.length / 2)]?.shortLabel}</span>
        <span>{points.at(-1)?.shortLabel}</span>
      </div>
      <figcaption className="sr-only">
        {total} conversaciones con actividad en los últimos {points.length} días.
      </figcaption>
      {/* sr-only en un div: una <table> ignora el alto de 1px y estira la página */}
      <div className="sr-only">
        <table>
          <thead>
            <tr>
              <th>Día</th>
              <th>Conversaciones</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.key}>
                <td>{p.label}</td>
                <td>{p.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

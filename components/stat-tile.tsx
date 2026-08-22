/**
 * A single headline number. No plot — per the form heuristic, one value with a
 * label reads better as a tile than as a one-bar chart.
 */
export default function StatTile({
  label, value, sub, accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "warn" | "good" | "neutral";
}) {
  const color =
    accent === "warn" ? "var(--color-series-1)"
    : accent === "good" ? "var(--color-series-2)"
    : undefined;

  return (
    <div className="bg-card p-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-slate">{label}</p>
      <p
        className="mt-3 font-display text-4xl font-medium leading-none tracking-[-0.05em] text-on-card"
        style={color ? { color } : undefined}
      >
        {value}
      </p>
      {sub && <p className="mt-2 text-xs leading-snug text-muted">{sub}</p>}
    </div>
  );
}

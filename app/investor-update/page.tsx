import Link from "next/link";
import { buildInvestorUpdate } from "@/lib/investor-update";

export const dynamic = "force-dynamic";

/**
 * The demo closer: one 16:9 slide the agent wrote about its own audit.
 * Server-rendered from the database, so it never depends on the browser
 * having finished streaming. Cmd+P prints it to a clean PDF.
 */
export default function InvestorUpdatePage() {
  const u = buildInvestorUpdate();

  return (
    <main className="min-h-screen bg-page p-6 text-fg print:p-0">
      <div className="mx-auto mb-4 flex max-w-[1280px] items-center justify-between print:hidden">
        <Link href="/" className="font-sans text-xs font-medium uppercase tracking-wider text-muted hover:text-on-card">
          ← Dashboard
        </Link>
        <p className="font-sans text-xs text-muted">
          Generated {u.generatedAt} · {u.mode} mode · press ⌘P to export PDF
        </p>
      </div>

      <section
        className="mx-auto grid aspect-video max-w-[1280px] grid-rows-[auto_auto_1fr_auto] gap-6 bg-card p-12 text-on-card shadow-2xl print:shadow-none"
        style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}
      >
        <header className="flex items-end justify-between border-b border-hairline pb-4">
          <div>
            <p className="font-sans text-[11px] uppercase tracking-[0.14em] text-muted">
              {u.company} · Investor update · {u.period}
            </p>
            <h1 className="mt-2 font-display text-4xl font-medium leading-tight tracking-[-0.04em]">
              {u.headline}
            </h1>
          </div>
          <p className="shrink-0 font-sans text-[10px] font-medium uppercase tracking-wider text-muted">
            Written by Burnshield
          </p>
        </header>

        <div className="grid grid-cols-4 gap-4">
          {u.kpis.map((k) => (
            <div key={k.label} className="border border-border-card bg-card-2 p-4">
              <p className="font-sans text-[10px] uppercase tracking-[0.12em] text-muted">{k.label}</p>
              <p
                className="mt-2 font-display text-3xl font-medium leading-none tracking-[-0.04em]"
                style={k.accent === "good" ? { color: "var(--color-mint)" } : undefined}
              >
                {k.value}
              </p>
              {k.sub && <p className="mt-1 text-xs text-muted">{k.sub}</p>}
            </div>
          ))}
        </div>

        <div className="grid min-h-0 grid-cols-[3fr_2fr] gap-8">
          <div className="min-h-0">
            <p className="mb-2 font-sans text-[10px] uppercase tracking-[0.12em] text-muted">What the agent found</p>
            {u.findings.length === 0 ? (
              <p className="text-sm text-muted">{u.audited ? "No anomalies this period." : "No audit run yet."}</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="font-sans text-[10px] uppercase tracking-[0.1em] text-muted">
                  <tr className="text-left">
                    <th className="pb-1 font-normal">Vendor</th>
                    <th className="pb-1 font-normal">Issue</th>
                    <th className="pb-1 font-normal">Why</th>
                    <th className="pb-1 text-right font-normal">Cost</th>
                    <th className="pb-1 text-right font-normal">Conf.</th>
                  </tr>
                </thead>
                <tbody>
                  {u.findings.map((fi) => (
                    <tr key={fi.vendor} className="border-t border-hairline align-top">
                      <td className="py-2 pr-2 font-medium">{fi.vendor}<br /><span className="text-xs text-muted">{fi.action}</span></td>
                      <td className="py-2 pr-2">{fi.kind}</td>
                      <td className="py-2 pr-2 text-xs text-muted">{fi.why}</td>
                      <td className="py-2 text-right font-sans text-xs">{fi.monthlyCost}</td>
                      <td className="py-2 text-right font-sans text-xs">{fi.confidence}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="flex flex-col gap-5">
            <div>
              <p className="mb-2 font-sans text-[10px] uppercase tracking-[0.12em] text-muted">Runway by scenario</p>
              <ul className="space-y-2">
                {u.runway.scenarios.map((s) => {
                  const max = Math.max(...u.runway.scenarios.map((x) => x.months), 1);
                  return (
                    <li key={s.label}>
                      <div className="flex justify-between text-xs">
                        <span>{s.label}</span>
                        <span className="font-sans">{s.months} mo · {s.netBurn}</span>
                      </div>
                      <div className="mt-1 h-1.5 w-full bg-card-3">
                        <div className="h-full" style={{ width: `${(s.months / max) * 100}%`, background: "var(--color-series-2)" }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div>
              <p className="mb-2 font-sans text-[10px] uppercase tracking-[0.12em] text-muted">Governance</p>
              <p className="text-xs leading-relaxed text-muted">
                Autonomy threshold <span className="font-sans text-on-card">{u.governance.threshold}</span>.{" "}
                <span className="font-sans text-on-card">{u.governance.pending}</span> actions held for human approval,{" "}
                <span className="font-sans text-on-card">{u.governance.approved}</span> approved,{" "}
                <span className="font-sans text-on-card">{u.governance.sent}</span> released to sandbox outbox.
                No email reaches a real vendor without sign-off.
                {u.realised.monthly > 0 && (
                  <> Locked in so far: <span className="font-sans" style={{ color: "var(--color-mint)" }}>{"$" + u.realised.monthly.toLocaleString()}/mo</span> ({u.realised.closedBy.agent} closed by the agent, {u.realised.closedBy.human} signed by a human).</>
                )}
              </p>
            </div>
          </div>
        </div>

        <footer className="border-t border-hairline pt-4">
          <p className="text-xs leading-relaxed text-muted">{u.narrative.join(" ")}</p>
        </footer>
      </section>
    </main>
  );
}

import Link from "next/link";

export default function Footer() {
  return (
    <footer className="relative z-10 border-t border-page/15 bg-ink text-page">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-10 px-6 py-10 sm:px-10 md:flex-row md:items-end md:justify-between lg:px-14">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-page/50">
            Runway Radar / agentic cash operations
          </p>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-page/70">
            Continuous spend monitoring, explainable flags, and a human approval gate on
            every action that leaves the building.
          </p>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-3 font-mono text-[10px] uppercase tracking-[0.1em] text-page/55">
          <Link href="/features" className="link-sweep transition-colors hover:text-azure">
            Agents
          </Link>
          <Link href="/pricing" className="link-sweep transition-colors hover:text-azure">
            Access
          </Link>
          <a href="#" className="link-sweep transition-colors hover:text-azure">
            Privacy
          </a>
          <span>© 2026</span>
        </div>
      </div>
    </footer>
  );
}

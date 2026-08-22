import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-page/20 bg-ink text-page">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-10 px-6 py-10 sm:px-10 md:flex-row md:items-end md:justify-between lg:px-14">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-page/50">Runway Radar / Intelligent cash operations</p>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-page/70">See every dollar, understand every recommendation, and approve the action that protects your runway.</p>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-3 font-mono text-[10px] uppercase tracking-[0.1em] text-page/55">
          <Link href="/features" className="transition-colors hover:text-lime">Agents</Link>
          <Link href="/pricing" className="transition-colors hover:text-lime">Access</Link>
          <a href="#" className="transition-colors hover:text-lime">Privacy</a>
          <span>© 2026</span>
        </div>
      </div>
    </footer>
  );
}

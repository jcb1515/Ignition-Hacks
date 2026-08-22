import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-border bg-page text-fg">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-8 px-4 py-10 sm:px-10 md:flex-row md:items-end md:justify-between lg:px-14">
        <div>
          <p className="font-sans text-xs font-medium uppercase tracking-wider text-muted">
            Burn Shield / fintech burn-rate workflow
          </p>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-slate">
            An agentic financial system for early-stage startups that monitors burn rate,
            surfaces waste, and keeps every spend decision under your control.
          </p>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-3 font-sans text-xs font-medium uppercase tracking-wider text-muted">
          <Link href="/features" className="link-sweep transition-colors hover:text-azure">
            Workflow
          </Link>
          <Link href="/pricing" className="link-sweep transition-colors hover:text-azure">
            Pricing
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

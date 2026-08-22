import { ArrowUpRight, Check } from "lucide-react";
import Link from "next/link";

const tiers = [
  {
    name: "Seed",
    price: "$0",
    description: "For teams building a disciplined cash operating system.",
    features: ["Up to $50k monthly spend", "Classifier and Forecast agents", "Five vendor reviews monthly", "Shared action log"],
    cta: "Start observing",
  },
  {
    name: "Growth",
    price: "$99",
    description: "For teams with enough moving parts to need a second set of eyes.",
    features: ["Up to $500k monthly spend", "Full agent system", "Unlimited recommendation drafts", "Slack-ready alerts", "Priority support"],
    cta: "Start a trial",
    featured: true,
  },
  {
    name: "Scale",
    price: "Custom",
    description: "For multi-entity operations that require custom policies and control.",
    features: ["Unlimited spend scanning", "Custom policies and thresholds", "SSO and audit archive", "Dedicated rollout support"],
    cta: "Talk to us",
  },
];

export default function PricingPage() {
  return (
    <div className="bg-page">
      <section className="border-b border-page/20 bg-ink text-page">
        <div className="mx-auto max-w-[1440px] px-6 py-20 sm:px-10 lg:px-14 lg:py-28">
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-lime">Access / runway radar</p>
          <div className="mt-10 grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <h1 className="max-w-4xl font-display text-[clamp(4rem,8vw,8.5rem)] font-medium leading-[0.84] tracking-[-0.07em]">Price your runway in months, not missed signals.</h1>
            <p className="max-w-md text-xl leading-snug tracking-[-0.025em] text-page/65">Start with visibility, then expand the agent system as your operations become more complex.</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1440px] px-6 py-20 sm:px-10 lg:px-14 lg:py-28">
        <div className="grid gap-5 lg:grid-cols-3">
          {tiers.map((tier, index) => (
            <article key={tier.name} className={`flex min-h-[480px] flex-col border p-7 ${tier.featured ? "border-ink bg-ink text-page" : "border-ink/20 bg-page"}`}>
              <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.14em]">
                <span>0{index + 1} / plan</span>
                {tier.featured ? <span className="bg-lime px-2 py-1 text-ink">Most selected</span> : null}
              </div>
              <div className="mt-14">
                <h2 className="font-display text-5xl leading-none tracking-[-0.06em]">{tier.name}</h2>
                <p className={`mt-4 max-w-xs text-sm leading-relaxed ${tier.featured ? "text-page/60" : "text-ink/60"}`}>{tier.description}</p>
                <p className="mt-10 font-display text-6xl leading-none tracking-[-0.07em]">{tier.price}<span className={`ml-2 font-mono text-[10px] uppercase tracking-[0.1em] ${tier.featured ? "text-page/50" : "text-ink/45"}`}>{tier.price === "Custom" || tier.price === "$0" ? "" : "per month"}</span></p>
              </div>
              <ul className={`mt-10 space-y-4 border-t pt-6 text-sm ${tier.featured ? "border-page/20 text-page/75" : "border-ink/20 text-ink/70"}`}>
                {tier.features.map((feature) => (
                  <li key={feature} className="flex gap-3"><Check size={16} className="mt-0.5 shrink-0 text-lime" />{feature}</li>
                ))}
              </ul>
              <Link href="/" className={`mt-auto inline-flex items-center justify-between px-5 py-4 text-sm font-medium transition-colors ${tier.featured ? "bg-lime text-ink hover:bg-page" : "bg-ink text-page hover:bg-coral"}`}>
                {tier.cta}<ArrowUpRight size={17} />
              </Link>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

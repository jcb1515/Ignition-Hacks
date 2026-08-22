import { ArrowUpRight, Check } from "lucide-react";
import Link from "next/link";
import { PointerPanel, Reveal } from "@/components/motion";

const tiers = [
  {
    name: "Seed",
    price: "$0",
    description: "For startups building a disciplined burn-rate workflow.",
    features: [
      "Up to $50k monthly spend",
      "Connect and forecast workflow",
      "Five spend reviews monthly",
      "Shared action log",
    ],
    cta: "Start tracking",
  },
  {
    name: "Growth",
    price: "$99",
    description: "For teams with enough moving spend to need a second set of eyes.",
    features: [
      "Up to $500k monthly spend",
      "Full fintech workflow",
      "Unlimited renegotiation drafts",
      "Slack-ready alerts",
      "Priority support",
    ],
    cta: "Start a trial",
    featured: true,
  },
  {
    name: "Scale",
    price: "Custom",
    description: "For multi-entity operations with custom burn policies and controls.",
    features: [
      "Unlimited spend scanning",
      "Custom thresholds and policies",
      "SSO and audit archive",
      "Dedicated rollout support",
    ],
    cta: "Talk to us",
  },
];

export default function PricingPage() {
  return (
    <div className="overflow-x-clip bg-page">
      <section className="border-b border-border bg-page text-fg">
        <div className="mx-auto max-w-[1440px] px-4 py-14 sm:px-10 sm:py-20 lg:px-14 lg:py-28">
          <Reveal>
            <p className="font-sans text-xs font-medium uppercase tracking-wider text-azure">
              Pricing / burn-rate workflow
            </p>
          </Reveal>
          <div className="mt-10 grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <Reveal delay={80}>
              <h1 className="max-w-4xl font-display text-[clamp(2.8rem,13vw,8.5rem)] font-medium leading-[0.88] tracking-[-0.055em] sm:text-[clamp(3.6rem,7.6vw,8.5rem)] sm:leading-[0.84] sm:tracking-[-0.07em]">
                Pricing that keeps burn rate visible from day one.
              </h1>
            </Reveal>
            <Reveal delay={160}>
              <p className="max-w-md text-xl leading-snug tracking-[-0.025em] text-slate">
                Start tracking burn, then expand the workflow as your team grows.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1440px] px-4 py-14 sm:px-10 sm:py-20 lg:px-14 lg:py-28">
        <div className="grid gap-5 lg:grid-cols-3">
          {tiers.map((tier, index) => (
            <Reveal key={tier.name} delay={index * 90}>
              <PointerPanel
                className={`flex min-h-[440px] flex-col border p-5 sm:min-h-[480px] sm:p-7 ${
                  tier.featured
                    ? "border-card-2 bg-ink text-white"
                    : "border-fg/20 bg-canvas hover:border-azure"
                }`}
              >
                <div className="flex items-center justify-between font-sans text-xs font-medium uppercase tracking-wider">
                  <span>0{index + 1} / plan</span>
                  {tier.featured ? (
                    <span className="rounded-full bg-azure px-2 py-1 text-white">Most selected</span>
                  ) : null}
                </div>
                <div className="mt-14">
                  <h2 className="font-display text-5xl leading-none tracking-[-0.06em]">{tier.name}</h2>
                  <p className={`mt-4 max-w-xs text-sm leading-relaxed ${tier.featured ? "text-white/60" : "text-fg/60"}`}>
                    {tier.description}
                  </p>
                  <p className="mt-10 break-words font-display text-5xl leading-none tracking-[-0.06em] sm:text-6xl sm:tracking-[-0.07em]">
                    {tier.price}
                    <span className={`ml-2 font-sans text-xs font-medium uppercase tracking-wider ${tier.featured ? "text-white/50" : "text-fg/45"}`}>
                      {tier.price === "Custom" || tier.price === "$0" ? "" : "per month"}
                    </span>
                  </p>
                </div>
                <ul className={`mt-10 space-y-4 border-t pt-6 text-sm ${tier.featured ? "border-white/20 text-white/75" : "border-fg/15 text-fg/70"}`}>
                  {tier.features.map((feature) => (
                    <li key={feature} className="data-row flex gap-3">
                      <Check size={16} className="mt-0.5 shrink-0 text-azure" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/"
                  className={`group mt-auto inline-flex min-h-12 items-center justify-between rounded-full px-5 py-4 text-sm font-medium transition-colors duration-300 ${
                    tier.featured
                      ? "bg-azure text-white hover:bg-cyan hover:text-ink"
                      : "bg-ink text-white hover:bg-azure"
                  }`}
                >
                  {tier.cta}
                  <ArrowUpRight size={17} className="transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </Link>
              </PointerPanel>
            </Reveal>
          ))}
        </div>
      </section>
    </div>
  );
}

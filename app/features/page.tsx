import { ArrowUpRight, Bot, Mail, TrendingDown, Shield, BarChart3, Eye } from "lucide-react";
import Link from "next/link";
import FeatureCard from "@/components/feature-card";
import { Marquee, Reveal } from "@/components/motion";

const agents = [
  {
    icon: BarChart3,
    title: "Classifier",
    description:
      "Reads your fintech stack — Plaid, Stripe, and cards — to spot duplicate subscriptions and spending that breaks category patterns.",
  },
  {
    icon: Mail,
    title: "Negotiator",
    description:
      "Drafts the renegotiation or cancellation email for flagged spend, and keeps every high-impact send behind your approval.",
  },
  {
    icon: TrendingDown,
    title: "Forecast",
    description:
      "Projects current, aggressive-cut, and hiring-freeze scenarios so every decision shows its runway impact.",
  },
  {
    icon: Bot,
    title: "Orchestrator",
    description:
      "Routes each step of the workflow, maintains the action log, and enforces your approval policy.",
  },
  {
    icon: Eye,
    title: "Explainability",
    description:
      "Surfaces the benchmark, confidence, and dollar impact behind every burn-rate flag.",
  },
  {
    icon: Shield,
    title: "Approval gate",
    description:
      "A configurable dollar threshold keeps humans accountable for high-impact spend decisions.",
  },
];

export default function FeaturesPage() {
  return (
    <div className="bg-page">
      <section className="border-b border-border bg-page text-fg">
        <div className="mx-auto max-w-[1440px] px-6 py-20 sm:px-10 lg:px-14 lg:py-28">
          <Reveal>
            <p className="font-sans text-xs font-medium uppercase tracking-wider text-azure">
              Burnshield / fintech workflow
            </p>
          </Reveal>
          <div className="mt-10 grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <Reveal delay={80}>
              <h1 className="max-w-4xl font-display text-[clamp(3.6rem,7.6vw,8.5rem)] font-medium leading-[0.84] tracking-[-0.07em]">
                One fintech workflow. Full burn-rate visibility.
              </h1>
            </Reveal>
            <Reveal delay={160}>
              <p className="max-w-md text-xl leading-snug tracking-[-0.025em] text-slate">
                Built for early-stage startups: every signal is traced, every action is
                approved by you.
              </p>
            </Reveal>
          </div>
        </div>
        <div className="border-t border-border py-3">
          <Marquee
            items={["Connect", "Classify", "Forecast", "Negotiate", "Explain", "Approve"]}
            duration={26}
            className="text-muted"
          />
        </div>
      </section>

      <section className="mx-auto max-w-[1440px] px-6 py-20 sm:px-10 lg:px-14 lg:py-28">
        <Reveal>
          <div className="mb-10 flex flex-col justify-between gap-5 border-b border-fg/20 pb-6 sm:flex-row sm:items-end">
            <h2 className="font-display text-5xl font-medium leading-none tracking-[-0.055em] sm:text-6xl">
              A focused step for every financial decision.
            </h2>
            <p className="max-w-xs font-sans text-xs font-medium uppercase tracking-wider text-fg/50">
              Clear steps prevent black-box spend decisions.
            </p>
          </div>
        </Reveal>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent, index) => (
            <Reveal key={agent.title} delay={index * 80}>
              <FeatureCard {...agent} />
            </Reveal>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-card text-fg">
        <div className="mx-auto grid max-w-[1440px] gap-10 px-6 py-16 sm:px-10 lg:grid-cols-[0.8fr_1.2fr] lg:px-14 lg:py-20">
          <Reveal>
            <p className="font-sans text-xs font-medium uppercase tracking-wider text-muted">
              The burn-rate workflow
            </p>
          </Reveal>
          <div>
            <Reveal delay={80}>
              <h2 className="font-display text-5xl font-medium leading-[0.9] tracking-[-0.055em] sm:text-6xl">
                Track the burn. Surface the waste. Approve the fix.
              </h2>
            </Reveal>
            <Reveal delay={160}>
              <Link
                href="/"
                className="group mt-10 inline-flex items-center gap-3 rounded-full border border-fg/20 bg-page px-5 py-4 text-sm font-medium shadow-sm transition-colors duration-300 hover:bg-ink hover:text-white"
              >
                Open the burn dashboard
                <ArrowUpRight size={17} className="transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </Link>
            </Reveal>
          </div>
        </div>
      </section>
    </div>
  );
}

import { ArrowUpRight, Bot, Mail, TrendingDown, Shield, BarChart3, Eye } from "lucide-react";
import Link from "next/link";
import FeatureCard from "@/components/feature-card";
import { Marquee, Reveal } from "@/components/motion";

const agents = [
  {
    icon: BarChart3,
    title: "Classifier",
    description:
      "Reads Plaid and Stripe activity, identifies duplicate subscriptions, and scores every anomaly against category benchmarks.",
  },
  {
    icon: Mail,
    title: "Negotiator",
    description:
      "Drafts the renegotiation or cancellation email for flagged vendors, and never sends above the approval threshold.",
  },
  {
    icon: TrendingDown,
    title: "Forecast",
    description:
      "Projects current, aggressive-cut, and hiring-freeze scenarios so every decision has a visible runway impact.",
  },
  {
    icon: Bot,
    title: "Orchestrator",
    description:
      "Chooses which agent runs next, maintains the action log, and enforces the human approval policy.",
  },
  {
    icon: Eye,
    title: "Explainability",
    description:
      "Surfaces the benchmark, confidence score, and reasoning behind each flag instead of hiding the model's work.",
  },
  {
    icon: Shield,
    title: "Approval gate",
    description:
      "A configurable dollar threshold keeps humans accountable for high-impact decisions by default.",
  },
];

export default function FeaturesPage() {
  return (
    <div className="bg-page">
      <section className="border-b border-page/15 bg-ink text-page">
        <div className="mx-auto max-w-[1440px] px-6 py-20 sm:px-10 lg:px-14 lg:py-28">
          <Reveal>
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-azure">
              Runway Radar / agent system
            </p>
          </Reveal>
          <div className="mt-10 grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <Reveal delay={80}>
              <h1 className="max-w-4xl font-display text-[clamp(3.6rem,7.6vw,8.5rem)] font-medium leading-[0.84] tracking-[-0.07em]">
                Four narrow agents. One explainable loop.
              </h1>
            </Reveal>
            <Reveal delay={160}>
              <p className="max-w-md text-xl leading-snug tracking-[-0.025em] text-page/65">
                Each agent has a single job, so every recommendation can be traced,
                questioned, and approved by a human.
              </p>
            </Reveal>
          </div>
        </div>
        <div className="border-t border-page/15 py-3">
          <Marquee
            items={["Classifier", "Negotiator", "Forecast", "Orchestrator", "Explainability", "Approval gate"]}
            duration={26}
            className="text-page/55"
          />
        </div>
      </section>

      <section className="mx-auto max-w-[1440px] px-6 py-20 sm:px-10 lg:px-14 lg:py-28">
        <Reveal>
          <div className="mb-10 flex flex-col justify-between gap-5 border-b border-ink/20 pb-6 sm:flex-row sm:items-end">
            <h2 className="font-display text-5xl font-medium leading-none tracking-[-0.055em] sm:text-6xl">
              A narrow job for every agent.
            </h2>
            <p className="max-w-xs font-mono text-[10px] uppercase tracking-[0.13em] text-ink/50">
              Clear roles prevent black-box decisions.
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

      <section className="border-y border-page/15 bg-azure text-page">
        <div className="mx-auto grid max-w-[1440px] gap-10 px-6 py-16 sm:px-10 lg:grid-cols-[0.8fr_1.2fr] lg:px-14 lg:py-20">
          <Reveal>
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em]">
              The operating loop
            </p>
          </Reveal>
          <div>
            <Reveal delay={80}>
              <h2 className="font-display text-5xl font-medium leading-[0.9] tracking-[-0.055em] sm:text-6xl">
                Spot the signal. Test the reasoning. Approve the move.
              </h2>
            </Reveal>
            <Reveal delay={160}>
              <Link
                href="/"
                className="group mt-10 inline-flex items-center gap-3 border border-page/50 px-5 py-4 text-sm font-medium transition-colors duration-300 hover:bg-ink hover:text-page"
              >
                Open the live dashboard
                <ArrowUpRight size={17} className="transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </Link>
            </Reveal>
          </div>
        </div>
      </section>
    </div>
  );
}

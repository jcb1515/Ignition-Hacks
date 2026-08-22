import { ArrowUpRight, Bot, Mail, TrendingDown, Shield, BarChart3, Eye } from "lucide-react";
import FeatureCard from "@/components/feature-card";
import Link from "next/link";

export default function FeaturesPage() {
  return (
    <div className="bg-page">
      <section className="bg-ink text-page">
        <div className="mx-auto max-w-[1440px] px-6 py-20 sm:px-10 lg:px-14 lg:py-28">
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-lime">Runway Radar / agent system</p>
          <div className="mt-10 grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <h1 className="max-w-4xl font-display text-[clamp(4rem,8vw,8.5rem)] font-medium leading-[0.84] tracking-[-0.07em]">One clear view of every decision that changes your runway.</h1>
            <p className="max-w-md text-xl leading-snug tracking-[-0.025em] text-page/65">Four specialized agents investigate spend while an orchestrator keeps the system explainable and your team in control.</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1440px] px-6 py-20 sm:px-10 lg:px-14 lg:py-28">
        <div className="mb-10 flex flex-col justify-between gap-5 border-b border-ink/20 pb-6 sm:flex-row sm:items-end">
          <h2 className="font-display text-5xl font-medium leading-none tracking-[-0.055em] sm:text-6xl">A narrow job for every agent.</h2>
          <p className="max-w-xs font-mono text-[10px] uppercase tracking-[0.13em] text-ink/50">Clear roles prevent black-box decisions.</p>
        </div>
        <div className="grid gap-px bg-page md:grid-cols-2 lg:grid-cols-3">
          <FeatureCard icon={BarChart3} title="Classifier" description="Reads Plaid and Stripe activity, identifies duplicate subscriptions, and grades each anomaly against category benchmarks." />
          <FeatureCard icon={Mail} title="Negotiator" description="Prepares a well-reasoned cancellation or renegotiation draft for vendors that need a human conversation." />
          <FeatureCard icon={TrendingDown} title="Forecast" description="Models current, aggressive-cut, and hiring-freeze scenarios so every decision has a visible runway impact." />
          <FeatureCard icon={Bot} title="Orchestrator" description="Chooses the next investigation, maintains the action trail, and only moves work forward when the policy allows." />
          <FeatureCard icon={Eye} title="Explainability" description="Shows the source, benchmark, confidence, and reasoning behind every flag instead of hiding the model's work." />
          <FeatureCard icon={Shield} title="Approval layer" description="Keeps people accountable for high-impact decisions with configurable thresholds and explicit sign-off." />
        </div>
      </section>

      <section className="border-y border-page/20 bg-lime text-ink">
        <div className="mx-auto grid max-w-[1440px] gap-10 px-6 py-16 sm:px-10 lg:grid-cols-[0.8fr_1.2fr] lg:px-14 lg:py-20">
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em]">The operating loop</p>
          <div>
            <h2 className="font-display text-5xl font-medium leading-[0.9] tracking-[-0.055em] sm:text-6xl">Spot the signal. Test the reasoning. Approve the move.</h2>
            <Link href="/" className="mt-10 inline-flex items-center gap-3 border border-ink/45 px-5 py-4 text-sm font-medium transition-colors hover:bg-ink hover:text-page">View the live workspace <ArrowUpRight size={17} /></Link>
          </div>
        </div>
      </section>
    </div>
  );
}

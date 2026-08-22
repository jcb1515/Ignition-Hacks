import { Bot, Mail, TrendingDown, Shield, BarChart3, Eye } from "lucide-react";
import FeatureCard from "@/components/feature-card";

export default function FeaturesPage() {
  return (
    <div className="min-h-full bg-page px-6 py-12">
      <div className="mx-auto max-w-3xl">
        <p className="mb-4 font-mono text-xs font-medium uppercase tracking-tight text-slate">
          How it works
        </p>
        <h1 className="mb-6 font-display text-5xl font-medium leading-none tracking-[-0.02em] text-ink">
          How Runway Radar works
        </h1>
        <p className="mb-16 text-lg leading-relaxed text-slate">
          Four narrow agents, one orchestrator, and a human always in the loop.
          No black boxes, no rogue emails.
        </p>

        <div className="mb-16 grid gap-4 md:grid-cols-2">
          <FeatureCard
            icon={BarChart3}
            title="Classifier Agent"
            description="Reads transactions from Plaid and Stripe, flags duplicate subscriptions, spots spend anomalies against category norms, and assigns a confidence score."
          />
          <FeatureCard
            icon={Mail}
            title="Negotiator Agent"
            description="Drafts renegotiation or cancellation emails for flagged vendors. Nothing is sent above an approval threshold without human sign-off."
          />
          <FeatureCard
            icon={TrendingDown}
            title="Forecast Agent"
            description="Runs burn-rate projections across current, aggressive-cut, and hiring-freeze scenarios so founders can see the runway impact of every decision."
          />
          <FeatureCard
            icon={Bot}
            title="Orchestrator Agent"
            description="Decides which agent to invoke and in what order, maintains the action log, and enforces the approval threshold."
          />
          <FeatureCard
            icon={Eye}
            title="Explainability"
            description="Every flag and action includes reasoning. The action log is queryable, so judges and founders can ask why the agent did what it did."
          />
          <FeatureCard
            icon={Shield}
            title="Human-in-the-loop"
            description="A configurable dollar threshold keeps the agent from acting autonomously on high-impact decisions. The default is conservative."
          />
        </div>

        <div className="rounded-3xl bg-card p-8">
          <h2 className="mb-6 font-body text-2xl font-medium text-on-card">
            The demo flow
          </h2>
          <ol className="list-decimal space-y-3 pl-5 leading-relaxed text-muted">
            <li>
              Seed data injects a duplicate subscription, an overpriced vendor,
              and a flatlined analytics tool.
            </li>
            <li>
              The Classifier flags them with confidence scores and reasoning.
            </li>
            <li>
              The Negotiator drafts a renegotiation email to the worst offender.
            </li>
            <li>The Forecast runs three runway scenarios.</li>
            <li>
              The Orchestrator logs every step and waits for human approval.
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}

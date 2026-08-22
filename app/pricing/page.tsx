import { Check } from "lucide-react";
import Link from "next/link";

export default function PricingPage() {
  return (
    <div className="min-h-full bg-page px-6 py-12">
      <div className="mx-auto max-w-5xl">
        <p className="mb-4 font-mono text-xs font-medium uppercase tracking-tight text-slate">
          Pricing
        </p>
        <h1 className="mb-6 font-display text-5xl font-medium leading-none tracking-[-0.02em] text-ink">
          Simple, startup-friendly pricing
        </h1>
        <p className="mb-16 max-w-2xl text-lg leading-relaxed text-slate">
          Pay for what you save. Runway Radar is free until our agents find
          actionable cost reductions.
        </p>

        <div className="grid gap-6 md:grid-cols-3">
          <PricingCard
            name="Seed"
            price="$0"
            description="For startups finding product-market fit."
            features={[
              "Up to $50k/month scanned",
              "Classifier + Forecast agents",
              "5 vendor renegotiations/mo",
              "Email support",
            ]}
            cta="Start free"
          />
          <PricingCard
            name="Series A"
            price="$99"
            description="For growing teams with complex spend."
            features={[
              "Up to $500k/month scanned",
              "All four agents",
              "Unlimited renegotiations",
              "Slack alerts",
              "Priority support",
            ]}
            cta="Start trial"
            highlighted
          />
          <PricingCard
            name="Scale"
            price="Custom"
            description="For multi-entity companies."
            features={[
              "Unlimited spend scanning",
              "Custom agent policies",
              "SSO + audit logs",
              "Dedicated success manager",
            ]}
            cta="Talk to sales"
          />
        </div>
      </div>
    </div>
  );
}

function PricingCard({
  name,
  price,
  description,
  features,
  cta,
  highlighted,
}: {
  name: string;
  price: string;
  description: string;
  features: string[];
  cta: string;
  highlighted?: boolean;
}) {
  return (
    <div
      className={`rounded-3xl p-8 ${
        highlighted
          ? "border border-mint bg-card"
          : "bg-card"
      }`}
    >
      <h3 className="font-body text-2xl font-medium text-on-card">{name}</h3>
      <p className="mt-2 text-sm text-muted">{description}</p>
      <p className="mt-6 font-display text-4xl font-medium leading-none text-on-card">
        {price}
        <span className="ml-1 font-body text-base font-medium text-muted">
          {price === "Custom" ? "" : "/mo"}
        </span>
      </p>
      <ul className="mt-8 space-y-4">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-3 text-muted">
            <Check
              size={16}
              className="mt-1 shrink-0 text-mint"
              strokeWidth={2}
            />
            {f}
          </li>
        ))}
      </ul>
      <Link
        href="/"
        className={`mt-10 block w-full rounded-full py-2.5 text-center text-sm font-medium ${
          highlighted
            ? "bg-on-card text-card hover:bg-canvas"
            : "border border-border-card text-on-card hover:bg-card-2"
        }`}
      >
        {cta}
      </Link>
    </div>
  );
}

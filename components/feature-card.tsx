import type { LucideIcon } from "lucide-react";

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

export default function FeatureCard({
  icon: Icon,
  title,
  description,
}: FeatureCardProps) {
  return (
    <div className="group flex min-h-64 flex-col justify-between border border-page/20 bg-card p-6 transition-colors hover:bg-card-2">
      <Icon size={24} strokeWidth={1.4} className="text-lime" />
      <div className="mt-12">
        <h3 className="font-display text-3xl leading-none tracking-[-0.045em] text-on-card">{title}</h3>
        <p className="mt-4 text-sm leading-relaxed text-muted">{description}</p>
      </div>
    </div>
  );
}

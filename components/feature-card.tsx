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
    <div className="rounded-lg bg-card p-6">
      <div className="mb-4 text-mint">
        <Icon size={22} strokeWidth={1.5} />
      </div>
      <h3 className="mb-2 font-body text-xl font-medium text-on-card">
        {title}
      </h3>
      <p className="text-sm leading-relaxed text-muted">{description}</p>
    </div>
  );
}

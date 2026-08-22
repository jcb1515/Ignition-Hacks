import type { LucideIcon } from "lucide-react";
import { PointerPanel } from "@/components/motion";

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
    <PointerPanel className="group flex min-h-64 flex-col justify-between border border-border-card bg-card p-6 shadow-sm transition-colors hover:border-azure">
      <Icon size={24} strokeWidth={1.4} className="text-azure" />
      <div className="mt-12">
        <h3 className="font-display text-3xl leading-none tracking-[-0.045em] text-on-card">
          {title}
        </h3>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          {description}
        </p>
      </div>
    </PointerPanel>
  );
}

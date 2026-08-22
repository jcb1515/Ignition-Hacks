"use client";

import { useState } from "react";

export function Tabs({
  tabs,
  defaultTab,
  label,
}: {
  tabs: { id: string; label: string; content: React.ReactNode }[];
  defaultTab: string;
  label?: string;
}) {
  const [active, setActive] = useState(defaultTab);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {label ? (
          <p className="mr-auto font-mono text-xs font-medium uppercase tracking-tight text-muted">
            {label}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActive(tab.id)}
              className={`rounded-full px-4 py-1.5 text-xs font-medium transition-all duration-200 ${
                active === tab.id
                  ? "bg-card-2 text-on-card"
                  : "text-muted hover:text-on-card"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      <div className="animate-fade-in">
        {tabs.find((t) => t.id === active)?.content}
      </div>
    </div>
  );
}

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
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        {label ? (
          <p className="font-sans text-xs font-medium uppercase tracking-wider text-muted">
            {label}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActive(tab.id)}
              className={`rounded-full px-3 py-1.5 font-sans text-xs font-medium uppercase tracking-wider transition-colors duration-200 ${
                active === tab.id
                  ? "bg-ink text-white"
                  : "text-muted hover:bg-card-2 hover:text-on-card"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      <div key={active} className="animate-fade-in">
        {tabs.find((tab) => tab.id === active)?.content}
      </div>
    </div>
  );
}

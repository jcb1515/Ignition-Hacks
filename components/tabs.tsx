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
      <div className="mb-5 flex flex-wrap items-center gap-2 border-b border-border-card pb-3">
        {label ? (
          <p className="mr-auto font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-muted">
            {label}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActive(tab.id)}
              className={`relative px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] transition-colors duration-300 ${
                active === tab.id
                  ? "text-azure"
                  : "text-muted hover:text-on-card"
              }`}
            >
              {tab.label}
              <span
                className={`absolute inset-x-0 -bottom-3 h-px origin-center bg-azure transition-transform duration-300 ${
                  active === tab.id ? "scale-x-100" : "scale-x-0"
                }`}
              />
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

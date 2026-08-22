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
      <div className="mb-5 flex min-w-0 flex-col gap-3 border-b border-border pb-3 sm:flex-row sm:items-center sm:justify-between">
        {label ? (
          <p className="font-sans text-xs font-medium uppercase tracking-wider text-muted">
            {label}
          </p>
        ) : null}
        <div className="-mx-1 flex max-w-full gap-1 overflow-x-auto px-1 pb-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActive(tab.id)}
              className={`min-h-10 shrink-0 rounded-full px-3 py-2 font-sans text-xs font-medium uppercase tracking-wider transition-colors duration-200 ${
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

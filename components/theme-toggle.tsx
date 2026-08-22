"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";

type Theme = "light" | "dark";

/**
 * The theme lives in one place: the <html data-theme> attribute, seeded from
 * localStorage or the OS preference. React reads it through an external store
 * so there is no setState inside an effect and no hydration mismatch — the
 * server snapshot is "light", the client snapshot is the real value.
 */
function readTheme(): Theme {
  try {
    const stored = localStorage.getItem("theme");
    if (stored === "light" || stored === "dark") return stored;
  } catch {}
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function subscribe(onChange: () => void) {
  window.addEventListener("theme-change", onChange);
  return () => window.removeEventListener("theme-change", onChange);
}

function setTheme(next: Theme) {
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem("theme", next);
  } catch {}
  window.dispatchEvent(new Event("theme-change"));
}

export default function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "light" as Theme);

  // Apply the resolved theme to the document once on the client. This is a DOM
  // side effect, not a state update.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const isDark = theme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-on-card shadow-sm transition-colors hover:border-azure hover:bg-azure hover:text-white"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      suppressHydrationWarning
    >
      {isDark ? <Moon size={16} /> : <Sun size={16} />}
    </button>
  );
}

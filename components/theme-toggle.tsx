"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const root = document.documentElement;

    let stored: "light" | "dark" | null = null;
    try {
      stored = localStorage.getItem("theme") as "light" | "dark" | null;
    } catch {}

    if (!stored) {
      stored = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }

    root.dataset.theme = stored;
    setTheme(stored);
  }, []);

  const toggle = () => {
    const root = document.documentElement;
    const next = theme === "light" ? "dark" : "light";
    root.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {}
    setTheme(next);
  };

  return (
    <button
      onClick={toggle}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-on-card shadow-sm transition-colors hover:border-azure hover:bg-azure hover:text-white"
      aria-label={mounted && theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
      suppressHydrationWarning
    >
      {mounted && theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
    </button>
  );
}

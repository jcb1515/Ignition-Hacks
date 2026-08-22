"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const root = document.documentElement;
    const stored = root.dataset.theme as "light" | "dark" | undefined;
    setTheme(stored || "light");
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
      aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
      suppressHydrationWarning
    >
      {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
    </button>
  );
}

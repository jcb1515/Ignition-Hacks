"use client";

import Link from "next/link";
import { ArrowUpRight, Menu, X } from "lucide-react";
import ThemeToggle from "@/components/theme-toggle";
import { usePathname } from "next/navigation";
import { useState } from "react";

const links = [
  { href: "/", label: "Overview" },
  { href: "/features", label: "Workflow" },
  { href: "/pricing", label: "Pricing" },
];

export default function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-page/90 px-4 py-3 text-fg backdrop-blur-xl sm:px-10 sm:py-4 lg:px-14">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3">
        <Link href="/" className="group flex min-w-0 items-center gap-2.5 font-sans text-xs font-medium uppercase tracking-wider sm:gap-3">
          <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-azure text-xs text-white sm:h-7 sm:w-7">
            <span className="relative">BS</span>
          </span>
          <span className="truncate transition-colors duration-300 group-hover:text-azure">Burn Shield</span>
        </Link>
        <nav className="hidden items-center gap-7 text-xs text-muted md:flex" aria-label="Primary navigation">
          {links.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`link-sweep transition-colors duration-300 hover:text-azure ${
                  isActive ? "text-fg" : ""
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <ThemeToggle />
          <Link
            href="/pricing"
            className="group hidden items-center gap-2 rounded-full border border-border bg-card-2 px-4 py-2 text-sm font-medium text-on-card transition-colors duration-300 hover:border-azure hover:bg-azure hover:text-white sm:inline-flex"
          >
            Get started
            <ArrowUpRight size={14} className="transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-on-card md:hidden"
            aria-expanded={open}
            aria-controls="mobile-navigation"
            aria-label={open ? "Close navigation" : "Open navigation"}
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>
      {open ? (
        <nav
          id="mobile-navigation"
          className="mx-auto mt-3 grid max-w-[1440px] gap-1 border-t border-border pt-3 md:hidden"
          aria-label="Mobile navigation"
        >
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className={`flex min-h-11 items-center justify-between rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                pathname === link.href
                  ? "bg-azure text-white"
                  : "text-muted hover:bg-card-2 hover:text-fg"
              }`}
            >
              {link.label}
              <ArrowUpRight size={15} />
            </Link>
          ))}
        </nav>
      ) : null}
    </header>
  );
}

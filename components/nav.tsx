"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import ThemeToggle from "@/components/theme-toggle";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Overview" },
  { href: "/features", label: "Workflow" },
  { href: "/pricing", label: "Pricing" },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-page/75 px-6 py-4 text-fg backdrop-blur-xl sm:px-10 lg:px-14">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-6">
        <Link href="/" className="group flex items-center gap-3 font-sans text-xs font-medium uppercase tracking-wider">
          <span className="relative flex h-7 w-7 items-center justify-center rounded-full bg-azure text-xs text-white">
            <span className="relative">RR</span>
          </span>
          <span className="transition-colors duration-300 group-hover:text-azure">Runway Radar</span>
        </Link>
        <nav className="hidden items-center gap-7 text-xs text-muted md:flex">
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
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link
            href="/pricing"
            className="group inline-flex items-center gap-2 rounded-full border border-border bg-card-2 px-4 py-2 text-sm font-medium text-on-card transition-colors duration-300 hover:border-azure hover:bg-azure hover:text-white"
          >
            Get started
            <ArrowUpRight size={14} className="transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </header>
  );
}

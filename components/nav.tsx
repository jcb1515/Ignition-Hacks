"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/features", label: "Agents" },
  { href: "/pricing", label: "Access" },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-page/15 bg-ink/95 px-6 py-4 text-page backdrop-blur sm:px-10 lg:px-14">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-6">
        <Link href="/" className="group flex items-center gap-3 font-mono text-[11px] font-medium uppercase tracking-[0.14em]">
          <span className="relative flex h-7 w-7 items-center justify-center rounded-full bg-azure text-[10px] text-page">
            <span className="ping-ring absolute inset-0 rounded-full bg-azure" />
            <span className="relative">RR</span>
          </span>
          <span className="transition-colors duration-300 group-hover:text-azure">Runway Radar</span>
        </Link>
        <nav className="hidden items-center gap-7 text-xs text-page/65 md:flex">
          {links.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`link-sweep transition-colors duration-300 hover:text-azure ${
                  isActive ? "text-page" : ""
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <Link
          href="/pricing"
          className="group inline-flex items-center gap-2 border border-page/30 px-3 py-2 text-[11px] font-medium transition-colors duration-300 hover:border-azure hover:bg-azure hover:text-page"
        >
          Get started
          <ArrowUpRight size={14} className="transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </Link>
      </div>
    </header>
  );
}

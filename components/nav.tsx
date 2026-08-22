"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Overview" },
  { href: "/features", label: "Agents" },
  { href: "/pricing", label: "Access" },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <header className="border-b border-page/20 bg-ink px-6 py-4 text-page sm:px-10 lg:px-14">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-6">
        <Link href="/" className="flex items-center gap-3 font-mono text-[11px] font-medium uppercase tracking-[0.14em]">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-lime text-[10px] text-ink">RR</span>
          Runway Radar
        </Link>
        <nav className="hidden items-center gap-7 text-xs text-page/65 md:flex">
          {links.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`transition-colors hover:text-lime ${
                  isActive ? "text-page" : ""
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <Link href="/pricing" className="inline-flex items-center gap-2 border border-page/30 px-3 py-2 text-[11px] font-medium transition-colors hover:border-lime hover:bg-lime hover:text-ink">
          Get started <ArrowUpRight size={14} />
        </Link>
      </div>
    </header>
  );
}

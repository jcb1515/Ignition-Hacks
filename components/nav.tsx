"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/features", label: "Agents" },
  { href: "/pricing", label: "Pricing" },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <header className="bg-page px-6 py-5">
      <div className="mx-auto flex max-w-[1340px] items-center justify-between">
        <Link href="/" className="font-display text-sm font-medium uppercase tracking-tight text-ink">
          Runway Radar
        </Link>
        <nav className="hidden items-center rounded-full border border-border bg-canvas p-1 md:flex">
          {links.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-full px-5 py-2 text-sm font-medium transition-all duration-300 ease-out ${
                  isActive
                    ? "bg-card text-on-card"
                    : "text-ink hover:bg-card/10"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="hidden items-center gap-3 md:flex">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-card-2 text-on-card">
            <span className="font-mono text-xs">R</span>
          </div>
        </div>
      </div>
    </header>
  );
}

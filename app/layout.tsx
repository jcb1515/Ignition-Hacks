import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/nav";
import Footer from "@/components/footer";
import { CursorGlow, ScrollProgress } from "@/components/motion";

export const metadata: Metadata = {
  title: "Runway Radar — Agentic Cash Burn Auditor",
  description:
    "Runway Radar is an agentic cash burn auditor and vendor renegotiation copilot for early-stage startups.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-background text-foreground font-body">
        <ScrollProgress />
        <CursorGlow />
        <Nav />
        <main className="relative z-10 flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}

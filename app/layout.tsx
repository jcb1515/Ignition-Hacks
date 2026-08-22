import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import Nav from "@/components/nav";
import Footer from "@/components/footer";

export const metadata: Metadata = {
  title: "Runway Radar — Fintech Burn-Rate Workflow",
  description:
    "Runway Radar is an agentic financial system for early-stage startups that monitors burn rate and automates spend decisions with human approval.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <Script
          id="theme-script"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                try {
                  var theme = localStorage.getItem("theme");
                  if (!theme) {
                    theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
                  }
                  document.documentElement.dataset.theme = theme;
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground font-body" suppressHydrationWarning>
        <Nav />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}

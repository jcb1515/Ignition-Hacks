export default function Footer() {
  return (
    <footer className="border-t border-border bg-page">
      <div className="mx-auto max-w-[1340px] px-6 py-8">
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          <p className="text-sm text-slate">
            © 2026 Runway Radar. Built for hackathons.
          </p>
          <div className="flex gap-6 text-sm text-slate">
            <a href="#" className="hover:text-ink hover:underline">
              Privacy
            </a>
            <a href="#" className="hover:text-ink hover:underline">
              Terms
            </a>
            <a href="#" className="hover:text-ink hover:underline">
              Contact
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

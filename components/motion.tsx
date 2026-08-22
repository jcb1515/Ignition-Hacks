"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from "react";

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Marks an element visible once it scrolls into view so CSS can transition it in. */
export function useInView<T extends HTMLElement>(threshold = 0.2) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setInView(true);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold, rootMargin: "0px 0px -8% 0px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, inView };
}

/** Fades and lifts content into place on scroll. */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const { ref, inView } = useInView<HTMLDivElement>();

  return (
    <div
      ref={ref}
      className={className}
      data-reveal={inView ? "visible" : "hidden"}
      style={{ "--reveal-delay": `${delay}ms` } as CSSProperties}
    >
      {children}
    </div>
  );
}

/** Animates a number up to its target the first time it becomes visible. */
export function CountUp({
  value,
  duration = 1400,
  format,
  className,
}: {
  value: number;
  duration?: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const { ref, inView } = useInView<HTMLSpanElement>(0.4);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;

    const span = prefersReducedMotion() ? 0 : duration;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = span <= 0 ? 1 : Math.min((now - start) / span, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(value * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, value, duration]);

  return (
    <span ref={ref} className={className}>
      {format ? format(display) : Math.round(display).toLocaleString()}
    </span>
  );
}

/** Tracks the pointer inside a panel and exposes it as CSS vars for the glow. */
export function usePointerGlow<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);

  const onPointerMove = useCallback((event: MouseEvent<T>) => {
    const node = ref.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    node.style.setProperty("--pointer-x", `${event.clientX - rect.left}px`);
    node.style.setProperty("--pointer-y", `${event.clientY - rect.top}px`);
  }, []);

  return { ref, onPointerMove };
}

/** Panel that lights up and tilts subtly toward the cursor. */
export function PointerPanel({
  children,
  className = "",
  variant = "dark",
  tilt = 1,
}: {
  children: ReactNode;
  className?: string;
  variant?: "dark" | "light";
  tilt?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  const handleMove = (event: MouseEvent<HTMLDivElement>) => {
    const node = ref.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    node.style.setProperty("--pointer-x", `${x}px`);
    node.style.setProperty("--pointer-y", `${y}px`);

    if (tilt > 0 && !prefersReducedMotion()) {
      const damp = 0.5;
      const rotateY = ((x / rect.width) * 2 - 1) * tilt * damp;
      const rotateX = ((y / rect.height) * 2 - 1) * -tilt * damp;
      node.style.transform = `perspective(1400px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-2px)`;
    }
  };

  const handleLeave = () => {
    const node = ref.current;
    if (node) node.style.transform = "";
  };

  return (
    <div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      className={`pointer-panel ${variant === "light" ? "pointer-panel-light" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

/** Button that leans toward the cursor while hovered. */
export function MagneticButton({
  children,
  className = "",
  strength = 7,
  onClick,
  disabled,
  type = "button",
}: {
  children: ReactNode;
  className?: string;
  strength?: number;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  const ref = useRef<HTMLButtonElement | null>(null);

  const handleMove = (event: MouseEvent<HTMLButtonElement>) => {
    const node = ref.current;
    if (!node || prefersReducedMotion()) return;
    const rect = node.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width - 0.5) * strength * 2;
    const y = ((event.clientY - rect.top) / rect.height - 0.5) * strength * 2;
    node.style.transform = `translate(${x}px, ${y}px)`;
  };

  const handleLeave = () => {
    const node = ref.current;
    if (node) node.style.transform = "";
  };

  return (
    <button
      ref={ref}
      type={type}
      onClick={onClick}
      disabled={disabled}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      className={`transition-transform duration-300 ease-out ${className}`}
    >
      {children}
    </button>
  );
}

/** Types a string out once, then holds a blinking caret. */
export function Typewriter({
  text,
  speed = 34,
  className,
}: {
  text: string;
  speed?: number;
  className?: string;
}) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const reduced = prefersReducedMotion();
    const start = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const typed = reduced
        ? text.length
        : Math.min(text.length, Math.floor((now - start) / speed));
      setCount(typed);
      if (typed < text.length) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [text, speed]);

  return (
    <span className={className}>
      {text.slice(0, count)}
      <span className="animate-caret">_</span>
    </span>
  );
}

/** Infinite horizontal ticker that pauses on hover. */
export function Marquee({
  items,
  duration = 34,
  className = "",
}: {
  items: string[];
  duration?: number;
  className?: string;
}) {
  const doubled = useMemo(() => [...items, ...items], [items]);

  return (
    <div className={`marquee-host overflow-hidden ${className}`}>
      <div
        className="marquee-track"
        style={{ "--marquee-duration": `${duration}s` } as CSSProperties}
      >
        {doubled.map((item, index) => (
          <span
            key={`${item}-${index}`}
            className="flex shrink-0 items-center gap-4 whitespace-nowrap px-6 font-mono text-[11px] uppercase tracking-[0.14em]"
          >
            {item}
            <span className="h-1 w-1 rounded-full bg-azure" />
          </span>
        ))}
      </div>
    </div>
  );
}

/** Thin scroll progress indicator pinned under the nav. */
export function ScrollProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const scrollable = document.body.scrollHeight - window.innerHeight;
      setProgress(scrollable > 0 ? (window.scrollY / scrollable) * 100 : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="fixed left-0 top-0 z-50 h-0.5 w-full bg-transparent">
      <div
        className="h-full bg-gradient-to-r from-azure via-sky to-cyan transition-[width] duration-150 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

/** Soft light that trails the cursor across the whole page. */
export function CursorGlow() {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const node = ref.current;
    if (!node) return;

    let currentX = window.innerWidth / 2;
    let currentY = window.innerHeight / 2;
    let targetX = currentX;
    let targetY = currentY;
    let frame = 0;

    const onMove = (event: PointerEvent) => {
      targetX = event.clientX;
      targetY = event.clientY;
    };

    const render = () => {
      currentX += (targetX - currentX) * 0.12;
      currentY += (targetY - currentY) * 0.12;
      node.style.transform = `translate3d(${currentX - 260}px, ${currentY - 260}px, 0)`;
      frame = requestAnimationFrame(render);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    frame = requestAnimationFrame(render);

    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 z-0 h-[520px] w-[520px] rounded-full opacity-70 mix-blend-multiply blur-[90px]"
      style={{
        background:
          "radial-gradient(circle, rgba(61,123,255,0.22), rgba(126,227,255,0.08) 55%, transparent 72%)",
      }}
    />
  );
}

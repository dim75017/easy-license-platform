import Link from "next/link";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link className="brand brand-warm" href="/" aria-label="Symbiose home">
      <span className="brand-mark brand-groove" aria-hidden="true">
        <svg viewBox="0 0 64 64" focusable="false">
          <path className="brand-groove-warm" d="M49.5 17.5C42 7.5 25.5 6.6 16.5 16c-7.8 8.1-5.6 19.7 5.4 24.3 4.3 1.8 8.8 1.2 12.2-1.6" />
          <path className="brand-groove-base" d="M14.5 46.5c7.6 10.1 24.2 10.9 33.1 1.6 7.8-8.1 5.6-19.7-5.4-24.3-4.3-1.8-8.8-1.2-12.2 1.6" />
        </svg>
      </span>
      <span className="brand-copy">
        <span className="brand-name"><span>sym<span className="brand-accent">biose</span></span></span>
        {!compact && <span className="brand-powered">by Lofi Girl</span>}
      </span>
    </Link>
  );
}

import Link from "next/link";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link className="brand" href="/" aria-label="Symbiose home">
      <span className="brand-mark" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <span className="brand-copy">
        <span className="brand-name"><span>sym<span className="brand-accent">biose</span></span></span>
        {!compact && <span className="brand-powered">by Lofi Girl</span>}
      </span>
    </Link>
  );
}

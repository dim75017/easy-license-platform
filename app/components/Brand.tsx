import Link from "next/link";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link className="brand" href="/" aria-label="Easy License home">
      <span className="brand-mark" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <span className="brand-copy">
        <span className="brand-name"><span>easy</span> <span className="brand-accent">license</span></span>
        {!compact && <span className="brand-powered">by Lofi Girl</span>}
      </span>
    </Link>
  );
}

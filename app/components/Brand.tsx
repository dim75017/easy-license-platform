import Link from "next/link";
import { LofiGirlWordmark } from "./LofiGirlWordmark";
import { SymbiomeMark } from "./SymbiomeMark";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link className="brand brand-warm" href="/" aria-label="Symbiome home">
      <span className="brand-mark brand-groove" aria-hidden="true">
        <SymbiomeMark />
      </span>
      <span className="brand-copy">
        <span className="brand-name"><span>sym<span className="brand-accent">biome</span></span></span>
        {!compact && <span className="brand-powered">by <LofiGirlWordmark decorative /></span>}
      </span>
    </Link>
  );
}

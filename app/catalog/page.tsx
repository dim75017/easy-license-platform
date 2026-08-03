import type { Metadata } from "next";
import Link from "next/link";
import { CatalogueExplorer } from "../components/CatalogueExplorer";
import { PublicShell } from "../components/PublicShell";

export const metadata: Metadata = { title: "Catalogue preview", description: "Explore the intended Easy License catalogue experience." };

export default function CataloguePage() {
  return <PublicShell><section className="page-hero section-shell catalogue-page-hero"><div className="page-hero-copy"><span className="eyebrow"><span>EL/04</span> Catalogue preview</span><h1>Find the right feeling.<br /><em>See the rights beside it.</em></h1><p>Search the product preview by mood, use or tempo. Production tracks will show plan and usage eligibility before download.</p></div><div className="catalogue-stats"><div><strong>8</strong><span>Demo tracks</span></div><div><strong>8</strong><span>Moods</span></div><div><strong>8</strong><span>Use cases</span></div></div></section><section className="section-shell catalogue-page-content"><div className="catalogue-page-heading"><div><span className="section-kicker">MUSIC WITH RIGHTS ATTACHED</span><h2>Music discovery, built around permission.</h2></div><span className="status-pill status-neutral">Prototype data</span></div><CatalogueExplorer /><div className="catalogue-bottom-cta"><div><span>EL</span><p><strong>Found the right track?</strong><small>A production track page would show exact plan, platform, territory and attribution rules.</small></p></div><Link className="button button-primary" href="/pricing">Compare creator licences</Link></div></section></PublicShell>;
}

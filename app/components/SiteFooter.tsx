import Link from "next/link";
import { Brand } from "./Brand";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-main">
        <div className="footer-brand">
          <Brand />
          <p>Music rights made clear for creators and businesses.</p>
        </div>
        <div className="footer-links">
          <div>
            <p className="footer-label">Creators</p>
            <Link href="/creators">Overview</Link>
            <Link href="/creators#creator-plans">Creator &amp; Pro plans</Link>
            <Link href="/app">Client area</Link>
          </div>
          <div>
            <p className="footer-label">Business</p>
            <Link href="/business">Overview</Link>
            <Link href="/sync">Commercial Sync &amp; Custom</Link>
            <Link href="/retail">Music for Retail · Coming soon</Link>
          </div>
          <div>
            <p className="footer-label">Music &amp; artists</p>
            <Link href="/catalog">Catalogue</Link>
            <Link href="/#artists">Our artists</Link>
            <a href="#">Licence terms</a>
            <a href="#">Artist policy</a>
          </div>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© 2026 Easy License. Prototype.</span>
        <span>Real music. Real artists. Clear rights.</span>
      </div>
    </footer>
  );
}

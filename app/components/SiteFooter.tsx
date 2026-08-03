import Link from "next/link";
import { Brand } from "./Brand";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-main">
        <div className="footer-brand">
          <Brand />
          <p>Music rights made clear for creators, brands and spaces.</p>
        </div>
        <div className="footer-links">
          <div>
            <p className="footer-label">Product</p>
            <Link href="/catalog">Catalogue</Link>
            <Link href="/pricing">Pricing</Link>
            <Link href="/app">Client area</Link>
          </div>
          <div>
            <p className="footer-label">Solutions</p>
            <Link href="/pricing">Creators</Link>
            <Link href="/sync">Sync & custom</Link>
            <Link href="/retail">Music for spaces</Link>
          </div>
          <div>
            <p className="footer-label">Legal</p>
            <a href="#">Licence terms</a>
            <a href="#">Privacy</a>
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

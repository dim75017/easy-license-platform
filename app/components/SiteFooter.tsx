import Link from "next/link";
import { Brand } from "./Brand";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-main">
        <div className="footer-brand">
          <Brand />
          <p>High-quality instrumental music for creators and businesses.</p>
        </div>
        <div className="footer-links">
          <div>
            <p className="footer-label">Music</p>
            <Link href="/catalog#music-library">Browse music</Link>
            <Link href="/pricing">View pricing</Link>
          </div>
          <div>
            <p className="footer-label">For Creators</p>
            <Link href="/creators">Overview</Link>
            <Link href="/pricing#creator-pricing-title">Creator &amp; Pro plans</Link>
          </div>
          <div>
            <p className="footer-label">For Businesses</p>
            <Link href="/business">Overview</Link>
            <Link href="/pricing?business_need=existing_track#business-request">Commercial Sync</Link>
            <Link href="/pricing?business_need=custom_music#business-request">Custom Commission</Link>
            <Link href="/pricing?business_need=physical_places#business-request">Music for Retail · Coming soon</Link>
          </div>
          <div>
            <p className="footer-label">Account</p>
            <Link href="/app">Log in</Link>
            <Link href="/pricing#creator-pricing-title">Create account</Link>
          </div>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© 2026 Symbiose.</span>
        <span>Powered by Lofi Girl.</span>
      </div>
    </footer>
  );
}

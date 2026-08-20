import Link from "next/link";
import { publicAccountSignOutHref } from "../_lib/public-account-auth";
import { Brand } from "./Brand";
import { LofiGirlWordmark } from "./LofiGirlWordmark";

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
            <p className="footer-label">Help</p>
            <Link href="/help">Help Center</Link>
            <a href={publicAccountSignOutHref("login")}>Log in</a>
            <a href={publicAccountSignOutHref("create")}>Create account</a>
          </div>
          <div>
            <p className="footer-label">About</p>
            <Link href="/contact">Contact us</Link>
            <Link href="/about">About us</Link>
            <Link href="/press">Press</Link>
            <Link href="/careers">Careers</Link>
          </div>
          <div>
            <p className="footer-label">Legal</p>
            <Link href="/legal">Legal information</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/cookies">Cookies</Link>
          </div>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© 2026 Symbiome.</span>
        <span className="footer-lofi-credit">Powered by<LofiGirlWordmark /></span>
      </div>
    </footer>
  );
}

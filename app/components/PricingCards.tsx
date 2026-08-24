"use client";

import { useState } from "react";
import { publicAccountSignOutHref } from "../_lib/public-account-auth";

export function PricingCards({ expanded = false }: { expanded?: boolean }) {
  const [annual, setAnnual] = useState(true);
  const creatorPrice = annual ? "6.67" : "7.99";
  const proPrice = annual ? "16.67" : "19.99";

  return (
    <div className="pricing-block">
      <p className="pricing-beta-notice"><strong>Planned pricing</strong> — beta accounts are free to create. No payment, subscription or licence is activated yet.</p>
      <div className="billing-toggle" data-period={annual ? "yearly" : "monthly"} role="group" aria-label="Planned billing frequency">
        <button type="button" aria-pressed={!annual} onClick={() => setAnnual(false)}>Monthly</button>
        <button type="button" aria-pressed={annual} onClick={() => setAnnual(true)}>Yearly</button>
      </div>
      <div className={expanded ? "pricing-grid pricing-grid-expanded" : "pricing-grid"}>
        <article className="price-card">
          <span className="plan-code">SY–01 / CREATOR</span>
          <div className="price-card-top">
            <span className="plan-icon plan-creator">C</span>
            <div><p>Creator</p><span>For your own content</span></div>
          </div>
          <div className="price" aria-live="polite" aria-atomic="true"><span>€</span><strong key={creatorPrice}>{creatorPrice}</strong><small>/ month</small></div>
          {annual && <p className="billing-note" key="creator-annual">€79.99 billed yearly</p>}
          {!annual && <p className="billing-note" key="creator-monthly">Cancel whenever you want</p>}
          <ul className="feature-list">
            <li><i>✓</i> 1 channel per platform</li>
            <li><i>✓</i> Monetised videos & livestreams</li>
            <li><i>✓</i> Eligible catalogue downloads</li>
            <li><i>✓</i> Clear licence & ready-to-copy credit</li>
            <li><i>✓</i> Content ID support workflow</li>
            {expanded && <li><i>✓</i> New eligible releases added regularly</li>}
          </ul>
          <a className="button button-primary button-full cta-swipe" href={publicAccountSignOutHref("create", "creator")}>Create a beta account</a>
          <p className="fine-print">Planned for individual creators publishing their own content. Account setup records a preference only.</p>
        </article>

        <article className="price-card price-card-featured">
          <span className="popular-pill">Recommended scope</span>
          <span className="plan-code">SY–02 / PRO</span>
          <div className="price-card-top">
            <span className="plan-icon plan-pro">P</span>
            <div><p>Pro</p><span>For multi-channel creators</span></div>
          </div>
          <div className="price" aria-live="polite" aria-atomic="true"><span>€</span><strong key={proPrice}>{proPrice}</strong><small>/ month</small></div>
          {annual && <p className="billing-note" key="pro-annual">€199.99 billed yearly</p>}
          {!annual && <p className="billing-note" key="pro-monthly">Cancel whenever you want</p>}
          <ul className="feature-list">
            <li><i>✓</i> Up to 3 channels per platform</li>
            <li><i>✓</i> YouTube, Twitch, podcasts & social</li>
            <li><i>✓</i> Cross-platform social publishing</li>
            <li><i>✓</i> Team-ready licence workspace</li>
            <li><i>✓</i> Priority Content ID support</li>
            {expanded && <li><i>✓</i> Centralised downloads and licences</li>}
          </ul>
          <a className="button button-light button-full cta-swipe" href={publicAccountSignOutHref("create", "pro")}>Create a beta account</a>
          <p className="fine-print">Planned for creator teams and multi-channel publishers. Commercial campaigns use Symbiome for Business.</p>
        </article>

      </div>
    </div>
  );
}

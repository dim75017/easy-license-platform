"use client";

import Link from "next/link";
import { useState } from "react";

export function PricingCards({ expanded = false }: { expanded?: boolean }) {
  const [annual, setAnnual] = useState(true);
  const creatorPrice = annual ? "6.58" : "7.99";
  const proPrice = annual ? "16.49" : "19.99";

  return (
    <div className="pricing-block">
      <div className="billing-toggle" role="group" aria-label="Billing frequency">
        <button type="button" className={!annual ? "is-active" : ""} onClick={() => setAnnual(false)}>Monthly</button>
        <button type="button" className={annual ? "is-active" : ""} onClick={() => setAnnual(true)}>Yearly <span>2 months free</span></button>
      </div>
      <div className={expanded ? "pricing-grid pricing-grid-expanded" : "pricing-grid"}>
        <article className="price-card" data-pointer-glow="">
          <div className="price-card-top">
            <span className="plan-icon plan-creator">▶</span>
            <div><p>Creator</p><span>For your own content</span></div>
          </div>
          <div className="price"><span>€</span><strong key={creatorPrice}>{creatorPrice}</strong><small>/ month</small></div>
          {annual && <p className="billing-note">€79 billed yearly</p>}
          {!annual && <p className="billing-note">Cancel whenever you want</p>}
          <ul className="feature-list">
            <li><i>✓</i> 1 channel per platform</li>
            <li><i>✓</i> Monetised videos & livestreams</li>
            <li><i>✓</i> Eligible catalogue downloads</li>
            <li><i>✓</i> Clear licence & ready-to-copy credit</li>
            <li><i>✓</i> Content ID support workflow</li>
            {expanded && <li><i>✓</i> New eligible releases added regularly</li>}
          </ul>
          <Link className="button button-primary button-full" href="/app">Start Creator</Link>
          <p className="fine-print">For individual creators publishing their own content.</p>
        </article>

        <article className="price-card price-card-featured" data-pointer-glow="">
          <span className="popular-pill">Most flexible</span>
          <div className="price-card-top">
            <span className="plan-icon plan-pro">✦</span>
            <div><p>Pro</p><span>For multi-channel creators</span></div>
          </div>
          <div className="price"><span>€</span><strong key={proPrice}>{proPrice}</strong><small>/ month</small></div>
          {annual && <p className="billing-note">€197.90 billed yearly</p>}
          {!annual && <p className="billing-note">Cancel whenever you want</p>}
          <ul className="feature-list">
            <li><i>✓</i> Up to 3 channels per platform</li>
            <li><i>✓</i> YouTube, Twitch, podcasts & social</li>
            <li><i>✓</i> Freelance client work</li>
            <li><i>✓</i> Team-ready licence workspace</li>
            <li><i>✓</i> Priority Content ID support</li>
            {expanded && <li><i>✓</i> Centralised downloads and licences</li>}
          </ul>
          <Link className="button button-light button-full" href="/app">Start Pro</Link>
          <p className="fine-print">For small teams and freelancers. Large agencies need a business licence.</p>
        </article>

        {expanded && (
          <article className="price-card price-card-business" data-pointer-glow="">
            <div className="price-card-top">
              <span className="plan-icon plan-business">◎</span>
              <div><p>Business</p><span>For brands & agencies</span></div>
            </div>
            <div className="price price-custom"><strong>Let&apos;s talk</strong></div>
            <p className="billing-note">A licence shaped around the project</p>
            <ul className="feature-list">
              <li><i>✓</i> Brand campaigns & paid media</li>
              <li><i>✓</i> Multiple clients and markets</li>
              <li><i>✓</i> Existing catalogue sync</li>
              <li><i>✓</i> Custom composition available</li>
              <li><i>✓</i> Dedicated rights support</li>
              <li><i>✓</i> Project-based clearances</li>
            </ul>
            <Link className="button button-ghost button-full" href="/sync">Brief a project</Link>
            <p className="fine-print">Quoted according to media, territory, term and exclusivity.</p>
          </article>
        )}
      </div>
    </div>
  );
}

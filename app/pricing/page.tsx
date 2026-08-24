import { pageMetadata } from "../_lib/seo";
import { Suspense } from "react";
import { BusinessLeadForm } from "../components/BusinessLeadForm";
import { LeadForm } from "../components/LeadForm";
import { PricingCards } from "../components/PricingCards";
import { PublicShell } from "../components/PublicShell";
import "../pricing-v39.css";

export const metadata = pageMetadata("Pricing", "Planned creator account routes and project-based business music requests from Symbiome.", "/pricing");

export default function PricingPage() {
  return (
    <PublicShell>
      <div className="pricing-v39">
        <section className="pricing-v39-hero">
          <div className="page-hero-copy centered">
            <span className="pricing-v39-kicker">SYMBIOME PRICING</span>
            <h1>Planned creator pricing.<br />Live business requests.</h1>
            <p>Create a beta account to prepare your workspace, or send the details of a commercial project for a custom quote. Creator checkout is not active yet.</p>
          </div>
        </section>

        <section className="pricing-v39-plans" aria-labelledby="creator-pricing-title">
          <div className="pricing-v39-heading">
            <div>
              <span className="pricing-v39-kicker">FOR CREATORS</span>
              <h2 id="creator-pricing-title">Choose the plan that fits your channels.</h2>
            </div>
          </div>
          <PricingCards expanded />
        </section>

        <section className="pricing-v39-business" aria-labelledby="business-pricing-title">
          <div className="pricing-v39-business-intro">
            <span className="pricing-v39-kicker">FOR BUSINESSES</span>
            <h2 id="business-pricing-title">Choose what you need.</h2>
            <p>License an existing track or commission original music for a project. Music for physical places is coming soon, and you can join the early-access list here.</p>
          </div>
          <div className="form-panel pricing-v39-business-form" id="business-request">
            <div className="form-panel-head">
              <span>Business music request</span>
              <small>Every active project receives a custom quote</small>
            </div>
            <Suspense fallback={<LeadForm type="business" />}>
              <BusinessLeadForm />
            </Suspense>
          </div>
        </section>
      </div>
    </PublicShell>
  );
}

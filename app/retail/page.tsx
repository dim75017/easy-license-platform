import type { Metadata } from "next";
import { LeadForm } from "../components/LeadForm";
import { PublicShell } from "../components/PublicShell";

export const metadata: Metadata = {
  title: "Music for Retail — Coming soon",
  description: "Human-made music for cafés, hotels, retail stores and workspaces. Simple monthly access, curated for real spaces.",
};

export default function RetailPage() {
  return (
    <PublicShell>
      <main className="retail-v2">
        <section className="retail-v2-hero">
          <div className="retail-v2-hero-copy" data-reveal="left">
            <p className="retail-v2-kicker"><span>COMING SOON</span> Music for Retail</p>
            <h1>Good music.<br />One less thing<br /><em>to think about.</em></h1>
            <p className="retail-v2-lead">A simple way for cafés, stores, hotels and workspaces to sound as considered as they look. Human-made music, curated for the room, without the headache.</p>
            <div className="retail-v2-actions">
              <a className="v5-button v5-button-dark" href="#retail-access"><span>Get early access</span><i>↓</i></a>
              <span>Built for real spaces, not enterprise dashboards.</span>
            </div>
          </div>
          <figure className="retail-v2-hero-image" data-reveal="scale">
            <img src="/images/unsplash/retail/cafe.jpg" alt="Warmly lit café interior" />
            <figcaption><span>NOW PLAYING</span><strong>Easy mornings</strong><small>Human-made music for your space</small></figcaption>
          </figure>
        </section>

        <section className="retail-v2-proof" aria-label="Music for Retail principles" data-reveal="group">
          <div><strong>Easy to run</strong><span>Set the mood once. Let it carry the room.</span></div>
          <div><strong>Made by people</strong><span>Zero AI music. Real artists, paid fairly.</span></div>
          <div><strong>Priced for places</strong><span>Clear monthly plans, built to stay affordable.</span></div>
        </section>

        <section className="retail-v2-easy">
          <div className="retail-v2-section-intro" data-reveal="left">
            <p className="retail-v2-kicker"><span>01</span> Less admin. Better atmosphere.</p>
            <h2>Music should not become another job.</h2>
            <p>Tell us about your space, choose the feeling you want and let the day flow. No agency retainer, no endless playlist hunting and no complicated setup.</p>
          </div>
          <div className="retail-v2-steps" data-reveal="group">
            <article><span>01</span><h3>Choose your room</h3><p>Café, store, hotel, office or somewhere in between.</p></article>
            <article><span>02</span><h3>Choose the feeling</h3><p>Warm mornings, focused afternoons, softer evenings.</p></article>
            <article><span>03</span><h3>Keep it simple</h3><p>A considered soundtrack that keeps showing up for your guests.</p></article>
          </div>
        </section>

        <section className="retail-v2-spaces" data-reveal="group">
          <figure className="retail-v2-space-large"><img src="/images/unsplash/retail/restaurant.jpg" alt="Warm restaurant interior at night" /><figcaption>Restaurants & cafés</figcaption></figure>
          <figure><img src="/images/unsplash/retail/hotel.jpg" alt="Warm modern hotel lobby" /><figcaption>Hotels & hospitality</figcaption></figure>
          <div className="retail-v2-space-copy"><p className="retail-v2-kicker"><span>02</span> Made for the room</p><h2>From first coffee to last guest.</h2><p>Every space has its own rhythm. Easy License helps make it intentional, whether people are stopping by, staying a while or coming back tomorrow.</p></div>
        </section>

        <section className="retail-v2-artists">
          <div data-reveal="left"><p className="retail-v2-kicker"><span>03</span> A better kind of background music</p><h2>Human-made music belongs in human spaces.</h2></div>
          <div className="retail-v2-artist-copy" data-reveal="right"><p>Every track begins with a real artist, never a prompt. Our model is designed so the people who make the music are credited and paid directly when their work is used.</p><div><span>0</span><p><strong>AI-generated tracks</strong><small>Only music made by people.</small></p></div><div><span>10,000+</span><p><strong>Premium tracks</strong><small>Curated for feeling, not filler.</small></p></div></div>
        </section>

        <section className="retail-v2-access" id="retail-access">
          <div data-reveal="left"><p className="retail-v2-kicker"><span>EARLY ACCESS</span> Be part of the first rooms</p><h2>Make your space<br />sound like yours.</h2><p>We are opening the first pilot with venues that care about their atmosphere. Join the list and help shape the simple, affordable version of Music for Retail.</p><small>No commitment. We will only use your details to contact you about the pilot.</small></div>
          <div className="retail-v2-form" data-reveal="scale"><div><span>FIRST PILOT</span><small>Opening soon</small></div><LeadForm type="retail_waitlist" /></div>
        </section>
      </main>
    </PublicShell>
  );
}

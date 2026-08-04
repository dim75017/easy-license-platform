import type { Metadata } from "next";
import Link from "next/link";
import { CatalogueExplorer } from "../components/CatalogueExplorer";
import { PricingCards } from "../components/PricingCards";
import { PublicShell } from "../components/PublicShell";

export const metadata: Metadata = {
  title: "Easy License for Creators",
  description: "Professionally curated, human-made music for YouTube, livestreams, podcasts and social content.",
};

const creatorUses = [
  ["YouTube", "Videos, essays, tutorials, vlogs, Shorts and eligible monetised uploads."],
  ["Livestreams", "Human-made music for Twitch and other eligible live platforms."],
  ["Social content", "TikTok, Instagram, Reels and everyday creator publishing."],
  ["Podcasts", "Intros, transitions and background music for eligible episodes."],
];

export default function CreatorsPage() {
  return (
    <PublicShell>
      <div className="offer-landing creators-landing">
        <section className="offer-hero offer-hero-creators">
          <div className="offer-hero-copy" data-reveal="left">
            <p className="offer-kicker"><span>EL / CREATORS</span> Powered by Lofi Girl</p>
            <h1 data-reveal="hero-title">Make every upload<br /><em>feel finished.</em></h1>
            <p>Access 10,000+ human-made tracks, carefully selected by music professionals for YouTube, livestreams, podcasts and social content. Premium sound, clear licensing and zero AI-generated music.</p>
            <div className="offer-actions">
              <Link className="offer-button offer-button-light" href="/catalog">Explore the music <span>↗</span></Link>
              <a className="offer-inline-link offer-inline-light" href="#creator-plans">Compare Creator &amp; Pro <span>↓</span></a>
            </div>
          </div>
          <div className="offer-hero-proof" data-reveal="group">
            <div><strong>10,000+</strong><span>Human-made tracks</span></div>
            <div><strong>0</strong><span>AI-generated tracks</span></div>
            <div><strong>1,000+</strong><span>Artists worldwide</span></div>
          </div>
        </section>

        <section className="offer-curation" aria-labelledby="creator-curation-title">
          <figure data-reveal="scale"><img src="/images/unsplash/hero-producer.jpg" alt="Music professional working in a warm recording studio" /></figure>
          <div className="offer-curation-copy" data-reveal="right">
            <p className="offer-kicker"><span>01</span> Professionally curated</p>
            <h2 id="creator-curation-title">10,000 tracks.<br />None of the filler.</h2>
            <p>Easy License is not an open upload library. Every track is reviewed, selected and organised by music professionals for musical quality, consistency and real creative use.</p>
            <div className="offer-principles">
              <article><span>01</span><h3>Selected by music professionals</h3><p>Every addition is reviewed for craft, production quality and usefulness.</p></article>
              <article><span>02</span><h3>100% human-made</h3><p>No AI-generated music. Every track starts with a real artist.</p></article>
              <article><span>03</span><h3>Coherent by design</h3><p>A catalogue that feels intentional from one search to the next.</p></article>
            </div>
          </div>
        </section>

        <section className="offer-uses" aria-labelledby="creator-uses-title">
          <div className="offer-section-head" data-reveal="group">
            <p className="offer-kicker"><span>02</span> Built for creators</p>
            <h2 id="creator-uses-title">One licence for everywhere you create.</h2>
            <p>For YouTubers, streamers, influencers, podcasters and social creators.</p>
          </div>
          <div className="offer-use-grid" data-reveal="group">
            {creatorUses.map(([title, copy], index) => <article key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{copy}</p></article>)}
          </div>
        </section>

        <section className="offer-catalogue" aria-labelledby="creator-catalogue-title">
          <div className="offer-section-head offer-section-head-light" data-reveal="group">
            <p className="offer-kicker"><span>03</span> The catalogue</p>
            <h2 id="creator-catalogue-title">The right feeling,<br />without the endless search.</h2>
            <p>Explore music by mood, style or use and see licensing eligibility before you download.</p>
          </div>
          <div className="offer-catalogue-console" data-reveal="scale"><CatalogueExplorer compact /></div>
          <Link className="offer-button offer-button-light offer-catalogue-link" href="/catalog">Browse all 10,000+ tracks <span>↗</span></Link>
        </section>

        <section className="offer-flow" aria-labelledby="creator-flow-title">
          <div className="offer-section-head" data-reveal="group">
            <p className="offer-kicker"><span>04</span> Simple by design</p>
            <h2 id="creator-flow-title">Find it. License it. Publish it.</h2>
          </div>
          <div className="offer-flow-grid" data-reveal="group">
            <article><span>01</span><h3>Connect your channels</h3><p>Tell us where you publish and keep everything together in one workspace.</p></article>
            <article><span>02</span><h3>Choose your track</h3><p>Download eligible music with clear use and ready-to-copy credit information.</p></article>
            <article><span>03</span><h3>Publish with proof</h3><p>Keep the licence record ready if a platform ever needs it.</p></article>
          </div>
        </section>

        <section className="offer-pricing" id="creator-plans" aria-labelledby="creator-plans-title">
          <div className="offer-section-head" data-reveal="group">
            <p className="offer-kicker"><span>05</span> Creator &amp; Pro</p>
            <h2 id="creator-plans-title">Start with one channel.<br />Grow when you need to.</h2>
            <p>Pricing is based on how you publish, not how large your audience is.</p>
          </div>
          <div data-reveal="group"><PricingCards expanded /></div>
        </section>

        <section className="offer-human offer-human-creators" aria-labelledby="creator-human-title">
          <figure data-reveal="scale"><img src="/artists/charlee.jpg" alt="Charlee, an Easy License artist, playing guitar" /></figure>
          <div data-reveal="right">
            <p className="offer-kicker"><span>06</span> Artist-first</p>
            <h2 id="creator-human-title">Made by artists.<br />Curated by people who know music.</h2>
            <p>Every track is created by a real artist. When music is licensed through Easy License, artists are credited and paid directly and fairly.</p>
          </div>
        </section>

        <section className="offer-faq" aria-labelledby="creator-faq-title">
          <div data-reveal="left"><p className="offer-kicker"><span>07</span> Creator FAQ</p><h2 id="creator-faq-title">Before you publish.</h2></div>
          <div className="offer-faq-list" data-reveal="group">
            <details open><summary>What does Creator cover?<span>+</span></summary><p>One connected channel or profile per supported platform for your own eligible monetised videos, livestreams, podcasts and social content.</p></details>
            <details><summary>What does Pro add?<span>+</span></summary><p>Up to three connected channels or profiles, cross-platform publishing and a workspace designed for creator teams.</p></details>
            <details><summary>What if I receive a Content ID claim?<span>+</span></summary><p>Automated claims can still happen. Your workspace keeps the relevant track and licence information ready for support.</p></details>
            <details><summary>Does this cover commercial campaigns?<span>+</span></summary><p>No. Paid advertising, brand campaigns, films, games and broader commercial uses need Easy License for Business.</p></details>
          </div>
        </section>

        <section className="offer-final-cta" data-reveal="group">
          <p>EASY LICENSE FOR CREATORS</p><h2>Your next upload already has a soundtrack.</h2>
          <div className="offer-actions"><Link className="offer-button offer-button-light" href="/pricing">Start with Creator <span>↗</span></Link><Link className="offer-inline-link offer-inline-light" href="/catalog">Explore the catalogue <span>→</span></Link></div>
        </section>
      </div>
    </PublicShell>
  );
}

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
  ["YouTube", "Use eligible tracks in videos, essays, tutorials, reviews, vlogs, Shorts and monetised uploads on your own channel."],
  ["Livestreams", "Add music to eligible Twitch streams and other supported live channels, with licence records kept in your account."],
  ["Social content", "Publish eligible tracks on TikTok, Instagram, Reels and other supported social platforms linked to your account."],
  ["Podcasts", "Use music for intros, transitions and background beds in eligible podcast episodes."],
];

export default function CreatorsPage() {
  return (
    <PublicShell>
      <div className="offer-landing creators-landing">
        <section className="offer-hero offer-hero-creators">
          <div className="offer-hero-copy" data-reveal="left">
            <p className="offer-kicker"><span>EL / CREATORS</span> Powered by Lofi Girl</p>
            <h1 data-reveal="hero-title">Human-made music for<br /><em>your videos, streams and podcasts.</em></h1>
            <p>Browse more than 10,000 instrumental and background tracks made by artists and selected by our music team. Creator plans cover eligible use on your own YouTube, Twitch, podcast and social channels, with licence records kept in one account. No AI-generated music is accepted into the catalogue.</p>
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
            <p className="offer-kicker"><span>01</span> How the catalogue is built</p>
            <h2 id="creator-curation-title">Every track is reviewed<br />before it is added.</h2>
            <p>Our music team reviews each track for composition, performance, recording, mix quality and usefulness in edited or live content. The catalogue is then organised by mood, style and use so that searches return consistent, relevant music.</p>
            <div className="offer-principles">
              <article><span>01</span><h3>Music review</h3><p>We assess the composition, performance and whether the arrangement can support a creator&apos;s content.</p></article>
              <article><span>02</span><h3>Production standards</h3><p>Recording, mix and master quality are checked before a track enters the catalogue.</p></article>
              <article><span>03</span><h3>Human-made catalogue</h3><p>Every eligible track is created by an artist; AI-generated music is not accepted.</p></article>
            </div>
          </div>
        </section>

        <section className="offer-uses" aria-labelledby="creator-uses-title">
          <div className="offer-section-head" data-reveal="group">
            <p className="offer-kicker"><span>02</span> Where you can use the music</p>
            <h2 id="creator-uses-title">Plans for your own<br />creator channels.</h2>
            <p>Creator and Pro are designed for YouTubers, streamers, influencers, podcasters and social creators publishing their own eligible content. The number of connected channels and available team features depends on the plan you choose.</p>
          </div>
          <div className="offer-use-grid" data-reveal="group">
            {creatorUses.map(([title, copy], index) => <article key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{copy}</p></article>)}
          </div>
        </section>

        <section className="offer-catalogue" aria-labelledby="creator-catalogue-title">
          <div className="offer-section-head offer-section-head-light" data-reveal="group">
            <p className="offer-kicker"><span>03</span> Browse the music</p>
            <h2 id="creator-catalogue-title">Search by mood,<br />style or use.</h2>
            <p>Listen to selected tracks, review the artist and genre, and check whether a title is eligible for your plan before downloading it.</p>
          </div>
          <div className="offer-catalogue-console" data-reveal="scale"><CatalogueExplorer compact /></div>
          <Link className="offer-button offer-button-light offer-catalogue-link" href="/catalog">Browse all 10,000+ tracks <span>↗</span></Link>
        </section>

        <section className="offer-flow" aria-labelledby="creator-flow-title">
          <div className="offer-section-head" data-reveal="group">
            <p className="offer-kicker"><span>04</span> How creator licensing works</p>
            <h2 id="creator-flow-title">From account setup<br />to a licensed upload.</h2>
          </div>
          <div className="offer-flow-grid" data-reveal="group">
            <article><span>01</span><h3>Connect your channels</h3><p>Add the supported YouTube, Twitch, podcast or social channels covered by your plan.</p></article>
            <article><span>02</span><h3>Select eligible music</h3><p>Browse the catalogue and download a track that is approved for your plan and intended use.</p></article>
            <article><span>03</span><h3>Keep the licence record</h3><p>Your workspace keeps the track, channel and licence information together for future reference and support.</p></article>
          </div>
        </section>

        <section className="offer-pricing" id="creator-plans" aria-labelledby="creator-plans-title">
          <div className="offer-section-head" data-reveal="group">
            <p className="offer-kicker"><span>05</span> Creator and Pro plans</p>
            <h2 id="creator-plans-title">Choose a plan based<br />on how you publish.</h2>
            <p>Creator covers one connected channel or profile per supported platform. Pro covers up to three and adds a shared workspace for creator teams. Audience size does not change the price.</p>
          </div>
          <div data-reveal="group"><PricingCards expanded /></div>
        </section>

        <section className="offer-human offer-human-creators" aria-labelledby="creator-human-title">
          <figure data-reveal="scale"><img src="/artists/charlee.jpg" alt="Charlee, an Easy License artist, playing guitar" /></figure>
          <div data-reveal="right">
            <p className="offer-kicker"><span>06</span> Artists and payments</p>
            <h2 id="creator-human-title">More than 1,000 artists<br />contribute to the catalogue.</h2>
            <p>Every track is created by a real artist, and no generative AI is used in the music catalogue. Artists are credited and paid directly and fairly when their music is licensed through Easy License.</p>
          </div>
        </section>

        <section className="offer-faq" aria-labelledby="creator-faq-title">
          <div data-reveal="left"><p className="offer-kicker"><span>07</span> Creator FAQ</p><h2 id="creator-faq-title">Common licensing questions.</h2></div>
          <div className="offer-faq-list" data-reveal="group">
            <details open><summary>What does Creator cover?<span>+</span></summary><p>One connected channel or profile per supported platform for your own eligible monetised videos, livestreams, podcasts and social content.</p></details>
            <details><summary>What does Pro add?<span>+</span></summary><p>Up to three connected channels or profiles, cross-platform publishing and a workspace designed for creator teams.</p></details>
            <details><summary>What if I receive a Content ID claim?<span>+</span></summary><p>Automated claims can still happen. Your workspace keeps the relevant track and licence information ready for support.</p></details>
            <details><summary>Does this cover commercial campaigns?<span>+</span></summary><p>No. Paid advertising, brand campaigns, films, games and broader commercial uses need Easy License for Business.</p></details>
          </div>
        </section>

        <section className="offer-final-cta" data-reveal="group">
          <p>EASY LICENSE FOR CREATORS</p><h2>Compare the plans before licensing your channels.</h2>
          <div className="offer-actions"><Link className="offer-button offer-button-light" href="/pricing">Compare creator plans <span>↗</span></Link><Link className="offer-inline-link offer-inline-light" href="/catalog">Browse the music <span>→</span></Link></div>
        </section>
      </div>
    </PublicShell>
  );
}

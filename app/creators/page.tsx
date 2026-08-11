import type { Metadata } from "next";
import Link from "next/link";
import { CatalogueFacts } from "../components/CatalogueFacts";
import { CreatorTrackShowcase } from "../components/CreatorTrackShowcase";
import { creatorPlatforms, PlatformLogo } from "../components/PlatformLogo";
import { PublicShell } from "../components/PublicShell";

export const metadata: Metadata = {
  title: "For Creators",
  description: "Professionally curated, human-made music for YouTube, livestreams, podcasts and social content.",
};

const creatorUses = [
  { title: "YouTube", copy: "Use eligible tracks in videos, essays, tutorials, reviews, vlogs, Shorts and monetised uploads on your own channel.", image: "/images/unsplash/creator-youtube-card.webp", alt: "Creator holding a movie clapper in a video studio", width: 1200, height: 800 },
  { title: "Livestreams", copy: "Add music to eligible Twitch streams and other supported live channels, with licence records kept in your account.", image: "/images/unsplash/creator-streamer-card.webp", alt: "Gamer playing at a desktop setup", width: 1200, height: 800 },
  { title: "Social content", copy: "Publish eligible tracks on TikTok, Instagram, Reels and other supported social platforms linked to your account.", image: "/images/unsplash/creator-social-card.webp", alt: "Creator filming a video at home", width: 1200, height: 675 },
  { title: "Podcasts", copy: "Use music for intros, transitions and background beds in eligible podcast episodes.", image: "/images/unsplash/creator-podcast-card.webp", alt: "Podcast host recording at a microphone", width: 1200, height: 675 },
];

export default function CreatorsPage() {
  return (
    <PublicShell>
      <div className="offer-landing creators-landing">
        <section className="offer-hero offer-hero-creators">
          <div className="offer-hero-copy" data-reveal="left">
            <p className="offer-kicker"><span>SYMBIOSE / CREATORS</span> Powered by Lofi Girl</p>
            <h1 data-reveal="hero-title">Music that fits<br /><em>the way you publish.</em></h1>
            <p>Find instrumental music for the edit, the stream or the opening of a new episode. Symbiose is built around your own YouTube, Twitch, podcast and social channels, with the relevant licence record kept alongside every download.</p>
            <div className="offer-actions">
              <Link className="offer-button offer-button-light" href="/catalog">Explore the music <span>↗</span></Link>
              <a className="offer-inline-link offer-inline-light" href="#creator-plans">Discover pricing <span>↓</span></a>
            </div>
          </div>
        </section>

        <CatalogueFacts />

        <section className="offer-curation" aria-labelledby="creator-curation-title">
          <figure data-reveal="scale"><img src="/images/unsplash/creator-audio-editor.webp" alt="Creator editing audio at a studio workstation" width={1600} height={1124} loading="eager" decoding="async" /></figure>
          <div className="offer-curation-copy" data-reveal="right">
            <p className="offer-kicker"><span>01</span> Built for the cut and the stream</p>
            <h2 id="creator-curation-title">Music that leaves room<br />for your voice.</h2>
            <p>The catalogue is organised for the moments creators actually need to soundtrack: a long edit, a live intro, an explainer, a recap or a quiet background bed. Search by feeling, format or use rather than starting from a blank page.</p>
            <div className="offer-principles">
              <article><span>01</span><h3>Made for the background</h3><p>Arrangements that can support a voiceover, a conversation or a scene without taking it over.</p></article>
              <article><span>02</span><h3>Easy to place</h3><p>Moods, energy and use tags help you move from a rough idea to a usable track quickly.</p></article>
              <article><span>03</span><h3>Made by artists</h3><p>Every eligible track comes from a real artist, never an AI music generator.</p></article>
            </div>
          </div>
        </section>

        <section className="offer-uses" aria-labelledby="creator-uses-title">
          <div className="offer-section-head" data-reveal="group">
            <p className="offer-kicker"><span>02</span> Where you can use the music</p>
            <h2 id="creator-uses-title">Music for your own<br />creator channels.</h2>
            <p>Built for YouTubers, streamers, influencers, podcasters and social creators publishing their own eligible content.</p>
          </div>
          <div className="offer-use-grid" data-reveal="group">
            {creatorUses.map(({ title, copy, image, alt, width, height }, index) => <article key={title}><img src={image} alt={alt} width={width} height={height} loading="lazy" decoding="async" /><div><span>0{index + 1}</span><h3>{title}</h3><p>{copy}</p></div></article>)}
          </div>
        </section>

        <section className="creator-platforms" aria-labelledby="creator-platforms-title">
          <div className="creator-platforms-inner">
            <div className="offer-section-head" data-reveal="up">
              <p className="offer-kicker"><span>03</span> Your channels</p>
              <h2 id="creator-platforms-title">Music for every channel you publish on.</h2>
              <p>Connect your own channels and manage every covered profile in one place.</p>
            </div>
            <div className="creator-platform-grid" data-reveal="group">
              {creatorPlatforms.map((name) => <span className="creator-platform-logo" key={name} role="img" aria-label={name} title={name}><PlatformLogo platform={name} bare onDark /></span>)}
            </div>
          </div>
        </section>

        <section className="offer-catalogue creator-editorial" aria-labelledby="creator-catalogue-title">
          <div className="offer-section-head offer-section-head-light creator-editorial-heading" data-reveal="group">
            <p className="offer-kicker"><span>04</span> Browse the music</p>
            <h2 id="creator-catalogue-title">Search by mood,<br />style or use.</h2>
            <p>Search for a specific track by mood, style or intended use. Or begin with these eight tracks — one from each of our main playlists, selected for streams, edits and different kinds of content.</p>
          </div>
          <div data-reveal="scale"><CreatorTrackShowcase /></div>
          <div className="creator-editorial-action"><Link className="offer-button offer-button-light offer-catalogue-link" href="/catalog">Explore the full music library <span>↗</span></Link></div>
        </section>

        <section className="offer-flow creator-flow" aria-labelledby="creator-flow-title">
          <div className="offer-section-head" data-reveal="group">
            <p className="offer-kicker"><span>05</span> How creator licensing works</p>
            <h2 id="creator-flow-title">Simple from account setup<br />to a licensed upload.</h2>
            <p>A simple three-step process: connect your channels, choose eligible music and keep every licence record in one place.</p>
          </div>
          <div className="offer-flow-grid" data-reveal="group">
            <article><span>01</span><h3>Connect your channels</h3><p>Add the supported YouTube, Twitch, podcast or social channels covered by your licence.</p></article>
            <article><span>02</span><h3>Select eligible music</h3><p>Browse the catalogue and download a track that is approved for your licence and intended use.</p></article>
            <article><span>03</span><h3>Keep the licence record</h3><p>Your workspace keeps the track, channel and licence information together for future reference and support.</p></article>
          </div>
        </section>

        <section className="offer-faq" aria-labelledby="creator-faq-title">
          <div data-reveal="left"><p className="offer-kicker"><span>06</span> Creator FAQ</p><h2 id="creator-faq-title">Common licensing questions.</h2></div>
          <div className="offer-faq-list" data-reveal="group">
            <details open><summary>Can I use the music in videos and livestreams?<span>+</span></summary><p>Yes. Eligible music can cover your own supported videos, livestreams, podcasts and social content.</p></details>
            <details><summary>Can I browse the catalogue before choosing?<span>+</span></summary><p>Yes. You can search the library and listen to the available tracks and playlists before choosing a licence.</p></details>
            <details><summary>What if I receive a Content ID claim?<span>+</span></summary><p>Automated claims can still happen. Your workspace keeps the relevant track and licence information ready for support.</p></details>
            <details><summary>Does this cover commercial campaigns?<span>+</span></summary><p>No. Paid advertising, brand campaigns, films, games and broader commercial uses need Symbiose for Business.</p></details>
          </div>
        </section>

        <section className="offer-final-cta creator-pricing-cta" id="creator-plans" aria-labelledby="creator-plans-title" data-reveal="group">
          <p>CREATOR PRICING</p><h2 id="creator-plans-title">Discover pricing for your creator channels.</h2>
          <div className="offer-actions"><Link className="offer-button offer-button-light" href="/pricing">Discover pricing <span>↗</span></Link></div>
        </section>
      </div>
    </PublicShell>
  );
}

import Link from "next/link";
import { CatalogueExplorer } from "./components/CatalogueExplorer";
import { HeroProductMockup } from "./components/HeroProductMockup";
import { PricingCards } from "./components/PricingCards";
import { PublicShell } from "./components/PublicShell";

export default function Home() {
  return (
    <PublicShell>
      <section className="hero section-shell">
        <div className="hero-copy">
          <div className="eyebrow"><span>✦</span> Independent platform · Powered by Lofi Girl</div>
          <h1>License music.<br /><em>Simply.</em></h1>
          <p>The official, uncomplicated way to use artist-made music in your content, your clients&apos; projects and your business.</p>
          <div className="hero-actions">
            <Link className="button button-primary" href="/pricing">Explore creator plans <span>→</span></Link>
            <Link className="button button-ghost" href="/sync">License for a project</Link>
          </div>
          <div className="hero-proof">
            <span><i>✓</i> Clear licence records</span>
            <span><i>✓</i> Music by real artists</span>
            <span><i>✓</i> Built for creators & brands</span>
          </div>
        </div>
        <HeroProductMockup />
      </section>

      <section className="trust-strip section-shell" aria-label="Platform benefits">
        <div><span className="trust-icon">▶</span><p><strong>YouTube & livestreams</strong><small>Declare the channels you publish on</small></p></div>
        <div><span className="trust-icon">◇</span><p><strong>Rights made readable</strong><small>Know what is covered before you use it</small></p></div>
        <div><span className="trust-icon">♫</span><p><strong>Artist-made catalogue</strong><small>No generative AI music</small></p></div>
        <div><span className="trust-icon">◎</span><p><strong>One project, one record</strong><small>Keep music and permission together</small></p></div>
      </section>

      <section className="section section-shell" id="solutions">
        <div className="section-heading centered">
          <span className="section-kicker">ONE PLATFORM · THREE WAYS TO USE MUSIC</span>
          <h2>The right licence for<br />what you&apos;re making.</h2>
          <p>Start with content, clear a commercial production, or join the next chapter for physical spaces.</p>
        </div>
        <div className="solution-grid">
          <Link className="solution-card solution-creators" href="/pricing">
            <span className="solution-number">01</span>
            <div className="solution-icon"><span>▶</span><i /></div>
            <span className="availability available"><i /> Available now</span>
            <h3>For creators</h3>
            <p>Use eligible music in videos, livestreams, podcasts and social content under one clear subscription.</p>
            <ul><li>From €7.99 / month</li><li>Channel-based licence records</li><li>Catalogue search & downloads</li></ul>
            <span className="card-arrow">Explore creator plans <i>→</i></span>
          </Link>
          <Link className="solution-card solution-sync" href="/sync">
            <span className="solution-number">02</span>
            <div className="solution-icon"><span>◎</span><i /></div>
            <span className="availability available sync"><i /> Project-based</span>
            <h3>Sync & custom music</h3>
            <p>Find an existing track or commission original music through one licensing team and one brief.</p>
            <ul><li>Advertising, film, games & podcasts</li><li>Existing catalogue clearances</li><li>Original music made by artists</li></ul>
            <span className="card-arrow">Brief a project <i>→</i></span>
          </Link>
          <Link className="solution-card solution-retail" href="/retail">
            <span className="solution-number">03</span>
            <div className="solution-icon"><span>▦</span><i /></div>
            <span className="availability soon"><i /> Coming soon</span>
            <h3>Music for spaces</h3>
            <p>Curated, licensed music for cafés, hotels, retail stores, offices and multi-location businesses.</p>
            <ul><li>Curated atmosphere by time of day</li><li>Central control for every location</li><li>Transparent artist value</li></ul>
            <span className="card-arrow">Join early access <i>→</i></span>
          </Link>
        </div>
      </section>

      <section className="section section-shell creator-section">
        <div className="split-heading">
          <div><span className="section-kicker">FOR CREATORS</span><h2>Publish with confidence,<br />not guesswork.</h2></div>
          <p>Your plan brings the eligible catalogue, your connected channels and your licence records into one calm workspace.</p>
        </div>
        <PricingCards />
        <div className="legacy-note"><span>◇</span><p><strong>Already approved before Easy License?</strong>A valid legacy permission stays protected under its original terms. New channels or uses can move into Easy License when needed.</p><Link href="/pricing#faq">How legacy permissions work →</Link></div>
      </section>

      <section className="section section-shell catalogue-preview-section">
        <div className="split-heading catalogue-heading">
          <div><span className="section-kicker">CATALOGUE EXPERIENCE</span><h2>Find the feeling.<br />See the rights.</h2></div>
          <div><p>Search by mood, moment or use. Every production track will show its eligible plans and permitted uses before download.</p><Link className="text-link arrow-link" href="/catalog">Open catalogue preview →</Link></div>
        </div>
        <CatalogueExplorer compact />
      </section>

      <section className="section section-shell workflow-section">
        <div className="section-heading centered small-heading">
          <span className="section-kicker">HOW IT WORKS</span>
          <h2>From idea to permission<br />in three clear steps.</h2>
        </div>
        <div className="workflow-grid">
          <article><span className="workflow-index">01</span><div className="workflow-visual choose-visual"><i /><i /><i /><span>♫</span></div><h3>Choose your music</h3><p>Search the eligible catalogue or send a brief for a commercial project.</p></article>
          <article><span className="workflow-index">02</span><div className="workflow-visual licence-visual"><span>◇</span><i>✓</i><small>LICENCE<br />RECORD</small></div><h3>Match the right licence</h3><p>Connect your channel or define media, territory, term and project scope.</p></article>
          <article><span className="workflow-index">03</span><div className="workflow-visual publish-visual"><span>▶</span><i>✓</i><small>READY FOR<br />YOUR PROJECT</small></div><h3>Keep the proof together</h3><p>Store the licence record, attribution and support path in your workspace.</p></article>
        </div>
      </section>

      <section className="section section-shell artist-section">
        <div className="artist-card">
          <div className="artist-copy">
            <span className="section-kicker">REAL MUSIC · REAL PEOPLE</span>
            <h2>A licence should support<br />the people behind the track.</h2>
            <p>Easy License is built around music made by real artists. Every subscription contributes to a model where creators and musicians can grow together.</p>
            <div className="artist-values"><span><i>♫</i><strong>Human-made only</strong><small>No generative AI catalogue</small></span><span><i>◇</i><strong>Artist-first rights</strong><small>Eligibility is verified track by track</small></span></div>
          </div>
          <div className="artist-visual" aria-hidden="true"><div className="record-disc"><span>easy<br />license</span><i /></div><div className="record-card"><span>NOW PLAYING</span><strong>The people behind<br />the music</strong><small>Artist-made · Rights-cleared</small><div>{[26,48,72,38,62,84,44,68,30,54,76,42,60,34,52,70].map((height,index)=><i key={index} style={{height:`${height}%`}} />)}</div></div></div>
        </div>
      </section>

      <section className="section section-shell sync-teaser">
        <div className="sync-teaser-inner">
          <div><span className="section-kicker">FOR BRANDS & PRODUCTIONS</span><h2>Existing track or<br />something made for you?</h2><p>Both start with the same brief. Our licensing team helps you choose the right path.</p></div>
          <div className="sync-paths"><div><span>♫</span><p><strong>License existing music</strong><small>Clear a track from the eligible catalogue for a campaign, film, game or branded project.</small></p></div><i>OR</i><div><span>✦</span><p><strong>Commission custom music</strong><small>Original composition, sonic identity and production made by real artists.</small></p></div></div>
          <Link className="button button-light" href="/sync">Start a project brief <span>→</span></Link>
        </div>
      </section>

      <section className="section section-shell faq-section" id="faq">
        <div className="section-heading centered small-heading"><span className="section-kicker">THE IMPORTANT BITS</span><h2>Clear answers, before<br />you press publish.</h2></div>
        <div className="faq-grid">
          <details open><summary>Is Easy License “copyright-free” music?<span>＋</span></summary><p>No. The music stays protected by copyright. Easy License gives you permission for specific uses under clear terms and keeps proof of that licence in one place.</p></details>
          <details><summary>Can a Content ID claim still appear?<span>＋</span></summary><p>Yes. Automated claims can happen even when a use is licensed. Eligible accounts will be able to submit the claim and licence record through a defined support workflow.</p></details>
          <details><summary>Is every track included in every plan?<span>＋</span></summary><p>No. Eligibility can vary by track, plan, platform, territory and use. The production track page will show what is covered before you download it.</p></details>
          <details><summary>What does Creator cover?<span>＋</span></summary><p>One connected channel or profile per supported platform for your own eligible monetised videos, livestreams and social content. Client work requires Pro or a Sync agreement.</p></details>
          <details><summary>What happens if I cancel?<span>＋</span></summary><p>Cancellation stops coverage for new uploads and newly connected channels. The final licence terms will define how existing, properly licensed publications remain covered.</p></details>
          <details><summary>Can I upload the music by itself?<span>＋</span></summary><p>No. You cannot redistribute files, upload music-only content, deliver tracks to streaming services, resell them or build a competing music service.</p></details>
        </div>
        <Link className="text-link arrow-link faq-more" href="/pricing#faq">Read the full licence FAQ →</Link>
      </section>

      <section className="final-cta section-shell">
        <div className="final-cta-noise" />
        <span className="section-kicker">MUSIC RIGHTS, WITHOUT THE MAZE</span>
        <h2>Ready to use music<br />with confidence?</h2>
        <p>Choose a creator plan or tell us about a commercial project.</p>
        <div><Link className="button button-light" href="/pricing">Choose a creator plan <span>→</span></Link><Link className="button button-ghost" href="/sync">Start a Sync brief</Link></div>
      </section>
    </PublicShell>
  );
}

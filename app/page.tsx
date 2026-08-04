import Link from "next/link";
import { CatalogueExplorer } from "./components/CatalogueExplorer";
import { HorizontalRailControls } from "./components/HorizontalRailControls";
import { PublicShell } from "./components/PublicShell";

const wave = [28, 54, 34, 72, 46, 82, 38, 64, 92, 48, 70, 32, 58, 78, 42, 66];

const deskCards = [
  {
    code: "EL/01",
    label: "Track & rights",
    title: "See the music and the permission together.",
    copy: "Every eligible track shows the plan, platforms and uses it can cover before you download it.",
    variant: "track",
    accent: "peach",
  },
  {
    code: "EL/02",
    label: "Channel coverage",
    title: "Connect the places where you publish.",
    copy: "Keep channels, active coverage and past publications attached to one creator workspace.",
    variant: "channel",
    accent: "blue",
  },
  {
    code: "EL/03",
    label: "Commercial brief",
    title: "Scope a sync project without the rights maze.",
    copy: "Media, territory, term and exclusivity stay visible from the first brief to the final clearance.",
    variant: "brief",
    accent: "lime",
  },
  {
    code: "EL/04",
    label: "Claim support",
    title: "Find the proof when a platform asks for it.",
    copy: "The licence record, track details and support path live together when Content ID needs attention.",
    variant: "claim",
    accent: "pink",
  },
];

const artists = [
  {
    name: "Charlee Nguyen",
    role: "Producer · Instrumentalist",
    note: "Guitar-led stories with a warm, cinematic pulse.",
    image: "/artists/charlee.jpg",
    href: "https://open.spotify.com/artist/5ffORofXMmNRRtwIeQsyW3",
    tone: "peach",
  },
  {
    name: "Project AER",
    role: "Producer · Soundscapes",
    note: "Atmospheric beats shaped around texture and space.",
    image: "/artists/project-aer.jpg",
    href: "https://open.spotify.com/artist/0iMWUBpWAGKAenBVePrZFP",
    tone: "blue",
  },
  {
    name: "amies",
    role: "Producer · Composer",
    note: "Ambient detail, emotional chords and quiet momentum.",
    image: "/artists/amies.jpg",
    href: "https://open.spotify.com/artist/2zNmlxTlRfyMAAifd2f71Q",
    tone: "pink",
  },
  {
    name: "M e a d o w",
    role: "Producer · Classical musician",
    note: "Organic instrumentation made for focus and reflection.",
    image: "/artists/meadow.jpg",
    href: "https://open.spotify.com/artist/6kG4rnzy0AVEvZb7RGZtoy",
    tone: "lime",
  },
];

function Waveform({ active = false }: { active?: boolean }) {
  return (
    <span className={active ? "el-wave is-active" : "el-wave"} aria-hidden="true">
      {wave.map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}
    </span>
  );
}

function DeskVisual({ variant }: { variant: string }) {
  if (variant === "channel") {
    return (
      <div className="desk-ui desk-channel-ui" aria-hidden="true">
        <div className="desk-ui-head"><span>CONNECTED CHANNELS</span><i>2 ACTIVE</i></div>
        <div className="channel-ui-row"><b>YT</b><p><strong>Studio channel</strong><small>Covered until 04 Aug 2027</small></p><i>✓</i></div>
        <div className="channel-ui-row"><b>TW</b><p><strong>Live channel</strong><small>Creator plan · Active</small></p><i>✓</i></div>
        <div className="channel-ui-foot"><span>12 publications covered</span><span>VIEW RECORDS ↗</span></div>
      </div>
    );
  }

  if (variant === "brief") {
    return (
      <div className="desk-ui desk-brief-ui" aria-hidden="true">
        <div className="desk-ui-head"><span>PROJECT EL-SYNC-021</span><i>IN REVIEW</i></div>
        <div className="brief-ui-grid"><span><small>MEDIA</small>Online film</span><span><small>TERRITORY</small>Worldwide</span><span><small>TERM</small>12 months</span><span><small>MUSIC</small>Existing track</span></div>
        <div className="brief-ui-route"><b>BRIEF</b><i /><b>TRACK</b><i /><b>LICENCE</b></div>
      </div>
    );
  }

  if (variant === "claim") {
    return (
      <div className="desk-ui desk-claim-ui" aria-hidden="true">
        <div className="desk-ui-head"><span>CONTENT ID SUPPORT</span><i>MATCH FOUND</i></div>
        <div className="claim-ui-seal"><span>EL</span><i>LICENCE<br />VERIFIED</i></div>
        <p><strong>Claim EL-CLM-0082</strong><small>Licence and publication matched</small></p>
        <div className="claim-ui-progress"><i /><span>Ready to submit</span></div>
      </div>
    );
  }

  return (
    <div className="desk-ui desk-track-ui" aria-hidden="true">
      <div className="desk-artwork"><span>EL</span><i /></div>
      <div className="desk-track-meta"><small>EL-CAT-0041</small><strong>Cloudlines</strong><span>Charlee Nguyen</span><Waveform active /></div>
      <div className="desk-rights"><span><i />CREATOR</span><span><i />PRO</span><small>Human-made · 02:42 · 78 BPM</small></div>
    </div>
  );
}

export default function Home() {
  return (
    <PublicShell>
      <div className="el-home">
        <section className="el-home-hero">
          <div className="hero-paper-grid" aria-hidden="true" />
          <div className="hero-float hero-float-left" data-parallax="18" aria-hidden="true"><span>HUMAN MADE</span><i>EL · 0042</i></div>
          <div className="hero-float hero-float-right" data-parallax="12" aria-hidden="true"><span>RIGHTS READY</span><i>✓ VERIFIED</i></div>
          <div className="el-home-hero-inner">
            <p className="el-kicker" data-reveal="up">Independent music licensing · Powered by Lofi Girl</p>
            <h1 data-reveal="hero-title"><span>Real music.</span><span><em>Ready for what you make.</em></span></h1>
            <p className="hero-intro" data-reveal="up" data-reveal-delay="1">License artist-made music for videos, streams, client work and commercial projects. Clear rights, simple plans and no generative AI music.</p>
            <div className="hero-actions" data-reveal="up" data-reveal-delay="2">
              <Link className="button button-ink" href="/pricing">Create account</Link>
              <Link className="button button-paper" href="/catalog">Explore the catalogue</Link>
            </div>
            <div className="hero-benefits" data-reveal="group" data-reveal-delay="3">
              <span><i>01</i>Made by real artists</span>
              <span><i>02</i>Artists paid directly</span>
              <span><i>03</i>Clear licence records</span>
              <span><i>04</i>Built for monetised content</span>
            </div>
          </div>
          <div className="hero-scroll-line" aria-hidden="true"><span>SCROLL TO EXPLORE</span><i /></div>
        </section>

        <section className="el-license-desk" aria-labelledby="license-desk-title">
          <div className="el-wide section-title-row">
            <div data-reveal="left"><p className="el-kicker el-kicker-light">Inside Easy License</p><h2 id="license-desk-title">Music on one side.<br /><em>Proof on the other.</em></h2></div>
            <p data-reveal="right">A working desk for choosing tracks, connecting channels and keeping every permission close to the project it covers.</p>
          </div>
          <HorizontalRailControls ariaLabel="Easy License product features" className="desk-rail-shell" trackClassName="desk-rail" controlsClassName="rail-controls rail-controls-light">
            {deskCards.map((card) => (
              <article className={`desk-card desk-card-${card.accent}`} key={card.code} data-pointer-glow="">
                <div className="desk-card-top"><span>{card.code}</span><span>{card.label}</span></div>
                <DeskVisual variant={card.variant} />
                <div className="desk-card-copy"><h3>{card.title}</h3><p>{card.copy}</p></div>
              </article>
            ))}
          </HorizontalRailControls>
          <div className="el-proof-marquee" aria-label="Platform principles">
            <div>
              <p><span>Human-made music</span><i>✦</i><span>Track-level eligibility</span><i>✦</i><span>Licence records</span><i>✦</i><span>Content ID support</span><i>✦</i><span>Artists paid directly</span><i>✦</i></p>
              <p aria-hidden="true"><span>Human-made music</span><i>✦</i><span>Track-level eligibility</span><i>✦</i><span>Licence records</span><i>✦</i><span>Content ID support</span><i>✦</i><span>Artists paid directly</span><i>✦</i></p>
            </div>
          </div>
        </section>

        <section className="el-offers" id="creators">
          <div className="el-wide">
            <div className="offer-heading" data-reveal="group">
              <p className="el-kicker el-kicker-dark">Choose your licence</p>
              <h2>One platform.<br /><em>Four ways to use music.</em></h2>
              <p>Start with the licence that fits today. Move up when your channels, clients or projects grow.</p>
            </div>
            <div className="offer-grid" data-reveal="group">
              <article className="offer-card offer-creator" data-pointer-glow="">
                <div className="offer-card-head"><span>EL–01 / SUBSCRIPTION</span><i>FOR YOUR OWN CHANNEL</i></div>
                <div className="offer-plan-title"><div><h3>Creator</h3><p>Videos, livestreams, podcasts and social content on your own monetised channel.</p></div><div className="offer-price"><span>€</span><strong>7.99</strong><small>/ month</small></div></div>
                <ul><li>1 channel per supported platform</li><li>Eligible catalogue downloads</li><li>Licence records & credit</li><li>Content ID support path</li></ul>
                <Link className="button button-ink" href="/pricing">Choose Creator</Link>
              </article>
              <article className="offer-card offer-pro" data-pointer-glow="">
                <div className="offer-card-head"><span>EL–02 / SUBSCRIPTION</span><i>MOST FLEXIBLE</i></div>
                <h3>Pro</h3>
                <div className="offer-price"><span>€</span><strong>19.99</strong><small>/ month</small></div>
                <p>Up to three channels, more platforms and eligible freelance client work.</p>
                <Link className="offer-text-link" href="/pricing">Compare plans <span>↗</span></Link>
              </article>
              <article className="offer-card offer-sync" data-pointer-glow="">
                <div className="offer-card-head"><span>EL–03 / PROJECT</span><i>FOR BRANDS & PRODUCTIONS</i></div>
                <h3>Sync</h3>
                <p>Clear an existing track or commission original music for a campaign, film, game or branded project.</p>
                <div className="sync-mini-paths"><span>EXISTING TRACK</span><i>OR</i><span>CUSTOM MUSIC</span></div>
                <Link className="offer-text-link" href="/sync">Start a music brief <span>↗</span></Link>
              </article>
              <Link className="offer-retail" href="/retail">
                <span>EL–04 / COMING SOON</span><div><strong>Music for Business</strong><p>Licensed music for cafés, hotels, stores, offices and multi-location brands.</p></div><i>Join early access ↗</i>
              </Link>
            </div>
          </div>
        </section>

        <section className="el-catalogue" aria-labelledby="catalogue-title">
          <div className="catalogue-grid-mark" aria-hidden="true" />
          <div className="el-wide">
            <div className="catalogue-heading" data-reveal="group">
              <div><p className="el-kicker el-kicker-dark">Music with rights attached</p><h2 id="catalogue-title">Find the sound.<br /><em>See the licence.</em></h2></div>
              <div><p>Search by mood, genre or use. Every eligible track shows where and how it can be licensed.</p><Link className="button button-ink" href="/catalog">Explore music and rights</Link></div>
            </div>
            <div className="catalogue-stage" data-reveal="scale">
              <div className="catalogue-stage-bar"><span>CATALOGUE / EL–2026</span><p><i /> 824 HUMAN-MADE TRACKS</p><span>SEARCH · FILTER · PREVIEW</span></div>
              <CatalogueExplorer compact />
            </div>
            <div className="catalogue-notes" data-reveal="group"><span><strong>01</strong> Search by moment</span><span><strong>02</strong> Preview the music</span><span><strong>03</strong> Check eligibility</span><span><strong>04</strong> Keep the licence</span></div>
          </div>
        </section>

        <section className="el-artists" id="artists" aria-labelledby="artists-title">
          <div className="el-wide artist-heading">
            <div data-reveal="left"><p className="el-kicker el-kicker-light">Meet the artists</p><h2 id="artists-title">The people behind<br /><em>every track.</em></h2></div>
            <div data-reveal="right"><p>No anonymous catalogue. No generative AI music. Easy License works with real artists and pays them directly when their music is licensed.</p><span className="artist-principle"><i>EL / PRINCIPLE 01</i>Real music has real value.</span></div>
          </div>
          <HorizontalRailControls ariaLabel="Featured artists" className="artist-rail-shell" trackClassName="artist-rail" controlsClassName="rail-controls rail-controls-light artist-rail-controls">
            {artists.map((artist, index) => (
              <a className={`artist-profile artist-profile-${artist.tone}`} href={artist.href} target="_blank" rel="noreferrer" key={artist.name} data-tilt="">
                <div className="artist-photo" role="img" aria-label={`Portrait of ${artist.name}`} style={{ backgroundImage: `url(${artist.image})` }}><span>{String(index + 1).padStart(2, "0")}</span></div>
                <div className="artist-profile-copy"><small>{artist.role}</small><h3>{artist.name}</h3><p>{artist.note}</p><span>View artist ↗</span></div>
              </a>
            ))}
          </HorizontalRailControls>
          <div className="el-wide artist-economy" data-reveal="group">
            <div className="economy-statement"><p className="el-kicker el-kicker-light">A direct model</p><h3>Artists are credited,<br /><em>paid directly</em> and kept<br />in the story.</h3></div>
            <div className="economy-flow">
              <span><i>01</i><strong>Music is chosen</strong><small>A real artist is attached to every track.</small></span>
              <b aria-hidden="true">→</b>
              <span><i>02</i><strong>The licence is recorded</strong><small>The project and permitted use stay visible.</small></span>
              <b aria-hidden="true">→</b>
              <span><i>03</i><strong>The artist is paid</strong><small>Value goes directly back to the people making the music.</small></span>
            </div>
          </div>
        </section>

        <section className="el-ledger" aria-labelledby="ledger-title">
          <div className="el-wide ledger-layout">
            <div className="ledger-copy" data-reveal="left">
              <p className="el-kicker el-kicker-dark">From track to licence</p>
              <h2 id="ledger-title">Three steps.<br /><em>No rights maze.</em></h2>
              <div className="ledger-steps">
                <span><i>01</i><p><strong>Find your music</strong><small>Explore tracks made by real artists.</small></p></span>
                <span><i>02</i><p><strong>Match the licence</strong><small>Choose a plan or define your project scope.</small></p></span>
                <span><i>03</i><p><strong>Keep the proof</strong><small>Store your licence, credit and support path together.</small></p></span>
              </div>
              <Link className="button button-ink" href="/pricing">Find my licence</Link>
            </div>
            <article className="licence-sheet" data-reveal="right" data-pointer-glow="">
              <div className="licence-sheet-head"><span>EASY LICENSE</span><i>EL-LIC-2026-00482</i></div>
              <div className="licence-status"><span>ACTIVE LICENCE</span><i>✓ VERIFIED</i></div>
              <div className="licence-main"><small>LICENSED TRACK</small><h3>Cloudlines</h3><p>Charlee Nguyen · EL-CAT-0041</p><Waveform active /></div>
              <dl><div><dt>Account</dt><dd>Creator workspace</dd></div><div><dt>Channel</dt><dd>Studio channel</dd></div><div><dt>Use</dt><dd>Video & livestream</dd></div><div><dt>Territory</dt><dd>Worldwide</dd></div><div><dt>Attribution</dt><dd>Ready to copy</dd></div><div><dt>Support</dt><dd>Included</dd></div></dl>
              <div className="licence-sheet-foot"><span>ISSUED / 04 AUG 2026</span><span>PROOF STORED IN WORKSPACE</span></div>
            </article>
          </div>
          <div className="el-wide compact-pricing" data-reveal="group">
            <Link href="/pricing"><span>CREATOR</span><strong>€7.99</strong><small>/ month · 1 channel</small><i>Choose ↗</i></Link>
            <Link href="/pricing"><span>PRO</span><strong>€19.99</strong><small>/ month · 3 channels + client work</small><i>Choose ↗</i></Link>
            <Link href="/sync"><span>COMMERCIAL</span><strong>Project quote</strong><small>Brands, campaigns, film & games</small><i>Brief ↗</i></Link>
          </div>
        </section>

        <section className="el-sync-band" aria-labelledby="sync-title">
          <div className="sync-band-half sync-band-existing" data-reveal="left"><span>01 / LICENSE EXISTING MUSIC</span><h2>Already made.<br />Ready to clear.</h2><p>License an eligible catalogue track for a campaign, film, game, podcast or branded project.</p></div>
          <div className="sync-band-half sync-band-custom" data-reveal="right"><span>02 / COMMISSION ORIGINAL MUSIC</span><h2>Made for you.<br />Built around the brief.</h2><p>Work with real composers and producers on music shaped around your story, timing and identity.</p></div>
          <div className="sync-band-center" data-reveal="scale"><p className="el-kicker el-kicker-light">Sync & custom music</p><h3 id="sync-title">One brief.<br /><em>Two ways to get the right music.</em></h3><Link className="button button-light" href="/sync">Start a music brief</Link></div>
        </section>

        <section className="el-faq" id="faq">
          <div className="el-wide faq-layout">
            <div data-reveal="left"><p className="el-kicker el-kicker-dark">Before you publish</p><h2>Clear answers.<br /><em>Before you press play.</em></h2><Link className="offer-text-link" href="/pricing#faq">See every licence question <span>↗</span></Link></div>
            <div className="el-faq-list" data-reveal="group">
              <details open><summary>What does Creator cover?<span>＋</span></summary><p>One connected channel or profile per supported platform for eligible monetised videos, livestreams and social content. Client work requires Pro or a Sync agreement.</p></details>
              <details><summary>Can a Content ID claim still appear?<span>＋</span></summary><p>Yes. Automated claims can happen even with a valid licence. Your workspace keeps the track and licence information ready for the support workflow.</p></details>
              <details><summary>Is every track eligible?<span>＋</span></summary><p>Eligibility can vary by track, plan, platform, territory and use. Every production track page will show what is covered before download.</p></details>
              <details><summary>What happens after cancellation?<span>＋</span></summary><p>Cancellation stops coverage for new uploads and newly connected channels. Final terms will define continued coverage for properly licensed past publications.</p></details>
            </div>
          </div>
        </section>

        <section className="el-final-cta" data-reveal="scale">
          <div className="final-cta-rings" aria-hidden="true"><i /><i /><i /></div>
          <p className="el-kicker el-kicker-dark">Real music · Clear rights</p>
          <h2>Make something<br /><em>worth hearing.</em></h2>
          <p>Create your account to license music for content, or brief the team for a commercial project.</p>
          <div><Link className="button button-ink" href="/pricing">Create account</Link><Link className="button button-paper" href="/sync">Start a music brief</Link></div>
          <Link className="final-login" href="/app">Already have an account? <span>Log in ↗</span></Link>
        </section>
      </div>
    </PublicShell>
  );
}

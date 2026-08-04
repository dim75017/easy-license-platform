import Link from "next/link";
import { CatalogueExplorer } from "./components/CatalogueExplorer";
import { LicenseBooth } from "./components/LicenseBooth";
import { PublicShell } from "./components/PublicShell";

const artists = [
  {
    name: "Charlee Nguyen",
    role: "Producer · Instrumentalist",
    image: "/artists/charlee.jpg",
    href: "https://open.spotify.com/artist/5ffORofXMmNRRtwIeQsyW3",
    color: "coral",
  },
  {
    name: "Project AER",
    role: "Producer · Soundscapes",
    image: "/artists/project-aer.jpg",
    href: "https://open.spotify.com/artist/0iMWUBpWAGKAenBVePrZFP",
    color: "blue",
  },
  {
    name: "amies",
    role: "Producer · Composer",
    image: "/artists/amies.jpg",
    href: "https://open.spotify.com/artist/2zNmlxTlRfyMAAifd2f71Q",
    color: "acid",
  },
  {
    name: "M e a d o w",
    role: "Producer · Classical musician",
    image: "/artists/meadow.jpg",
    href: "https://open.spotify.com/artist/6kG4rnzy0AVEvZb7RGZtoy",
    color: "mint",
  },
];

export default function Home() {
  return (
    <PublicShell>
      <div className="el-v5">
        <section className="v5-hero">
          <div className="v5-hero-grid" aria-hidden="true" />
          <div className="v5-hero-copy">
            <p className="v5-kicker" data-reveal="left"><span>New route</span> Music licensing, rerouted.</p>
            <h1 data-reveal="hero-title">
              <span>Clear</span>
              <span>the track.</span>
              <span className="v5-outline">Keep moving.</span>
            </h1>
            <div className="v5-hero-intro" data-reveal="up" data-reveal-delay="2">
              <p>Music made by artists, licensed for creators, client work and commercial stories. Pick a use. See the rights. Publish.</p>
              <div>
                <Link className="v5-button v5-button-dark" href="/catalog"><span>Open the catalogue</span><i>↗</i></Link>
                <Link className="v5-inline-link" href="/pricing">Plans from €7.99 <span>→</span></Link>
              </div>
            </div>
          </div>

          <div className="v5-hero-booth" data-reveal="hero-product" data-parallax="14">
            <LicenseBooth />
          </div>

          <div className="v5-hero-code" aria-hidden="true">
            <span>EL / 2026</span>
            <span>HUMAN MADE</span>
          </div>
          <div className="v5-hero-ticker" aria-label="Easy License principles">
            <div>
              <span>Human-made music</span><i>●</i><span>Artists paid directly</span><i>●</i><span>Rights attached to every track</span><i>●</i><span>Built for content that earns</span><i>●</i>
              <span aria-hidden="true">Human-made music</span><i aria-hidden="true">●</i><span aria-hidden="true">Artists paid directly</span><i aria-hidden="true">●</i><span aria-hidden="true">Rights attached to every track</span><i aria-hidden="true">●</i><span aria-hidden="true">Built for content that earns</span><i aria-hidden="true">●</i>
            </div>
          </div>
        </section>

        <section className="v5-route" aria-labelledby="route-title">
          <div className="v5-route-intro">
            <div className="v5-route-sticky" data-reveal="left">
              <p className="v5-kicker"><span>01 / The product</span> One route, end to end</p>
              <h2 id="route-title">From sound<br />to cleared.</h2>
              <p>Easy License keeps discovery, permissions and proof inside the same flow. No separate rights maze after you find the track.</p>
              <Link className="v5-inline-link" href="/app">See the workspace <span>→</span></Link>
            </div>
          </div>

          <div className="v5-route-steps">
            <article className="v5-route-step v5-step-acid" data-reveal="right">
              <div className="v5-step-index"><span>01</span><small>FIND</small></div>
              <div className="v5-step-copy"><h3>Choose by feeling.<br />Check by use.</h3><p>Search the catalogue by mood, genre or project. Eligible uses stay visible before download.</p></div>
              <div className="v5-step-visual v5-search-visual" aria-hidden="true"><span>⌕</span><p>late night focus</p><i>12 MATCHES</i></div>
            </article>

            <article className="v5-route-step v5-step-blue" data-reveal="right">
              <div className="v5-step-index"><span>02</span><small>CONNECT</small></div>
              <div className="v5-step-copy"><h3>Tell us where<br />you publish.</h3><p>Connect your channels once. Easy License keeps the active coverage attached to them.</p></div>
              <div className="v5-step-visual v5-channel-visual" aria-hidden="true"><span>YT</span><b /><span>TW</span><b /><i>CONNECTED</i></div>
            </article>

            <article className="v5-route-step v5-step-coral" data-reveal="right">
              <div className="v5-step-index"><span>03</span><small>KEEP PROOF</small></div>
              <div className="v5-step-copy"><h3>Publish with the<br />record beside you.</h3><p>Track, channel, permitted use and support route stay together if a platform asks.</p></div>
              <div className="v5-step-visual v5-proof-visual" aria-hidden="true"><span>EL</span><p>LICENCE / ACTIVE</p><i>✓ VERIFIED</i></div>
            </article>
          </div>
        </section>

        <section className="v5-plans" id="creators" aria-labelledby="plans-title">
          <div className="v5-section-head" data-reveal="group">
            <p className="v5-kicker"><span>02 / Access</span> Choose your route</p>
            <h2 id="plans-title">Built around<br />how you publish.</h2>
            <p>Start small, then move to a wider route when the work changes. Every plan stays attached to real music and clear permissions.</p>
          </div>

          <div className="v5-plan-board" data-reveal="group">
            <Link className="v5-plan-row v5-plan-creator" href="/pricing">
              <span className="v5-plan-number">01</span>
              <div className="v5-plan-name"><small>YOUR OWN CHANNEL</small><strong>Creator</strong></div>
              <p>One channel per supported platform. Videos, livestreams, podcasts and social content.</p>
              <div className="v5-plan-cost"><strong>€7.99</strong><span>/ month</span></div>
              <i aria-hidden="true">↗</i>
            </Link>
            <Link className="v5-plan-row v5-plan-pro" href="/pricing">
              <span className="v5-plan-number">02</span>
              <div className="v5-plan-name"><small>MORE CHANNELS + CLIENTS</small><strong>Pro</strong></div>
              <p>Up to three channels, broader platform coverage and eligible freelance client work.</p>
              <div className="v5-plan-cost"><strong>€19.99</strong><span>/ month</span></div>
              <i aria-hidden="true">↗</i>
            </Link>
            <Link className="v5-plan-row v5-plan-sync" href="/sync">
              <span className="v5-plan-number">03</span>
              <div className="v5-plan-name"><small>BRANDS + PRODUCTIONS</small><strong>Sync</strong></div>
              <p>Clear an existing track or commission original music for a campaign, film, game or brand.</p>
              <div className="v5-plan-cost"><strong>Project</strong><span>brief + quote</span></div>
              <i aria-hidden="true">↗</i>
            </Link>
            <Link className="v5-plan-row v5-plan-retail" href="/retail">
              <span className="v5-plan-number">04</span>
              <div className="v5-plan-name"><small>PHYSICAL SPACES</small><strong>Music for Business</strong></div>
              <p>For cafés, stores, hotels and teams. The first retail route is currently being built.</p>
              <div className="v5-plan-cost"><strong>Soon</strong><span>join early access</span></div>
              <i aria-hidden="true">↗</i>
            </Link>
          </div>
        </section>

        <section className="v5-catalogue" aria-labelledby="catalogue-title">
          <div className="v5-catalogue-side" aria-hidden="true"><span>824 TRACKS</span><i>HUMAN / MADE</i></div>
          <div className="v5-catalogue-main">
            <div className="v5-catalogue-head" data-reveal="group">
              <p className="v5-kicker"><span>03 / Music</span> Rights live with the sound</p>
              <h2 id="catalogue-title">Press play.<br />See the route.</h2>
              <div><p>Preview the music like a listener. Inspect the permissions like a professional.</p><Link className="v5-button v5-button-acid" href="/catalog"><span>Explore all music</span><i>↗</i></Link></div>
            </div>
            <div className="v5-catalogue-console" data-reveal="scale">
              <div className="v5-console-bar"><span>CATALOGUE / LIVE INDEX</span><span><i /> 824 READY TRACKS</span><span>FILTER · PLAY · CLEAR</span></div>
              <CatalogueExplorer compact />
            </div>
          </div>
        </section>

        <section className="v5-artists" id="artists" aria-labelledby="artists-title">
          <div className="v5-artist-header" data-reveal="group">
            <p className="v5-kicker"><span>04 / People</span> Not a faceless library</p>
            <h2 id="artists-title">Every track<br />has a name.</h2>
            <p>No anonymous filler and no generative AI catalogue. Easy License works with artists, credits them and pays them directly when their music creates value.</p>
          </div>

          <div className="v5-artist-wall" data-reveal="group">
            {artists.map((artist, index) => (
              <a
                className={`v5-artist-tile v5-artist-${artist.color} v5-artist-${index + 1}`}
                href={artist.href}
                target="_blank"
                rel="noreferrer"
                key={artist.name}
                data-tilt=""
              >
                <div className="v5-artist-image" style={{ backgroundImage: `url(${artist.image})` }} role="img" aria-label={`Portrait of ${artist.name}`} />
                <div className="v5-artist-caption"><small>{String(index + 1).padStart(2, "0")} / {artist.role}</small><strong>{artist.name}</strong><span>Open artist ↗</span></div>
              </a>
            ))}
          </div>

          <div className="v5-payout" data-reveal="group">
            <span><small>01</small><strong>Track licensed</strong></span><b aria-hidden="true">→</b>
            <span><small>02</small><strong>Use recorded</strong></span><b aria-hidden="true">→</b>
            <span><small>03</small><strong>Artist credited</strong></span><b aria-hidden="true">→</b>
            <span className="is-highlighted"><small>04</small><strong>Artist paid directly</strong></span>
          </div>
        </section>

        <section className="v5-sync" aria-labelledby="sync-title">
          <div className="v5-sync-title" data-reveal="left">
            <p className="v5-kicker"><span>05 / Sync</span> One brief, two routes</p>
            <h2 id="sync-title">Need music<br />for a bigger story?</h2>
            <p>Start with what already exists, or make something new with an artist.</p>
          </div>
          <div className="v5-sync-paths" data-reveal="group">
            <Link href="/sync" className="v5-sync-path v5-sync-existing">
              <span>PATH A / CATALOGUE</span><strong>License<br />an existing track.</strong><p>Campaigns, films, games, podcasts and branded work.</p><i>Start a clearance ↗</i>
            </Link>
            <Link href="/sync" className="v5-sync-path v5-sync-custom">
              <span>PATH B / ORIGINAL</span><strong>Commission<br />custom music.</strong><p>A track shaped around your brief, timing and identity.</p><i>Start a commission ↗</i>
            </Link>
          </div>
        </section>

        <section className="v5-faq" id="faq" aria-labelledby="faq-title">
          <div className="v5-faq-title" data-reveal="left"><p className="v5-kicker"><span>06 / Fine print</span> The useful answers</p><h2 id="faq-title">Before you<br />press publish.</h2></div>
          <div className="v5-faq-list" data-reveal="group">
            <details open><summary><span>01</span>What does Creator cover?<i>+</i></summary><p>One connected channel or profile per supported platform for eligible monetised videos, livestreams and social content. Client work needs Pro or a Sync agreement.</p></details>
            <details><summary><span>02</span>Can a Content ID claim still appear?<i>+</i></summary><p>Yes. Automated claims can happen even with a valid licence. Your workspace keeps the track and licence information ready for support.</p></details>
            <details><summary><span>03</span>Is every track eligible everywhere?<i>+</i></summary><p>Eligibility can vary by track, plan, platform, territory and use. Each production track page shows the coverage before download.</p></details>
            <details><summary><span>04</span>What happens after cancellation?<i>+</i></summary><p>Cancellation stops coverage for new uploads and newly connected channels. Final terms will define continued coverage for properly licensed past publications.</p></details>
          </div>
        </section>

        <section className="v5-command" data-reveal="scale" data-pointer-glow="">
          <div className="v5-command-status"><i /> ROUTE AVAILABLE / CREATOR</div>
          <h2>Your channel.<br />Cleared to move.</h2>
          <p>Connect a channel, choose the music and keep the rights record next to the work.</p>
          <div>
            <Link className="v5-button v5-button-acid" href="/pricing"><span>Create account</span><i>↗</i></Link>
            <Link className="v5-inline-link" href="/app">Already have an account? Log in <span>→</span></Link>
          </div>
          <span className="v5-command-code" aria-hidden="true">EL<br />OK</span>
        </section>
      </div>
    </PublicShell>
  );
}

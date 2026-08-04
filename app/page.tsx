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
      <div className="el-v5 el-v6">
        <section className="v5-hero">
          <div className="v5-hero-grid" aria-hidden="true" />
          <div className="v5-hero-copy">
            <p className="v5-kicker" data-reveal="left"><span>Powered by Lofi Girl</span> 10,000+ human-made tracks · zero AI-generated music</p>
            <h1 data-reveal="hero-title">
              <span>Sound for</span>
              <span>every story.</span>
              <span className="v5-hero-human">Made by real artists.</span>
            </h1>
            <div className="v5-hero-intro" data-reveal="up" data-reveal-delay="2">
              <p>A deeply curated catalogue of instrumental and background music for videos, livestreams, podcasts, brands, films and games—licensed simply, with artists paid directly.</p>
              <div>
                <Link className="v5-button v5-button-dark" href="/catalog"><span>Find your sound</span><i>↗</i></Link>
                <Link className="v5-inline-link" href="/pricing">License from €7.99 <span>→</span></Link>
              </div>
            </div>
          </div>

          <div className="v5-hero-booth" data-reveal="hero-product" data-parallax="14">
            <LicenseBooth />
          </div>

          <div className="v5-hero-code" aria-hidden="true">
            <span>EASY LICENSE</span>
            <span>BY LOFI GIRL</span>
          </div>
        </section>

        <section className="v5-proof-band" aria-label="Easy License catalogue in numbers" data-reveal="group">
          <article className="v5-proof-stat v5-proof-stat-size">
            <strong>10,000+</strong>
            <span>Human-made tracks</span>
            <small>A deep catalogue, curated to keep growing</small>
          </article>
          <article className="v5-proof-stat v5-proof-stat-zero">
            <strong>0</strong>
            <span>AI-generated tracks</span>
            <small>Every piece starts with a real artist</small>
          </article>
          <article className="v5-proof-stat v5-proof-stat-quality">
            <strong>Premium</strong>
            <span>Instrumental + background</span>
            <small>Selected for quality, feeling and versatility</small>
          </article>
          <article className="v5-proof-stat v5-proof-stat-uses">
            <strong>Paid directly</strong>
            <span>Fairer by design</span>
            <small>Each licence supports the artist behind the music, directly and fairly</small>
          </article>
        </section>

        <section className="v5-route" aria-labelledby="route-title">
          <div className="v5-route-intro">
            <div className="v5-route-sticky" data-reveal="left">
              <p className="v5-kicker"><span>01 / Built for every brief</span> One catalogue, countless uses</p>
              <h2 id="route-title">One catalogue.<br />Every kind of work.</h2>
              <p>From tomorrow&apos;s upload to a major campaign, find music that fits the feeling, the format and the rights you need.</p>
              <Link className="v5-inline-link" href="/app">See how it works <span>→</span></Link>
            </div>
          </div>

          <div className="v5-route-steps">
            <article className="v5-route-step v5-step-acid" data-reveal="right">
              <div className="v5-step-index"><span>01</span><small>CREATE DAILY</small></div>
              <div className="v5-step-copy"><h3>Sound better on<br />every upload.</h3><p>YouTube videos, Shorts, Reels, livestreams, podcasts and social content—without generic background music.</p></div>
              <div className="v5-step-visual v5-search-visual" aria-hidden="true"><span>⌕</span><p>late night focus</p><i>CREATOR READY</i></div>
            </article>

            <article className="v5-route-step v5-step-blue" data-reveal="right">
              <div className="v5-step-index"><span>02</span><small>CLIENT WORK</small></div>
              <div className="v5-step-copy"><h3>Give every brief<br />a real soundtrack.</h3><p>Clear music for freelance edits, branded content, product films and agency work from one place.</p></div>
              <div className="v5-step-visual v5-channel-visual" aria-hidden="true"><span>BR</span><b /><span>AD</span><b /><i>CLIENT READY</i></div>
            </article>

            <article className="v5-route-step v5-step-coral" data-reveal="right">
              <div className="v5-step-index"><span>03</span><small>GO BIGGER</small></div>
              <div className="v5-step-copy"><h3>Scale from content<br />to campaigns.</h3><p>License existing tracks or commission original music for films, games, campaigns and brand worlds.</p></div>
              <div className="v5-step-visual v5-proof-visual" aria-hidden="true"><span>EL</span><p>SYNC / CUSTOM</p><i>BRIEF READY</i></div>
            </article>
          </div>
        </section>

        <section className="v5-plans" id="creators" aria-labelledby="plans-title">
          <div className="v5-section-head" data-reveal="group">
            <p className="v5-kicker"><span>02 / Simple access</span> Choose the licence that fits</p>
            <h2 id="plans-title">Start at €7.99.<br />Scale when the work does.</h2>
            <p>License premium music for your own channels, client work or larger productions—without paying for more than you need.</p>
          </div>

          <div className="v5-plan-board" data-reveal="group">
            <Link className="v5-plan-row v5-plan-creator" href="/pricing">
              <span className="v5-plan-number">01</span>
              <div className="v5-plan-name"><small>VIDEOS · LIVE · PODCASTS · SOCIAL</small><strong>Creator</strong></div>
              <p>License music for one channel per supported platform, including eligible monetised content.</p>
              <div className="v5-plan-cost"><strong>€7.99</strong><span>/ month</span></div>
              <i aria-hidden="true">↗</i>
            </Link>
            <Link className="v5-plan-row v5-plan-pro" href="/pricing">
              <span className="v5-plan-number">02</span>
              <div className="v5-plan-name"><small>MORE CHANNELS · CLIENT WORK</small><strong>Pro</strong></div>
              <p>Cover up to three channels plus eligible freelance and client projects.</p>
              <div className="v5-plan-cost"><strong>€19.99</strong><span>/ month</span></div>
              <i aria-hidden="true">↗</i>
            </Link>
            <Link className="v5-plan-row v5-plan-sync" href="/sync">
              <span className="v5-plan-number">03</span>
              <div className="v5-plan-name"><small>CAMPAIGNS · FILMS · GAMES</small><strong>Sync</strong></div>
              <p>Clear a catalogue track or commission original music for a larger commercial brief.</p>
              <div className="v5-plan-cost"><strong>Project</strong><span>brief + quote</span></div>
              <i aria-hidden="true">↗</i>
            </Link>
            <Link className="v5-plan-row v5-plan-retail" href="/retail">
              <span className="v5-plan-number">04</span>
              <div className="v5-plan-name"><small>PHYSICAL SPACES · COMING SOON</small><strong>Music for Business</strong></div>
              <p>Curated music for cafés, stores, hotels and other customer-facing spaces.</p>
              <div className="v5-plan-cost"><strong>Soon</strong><span>join early access</span></div>
              <i aria-hidden="true">↗</i>
            </Link>
          </div>
        </section>

        <section className="v5-catalogue" aria-labelledby="catalogue-title">
          <div className="v5-catalogue-side" aria-hidden="true"><span>10,000+ TRACKS</span><i>HUMAN / MADE</i></div>
          <div className="v5-catalogue-main">
            <div className="v5-catalogue-head" data-reveal="group">
              <p className="v5-kicker"><span>03 / The catalogue</span> Premium sound, without the filler</p>
              <h2 id="catalogue-title">The right feeling.<br />Every time.</h2>
              <div><p>Lofi, ambient, jazz, piano, cinematic, electronic, chill, focus, sleep and more—curated to support the work without making it sound generic.</p><Link className="v5-button v5-button-acid" href="/catalog"><span>Explore 10,000+ tracks</span><i>↗</i></Link><figure className="v6-catalogue-photo"><img src="/images/stock/vinyl-turntable.jpg" alt="A vinyl record playing on a turntable" /><figcaption>Human-made. Curated with care.</figcaption></figure></div>
            </div>
            <div className="v5-catalogue-console" data-reveal="scale">
              <div className="v5-console-bar"><span>CATALOGUE / LIVE INDEX</span><span><i /> 10,000+ HUMAN-MADE TRACKS</span><span>FILTER · PLAY · CLEAR</span></div>
              <CatalogueExplorer compact />
            </div>
          </div>
        </section>

        <section className="v5-artists" id="artists" aria-labelledby="artists-title">
          <div className="v5-artist-header" data-reveal="group">
            <p className="v5-kicker"><span>04 / The artists</span> Real music starts with real people</p>
            <h2 id="artists-title">No prompts.<br />Just people.</h2>
            <p>Every track is created by a human artist—not generated by AI. Artists are credited and paid directly when their music is licensed, so every use supports the people behind the sound.</p>
          </div>

          <div className="v6-artist-statement" data-reveal="group">
            <figure><img src="/images/stock/studio-artist.jpg" alt="An artist working in a recording studio" /></figure>
            <div><span>MADE BY REAL ARTISTS</span><h3>When music is licensed, the artist is paid directly and fairly.</h3><p>That is the point of Easy License: more clarity for the person using music, and more respect for the person who made it.</p></div>
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
            <p className="v5-kicker"><span>05 / Sync</span> Go beyond the subscription</p>
            <h2 id="sync-title">Need a sound<br />no one else has?</h2>
            <p>License a standout catalogue track or build an original soundtrack with an artist around your brief.</p>
          </div>
          <div className="v5-sync-paths" data-reveal="group">
            <Link href="/sync" className="v5-sync-path v5-sync-existing">
              <span>PATH A / CATALOGUE</span><strong>License<br />an existing track.</strong><p>Campaigns, films, games, podcasts and branded work—cleared for the specific project.</p><i>Start a clearance ↗</i>
            </Link>
            <Link href="/sync" className="v5-sync-path v5-sync-custom">
              <span>PATH B / ORIGINAL</span><strong>Commission<br />custom music.</strong><p>Original music shaped around your edit, timing, territory and identity.</p><i>Start a commission ↗</i>
            </Link>
          </div>
        </section>

        <section className="v5-faq" id="faq" aria-labelledby="faq-title">
          <div className="v5-faq-title" data-reveal="left"><p className="v5-kicker"><span>06 / Fine print</span> The useful answers</p><h2 id="faq-title">Before you<br />press publish.</h2></div>
          <div className="v5-faq-list" data-reveal="group">
            <details open><summary><span>01</span>What does Creator cover?<i>+</i></summary><p>One connected channel or profile per supported platform for eligible monetised videos, livestreams and social content. Client work needs Pro or a Sync agreement.</p></details>
            <details><summary><span>02</span>Can a Content ID claim still appear?<i>+</i></summary><p>Yes. Automated claims can happen even with a valid licence. Your workspace keeps the track and licence information ready for support.</p></details>
            <details><summary><span>03</span>Is any music AI-generated?<i>+</i></summary><p>No. The catalogue contains zero AI-generated music. Every track is made by a human artist, who is credited and paid directly when it is licensed.</p></details>
            <details><summary><span>04</span>Is every track eligible everywhere?<i>+</i></summary><p>Eligibility can vary by track, plan, platform, territory and use. Each production track page shows the coverage before download.</p></details>
            <details><summary><span>05</span>What happens after cancellation?<i>+</i></summary><p>Cancellation stops coverage for new uploads and newly connected channels. Final terms will define continued coverage for properly licensed past publications.</p></details>
          </div>
        </section>

        <section className="v5-command" data-reveal="scale" data-pointer-glow="">
          <div className="v5-command-status"><i /> 10,000+ TRACKS / READY</div>
          <h2>Make more.<br />Never sound generic.</h2>
          <p>Find premium music made by real artists, clear the right licence and publish with confidence.</p>
          <div>
            <Link className="v5-button v5-button-acid" href="/pricing"><span>Start licensing music</span><i>↗</i></Link>
            <Link className="v5-inline-link" href="/app">Already have an account? Log in <span>→</span></Link>
          </div>
          <span className="v5-command-code" aria-hidden="true">LG<br />EL</span>
        </section>
      </div>
    </PublicShell>
  );
}

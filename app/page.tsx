import Link from "next/link";
import { CatalogueExplorer } from "./components/CatalogueExplorer";
import { PublicShell } from "./components/PublicShell";

const artists = [
  {
    name: "Dario Lessing",
    role: "Pianist · Producer",
    image: "/artists/dario-lessing.jpg",
    href: "https://open.spotify.com/artist/0EocooOvTYLsjqSSQdqiyi",
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
            <p className="v5-kicker" data-reveal="left"><span>Powered by Lofi Girl</span> Human-made music licensing</p>
            <h1 data-reveal="hero-title">
              <span>Sound for</span>
              <span>every story.</span>
              <span className="v5-hero-human">Made by real artists.</span>
            </h1>
            <div className="v5-hero-intro" data-reveal="up" data-reveal-delay="2">
              <p>One human-made catalogue. Two simple ways to license it: for creators publishing online, and for businesses using music commercially or in physical spaces.</p>
              <div>
                <Link className="v5-button v5-button-dark" href="#creators"><span>For Creators</span><i>↓</i></Link>
                <Link className="v5-inline-link" href="#business">For Business <span>↓</span></Link>
              </div>
            </div>
          </div>

          <div className="v5-hero-code" aria-hidden="true">
            <span>EASY LICENSE</span>
            <span>BY LOFI GIRL</span>
          </div>
        </section>

        <section className="v5-proof-band" aria-label="Easy License catalogue essentials" data-reveal="group">
          <article className="v5-proof-stat v5-proof-stat-size">
            <strong>10,000+</strong>
            <span>Human-made tracks</span>
          </article>
          <article className="v5-proof-stat v5-proof-stat-zero">
            <strong>0</strong>
            <span>AI-generated tracks</span>
          </article>
          <article className="v5-proof-stat v5-proof-stat-quality">
            <strong>1,000+</strong>
            <span>Artists around the world</span>
          </article>
        </section>

        <section className="v5-route" aria-labelledby="route-title">
          <div className="v5-route-intro">
            <div className="v5-route-sticky" data-reveal="left">
              <p className="v5-kicker"><span>01 / Choose your path</span> One catalogue, two clear offers</p>
              <h2 id="route-title">For creators.<br />For businesses.</h2>
              <p>Start with how you plan to use the music. We&apos;ll take you straight to the right licence.</p>
            </div>
          </div>

          <div className="v5-route-steps v5-route-choices">
            <Link className="v5-route-step v5-step-acid" href="#creators" data-reveal="right">
              <div className="v5-step-index"><span>01</span><small>EASY LICENSE FOR CREATORS</small></div>
              <div className="v5-step-copy"><h3>Music for every<br />upload and live.</h3><p>For YouTubers, streamers, influencers, podcasters and everyone publishing on social platforms.</p><strong className="v5-step-cta">See Creator &amp; Pro plans →</strong></div>
            </Link>

            <Link className="v5-route-step v5-step-business" href="#business" data-reveal="right">
              <div className="v5-step-index"><span>02</span><small>EASY LICENSE FOR BUSINESS</small></div>
              <div className="v5-step-copy"><h3>Music for commercial<br />work and spaces.</h3><p>For campaigns, films, games, custom commissions and physical locations, with Music for Retail coming soon.</p><strong className="v5-step-cta">Explore business licensing →</strong></div>
            </Link>
          </div>
        </section>

        <section className="v5-plans" id="offers" aria-labelledby="plans-title">
          <div className="v5-section-head" data-reveal="group">
            <p className="v5-kicker"><span>02 / The offers</span> Two ways to use Easy License</p>
            <h2 id="plans-title">Two offers.<br />That&apos;s it.</h2>
            <p>One for people publishing content online. One for companies using music commercially or in physical spaces.</p>
          </div>

          <div className="v5-offer-stack">
            <article className="v5-offer-group v5-offer-creators" id="creators" aria-labelledby="creators-title" data-reveal="group">
              <div className="v5-offer-group-head">
                <div><span>01</span><small>EASY LICENSE FOR CREATORS</small></div>
                <div><h3 id="creators-title">For YouTubers, streamers and social creators.</h3><p>Publish on YouTube, Twitch, TikTok, Instagram, podcasts and other social platforms with one simple subscription.</p></div>
              </div>
              <div className="v5-plan-board" data-reveal="group">
                <Link className="v5-plan-row v5-plan-creator" href="/pricing" data-plan-glide="">
                  <span className="v5-plan-number">01</span>
                  <div className="v5-plan-name"><small>VIDEOS · LIVE · PODCASTS · SOCIAL</small><strong>Creator</strong></div>
                  <p>License music for one channel per supported platform, including eligible monetised content.</p>
                  <div className="v5-plan-cost"><strong>€6.67</strong><span>/ month · €79.99 billed yearly</span></div>
                  <i aria-hidden="true">↗</i>
                </Link>
                <Link className="v5-plan-row v5-plan-pro" href="/pricing" data-plan-glide="">
                  <span className="v5-plan-number">02</span>
                  <div className="v5-plan-name"><small>MORE CHANNELS · CREATOR TEAMS</small><strong>Pro</strong></div>
                  <p>Cover up to three channels for creators publishing across multiple profiles and platforms.</p>
                  <div className="v5-plan-cost"><strong>€16.67</strong><span>/ month · €199.99 billed yearly</span></div>
                  <i aria-hidden="true">↗</i>
                </Link>
              </div>
            </article>

            <article className="v5-offer-group v5-offer-business" id="business" aria-labelledby="business-offer-title" data-reveal="group">
              <div className="v5-offer-group-head">
                <div><span>02</span><small>EASY LICENSE FOR BUSINESS</small></div>
                <div><h3 id="business-offer-title">For commercial projects and physical spaces.</h3><p>License existing music, commission something original, or prepare the soundtrack for your venue.</p></div>
              </div>
              <div className="v5-plan-board" data-reveal="group">
                <Link className="v5-plan-row v5-plan-sync" href="/sync" data-plan-glide="">
                  <span className="v5-plan-number">01</span>
                  <div className="v5-plan-name"><small>EXISTING MUSIC · FILM · ADS · GAMES</small><strong>Commercial sync</strong></div>
                  <p>License an existing catalogue track for a commercial production, campaign, film or game.</p>
                  <div className="v5-plan-cost"><strong>Per project</strong><span>rights + clear quote</span></div>
                  <i aria-hidden="true">↗</i>
                </Link>
                <Link className="v5-plan-row v5-plan-custom" href="/sync" data-plan-glide="">
                  <span className="v5-plan-number">02</span>
                  <div className="v5-plan-name"><small>ORIGINAL MUSIC · MADE TO ORDER</small><strong>Custom commission</strong></div>
                  <p>Commission original music created around your story, edit, timing and brand world.</p>
                  <div className="v5-plan-cost"><strong>Custom quote</strong><span>built from your brief</span></div>
                  <i aria-hidden="true">↗</i>
                </Link>
                <Link className="v5-plan-row v5-plan-retail" href="/retail" data-plan-glide="">
                  <span className="v5-plan-number">03</span>
                  <div className="v5-plan-name"><small>CAFÉS · RETAIL · HOTELS · SPAS</small><strong>Music for Retail</strong></div>
                  <p>Human-made music for cafés, shops, restaurants, hotels, studios and spas.</p>
                  <div className="v5-plan-cost"><strong>Coming soon</strong><span>join early access</span></div>
                  <i aria-hidden="true">↗</i>
                </Link>
              </div>
            </article>
          </div>
        </section>

        <section className="v5-catalogue" aria-labelledby="catalogue-title">
          <div className="v5-catalogue-main">
            <div className="v5-catalogue-head" data-reveal="group">
              <p className="v5-kicker"><span>03 / The catalogue</span> Premium sound, without the filler</p>
              <h2 id="catalogue-title">The right feeling.<br />Every time.</h2>
              <div><p>Lofi, ambient, jazz, piano, cinematic, electronic, chill, focus, sleep and more—curated to support the work without making it sound generic.</p><Link className="v5-button v5-button-acid" href="/catalog"><span>Explore 10,000+ tracks</span><i>↗</i></Link></div>
            </div>
            <div className="v5-catalogue-console" data-reveal="scale">
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
            <figure><img src="/artists/charlee.jpg" alt="Charlee, an Easy License artist, playing guitar" /></figure>
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

        </section>

        <section className="v5-faq" id="faq" aria-labelledby="faq-title">
          <div className="v5-faq-title" data-reveal="left"><p className="v5-kicker"><span>05 / Fine print</span> The useful answers</p><h2 id="faq-title">Before you<br />press publish.</h2></div>
          <div className="v5-faq-list" data-reveal="group">
            <details open><summary><span>01</span>What does Creator cover?<i>+</i></summary><p>One connected channel or profile per supported platform for eligible monetised videos, livestreams and social content. Multi-channel publishing uses Pro; paid campaigns, advertising, films, games and broader commercial uses need Easy License for Business.</p></details>
            <details><summary><span>02</span>Can a Content ID claim still appear?<i>+</i></summary><p>Yes. Automated claims can happen even with a valid licence. Your workspace keeps the track and licence information ready for support.</p></details>
            <details><summary><span>03</span>Is any music AI-generated?<i>+</i></summary><p>No. The catalogue contains zero AI-generated music. Every track is made by a human artist, who is credited and paid directly when it is licensed.</p></details>
            <details><summary><span>04</span>Is every track eligible everywhere?<i>+</i></summary><p>Eligibility can vary by track, plan, platform, territory and use. Each production track page shows the coverage before download.</p></details>
            <details><summary><span>05</span>What happens after cancellation?<i>+</i></summary><p>Cancellation stops coverage for new uploads and newly connected channels. Final terms will define continued coverage for properly licensed past publications.</p></details>
          </div>
        </section>

      </div>
    </PublicShell>
  );
}

import Link from "next/link";
import { PublicShell } from "./components/PublicShell";

const catalogueCovers = [
  { src: "/images/catalogue/melting-snowman.jpg", alt: "Melting Snowman artwork" },
  { src: "/images/catalogue/532pm.jpg", alt: "5:32pm artwork" },
  { src: "/images/catalogue/blue-and-green.jpg", alt: "Blue and Green artwork" },
  { src: "/images/catalogue/drifting-away.jpg", alt: "Drifting away artwork" },
];

export default function Home() {
  return (
    <PublicShell>
      <div className="el-v5 el-v6 gateway-page">
        <section className="v5-hero gateway-hero">
          <div className="v5-hero-copy">
            <p className="v5-kicker" data-reveal="left"><span>Powered by Lofi Girl</span> Human-made music licensing</p>
            <h1 data-reveal="hero-title">
              <span>Human-made music.</span>
              <span className="v5-hero-human">Curated to belong.</span>
            </h1>
            <div className="v5-hero-intro" data-reveal="up" data-reveal-delay="2">
              <p>Access 10,000+ instrumental and background tracks, selected by music professionals for quality, consistency and real-world use. Zero AI-generated music.</p>
              <div>
                <Link className="v5-button v5-button-dark" href="/creators"><span>I&apos;m a creator</span><i>↗</i></Link>
                <Link className="v5-inline-link" href="/business">I&apos;m licensing for a business <span>→</span></Link>
              </div>
            </div>
          </div>
          <div className="v5-hero-code" aria-hidden="true"><span>EASY LICENSE</span><span>BY LOFI GIRL</span></div>
        </section>

        <section className="gateway-paths" aria-labelledby="gateway-paths-title">
          <div className="gateway-section-head" data-reveal="group">
            <p className="gateway-kicker"><span>01</span> Choose how you use music</p>
            <h2 id="gateway-paths-title">Two offers.<br />Two clear places to start.</h2>
            <p>We keep creator subscriptions and commercial licensing separate, so every page only shows what matters to you.</p>
          </div>
          <div className="gateway-path-grid" data-reveal="group">
            <Link className="gateway-path-card gateway-path-creators" href="/creators">
              <div className="gateway-path-top"><span>01</span><small>EASY LICENSE FOR CREATORS</small></div>
              <div className="gateway-path-copy">
                <h3>Make every upload<br />feel finished.</h3>
                <p>YouTube, livestreams, podcasts and social content. Creator and Pro plans from €6.67/month with annual billing.</p>
                <strong>Explore Creators <i>↗</i></strong>
              </div>
            </Link>
            <Link className="gateway-path-card gateway-path-business" href="/business">
              <div className="gateway-path-top"><span>02</span><small>EASY LICENSE FOR BUSINESS</small></div>
              <div className="gateway-path-copy">
                <h3>Music for the brief,<br />the brand and the room.</h3>
                <p>Commercial Sync, Custom Commission and Music for Retail, with Retail coming soon.</p>
                <strong>Explore Business <i>↗</i></strong>
              </div>
            </Link>
          </div>
        </section>

        <section className="gateway-curation" aria-labelledby="gateway-curation-title">
          <div className="gateway-cover-grid" data-reveal="group" aria-label="A selection of Easy License catalogue artwork">
            {catalogueCovers.map((cover) => <img src={cover.src} alt={cover.alt} key={cover.src} />)}
          </div>
          <div className="gateway-curation-copy" data-reveal="right">
            <p className="gateway-kicker"><span>02</span> Professionally curated</p>
            <h2 id="gateway-curation-title">Not an upload dump.<br />A catalogue with a point of view.</h2>
            <p>Every addition is reviewed and selected by music professionals for craft, production quality, coherence and usefulness. Less filler means faster, better choices.</p>
            <div className="gateway-curation-points">
              <div><strong>10,000+</strong><span>Human-made tracks</span></div>
              <div><strong>0</strong><span>AI-generated tracks</span></div>
              <div><strong>1,000+</strong><span>Artists worldwide</span></div>
            </div>
            <Link className="gateway-text-link" href="/catalog">Explore the curated catalogue <span>→</span></Link>
          </div>
        </section>

        <section className="gateway-artists" id="artists" aria-labelledby="gateway-artists-title">
          <figure data-reveal="scale"><img src="/artists/charlee.jpg" alt="Charlee, an Easy License artist, playing guitar" /></figure>
          <div data-reveal="right">
            <p className="gateway-kicker"><span>03</span> Made by real artists</p>
            <h2 id="gateway-artists-title">Selected by professionals.<br />Created by people.</h2>
            <p>Every track begins with a real artist, never a prompt. Artists are credited and paid directly and fairly when their music is licensed.</p>
            <div className="gateway-artist-actions">
              <Link className="v5-button v5-button-dark" href="/creators"><span>For Creators</span><i>↗</i></Link>
              <Link className="gateway-text-link" href="/business">For Business <span>→</span></Link>
            </div>
          </div>
        </section>
      </div>
    </PublicShell>
  );
}

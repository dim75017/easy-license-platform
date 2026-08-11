import Link from "next/link";
import { ArtistMarquee } from "./components/ArtistMarquee";
import { CatalogueFacts } from "./components/CatalogueFacts";
import { PublicShell } from "./components/PublicShell";

const useCollections = [
  {
    title: "Travel & Outdoors",
    copy: "Open, atmospheric music for journeys, landscapes and destination films.",
    slug: "travel",
    image: "/images/unsplash/collection-travel-bridge.webp",
  },
  {
    title: "Vlogs & Everyday Life",
    copy: "Warm, unobtrusive tracks for routines, stories and day-to-day content.",
    slug: "lifestyle-vlogs",
    image: "/images/unsplash/vlogger.jpg",
  },
  {
    title: "Study, Focus & Tutorials",
    copy: "Steady instrumental music that supports explanation without competing with it.",
    slug: "study-focus",
    image: "/images/unsplash/study.jpg",
  },
  {
    title: "Livestreams & Gaming",
    copy: "Long-form background music for live sessions, gameplay and community streams.",
    slug: "gaming-streaming",
    image: "/images/unsplash/streamer.jpg",
  },
  {
    title: "Podcasts & Interviews",
    copy: "Intros, transitions and subtle beds for conversation-led formats.",
    slug: "podcasts",
    image: "/images/unsplash/podcast-home.jpg",
  },
  {
    title: "Film, Documentary & Brand",
    copy: "Narrative music for films, visual essays, launches and branded productions.",
    slug: "cinematic",
    image: "/images/unsplash/collection-film-camera.webp",
  },
  {
    title: "Wellness & Slow Living",
    copy: "Calm, spacious music for meditation, movement, rest and quiet rituals.",
    slug: "wellness",
    image: "/images/unsplash/massage.jpg",
  },
  {
    title: "Food & Hospitality",
    copy: "Warm music for recipes, cafés, restaurants and welcoming spaces.",
    slug: "food-hospitality",
    image: "/images/unsplash/food-hospitality.jpg",
  },
];

const artists = [
  { name: "Charlee Nguyen", style: "Ambient · Cinematic", image: "/artists/charlee.webp" },
  { name: "Laffey", style: "Lofi hip-hop · Ambient", image: "/artists/laffey.webp" },
  { name: "amies", style: "Ambient · Piano", image: "/artists/amies.webp" },
  { name: "M e a d o w", style: "Ambient · Electronic", image: "/artists/meadow.webp" },
  { name: "Hoogway", style: "Lofi hip-hop · Guitar", image: "/artists/hoogway.webp" },
  { name: "Tibeauthetraveler", style: "Lofi hip-hop · Travel", image: "/artists/tibeauthetraveler.webp" },
  { name: "Swink", style: "Lofi hip-hop · Guitar", image: "/artists/swink.webp" },
  { name: "Mondo Loops", style: "Cinematic lofi · Guitar", image: "/artists/mondo-loops.webp" },
  { name: "Jam'addict", style: "Lofi hip-hop · Guitar", image: "/artists/jamaddict.webp" },
  { name: "John Lee", style: "Korean lofi · Cinematic", image: "/artists/john-lee.webp" },
  { name: "Kainbeats", style: "Sleepy lofi · Ambient", image: "/artists/kainbeats.webp" },
  { name: "xander.", style: "Cinematic lofi · Ambient", image: "/artists/xander.webp" },
  { name: "Phlocalyst", style: "Jazzhop · Lofi hip-hop", image: "/artists/phlocalyst.webp" },
  { name: "Yasper", style: "Jazzhop · Chillhop", image: "/artists/yasper.webp" },
  { name: "BluntOne", style: "Boom bap · Beatmaking", image: "/artists/bluntone.webp" },
  { name: "Allem Iversom", style: "Lofi hip-hop · Chillhop", image: "/artists/allem-iversom.webp" },
  { name: "Kupla", style: "Lofi · Ambient", image: "/artists/kupla.webp" },
  { name: "Nymano", style: "Lofi hip-hop · Jazzhop", image: "/artists/nymano.webp" },
  { name: "Leavv", style: "Cinematic lofi · Chillhop", image: "/artists/leavv.webp" },
  { name: "Sebastian Kamae", style: "Jazzhop · Vinyl", image: "/artists/sebastian-kamae.webp" },
];

export default function Home() {
  return (
    <PublicShell>
      <div className="home26">
        <section className="home26-hero">
          <img className="home26-hero-image" src="/images/unsplash/hero-producer.jpg" alt="Music producer working at a recording console" />
          <span className="home26-hero-wash" aria-hidden="true" />
          <div className="home26-hero-copy" data-reveal="left">
            <p className="home26-eyebrow">Symbiose · Powered by Lofi Girl</p>
            <h1 data-reveal="hero-title">Human-made music for videos, streams and commercial projects.</h1>
            <p className="home26-hero-lede">
              Browse more than 10,000 instrumental and background tracks created by real artists, with no generative AI. Find a sound that fits the story, the stream or the project you are building.
            </p>
            <div className="home26-actions">
              <Link className="home26-button home26-button-primary" href="/catalog">Browse music</Link>
              <Link className="home26-button home26-button-secondary" href="#services">Explore licensing</Link>
            </div>
            <p className="home26-hero-note">No AI-generated music · Artists credited and paid directly</p>
          </div>

          <p className="home26-hero-credit">A catalogue made by artists, for the people making the work.</p>
        </section>

        <CatalogueFacts />

        <section className="home26-section home26-audience home26-audience-creators" id="services" aria-labelledby="home26-creators-title">
          <div className="home26-audience-panel">
            <figure className="home26-audience-media" data-reveal="scale">
              <img src="/images/unsplash/creator-editing-keyboard.webp" alt="Creator editing a video from a laptop and dedicated control keyboard" width={1800} height={1200} loading="lazy" decoding="async" />
            </figure>
            <div className="home26-audience-copy" data-reveal="right">
              <p className="home26-eyebrow">For content creators</p>
              <h2 id="home26-creators-title">A simple music licence for the channels you own.</h2>
              <p>Use high-quality instrumental music in your YouTube videos, livestreams, social content and podcasts. Browse by mood or project, download the right track, and keep the channels covered by your plan together in one account.</p>
              <ul className="home26-audience-points" aria-label="Creator uses">
                <li>YouTube videos and Shorts</li>
                <li>Twitch and livestreams</li>
                <li>TikTok and Instagram</li>
                <li>Podcasts</li>
              </ul>
              <Link className="home26-button home26-button-primary home26-audience-button" href="/creators">Explore Symbiose for Creators <span aria-hidden="true">→</span></Link>
            </div>
          </div>
        </section>

        <section className="home26-section home26-audience home26-audience-business" aria-labelledby="home26-business-title">
          <div className="home26-audience-panel">
            <div className="home26-audience-copy" data-reveal="left">
              <p className="home26-eyebrow">For businesses</p>
              <h2 id="home26-business-title">Music and rights shaped around the project.</h2>
              <p>License an existing track for a campaign, film, game, advert or branded production, or commission original music from an artist. Media, territories, duration and exclusivity are confirmed from your brief, so the quote reflects the use you actually need.</p>
              <Link className="home26-button home26-button-light home26-audience-button" href="/business">Explore Symbiose for Businesses <span aria-hidden="true">→</span></Link>
              <ul className="home26-audience-points" aria-label="Business services">
                <li>Commercial Sync</li>
                <li>Custom Commission</li>
                <li>Music for Retail · Coming soon</li>
              </ul>
            </div>
            <figure className="home26-audience-media" aria-hidden="true">
              <img src="/images/unsplash/filmmaker-desk.jpg" alt="" width={1800} height={2699} loading="lazy" decoding="async" />
            </figure>
          </div>
        </section>

        <section className="home26-section home26-collections" aria-labelledby="home26-collections-title">
          <div className="home26-section-heading home26-section-heading-wide" data-reveal="group">
            <p className="home26-eyebrow">A diverse catalogue</p>
            <h2 id="home26-collections-title">Find the perfect music<br />for any situation.</h2>
            <p>Explore more than 10,000 instrumental tracks across lofi hip-hop, ambient, jazz, piano, electronic, cinematic and more. Start with a project collection below, browse by mood, or explore playlists prepared for common creative needs.</p>
          </div>
          <div className="home26-collection-grid" data-reveal="group">
            {useCollections.map((collection) => (
              <Link className="home26-collection-card" href={`/catalog?use=${collection.slug}`} key={collection.title}>
                <img src={collection.image} alt="" loading="lazy" decoding="async" fetchPriority="low" />
                <span className="home26-collection-overlay" />
                <span className="home26-collection-copy">
                  <strong>{collection.title}</strong>
                  <small>{collection.copy}</small>
                  <em>Browse collection →</em>
                </span>
              </Link>
            ))}
          </div>
          <div className="home26-catalogue-action" data-reveal="group">
            <Link className="home26-button home26-button-primary" href="/catalog">Explore the full music library <span aria-hidden="true">→</span></Link>
          </div>
        </section>

        <section className="home26-section home26-artists" id="artists" aria-labelledby="home26-artists-title">
          <div className="home26-section-heading home26-section-heading-wide" data-reveal="group">
            <p className="home26-eyebrow">The people behind the music</p>
            <h2 id="home26-artists-title">More than 1,000 artists contribute to the catalogue.</h2>
            <p>Every track is written and produced by artists. Generative AI music is not accepted, artists remain clearly credited, and licensing income is paid directly and fairly.</p>
          </div>
          <ArtistMarquee artists={artists} />
        </section>

        <section className="home26-plan-preview" aria-labelledby="home26-plan-preview-title">
          <div className="home26-plan-preview-inner">
            <div className="home26-plan-preview-copy" data-reveal="group">
              <p className="home26-eyebrow">Plans and licensing</p>
              <h2 id="home26-plan-preview-title">Fixed plans for creators. Custom quotes for businesses.</h2>
              <p>Choose a simple subscription for the channels you own, or tell us what your commercial project needs. If you are not sure yet, you can start with the music and decide later.</p>
            </div>

            <div className="home26-plan-board" data-reveal="group">
              <Link className="home26-plan-row home26-plan-card-creator" href="/pricing#creator-pricing-title">
                <span className="home26-plan-name"><strong>Creator</strong><span>For your own content</span></span>
                <span className="home26-plan-price"><strong>€6.67</strong><span>/ month · billed yearly</span></span>
                <ul className="home26-plan-features">
                  <li>One channel per supported platform</li>
                  <li>Videos, streams, podcasts and social content</li>
                  <li>Licence and Content ID support</li>
                </ul>
                <span className="home26-plan-detail">View Creator details <span aria-hidden="true">→</span></span>
              </Link>

              <Link className="home26-plan-row home26-plan-card-pro" href="/pricing#creator-pricing-title">
                <span className="home26-plan-name"><strong>Pro</strong><span>For multi-channel creators</span></span>
                <span className="home26-plan-price"><strong>€16.67</strong><span>/ month · billed yearly</span></span>
                <ul className="home26-plan-features">
                  <li>Up to three channels per platform</li>
                  <li>Multi-channel and team workspace</li>
                  <li>Priority support</li>
                </ul>
                <span className="home26-plan-detail">View Pro details <span aria-hidden="true">→</span></span>
              </Link>

              <Link className="home26-plan-row home26-plan-row-business" href="/pricing#business-pricing-title">
                <span className="home26-plan-name"><strong>Businesses</strong><span>For commercial projects</span></span>
                <span className="home26-plan-price"><strong>Custom quote</strong><span>based on your brief</span></span>
                <ul className="home26-plan-features">
                  <li>License an existing track</li>
                  <li>Commission original music</li>
                  <li>Physical places · Coming soon</li>
                </ul>
                <span className="home26-plan-detail">View Business details <span aria-hidden="true">→</span></span>
              </Link>
            </div>

            <div className="home26-plan-action" data-reveal="up">
              <Link className="home26-button home26-button-primary" href="/pricing">Compare all pricing and licensing options</Link>
            </div>
          </div>
        </section>

        <section className="home26-closing" aria-labelledby="home26-closing-title">
          <div className="home26-closing-inner">
            <div className="home26-closing-copy" data-reveal="left">
              <p className="home26-eyebrow">Start with the music</p>
              <h2 id="home26-closing-title">Find the music your project needs.</h2>
              <p>Browse the catalogue first. Then choose a creator plan or send us a business brief. The licensing route stays simple from the first listen to publication.</p>
            </div>
            <div className="home26-actions" data-reveal="right">
              <Link className="home26-button home26-button-light" href="/catalog">Browse music</Link>
              <Link className="home26-button home26-button-outline-light" href="/pricing">View pricing</Link>
            </div>
          </div>
        </section>

      </div>
    </PublicShell>
  );
}

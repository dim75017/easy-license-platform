import Link from "next/link";
import { ArtistMarquee } from "./components/ArtistMarquee";
import { PublicShell } from "./components/PublicShell";
import { lofiGirlPlaylists } from "./data/catalog";

const featuredGenreCount = new Set(lofiGirlPlaylists.map((playlist) => playlist.genre)).size;

const useCollections = [
  {
    title: "Travel & Outdoors",
    copy: "Open, atmospheric music for journeys, landscapes and destination films.",
    slug: "travel",
    image: "/images/unsplash/hero-listening.jpg",
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
    image: "/images/unsplash/campaign-filmset.jpg",
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

        <section className="home26-facts" aria-label="Symbiose catalogue facts" data-reveal="group">
          <div><strong>10,000+</strong><span>instrumental and background tracks</span></div>
          <div><strong>1,000+</strong><span>artists represented worldwide</span></div>
          <div><strong>{featuredGenreCount}</strong><span>music genres across our featured playlists</span></div>
          <div><strong>0</strong><span>AI-generated tracks accepted</span></div>
        </section>

        <section className="home26-section home26-audience home26-audience-creators" id="services" aria-labelledby="home26-creators-title">
          <div className="home26-audience-panel">
            <figure className="home26-audience-media" data-reveal="scale">
              <img src="/images/unsplash/editing-desk.jpg" alt="Video editing timeline and headphones at a creator workspace" width={1800} height={1200} loading="lazy" decoding="async" />
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
              <ul className="home26-audience-points" aria-label="Business services">
                <li>Commercial Sync</li>
                <li>Custom Commission</li>
                <li>Music for Retail · Coming soon</li>
              </ul>
              <Link className="home26-button home26-button-light home26-audience-button" href="/business">Explore Symbiose for Businesses <span aria-hidden="true">→</span></Link>
            </div>
            <figure className="home26-audience-media" data-reveal="scale">
              <img src="/images/unsplash/filmmaker-desk.jpg" alt="Camera equipment and production monitors in a filmmaker workspace" width={1800} height={2699} loading="lazy" decoding="async" />
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
                <img src={collection.image} alt="" />
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

      </div>
    </PublicShell>
  );
}

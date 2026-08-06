import Link from "next/link";
import { PublicShell } from "./components/PublicShell";

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
  { name: "Charlee Nguyen", style: "Ambient · Cinematic", image: "/artists/charlee.jpg" },
  { name: "Project AER", style: "Lofi hip-hop · Jazzhop", image: "/artists/project-aer.jpg" },
  { name: "amies", style: "Ambient · Piano", image: "/artists/amies.jpg" },
  { name: "M e a d o w", style: "Ambient · Electronic", image: "/artists/meadow.jpg" },
];

export default function Home() {
  return (
    <PublicShell>
      <div className="home26">
        <section className="home26-hero">
          <img className="home26-hero-image" src="/images/unsplash/hero-producer.jpg" alt="Music producer working at a recording console" />
          <span className="home26-hero-wash" aria-hidden="true" />
          <div className="home26-hero-copy" data-reveal="left">
            <p className="home26-eyebrow">Powered by Lofi Girl · Human-made music licensing</p>
            <h1 data-reveal="hero-title">Human-made music for videos, streams and commercial projects.</h1>
            <p className="home26-hero-lede">
              Browse more than 10,000 instrumental and background tracks created by real artists, with no generative AI. Find a sound that fits the story, the stream or the project you are building.
            </p>
            <div className="home26-actions">
              <Link className="home26-button home26-button-primary" href="/catalog">Browse music</Link>
              <Link className="home26-button home26-button-secondary" href="/pricing">View pricing</Link>
            </div>
            <p className="home26-hero-note">No AI-generated music · Artists credited and paid directly</p>
          </div>

          <p className="home26-hero-credit">A catalogue made by artists, for the people making the work.</p>
        </section>

        <section className="home26-facts" aria-label="Easy License catalogue facts" data-reveal="group">
          <div><strong>10,000+</strong><span>instrumental and background tracks</span></div>
          <div><strong>1,000+</strong><span>artists represented worldwide</span></div>
          <div><strong>0</strong><span>AI-generated tracks accepted</span></div>
        </section>

        <section className="home26-section home26-collections" aria-labelledby="home26-collections-title">
          <div className="home26-section-heading home26-section-heading-wide" data-reveal="group">
            <p className="home26-eyebrow">Browse by project</p>
            <h2 id="home26-collections-title">Find music for the project you are working on.</h2>
            <p>Genres and moods are useful, but sometimes the quickest place to start is the job the music needs to do. These collections are organised around common formats and real creative briefs.</p>
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
        </section>

        <section className="home26-section home26-curation" aria-labelledby="home26-curation-title">
          <figure data-reveal="scale">
            <img src="/images/unsplash/hero-turntable.jpg" alt="Turntable and amplifier in a warm listening room" />
          </figure>
          <div className="home26-curation-copy" data-reveal="right">
            <p className="home26-eyebrow">Quality without the noise</p>
            <h2 id="home26-curation-title">A precise, high-quality catalogue.</h2>
            <p>Instrumental and background music made for projects where the details matter. Clear moods, genres and project filters make it simple to find a track that supports the story without taking it over.</p>
          </div>
        </section>

        <section className="home26-section home26-artists" id="artists" aria-labelledby="home26-artists-title">
          <div className="home26-section-heading home26-section-heading-wide" data-reveal="group">
            <p className="home26-eyebrow">The people behind the music</p>
            <h2 id="home26-artists-title">More than 1,000 artists contribute to the catalogue.</h2>
            <p>Every track is written and produced by artists. Generative AI music is not accepted, artists remain clearly credited, and licensing income is paid directly and fairly.</p>
          </div>
          <div className="home26-artist-grid" data-reveal="group" aria-label="A selection of Easy License artists and studio sessions">
            {artists.map((artist) => (
              <article key={artist.name}>
                <img src={artist.image} alt={`Portrait of ${artist.name}`} />
                <div><strong>{artist.name}</strong><span>{artist.style}</span></div>
              </article>
            ))}
          </div>
        </section>

        <section className="home26-section home26-faq" aria-labelledby="home26-faq-title">
          <div className="home26-section-heading" data-reveal="left">
            <p className="home26-eyebrow">Questions about the licence</p>
            <h2 id="home26-faq-title">What to know before using a track.</h2>
            <p>Final eligibility is shown with the selected track and plan. For commercial work, our team confirms the scope in writing.</p>
          </div>
          <div className="home26-faq-list" data-reveal="group">
            <details open><summary>Can I listen before creating an account?<span>+</span></summary><p>Yes. You can browse the catalogue and listen to the available previews before choosing a creator plan or requesting a business licence.</p></details>
            <details><summary>Which platforms can I connect?<span>+</span></summary><p>Creator plans are intended for eligible YouTube, Twitch, podcast and social profiles. The exact number of connected profiles depends on the plan.</p></details>
            <details><summary>Does a Creator plan cover paid advertising?<span>+</span></summary><p>No. Paid media, brand campaigns, client productions, films and games require Easy License for Businesses.</p></details>
            <details><summary>Is any catalogue music generated with AI?<span>+</span></summary><p>No. Easy License does not accept generative AI music into the eligible catalogue. Every track is created by artists.</p></details>
            <details><summary>How are artists paid?<span>+</span></summary><p>Artists are credited and receive direct, fair payment when their music is licensed through Easy License.</p></details>
            <details><summary>What happens to content after I cancel?<span>+</span></summary><p>The final licence terms will explain how content published during an active subscription remains covered and which new uses require an active plan.</p></details>
            <details><summary>Can a business commission an exclusive track?<span>+</span></summary><p>Yes. Custom Commission covers original music created for a brief. Exclusivity, media, territory, term and delivery are agreed for the project.</p></details>
          </div>
        </section>

        <section className="home26-final" data-reveal="group">
          <div><p className="home26-eyebrow">Start with the music</p><h2>Finding the right track should be simple.</h2><p>Browse a specific sound or start with a professionally curated playlist, then choose the licensing option that fits your project.</p></div>
          <div className="home26-actions"><Link className="home26-button home26-button-light" href="/catalog">Explore music</Link><Link className="home26-button home26-button-outline-light" href="/pricing">Compare plans</Link></div>
        </section>
      </div>
    </PublicShell>
  );
}

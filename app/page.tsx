import Link from "next/link";
import { CatalogueExplorer } from "./components/CatalogueExplorer";
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
    image: "/images/stock/cozy-workspace.jpg",
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
    image: "/images/stock/studio-artist.jpg",
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
    image: "/images/unsplash/retail/cafe.jpg",
  },
];

const artists = [
  { name: "Charlee Nguyen", style: "Ambient · Cinematic", image: "/artists/charlee.jpg" },
  { name: "Project AER", style: "Lofi hip-hop · Jazzhop", image: "/artists/project-aer.jpg" },
  { name: "amies", style: "Ambient · Piano", image: "/artists/amies.jpg" },
  { name: "Dario Lessing", style: "Modern classical · Piano", image: "/artists/dario-lessing.jpg" },
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
              Browse more than 10,000 instrumental and background tracks selected by our music team. Choose a creator plan for your own channels, or request a licence for a campaign, production or physical space.
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
          <div><strong>Music team</strong><span>professional review and detailed tagging</span></div>
        </section>

        <section className="home26-section home26-listen" aria-labelledby="home26-listen-title">
          <div className="home26-section-heading" data-reveal="group">
            <p className="home26-eyebrow">Music library</p>
            <h2 id="home26-listen-title">Listen to the catalogue before choosing a licence.</h2>
            <p>Start with a selection from our music editors. Search the full library by track, artist, mood or intended use when you need something more specific.</p>
            <Link className="home26-text-link" href="/catalog">Open the music library <span>→</span></Link>
          </div>
          <div className="home26-library" data-reveal="scale">
            <CatalogueExplorer compact />
          </div>
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

        <section className="home26-section home26-offers" aria-labelledby="home26-offers-title">
          <div className="home26-section-heading home26-section-heading-wide" data-reveal="group">
            <p className="home26-eyebrow">Licensing options</p>
            <h2 id="home26-offers-title">Different uses need different licences.</h2>
            <p>Creator subscriptions cover music used on your own eligible channels. Business licences are scoped to a commercial project, client brief or physical location.</p>
          </div>
          <div className="home26-offer-grid" data-reveal="group">
            <article className="home26-offer-card home26-offer-creators">
              <img src="/images/unsplash/hero-creator.jpg" alt="Creator setting up a camera for a filmed project" />
              <div>
                <p>Easy License for Creators</p>
                <h3>For your own YouTube, livestream, podcast and social channels.</h3>
                <ul>
                  <li>Creator and Pro plans</li>
                  <li>Clear records for every licensed download</li>
                  <li>Plans from €6.67/month with annual billing</li>
                </ul>
                <Link href="/creators">See the creator licence →</Link>
              </div>
            </article>
            <article className="home26-offer-card home26-offer-business">
              <img src="/images/unsplash/filmmaker-desk.jpg" alt="Commercial production planned at a filmmaker's desk" />
              <div>
                <p>Easy License for Businesses</p>
                <h3>For campaigns, productions, client work and physical spaces.</h3>
                <ul>
                  <li>Commercial Sync for existing music</li>
                  <li>Custom Commission for original music</li>
                  <li>Music for Retail coming soon</li>
                </ul>
                <Link href="/business">See the business options →</Link>
              </div>
            </article>
          </div>
        </section>

        <section className="home26-section home26-curation" aria-labelledby="home26-curation-title">
          <figure data-reveal="scale">
            <img src="/images/unsplash/studio-artist.jpg" alt="Music artist working in a recording studio" />
          </figure>
          <div className="home26-curation-copy" data-reveal="right">
            <p className="home26-eyebrow">A considered catalogue</p>
            <h2 id="home26-curation-title">Music that is easy to find and good to use.</h2>
            <p>Every release is selected and organised with the people making the work in mind. Clear moods, genres and project filters make it easier to find music that supports the story instead of distracting from it.</p>
          </div>
        </section>

        <section className="home26-section home26-artists" id="artists" aria-labelledby="home26-artists-title">
          <div className="home26-section-heading home26-section-heading-wide" data-reveal="group">
            <p className="home26-eyebrow">The people behind the music</p>
            <h2 id="home26-artists-title">More than 1,000 artists contribute to the catalogue.</h2>
            <p>Every track is written and produced by artists. Generative AI music is not accepted, artists remain clearly credited, and licensing income is paid directly and fairly.</p>
          </div>
          <div className="home26-artist-grid" data-reveal="group">
            {artists.map((artist) => (
              <article key={artist.name}>
                <img src={artist.image} alt={`Portrait of ${artist.name}`} />
                <div><strong>{artist.name}</strong><span>{artist.style}</span></div>
              </article>
            ))}
          </div>
        </section>

        <section className="home26-section home26-how" aria-labelledby="home26-how-title">
          <div className="home26-section-heading home26-section-heading-wide" data-reveal="group">
            <p className="home26-eyebrow">How licensing works</p>
            <h2 id="home26-how-title">A clear process for creators and businesses.</h2>
            <p>The route depends on where the music will be used. You do not need to interpret every right before you start.</p>
          </div>
          <div className="home26-how-grid" data-reveal="group">
            <article>
              <p>For Creators</p>
              <h3>Use music on your own eligible channels.</h3>
              <ol>
                <li><span>1</span><div><strong>Choose Creator or Pro</strong><small>Select the plan that matches the channels and people you manage.</small></div></li>
                <li><span>2</span><div><strong>Connect your channels</strong><small>Keep covered profiles and licence records together in your account.</small></div></li>
                <li><span>3</span><div><strong>Browse, download and publish</strong><small>Use eligible music while the account keeps the related licence information.</small></div></li>
              </ol>
              <Link href="/pricing">Compare creator plans →</Link>
            </article>
            <article>
              <p>For Businesses</p>
              <h3>License music for a defined commercial use.</h3>
              <ol>
                <li><span>1</span><div><strong>Send the brief</strong><small>Share the project, media, markets, timing and budget.</small></div></li>
                <li><span>2</span><div><strong>Receive a shortlist or proposal</strong><small>Choose catalogue music or discuss an original commission with the team.</small></div></li>
                <li><span>3</span><div><strong>Confirm scope and delivery</strong><small>Rights, term, territory, quote and final assets are documented before use.</small></div></li>
              </ol>
              <Link href="/sync#brief">Start a business brief →</Link>
            </article>
          </div>
        </section>

        <section className="home26-section home26-pricing" aria-labelledby="home26-pricing-title">
          <div className="home26-section-heading home26-section-heading-wide" data-reveal="group">
            <p className="home26-eyebrow">Pricing overview</p>
            <h2 id="home26-pricing-title">Creator plans start at €6.67 per month.</h2>
            <p>Prices below are the monthly equivalent when billed annually. Commercial licensing is quoted according to the rights required by the project.</p>
          </div>
          <div className="home26-price-grid" data-reveal="group">
            <article>
              <p>Creator</p><div><strong>€6.67</strong><span>/ month</span></div>
              <small>€79.99 billed annually</small>
              <ul><li>One channel per supported platform</li><li>Your own monetised content</li><li>Licence and Content ID support records</li></ul>
              <Link href="/pricing">See Creator details →</Link>
            </article>
            <article className="home26-price-featured">
              <p>Pro</p><div><strong>€16.67</strong><span>/ month</span></div>
              <small>€199.99 billed annually</small>
              <ul><li>Up to three channels per platform</li><li>Multi-channel and team workspace</li><li>Priority Content ID support</li></ul>
              <Link href="/pricing">See Pro details →</Link>
            </article>
            <article className="home26-price-business">
              <p>Business</p><div><strong>Project-based</strong></div>
              <small>Rights and quote defined from your brief</small>
              <ul><li>Commercial Sync</li><li>Custom Commission</li><li>Music for Retail coming soon</li></ul>
              <Link href="/business">See business options →</Link>
            </article>
          </div>
          <Link className="home26-button home26-button-primary home26-pricing-button" href="/pricing">Compare all pricing and coverage</Link>
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
          <div><p className="home26-eyebrow">Start with the music</p><h2>Browse the catalogue before you choose.</h2><p>Listen first, compare the licensing options and create an account when you are ready to publish.</p></div>
          <div className="home26-actions"><Link className="home26-button home26-button-light" href="/catalog">Explore music</Link><Link className="home26-button home26-button-outline-light" href="/pricing">Compare plans</Link></div>
        </section>
      </div>
    </PublicShell>
  );
}

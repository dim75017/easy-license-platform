import assert from "node:assert/strict";
import { access, readFile, readdir, stat } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("contains the complete Symbiome music licensing homepage", async () => {
  const [page, layout, css, homeCss, catalogueCss, offerCss, packageJson, artistMarquee, artistSources, catalogueFacts] = await Promise.all([
    source("app/page.tsx"),
    source("app/layout.tsx"),
    source("app/globals.css"),
    source("app/home-v26.css"),
    source("app/catalog-v26.css"),
    source("app/offer-pages.css"),
    source("package.json"),
    source("app/components/ArtistMarquee.tsx"),
    source("public/artists/SOURCES.md"),
    source("app/components/CatalogueFacts.tsx"),
  ]);

  assert.match(page, /Human-made music for videos, streams and commercial projects\./i);
  assert.match(page, /Powered by Lofi Girl/i);
  assert.match(page, /Browse more than 10,000 instrumental and background tracks created by real artists/i);
  assert.doesNotMatch(page, /Music team[\s\S]*professional review and detailed tagging/i);
  assert.doesNotMatch(page, /Listen to the catalogue before choosing a licence|Open the music library/i);
  for (const useCase of [
    "Travel & Outdoors",
    "Vlogs & Everyday Life",
    "Study, Focus & Tutorials",
    "Livestreams & Gaming",
    "Podcasts & Interviews",
    "Film, Documentary & Brand",
    "Wellness & Slow Living",
    "Food & Hospitality",
  ]) {
    assert.match(page, new RegExp(useCase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), useCase);
  }
  for (const useRoute of ["travel", "lifestyle-vlogs", "study-focus", "gaming-streaming", "podcasts", "cinematic", "wellness", "food-hospitality"]) {
    assert.match(page, new RegExp(`slug: "${useRoute}"`), useRoute);
  }
  assert.doesNotMatch(page, /home26-offers|home26-pricing|home26-how-grid/i);
  assert.match(page, /home26-audience-creators[\s\S]*A simple music licence for the channels you own[\s\S]*href="\/creators"/i);
  assert.match(page, /home26-audience-business[\s\S]*License an existing track or commission original music[\s\S]*href="\/business"/i);
  assert.doesNotMatch(page, /home26-hero-note|No AI-generated music · Artists credited and paid directly/i);
  const businessRouteStart = page.indexOf('className="home26-section home26-audience home26-audience-business"');
  const catalogueRouteStart = page.indexOf('className="home26-section home26-collections"');
  const businessRoute = page.slice(businessRouteStart, catalogueRouteStart);
  assert.ok(businessRouteStart !== -1 && catalogueRouteStart > businessRouteStart, "homepage should isolate the Business route before the catalogue");
  assert.match(businessRoute, /aria-labelledby="home26-business-title"/);
  assert.match(businessRoute, /<h2 id="home26-business-title">License an existing track or commission original music\.<\/h2>/);
  assert.match(businessRoute, /Commercial Sync[\s\S]*Custom Commission[\s\S]*Music for Retail[\s\S]*Coming soon/i);
  assert.match(businessRoute, /href="\/business"/);
  assert.match(businessRoute, /home26-audience-media" aria-hidden="true"[\s\S]{0,180}alt=""/);
  assert.doesNotMatch(businessRoute, /home26-audience-media" data-reveal="scale"/);
  assert.match(page, /Find the perfect music<br \/>for any situation/i);
  assert.match(page, /Explore the full music library[\s\S]*href="\/catalog"|href="\/catalog"[\s\S]*Explore the full music library/i);
  assert.match(page, /creator-video-editor-WsJBwU9psWI\.webp/i);
  assert.match(page, /business-headphones-books-T3mKJXfdims\.webp/i);
  assert.doesNotMatch(page, /business-headphones-B88PgQXS4qg\.jpg/i);
  assert.match(page, /More than 1,000 artists contribute to the catalogue/i);
  assert.match(page, /Laffey/i);
  assert.match(page, /Hoogway/i);
  assert.doesNotMatch(page, /The Deli/i);
  assert.doesNotMatch(page, /Project AER/i);
  assert.match(page, /M e a d o w/i);
  assert.match(page, /Tibeauthetraveler/i);
  assert.match(page, /Mondo Loops/i);
  assert.match(page, /Sebastian Kamae/i);
  const artistImages = [...page.matchAll(/image:\s*"(\/artists\/[^".]+\.webp)"/g)].map((match) => match[1]);
  assert.equal(artistImages.length, 20, "homepage should present twenty artist portraits");
  assert.equal(new Set(artistImages).size, 20, "artist portraits should be unique");
  let artistImageBytes = 0;
  for (const image of artistImages) {
    const file = new URL(`public${image}`, root);
    await access(file);
    const metadata = await stat(file);
    artistImageBytes += metadata.size;
    assert.ok(metadata.size <= 120_000, `${image} should stay below 120 KB`);
    assert.match(artistSources, new RegExp(image.split("/").at(-1).replace(".", "\\.")), `${image} source should be documented`);
  }
  assert.ok(artistImageBytes <= 1_600_000, "the twenty artist portraits should stay below 1.6 MB");
  assert.match(artistSources, /Rights\/status[\s\S]*Public profile metadata; prototype only/i);
  assert.match(page, /<ArtistMarquee artists=\{artists\} \/>/);
  assert.match(artistMarquee, /<ArtistSequence artists=\{artists\} \/>[\s\S]*<ArtistSequence artists=\{artists\} duplicate \/>/);
  assert.match(artistMarquee, /aria-hidden=\{duplicate \? "true" : undefined\}/);
  assert.match(artistMarquee, /width=\{640\}[\s\S]{0,180}height=\{640\}[\s\S]{0,180}loading="lazy"[\s\S]{0,180}decoding="async"[\s\S]{0,180}fetchPriority="low"/);
  assert.match(artistMarquee, /IntersectionObserver/);
  assert.match(artistMarquee, /aria-pressed=\{paused\}/);
  assert.doesNotMatch(artistMarquee, /aria-live/);
  assert.doesNotMatch(page, /In the studio|Human-made production/i);
  assert.doesNotMatch(page, /Dario Lessing/i);
  assert.match(page, /food-hospitality\.jpg/i);
  assert.doesNotMatch(page, /home26-curation|home26-final/i);
  assert.match(page, /home26-plan-preview[\s\S]*Creator[\s\S]*€6\.67[\s\S]*Pro[\s\S]*€16\.67/i);
  assert.match(page, /home26-plan-row-business[\s\S]*Businesses[\s\S]*Custom quote[\s\S]*href="\/pricing#business-pricing-title"|href="\/pricing#business-pricing-title"[\s\S]*Custom quote/i);
  assert.match(page, /home26-plan-preview[\s\S]*href="\/pricing"/i);
  assert.match(page, /home26-plan-preview[\s\S]*home26-plan-features[\s\S]*home26-plan-detail/i);
  assert.match(page, /home26-closing[\s\S]*href="\/catalog"[\s\S]*href="\/pricing"/i);
  const artistsIndex = page.indexOf('className="home26-section home26-artists"');
  const pricingIndex = page.indexOf('className="home26-plan-preview"');
  const faqIndex = page.indexOf('className="home26-section home26-faq home26-quick-faq"');
  const closingIndex = page.indexOf('className="home26-closing"');
  const pricingRoute = page.slice(pricingIndex, closingIndex);
  assert.ok(artistsIndex !== -1, "homepage should include the artist section");
  assert.ok(pricingIndex > artistsIndex, "pricing preview should follow the artist section");
  assert.ok(closingIndex > pricingIndex, "the concluding CTA should follow pricing");
  assert.ok(faqIndex > closingIndex, "the quick FAQ should close the homepage after the concluding CTA");
  assert.doesNotMatch(pricingRoute, /href="\/business/);
  const faqRoute = page.slice(faqIndex);
  const quickFaqBlock = page.match(/const quickFaqs = \[([\s\S]*?)\];/);
  assert.ok(quickFaqBlock, "homepage should define its quick FAQ content");
  assert.equal([...quickFaqBlock[1].matchAll(/question:/g)].length, 5, "homepage should keep the FAQ concise");
  assert.equal([...quickFaqBlock[1].matchAll(/answer:/g)].length, 5, "every quick question should have an answer");
  assert.match(faqRoute, /aria-labelledby="home26-faq-title"/);
  assert.match(faqRoute, /home26-faq-list[\s\S]*quickFaqs\.map/);
  assert.match(faqRoute, /href="\/help"[\s\S]*Explore the full Help Center/);
  assert.match(faqRoute, /<summary>\{item\.question\}<span aria-hidden="true">\+<\/span><\/summary>/);
  assert.match(faqRoute, /<p>\{item\.answer\}<\/p>/);
  assert.match(page, /<CatalogueFacts \/>/);
  assert.match(catalogueFacts, /10,000\+[\s\S]*instrumental and background tracks/i);
  assert.match(catalogueFacts, /0[\s\S]*AI-generated tracks accepted/i);
  assert.match(catalogueFacts, /1,000\+[\s\S]*artists represented worldwide/i);
  assert.match(catalogueFacts, /featuredGenreLabel[\s\S]*music genres across our featured playlists/i);
  assert.match(catalogueFacts, /new Set\(lofiGirlPlaylists\.map\(\(playlist\) => playlist\.genre\)\)\.size/i);
  assert.match(catalogueFacts, /featuredGenreCount >= 10 \? "10\+" : String\(featuredGenreCount\)/i);
  assert.doesNotMatch(page, /Genre families/i);
  assert.doesNotMatch(page, /Curated to belong|Two offers|Not an upload dump|Selected by professionals\.\s*Created by people/i);
  assert.match(layout, /Symbiome — High-quality instrumental music for creators and businesses/);
  assert.match(layout, /offer-pages\.css/);
  assert.match(layout, /catalog-v26\.css/);
  assert.match(layout, /home-v26\.css/);
  assert.match(layout, /themeColor:\s*"#f7ebdd"/i);
  assert.match(layout, /colorScheme:\s*"light"/i);
  assert.match(css, /--bg:\s*#07080d/i);
  assert.match(homeCss, /\.home26-hero/);
  assert.match(homeCss, /\.home26-facts\s*\{\s*width:\s*min\(1440px,\s*calc\(100% - 72px\)\)/);
  assert.match(homeCss, /\.home26-facts\s*\{[\s\S]{0,180}grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(homeCss, /\.home26-facts > div\s*\{[\s\S]{0,180}align-items:\s*center;[\s\S]{0,220}text-align:\s*center;/);
  assert.match(homeCss, /\.home26-collection-grid/);
  assert.match(homeCss, /\.home26-audience-panel/);
  assert.match(homeCss, /grid-template-areas:\s*"media copy"/);
  assert.match(homeCss, /V51: the two licensing routes are full-bleed[\s\S]{0,220}\.home26-audience\s*\{[\s\S]{0,140}width:\s*100%;[\s\S]{0,100}padding:\s*0;/);
  assert.match(homeCss, /V66: each main homepage story owns a complete desktop viewport[\s\S]{0,420}@media \(min-width: 981px\)[\s\S]{0,240}\.home26-audience-panel,[\s\S]{0,120}\.home26-audience-business \.home26-audience-panel\s*\{[^}]*height:\s*auto;[^}]*min-height:\s*max\(900px, calc\(100svh - 90px\)\)/s);
  assert.match(homeCss, /V66: each main homepage story owns a complete desktop viewport[\s\S]{0,700}\.home26-artists,[\s\S]{0,100}\.home26-plan-preview\s*\{[^}]*display:\s*grid;[^}]*min-height:\s*max\(900px, calc\(100svh - 90px\)\);[^}]*align-content:\s*center/s);
  assert.match(homeCss, /\.home26-audience-business \.home26-audience-copy\s*\{[^}]*min-height:\s*max\(900px, calc\(100svh - 90px\)\)/s);
  assert.match(homeCss, /V64: Business is a cinematic project canvas, not a mirrored Creator split\.[\s\S]{0,360}\.home26-audience-business \.home26-audience-panel\s*\{[\s\S]{0,180}display:\s*block;[\s\S]{0,180}isolation:\s*isolate/);
  assert.match(homeCss, /V64: Business is a cinematic project canvas[\s\S]{0,1800}\.home26-audience-business \.home26-audience-points\s*\{[\s\S]{0,260}grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(homeCss, /V68: audience labels act as clear, brand-orange section signposts[\s\S]{0,320}\.home26 \.home26-audience \.home26-eyebrow\s*\{[^}]*color:\s*#9f3f2b;[^}]*font-size:\s*clamp\(26px, 2vw, 32px\);[^}]*font-weight:\s*760/s);
  assert.match(homeCss, /\.home26 \.home26-audience-business \.home26-eyebrow\s*\{[^}]*color:\s*#f2b5a0/s);
  assert.match(homeCss, /V68: audience labels act as clear, brand-orange section signposts[\s\S]{0,800}@media \(max-width: 620px\)[\s\S]{0,300}font-size:\s*22px/s);
  assert.match(homeCss, /V65: audience routes have clear labels[\s\S]{0,650}\.home26-audience-business \.home26-audience-points li\s*\{[^}]*font-size:\s*clamp\(19px, 1\.45vw, 23px\)/s);
  assert.match(homeCss, /\.home26-hero \+ \.home26-facts,[\s\S]{0,120}border-top:\s*0/);
  assert.match(homeCss, /\.home26-audience-creators \.home26-audience-panel\s*\{[^}]*border-bottom:\s*0/s);
  assert.match(homeCss, /V54: keep the next photographic section below the opening viewport[\s\S]{0,260}min-height:\s*max\(720px, calc\(100svh - 245px\)\)/);
  assert.match(homeCss, /V55: artist portraits fill each card[\s\S]{0,900}\.home26-artist-meta\s*\{[\s\S]{0,260}position:\s*absolute;[\s\S]{0,260}color:\s*#fff;/);
  assert.match(homeCss, /V56: a continuous artist marquee[\s\S]{0,900}animation:\s*home26ArtistsLeft 200s linear infinite/);
  assert.match(homeCss, /@keyframes home26ArtistsLeft[\s\S]{0,180}translate3d\(-50%, 0, 0\)/);
  assert.match(homeCss, /\.home26-artist-track\[data-paused="true"\]\s*\{[\s\S]{0,100}animation-play-state:\s*paused/);
  assert.doesNotMatch(homeCss, /home26-artist-grid:(?:hover|focus-within) \.home26-artist-track/);
  assert.match(homeCss, /@media \(prefers-reduced-motion: reduce\)[\s\S]{0,900}\.home26-artist-sequence\.is-duplicate[\s\S]{0,120}display:\s*none/);
  assert.match(homeCss, /V60: the homepage presents all three routes[\s\S]{0,1000}\.home26-plan-board\s*\{[\s\S]{0,420}grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(homeCss, /V60: the homepage presents all three routes[\s\S]{0,1600}\.home26-plan-row\s*\{[\s\S]{0,320}display:\s*flex;[\s\S]{0,420}flex-direction:\s*column/);
  assert.match(homeCss, /\.home26-plan-row\s*\{[\s\S]{0,420}border-radius:\s*30px/);
  assert.match(homeCss, /V67: a short, warm FAQ[\s\S]{0,500}\.home26-quick-faq\s*\{[^}]*width:\s*100%;[^}]*background:\s*var\(--home26-oat\)/s);
  assert.match(homeCss, /\.home26-quick-faq \.home26-faq-list summary:focus-visible\s*\{[^}]*outline:\s*3px solid var\(--home26-night\)/s);
  assert.match(homeCss, /\.home26-closing\s*\{[\s\S]{0,180}width:\s*100%;[\s\S]{0,420}var\(--home26-night\)/);
  assert.match(homeCss, /V58: primary actions use the same navy[\s\S]{0,260}\.home26 \.home26-button-primary\s*\{[\s\S]{0,180}background:\s*var\(--home26-night\)/);
  assert.match(css, /V38: public button hover details stay navy[\s\S]{0,220}background:\s*#3a3742/);
  assert.match(catalogueCss, /\.catalogue-v26-listen:hover\s*\{[\s\S]{0,100}background:\s*var\(--music-night-soft\)/);
  assert.match(homeCss, /V51: the two licensing routes are full-bleed[\s\S]{0,650}\.home26-audience-panel,[\s\S]{0,100}\.home26-audience-business \.home26-audience-panel\s*\{[\s\S]{0,220}border-radius:\s*0;/);
  assert.match(homeCss, /scroll-snap-type: x mandatory/);
  assert.match(catalogueCss, /\.catalogue-v26/);
  assert.match(catalogueCss, /\.catalogue-v26-use-grid/);
  const cataloguePage = await source("app/catalog/page.tsx");
  assert.match(cataloguePage, /import \{ CatalogueFacts \} from "\.\.\/components\/CatalogueFacts"/);
  assert.equal((cataloguePage.match(/<CatalogueFacts \/>/g) ?? []).length, 1, "Music should render the shared catalogue facts once");
  assert.match(cataloguePage, /className="music-library-hero"[\s\S]*?<\/section>\s*<CatalogueFacts \/>\s*<section className="music-playlists"/);
  assert.match(cataloguePage, /lofiGirlPlaylists/);
  assert.match(cataloguePage, /Explore all playlists/);
  assert.match(cataloguePage, /Browse by mood/);
  assert.match(cataloguePage, /className="catalogue-moods"/);
  assert.match(cataloguePage, /className="catalogue-moods-grid"[\s\S]{0,1000}className="catalogue-mood-card"/);
  assert.match(cataloguePage, /featuredMoods = moods\.filter\([\s\S]{0,120}\.slice\(0, 10\)/);
  assert.match(cataloguePage, /featuredMoods\.map\(\(mood, index\)/);
  assert.match(cataloguePage, /className="music-v26-library music-library-editorial"/);
  assert.match(cataloguePage, /className="music-v26-section-head music-library-editorial-heading"[\s\S]{0,500}Search the library<br \/>by mood, style or use\./);
  assert.match(cataloguePage, /<CatalogueExplorer showUseCases=\{false\} editorial \/>/);
  assert.doesNotMatch(cataloguePage, /<CreatorTrackShowcase/);
  assert.match(catalogueCss, /V44: the full library uses the same warm editorial model as the Creator sampler\.[\s\S]{0,900}\.music-library-editorial-heading\s*\{[\s\S]{0,260}grid-template-columns:\s*minmax\(0, 1fr\) minmax\(360px, \.64fr\)/);
  assert.match(catalogueCss, /\.music-library-editorial\s*\{[^}]*background:\s*var\(--music-paper\);[^}]*color:\s*var\(--music-night\)/s);
  assert.match(catalogueCss, /\.music-library-editorial-heading h2\s*\{[^}]*font-size:\s*clamp\(45px, 5\.2vw, 82px\);[^}]*line-height:\s*\.91/s);
  assert.match(catalogueCss, /\.music-library-editorial \.catalogue-v26-track\s*\{[\s\S]{0,520}background:\s*var\(--music-cream\);[\s\S]{0,120}color:\s*var\(--music-night\)/);
  assert.match(catalogueCss, /\.music-library-editorial \.catalogue-v26-track:hover,[\s\S]{0,180}background:\s*#f1e5d8/);
  assert.match(catalogueCss, /\.music-library-editorial \.catalogue-v26-listen\s*\{[\s\S]{0,420}background:\s*var\(--music-night\);[\s\S]{0,100}color:\s*var\(--music-cream\)/);
  assert.match(catalogueCss, /\.music-library-editorial \.catalogue-v26-track-list\s*\{[\s\S]{0,180}grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(catalogueCss, /V48: library previews play in place[\s\S]{0,220}grid-template-columns:\s*92px minmax\(0, 1fr\) minmax\(150px, 180px\) 52px/);
  assert.match(catalogueCss, /V48: library previews play in place[\s\S]{0,1000}\.music-library-editorial \.catalogue-v26-track \.catalogue-v26-waveform i\s*\{[^}]*max-width:\s*none;[^}]*flex:\s*1 1 0;[^}]*opacity:\s*\.28/s);
  assert.match(catalogueCss, /\.music-library-editorial \.catalogue-v26-track \.catalogue-v26-waveform i\.is-played\s*\{[^}]*background:\s*var\(--music-night\);[^}]*opacity:\s*\.92/s);
  assert.match(catalogueCss, /V48: library previews play in place[\s\S]*?@media \(max-width: 900px\)[\s\S]{0,160}\.music-library-editorial \.catalogue-v26-track-list\s*\{\s*grid-template-columns:\s*1fr/);
  assert.match(catalogueCss, /@media \(max-width: 560px\)[\s\S]{0,480}\.music-library-editorial-heading h2\s*\{[\s\S]{0,120}font-size:\s*clamp\(40px, 12vw, 52px\)/);
  assert.match(catalogueCss, /V45: Music opens on the same banner dimensions as every public route\.[\s\S]{0,180}\.music-v26-page \.music-library-hero\s*\{[\s\S]{0,100}min-height:\s*720px;[\s\S]{0,80}align-items:\s*center/);
  assert.match(catalogueCss, /V45: Music opens on the same banner dimensions as every public route\.[\s\S]{0,480}@media \(min-width: 901px\) and \(min-height: 800px\)[\s\S]{0,160}min-height:\s*max\(720px, calc\(100svh - 245px\)\)/);
  assert.match(catalogueCss, /V45: Music opens on the same banner dimensions as every public route\.[\s\S]{0,700}@media \(max-width: 760px\)[\s\S]{0,140}min-height:\s*620px/);
  assert.match(catalogueCss, /V47: Music shares the same catalogue proof band as every public route\.[\s\S]{0,260}\.music-v26-page \.catalogue-facts\s*\{[^}]*--home26-paper:\s*var\(--music-cream\);[^}]*--home26-rule:\s*var\(--music-rule\);[^}]*background:\s*var\(--music-cream\)/s);
  assert.match(catalogueCss, /\.music-v26-page \.music-library-hero \+ \.catalogue-facts\s*\{[^}]*border-top:\s*0/s);
  assert.match(catalogueCss, /\.catalogue-moods\s*\{[\s\S]{0,260}background:\s*var\(--music-paper\)/);
  assert.match(catalogueCss, /\.catalogue-moods-grid\s*\{[\s\S]{0,180}grid-template-columns:\s*repeat\(5, minmax\(0, 1fr\)\)/);
  assert.match(catalogueCss, /@media \(max-width: 1100px\)[\s\S]{0,160}\.catalogue-moods-grid\s*\{[^}]*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(catalogueCss, /@media \(max-width: 560px\)[\s\S]{0,260}\.music-playlist-grid, \.catalogue-moods-grid\s*\{[^}]*grid-template-columns:\s*1fr/);
  assert.match(catalogueCss, /V46: twelve playlist directions fit within one desktop view\.[\s\S]{0,400}min-height:\s*calc\(100svh - 90px\)/);
  assert.match(catalogueCss, /V46: twelve playlist directions fit within one desktop view\.[\s\S]{0,1000}grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\);[\s\S]{0,100}grid-template-rows:\s*repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(catalogueCss, /@media \(min-width: 1800px\) and \(min-height: 760px\)[\s\S]{0,220}grid-template-columns:\s*repeat\(6, minmax\(0, 1fr\)\);[\s\S]{0,100}grid-template-rows:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(catalogueCss, /@media \(min-width: 901px\) and \(max-width: 1179px\)[\s\S]{0,160}grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/);
  assert.doesNotMatch(cataloguePage, /Lofi Girl worlds/);
  assert.doesNotMatch(cataloguePage, /NOW EXPLORING|Instrumental music<br \/>with a human touch/);
  assert.doesNotMatch(cataloguePage, /Symbiome<\/span> Music/);
  assert.match(catalogueCss, /\.music-library-hero h1 \{[\s\S]*letter-spacing: -\.035em/);
  assert.match(homeCss, /V43: let the homepage sections use the full editorial canvas/);
  assert.match(offerCss, /V43: public offer pages use the full width/);
  assert.match(offerCss, /\.gateway-page/);
  assert.match(offerCss, /\.creators-landing/);
  assert.match(offerCss, /\.business-landing/);
  assert.match(offerCss, /offer-hero-creators/);
  assert.match(offerCss, /offer-hero-business/);
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.match(css, /\.public-shell \.site-footer\s*\{\s*width:\s*min\(1440px,\s*calc\(100% - 72px\)\)/);
  assert.doesNotMatch(page, /codex-preview|SkeletonPreview|Your site is taking shape/i);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});

test("defines every public and connected product surface", async () => {
  const routes = [
    ["app/creators/page.tsx", /Music that fits/i],
    ["app/business/page.tsx", /Music with the rights/i],
    ["app/catalog/page.tsx", /A real music/i],
    ["app/pricing/page.tsx", /Simple pricing for/i],
    ["app/sync/page.tsx", /One brief/i],
    ["app/retail/page.tsx", /Good music\.<br \/>One less thing/i],
    ["app/app/page.tsx", /CreatorWorkspace/],
    ["app/admin/page.tsx", /AdminWorkspace/],
  ];

  for (const [path, expected] of routes) {
    assert.match(await source(path), expected, path);
  }

  const [creators, business, pricing, pricingCards, pricingCss, leadForm, businessLeadForm, footer, retail, sync] = await Promise.all([
    source("app/creators/page.tsx"),
    source("app/business/page.tsx"),
    source("app/pricing/page.tsx"),
    source("app/components/PricingCards.tsx"),
    source("app/pricing-v39.css"),
    source("app/components/LeadForm.tsx"),
    source("app/components/BusinessLeadForm.tsx"),
    source("app/components/SiteFooter.tsx"),
    source("app/retail/page.tsx"),
    source("app/sync/page.tsx"),
  ]);
  assert.match(creators, /Music that leaves room/i);
  assert.doesNotMatch(creators, /CatalogueExplorer/i);
  assert.match(creators, /<CreatorTrackShowcase \/>/i);
  assert.doesNotMatch(creators, /PricingCards|creator-pricing-cards/i);
  assert.match(creators, /creator-pricing-cta[\s\S]*href="\/pricing"[\s\S]*Discover pricing/i);
  assert.doesNotMatch(creators, /className="offer-faq"|Common licensing questions|offer-faq-help|Can I use the music in videos and livestreams/i);
  assert.match(creators, /className="offer-flow creator-flow"[\s\S]*?<\/section>\s*<section className="offer-final-cta creator-pricing-cta"/i);
  assert.match(creators, /<CatalogueFacts \/>/);
  assert.doesNotMatch(creators, /offer-hero-proof|Human-made tracks|AI-generated tracks|Artists worldwide/i);
  assert.doesNotMatch(creators, /Commercial Sync|Custom Commission|Music for Retail/i);
  assert.doesNotMatch(creators, /Artists and payments|More than 1,000 artists|offer-human/i);
  assert.match(business, /Commercial Sync/i);
  assert.match(business, /Custom Commission/i);
  assert.match(business, /Music for Retail · Coming soon/i);
  assert.match(business, /Music that can carry/i);
  assert.match(business, /Rights fit/i);
  assert.match(business, /Choose what you need/i);
  assert.match(business, /id="business-brief"/i);
  assert.match(business, /<LeadForm type="business" \/>/i);
  assert.match(business, /<CatalogueFacts \/>/);
  assert.doesNotMatch(business, /offer-hero-proof|Human-made tracks|AI-generated tracks|Quote for every brief/i);
  assert.match(business, /href="#business-brief"/i);
  assert.doesNotMatch(business, /Creator &amp; Pro|€6\.67|€16\.67/i);
  assert.doesNotMatch(business, /Artists and music team|More than 1,000 artists|offer-human/i);
  const businessStageIds = [
    "business-curation-title",
    "business-options-title",
    "business-flow-title",
    "business-retail-title",
    "business-brief-title",
    "business-faq-title",
  ];
  let previousBusinessStage = -1;
  for (const id of businessStageIds) {
    const index = business.indexOf(`id="${id}"`);
    assert.ok(index > previousBusinessStage, `${id} should follow the previous Business stage`);
    previousBusinessStage = index;
  }
  const businessFaqStart = business.indexOf('className="offer-faq business-faq"');
  const businessFaq = business.slice(businessFaqStart);
  assert.ok(businessFaqStart !== -1, "Business should end with a FAQ");
  assert.match(businessFaq, /Common licensing questions\./i);
  assert.equal([...businessFaq.matchAll(/<details/g)].length, 5);
  assert.equal([...businessFaq.matchAll(/<summary/g)].length, 5);
  assert.match(businessFaq, /href="\/help#business-licensing"/);
  assert.match(businessFaq, /<p>[^<]+<\/p><\/details>/);
  assert.match(businessFaq, /<\/section>\s*<\/div>\s*<\/PublicShell>/);
  assert.match(pricing, /FOR CREATORS/i);
  assert.match(pricing, /FOR BUSINESSES/i);
  assert.match(pricing, /<PricingCards expanded \/>/i);
  assert.match(pricing, /id="business-request"/i);
  assert.match(pricing, /<Suspense fallback=\{<LeadForm type="business" \/>\}>[\s\S]*<BusinessLeadForm \/>[\s\S]*<\/Suspense>/i);
  assert.equal([...pricing.matchAll(/<section/g)].length, 3, "Pricing should contain only its compact hero and two product routes");
  assert.doesNotMatch(pricing, /pricing-v39-platforms|pricing-v39-comparison|pricing-v39-faq|pricing-v39-cta|comparison-table|pricingFaq|const comparison|business-option-grid/i);
  assert.match(pricingCss, /\.pricing-v39 \.price-card\s*\{[\s\S]{0,220}border-radius:\s*30px/);
  assert.match(pricingCss, /\.pricing-v39-business\s*\{[\s\S]{0,260}grid-template-columns:/);
  assert.match(pricingCss, /\.pricing-v39-business-form\s*\{[\s\S]{0,120}scroll-margin-top:\s*110px/);
  assert.match(leadForm, /License an existing track/);
  assert.match(leadForm, /Commission original music/);
  assert.match(leadForm, /Music for a physical place — Coming soon/);
  assert.match(leadForm, /type:\s*"retail_waitlist" as const/);
  assert.match(leadForm, /type:\s*isBusiness \? "sync" as const : type/);
  assert.match(leadForm, /businessNeedLabels\[businessNeed\][^\n]*project/);
  assert.match(leadForm, /Physical places is coming soon/);
  assert.match(leadForm, /initialBusinessNeed\?: BusinessNeed/);
  assert.match(leadForm, /useState<BusinessNeed>\(initialBusinessNeed\)/);
  assert.equal([...leadForm.matchAll(/setBusinessNeed\(initialBusinessNeed\)/g)].length, 2, "the selected footer route should survive both form reset paths");
  assert.doesNotMatch(leadForm, /setBusinessNeed\("existing_track"\)/);
  assert.match(businessLeadForm, /useSearchParams\(\)/);
  assert.match(businessLeadForm, /businessNeeds\.has\(requestedNeed as BusinessNeed\)/);
  assert.match(businessLeadForm, /<LeadForm key=\{initialBusinessNeed\} type="business" initialBusinessNeed=\{initialBusinessNeed\} \/>/);
  assert.match(footer, /href="\/catalog#music-library"/);
  assert.match(footer, /href="\/pricing#creator-pricing-title"[\s\S]*Creator &amp; Pro plans/);
  assert.match(footer, /href="\/pricing\?business_need=existing_track#business-request"[\s\S]*Commercial Sync/);
  assert.match(footer, /href="\/pricing\?business_need=custom_music#business-request"[\s\S]*Custom Commission/);
  assert.match(footer, /href="\/pricing\?business_need=physical_places#business-request"[\s\S]*Music for Retail/);
  assert.doesNotMatch(footer, /href="\/(?:sync|retail)(?:[#"])/);
  assert.doesNotMatch(pricingCards, /SY–03 \/ BUSINESS/i);
  assert.match(retail, /Music for Retail — Coming soon/i);
  assert.doesNotMatch(retail, /Music for Business/i);
  assert.match(sync, /Symbiome/i);
});

test("ships a complete footer, detailed help and honest public information pages", async () => {
  const publicRoutes = ["help", "contact", "about", "press", "careers", "legal", "privacy", "cookies"];
  const [footer, creators, help, about, contact, press, careers, legal, privacy, cookies, layout, supportCss] = await Promise.all([
    source("app/components/SiteFooter.tsx"),
    source("app/creators/page.tsx"),
    source("app/help/page.tsx"),
    source("app/about/page.tsx"),
    source("app/contact/page.tsx"),
    source("app/press/page.tsx"),
    source("app/careers/page.tsx"),
    source("app/legal/page.tsx"),
    source("app/privacy/page.tsx"),
    source("app/cookies/page.tsx"),
    source("app/layout.tsx"),
    source("app/support-pages.css"),
  ]);

  for (const route of publicRoutes) {
    await access(new URL(`app/${route}/page.tsx`, root));
    assert.match(footer, new RegExp(`href="/${route}"`), `footer should link to /${route}`);
  }

  const footerGroups = [...footer.matchAll(/<p className="footer-label">([^<]+)<\/p>/g)].map((match) => match[1]);
  assert.deepEqual(footerGroups, ["Music", "For Creators", "For Businesses", "Help", "About", "Legal"]);
  assert.doesNotMatch(footer, /href="\/blog"|>\s*Blog\s*</i);
  assert.match(layout, /support-pages\.css/);
  assert.match(supportCss, /\.public-shell \.site-footer \.footer-main,\s*\.public-shell \.site-footer \.footer-bottom\s*\{[\s\S]{0,180}width:\s*100%;[\s\S]{0,120}max-width:\s*none;[\s\S]{0,120}margin-inline:\s*0;/);
  assert.match(supportCss, /\.site-footer \.footer-links\s*\{[\s\S]{0,180}grid-template-columns:\s*repeat\(6, auto\);[\s\S]{0,120}justify-content:\s*space-between/);
  assert.match(supportCss, /@media \(max-width: 1280px\)[\s\S]{0,320}\.site-footer \.footer-links\s*\{\s*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(supportCss, /@media \(max-width: 700px\)[\s\S]{0,900}\.site-footer \.footer-links\s*\{\s*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(supportCss, /@media \(max-width: 420px\)[\s\S]{0,160}\.site-footer \.footer-links\s*\{\s*grid-template-columns:\s*1fr/);

  assert.doesNotMatch(creators, /className="offer-faq"|Common licensing questions|offer-faq-help/i);
  assert.match(help, /id:\s*"creator-licensing"/);
  assert.equal([...help.matchAll(/question:\s*"/g)].length, 30, "Help Center should answer thirty concrete questions");
  for (const category of ["getting-started", "creator-licensing", "business-licensing", "catalogue-artists", "account-billing-support"]) {
    assert.match(help, new RegExp(`id: "${category}"`), `Help Center should include ${category}`);
  }
  for (const question of [
    "What can a Creator licence cover?",
    "What should I do if I receive a Content ID claim?",
    "What is Commercial Sync?",
    "When can I start using the music?",
    "Is AI-generated music accepted into the catalogue?",
    "Can I create a paid account or purchase a licence in this preview?",
  ]) {
    assert.match(help, new RegExp(question.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), question);
  }
  assert.match(help, /Authentication, checkout, production downloads and licence issuance are not active on this GitHub Pages preview/i);
  assert.match(help, /no information is sent or stored/i);

  for (const page of [about, contact, press, careers, legal, privacy, cookies]) {
    assert.match(page, /<EditorialInfoPage/);
    assert.doesNotMatch(page, /lorem ipsum|example@example\.com|hello@symbiome/i);
  }
  assert.match(about, /combines symbiosis and biome/i);
  assert.match(about, /artists, the label, creators and businesses/i);
  assert.match(about, /id:\s*"the-name"/);
  assert.equal([...about.matchAll(/className="support-concept-card"/g)].length, 2);
  assert.match(supportCss, /\.support-concept-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/s);
  assert.match(supportCss, /@media \(max-width: 700px\)[\s\S]*\.support-concept-grid\s*\{[^}]*grid-template-columns:\s*1fr/s);
  assert.match(about, /does not accept generative AI music/i);
  assert.match(contact, /dedicated Symbiome support address is not published yet/i);
  assert.match(press, /No downloadable press kit or dedicated Symbiome press email is currently published/i);
  assert.match(careers, /No confirmed Symbiome openings are listed today/i);
  assert.match(legal, /currently presented as a pre-launch service[\s\S]*legal identity of the operator[\s\S]*will be published here before Symbiome issues licences or accepts payments/i);
  assert.match(privacy, /static GitHub Pages version[\s\S]*not transmitted or stored by Symbiome/i);
  assert.match(privacy, /data controller, lawful bases, service providers, international transfers, retention periods/i);
  assert.match(cookies, /does not include a first-party advertising or analytics cookie system/i);
  assert.match(cookies, /one preference in the browser(?:&apos;|')s local storage[\s\S]*device-level interface preference rather than an advertising profile/i);
});

test("plays eight editor-selected track previews directly on the Creators page", async () => {
  const [creators, showcase, previewHook, catalogueData, offerCss, artworkSources] = await Promise.all([
    source("app/creators/page.tsx"),
    source("app/components/CreatorTrackShowcase.tsx"),
    source("app/hooks/useTrackPreview.ts"),
    source("app/data/catalog.ts"),
    source("app/offer-pages.css"),
    source("public/images/stock/ATTRIBUTION.md"),
  ]);

  assert.match(creators, /eight editor-selected tracks drawn from our main playlists/i);
  assert.match(showcase, /creatorPlaylistTracks\.slice\(0, 8\)\.map/);
  assert.match(showcase, /className=\{`\$\{isActive \? "creator-editorial-track is-selected" : "creator-editorial-track"\}\$\{hasError \? " has-preview-error" : ""\}`\}/);
  assert.match(showcase, /<article/);
  assert.match(showcase, /useTrackPreview\(\)/);
  assert.match(showcase, /\{track\.title\}/);
  assert.match(showcase, /\{track\.artist\}/);
  assert.match(showcase, /\{track\.genre\}/);
  assert.match(showcase, /\{track\.duration\}/);
  assert.match(showcase, /src=\{track\.cover\}[\s\S]{0,220}width=\{640\}[\s\S]{0,100}height=\{640\}[\s\S]{0,120}loading="lazy"[\s\S]{0,120}decoding="async"/);
  assert.match(showcase, /<audio[\s\S]{0,180}preload="none"[\s\S]{0,300}onEnded=\{preview\.onEnded\}[\s\S]{0,160}onError=\{preview\.onError\}/);
  assert.match(showcase, /data-playing=\{isPlaying \|\| undefined\}/);
  assert.match(showcase, /preview\.toggle\(\{ id: track\.spotifyId, previewUrl: track\.previewUrl \}\)/);
  assert.match(showcase, /Array\.from\(\{ length: 48 \}/);
  assert.match(showcase, /https:\/\/open\.spotify\.com\/track\/\$\{track\.spotifyId\}/);
  assert.doesNotMatch(showcase, /<iframe|SpotifyPlayer|open\.spotify\.com\/embed/);
  assert.match(previewHook, /audio\.src = previewUrl/);
  assert.match(previewHook, /activeTrackId === id/);
  assert.match(previewHook, /if \(audio\.paused\)[\s\S]{0,120}await audio\.play\(\)/);
  assert.match(previewHook, /else \{\s*audio\.pause\(\)/);
  assert.match(previewHook, /audio\.currentTime \/ audio\.duration/);
  assert.match(previewHook, /onEnded[\s\S]{0,180}setProgress\(0\)/);
  assert.match(previewHook, /requestIdRef\.current === requestId/);
  assert.match(previewHook, /activeTrackIdRef\.current/);

  const featureBlock = catalogueData.match(/export const creatorPlaylistTracks = \[([\s\S]*?)\]\s+satisfies readonly CreatorPlaylistTrack\[\];/);
  assert.ok(featureBlock, "creatorPlaylistTracks should be exported as a typed list");
  const featureSource = featureBlock[1];
  const playlistIds = [...featureSource.matchAll(/playlistId:\s*"([^"]+)"/g)].map((match) => match[1]);
  assert.equal(playlistIds.length, 8);
  assert.equal(new Set(playlistIds).size, 8);
  assert.deepEqual(
    new Set(playlistIds),
    new Set(["lofi-study", "synthwave-night", "peaceful-piano", "dark-ambient", "jazz-lofi", "chill-house", "sleep-ambient", "chill-guitar"]),
  );

  const durations = [...featureSource.matchAll(/duration:\s*"([^"]+)"/g)].map((match) => match[1]);
  assert.equal(durations.length, 8);
  assert.ok(durations.every((value) => /^\d{1,2}:\d{2}$/.test(value)), "every editorial track needs an m:ss duration");

  const previewUrls = [...featureSource.matchAll(/previewUrl:\s*"([^"]+)"/g)].map((match) => match[1]);
  assert.equal(previewUrls.length, 8);
  assert.equal(new Set(previewUrls).size, 8);
  assert.ok(previewUrls.every((value) => /^https:\/\/p\.scdn\.co\/mp3-preview\/[a-f0-9]+$/.test(value)), "every Creator track needs a remote Spotify preview");

  const covers = [...featureSource.matchAll(/cover:\s*"([^"]+)"/g)].map((match) => match[1]);
  assert.equal(covers.length, 8);
  assert.equal(new Set(covers).size, 8);
  let coverBytes = 0;
  for (const cover of covers) {
    const file = new URL(`public${cover}`, root);
    await access(file);
    const metadata = await stat(file);
    coverBytes += metadata.size;
    assert.ok(metadata.size <= 120_000, `${cover} should stay below 120 KB`);
    assert.match(artworkSources, new RegExp(cover.split("/").at(-1).replace(".", "\\.")), `${cover} source should be documented`);
  }
  assert.ok(coverBytes <= 500_000, "the eight editorial covers should stay below 500 KB");

  assert.match(offerCss, /\.creator-editorial-grid\s*\{[\s\S]{0,180}grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(offerCss, /V69: Creator previews play in place[\s\S]{0,220}grid-template-columns:\s*92px minmax\(0, 1fr\) minmax\(150px, 180px\) 52px/);
  assert.match(offerCss, /V69: Creator previews play in place[\s\S]{0,1200}\.creators-landing \.creator-editorial-wave i\s*\{[^}]*flex:\s*1 1 0;[^}]*opacity:\s*\.28/s);
  assert.match(offerCss, /\.creators-landing \.creator-editorial-wave i\.is-played\s*\{[^}]*background:\s*var\(--marketing-night\);[^}]*opacity:\s*\.92/s);
  assert.match(offerCss, /\.creator-editorial-cover\s*\{[\s\S]{0,180}aspect-ratio:\s*1/);
  assert.match(offerCss, /\.creator-editorial-cover img\s*\{[\s\S]{0,180}object-fit:\s*cover/);
  assert.match(offerCss, /V69: Creator previews play in place[\s\S]*?@media \(max-width: 900px\)[\s\S]{0,100}\.creators-landing \.creator-editorial-grid\s*\{\s*grid-template-columns:\s*1fr/);
});

test("uses real platform logos instead of placeholder glyphs", async () => {
  const [creators, platformLogo, offerCss] = await Promise.all([
    source("app/creators/page.tsx"),
    source("app/components/PlatformLogo.tsx"),
    source("app/offer-pages.css"),
  ]);

  assert.match(creators, /<PlatformLogo platform=\{name\}/);
  assert.match(creators, /<PlatformLogo platform=\{name\} bare onDark \/>/);
  assert.match(creators, /className="creator-platforms-inner"/);
  assert.match(creators, /className="creator-platform-logo"[^>]*role="img"[^>]*aria-label=\{name\}/);
  assert.match(creators, /id="creator-platforms-title">Music for every channel you publish on\.<\/h2>/);
  assert.doesNotMatch(creators, /id="creator-platforms-title">[^<]*<br/);
  assert.doesNotMatch(creators, /<PlatformLogo platform=\{name\} \/>\{name\}/);
  assert.match(platformLogo, /creatorPlatforms: PlatformName\[\] = \["YouTube", "Twitch", "TikTok", "Instagram", "Kick", "Spotify"\]/);
  assert.doesNotMatch(platformLogo, /creatorPlatforms[^;]*Apple Podcasts/);
  assert.doesNotMatch(creators, /\["YouTube", "▶"\]|\["Twitch", "✦"\]|\["TikTok", "♪"\]/);
  assert.match(platformLogo, /<svg viewBox="0 0 24 24"/);
  assert.match(platformLogo, /aria-hidden="true"/);
  assert.match(platformLogo, /background: "#000000"/);
  assert.match(platformLogo, /platform === "TikTok"[\s\S]{0,700}fill=\{onDark \? "#FFFFFF" : \(bare \? icon\.color : "#FFFFFF"\)\}/);
  assert.match(platformLogo, /platform-logo-tiktok/);
  assert.match(platformLogo, /#25F4EE/);
  assert.match(platformLogo, /#FE2C55/);
  assert.match(platformLogo, /style=\{bare \? undefined : \{ backgroundColor: icon\.background \}\}/);
  assert.match(platformLogo, /platform-logo-youtube-play[^>]*fill="#FFFFFF"/);
  assert.match(platformLogo, /platform-logo-twitch-face[^>]*fill="#FFFFFF"/);
  assert.match(platformLogo, /platform-logo-twitch-eyes/);
  assert.match(platformLogo, /<img src="\/images\/platforms\/instagram-glyph-gradient\.svg" alt="" \/>/);
  for (const [name, color] of [
    ["YouTube", "#FF0000"],
    ["Twitch", "#9146FF"],
    ["TikTok", "#000000"],
    ["Instagram", "#FF0069"],
    ["Kick", "#53FC19"],
    ["Spotify", "#1ED760"],
  ]) {
    assert.match(platformLogo, new RegExp(name), name);
    assert.match(platformLogo, new RegExp(color), color);
  }
  assert.match(offerCss, /\.creator-platform-grid \.platform-brand-icon svg/);
  assert.match(offerCss, /\.creator-platform-grid \.platform-brand-icon img/);
  assert.match(offerCss, /V50: Creators shows the platform marks themselves[\s\S]{0,900}\.platform-brand-icon\.is-bare\s*\{[\s\S]{0,260}background:\s*transparent;[\s\S]{0,80}box-shadow:\s*none;/);
  assert.match(offerCss, /V63: platforms become a full-width brand rail[\s\S]{0,500}\.creators-landing \.creator-platforms\s*\{[\s\S]{0,180}width:\s*100%;[\s\S]{0,100}margin:\s*0;[\s\S]{0,140}border-radius:\s*0;/);
  assert.match(offerCss, /V63: platforms become a full-width brand rail[\s\S]{0,1100}\.creators-landing \.creator-platforms \.offer-section-head\s*\{[\s\S]{0,180}text-align:\s*center/);
  assert.match(offerCss, /V63: platforms become a full-width brand rail[\s\S]{0,2400}\.creators-landing \.creator-platform-grid\s*\{[\s\S]{0,700}background:\s*transparent;[\s\S]{0,120}box-shadow:\s*none;[\s\S]{0,150}grid-template-columns:\s*repeat\(6, minmax\(0, 1fr\)\)/);
  assert.match(offerCss, /\.creators-landing \.creator-editorial\s*\{[^}]*background:\s*var\(--marketing-paper\)/s);
  assert.match(offerCss, /\.creators-landing \.creator-editorial-track\s*\{[\s\S]{0,300}background:\s*var\(--marketing-cream\)/);
  assert.match(offerCss, /\.creators-landing \.creator-editorial-track:hover,[\s\S]{0,160}background:\s*#f1e5d8/);
  assert.match(offerCss, /V63: platforms become a full-width brand rail[\s\S]{0,3300}\.platform-brand-icon\.is-bare\s*\{[\s\S]{0,160}width:\s*clamp\(74px, 5vw, 88px\)/);
  assert.match(offerCss, /V63: platforms become a full-width brand rail[\s\S]{0,5200}@media \(max-width: 700px\)[\s\S]{0,180}grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(offerCss, /V63: platforms become a full-width brand rail[\s\S]{0,7000}@media \(max-width: 360px\)[\s\S]{0,180}grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(offerCss, /@media \(prefers-reduced-motion: reduce\)[\s\S]{0,300}\.creators-landing \.creator-platform-grid > \.creator-platform-logo:hover\s*\{[\s\S]{0,80}transform:\s*none/);
  assert.match(offerCss, /V51: the Creators banner is a full-width rectangle[\s\S]{0,180}\.creators-landing \.offer-hero\s*\{[\s\S]{0,80}border-radius:\s*0;/);
  await access(new URL("public/images/platforms/instagram-glyph-gradient.svg", root));
});

test("preloads lightweight imagery for the physical-spaces section", async () => {
  const [business, businessHead] = await Promise.all([
    source("app/business/page.tsx"),
    source("app/business/head.tsx"),
  ]);
  const retailImages = ["store.webp", "office.webp", "restaurant.webp", "hotel.webp", "gym.webp", "spa.webp"];
  let totalBytes = 0;

  assert.doesNotMatch(business, /className="business-retail-images"\s+data-reveal/, "Retail images should paint without a stagger delay");

  for (const image of retailImages) {
    assert.match(business, new RegExp(`retail/${image.replace(".", "\\.")}[\\s\\S]{0,180}loading="eager"[\\s\\S]{0,80}fetchPriority="high"`), image);
    assert.match(businessHead, new RegExp(`retail/${image.replace(".", "\\.")}`), `${image} preload`);
    totalBytes += (await stat(new URL(`public/images/unsplash/retail/${image}`, root))).size;
  }

  assert.ok(totalBytes < 350_000, `Retail imagery should stay below 350 KB, received ${totalBytes} bytes`);
});

function imagePaths(content) {
  return [...content.matchAll(/(?:src|image)\s*[:=]\s*"([^"]+)"/g)].map((match) => match[1]);
}

function backgroundImage(css, selector) {
  const start = css.indexOf(selector);
  assert.notEqual(start, -1, `Missing visual selector ${selector}`);
  const match = css.slice(start, start + 260).match(/url\("([^"]+)"\)/);
  assert.ok(match, `Missing image for ${selector}`);
  return match[1];
}

function assertUniquePageImages(page, images) {
  const duplicates = images.filter((image, index) => images.indexOf(image) !== index);
  assert.deepEqual(duplicates, [], `${page} repeats image assets: ${[...new Set(duplicates)].join(", ")}`);
}

test("keeps each public page free of repeated image assets", async () => {
  const [home, creators, business, retail, catalogueData, offerCss] = await Promise.all([
    source("app/page.tsx"),
    source("app/creators/page.tsx"),
    source("app/business/page.tsx"),
    source("app/retail/page.tsx"),
    source("app/data/catalog.ts"),
    source("app/offer-pages.css"),
  ]);

  assertUniquePageImages("Homepage", imagePaths(home));
  assertUniquePageImages("Creators", [
    ...imagePaths(creators),
    backgroundImage(offerCss, ".offer-hero-creators"),
    backgroundImage(offerCss, ".creators-landing .creator-flow::before"),
  ]);
  assertUniquePageImages("Business", [
    ...imagePaths(business),
    backgroundImage(offerCss, ".offer-hero-business"),
    backgroundImage(offerCss, ".business-option-sync"),
    backgroundImage(offerCss, ".business-option-custom"),
    backgroundImage(offerCss, ".business-option-retail"),
    backgroundImage(offerCss, ".business-landing .business-flow::before"),
  ]);
  assertUniquePageImages("Retail", imagePaths(retail));
  assertUniquePageImages("Catalogue", imagePaths(catalogueData));
});

test("ships the requested Travel and Film collection photographs", async () => {
  const [page, catalogueData, sources] = await Promise.all([
    source("app/page.tsx"),
    source("app/data/catalog.ts"),
    source("public/images/unsplash/SOURCES.md"),
  ]);
  const collectionImages = [
    ["Travel & Outdoors", "/images/unsplash/collection-travel-bridge.webp", "8sOuWN9ebKk"],
    ["Film, Documentary & Brand", "/images/unsplash/collection-film-camera.webp", "ditCL6ubLRc"],
  ];
  assert.match(page, /src=\{collection\.image\} alt="" loading="lazy" decoding="async" fetchPriority="low"/);
  let collectionImageBytes = 0;
  for (const [title, image, sourceId] of collectionImages) {
    assert.match(page, new RegExp(`${title}[\\s\\S]{0,260}${image.replaceAll("/", "\\/")}`));
    const metadata = await stat(new URL(`public${image}`, root));
    collectionImageBytes += metadata.size;
    assert.ok(metadata.size <= 160_000, `${image} should stay below 160 KB`);
    assert.match(sources, new RegExp(`${image.split("/").at(-1)}[\\s\\S]{0,240}${sourceId}`));
  }
  assert.equal(new Set(collectionImages.map(([, image]) => image)).size, 2);
  assert.ok(collectionImageBytes <= 220_000, "the two collection photographs should stay below 220 KB");
  assert.doesNotMatch(
    catalogueData,
    /collection-travel-bridge\.webp|collection-film-camera\.webp/,
    "the new homepage collection photographs should not be reused in the catalogue",
  );
});

test("ships the clean Premium Study photograph without the watermarked preview", async () => {
  const [page, catalogueData, sources] = await Promise.all([
    source("app/page.tsx"),
    source("app/data/catalog.ts"),
    source("public/images/unsplash/SOURCES.md"),
  ]);
  const cleanStudyImage = "/images/unsplash/study-focus-clean.jpg";
  const metadata = await stat(new URL(`public${cleanStudyImage}`, root));

  assert.match(page, /Study, Focus & Tutorials[\s\S]{0,260}study-focus-clean\.jpg/);
  assert.match(catalogueData, /slug: "study-focus"[\s\S]{0,260}study-focus-clean\.jpg/);
  assert.doesNotMatch(`${page}\n${catalogueData}`, /\/images\/unsplash\/study\.jpg/);
  assert.match(sources, /study-focus-clean\.jpg[\s\S]{0,220}JT5IUQHtL7E[\s\S]{0,220}original Premium download without watermark/i);
  assert.ok(metadata.size <= 140_000, "the clean Study photograph should stay below 140 KB");
});

test("ships the requested homepage Creator photograph and documents its source", async () => {
  const [page, sources] = await Promise.all([
    source("app/page.tsx"),
    source("public/images/unsplash/SOURCES.md"),
  ]);
  const creatorImage = new URL("public/images/unsplash/creator-video-editor-WsJBwU9psWI.webp", root);

  await access(creatorImage);
  const metadata = await stat(creatorImage);
  assert.ok(metadata.size <= 140_000, "the homepage Creator photograph should stay below 140 KB");
  assert.match(page, /creator-video-editor-WsJBwU9psWI\.webp/);
  assert.doesNotMatch(page, /creator-editing-keyboard\.webp/);
  assert.match(sources, /creator-video-editor-WsJBwU9psWI\.webp[\s\S]{0,180}TheRegisti[\s\S]{0,180}WsJBwU9psWI/);
});

test("ships the requested homepage Business photograph and documents its source", async () => {
  const [page, sources] = await Promise.all([
    source("app/page.tsx"),
    source("public/images/unsplash/SOURCES.md"),
  ]);
  const businessImage = new URL("public/images/unsplash/business-headphones-books-T3mKJXfdims.webp", root);

  await access(businessImage);
  const metadata = await stat(businessImage);
  assert.ok(metadata.size <= 300_000, "the homepage Business photograph should stay below 300 KB");
  assert.match(page, /business-headphones-books-T3mKJXfdims\.webp"[\s\S]{0,120}width=\{2400\} height=\{1600\}/);
  assert.doesNotMatch(page, /business-headphones-B88PgQXS4qg\.jpg/);
  assert.match(sources, /business-headphones-books-T3mKJXfdims\.webp[\s\S]{0,220}T3mKJXfdims[\s\S]{0,160}Unsplash License/i);
});

test("ships the Business process backdrop locally and documents its source", async () => {
  const backdrop = new URL("public/images/unsplash/business-process-blur.webp", root);
  const sources = await source("public/images/unsplash/SOURCES.md");

  await access(backdrop);
  const metadata = await stat(backdrop);
  assert.ok(metadata.size <= 80_000, "the blurred Business process backdrop should stay below 80 KB");
  assert.match(sources, /business-process-blur\.webp[\s\S]{0,160}Vitaly Gariev[\s\S]{0,160}KNGa5luu2HA/);
});

test("ships the Creator process backdrop locally and documents its source", async () => {
  const backdrop = new URL("public/images/unsplash/creator-process-blur.webp", root);
  const sources = await source("public/images/unsplash/SOURCES.md");

  await access(backdrop);
  const metadata = await stat(backdrop);
  assert.ok(metadata.size <= 80_000, "the blurred Creator process backdrop should stay below 80 KB");
  assert.match(sources, /creator-process-blur\.webp[\s\S]{0,180}Rodrigo Rodrigues[\s\S]{0,180}sPeIJ0ebl8c/);
});

test("ships progressive, accessible motion without an animation dependency", async () => {
  const [page, shell, motion, css, homeCss, home26Css, cozyCss, booth, packageJson] = await Promise.all([
    source("app/page.tsx"),
    source("app/components/PublicShell.tsx"),
    source("app/components/MotionLayer.tsx"),
    source("app/globals.css"),
    source("app/home-v5.css"),
    source("app/home-v26.css"),
    source("app/home-v6.css"),
    source("app/components/LicenseBooth.tsx"),
    source("package.json"),
  ]);

  assert.match(page, /data-reveal="hero-title"/);
  assert.doesNotMatch(page, /data-pointer-glow/);
  assert.match(booth, /useState/);
  assert.match(booth, /role="tablist"/);
  assert.match(shell, /<MotionLayer/);
  assert.match(motion, /IntersectionObserver/);
  assert.match(motion, /data-plan-glide/);
  assert.match(motion, /requestAnimationFrame/);
  assert.match(motion, /prefers-reduced-motion/);
  assert.match(css, /\.motion-enhanced \[data-reveal\]/);
  assert.match(homeCss, /@keyframes v5Scan/);
  assert.match(home26Css, /@media \(min-width: 901px\)[\s\S]*?\.home26-artists \.home26-section-heading\s*\{[\s\S]{0,100}margin-inline:\s*auto;[\s\S]{0,100}text-align:\s*center;/);
  assert.match(home26Css, /V56: a continuous artist marquee[\s\S]{0,650}width:\s*100vw;[\s\S]{0,180}overflow:\s*hidden/);
  assert.match(home26Css, /\.home26-artist-track\s*\{[\s\S]{0,180}width:\s*max-content;[\s\S]{0,180}animation:\s*home26ArtistsLeft 200s linear infinite/);
  assert.match(homeCss, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(cozyCss, /animation:\s*none\s*!important/);
  assert.doesNotMatch(packageJson, /framer-motion|gsap/);
});

test("ships the cozy Lofi Girl identity, focused navigation and real artist profiles", async () => {
  const [css, homeCss, cozyCss, catalogCss, offerCss, layout, brand, header, catalogue, catalogueData, page, creators, business, booth] = await Promise.all([
    source("app/globals.css"),
    source("app/home-v5.css"),
    source("app/home-v6.css"),
    source("app/catalog-v26.css"),
    source("app/offer-pages.css"),
    source("app/layout.tsx"),
    source("app/components/Brand.tsx"),
    source("app/components/SiteHeader.tsx"),
    source("app/components/CatalogueExplorer.tsx"),
    source("app/data/catalog.ts"),
    source("app/page.tsx"),
    source("app/creators/page.tsx"),
    source("app/business/page.tsx"),
    source("app/components/LicenseBooth.tsx"),
  ]);

  assert.match(css, /font-family:\s*"Unbounded"/);
  assert.match(css, /font-family:\s*"Afacad Flux"/);
  assert.match(css, /unbounded-var-latin\.woff2/);
  assert.match(css, /afacad-flux-var-latin\.woff2/);
  assert.match(homeCss, /Symbiome V5 — the licensing signal router/);
  assert.match(homeCss, /\.v5-booth/);
  assert.match(homeCss, /clip-path:/);
  assert.match(cozyCss, /Symbiome V6 — warm, quiet and recognisably Lofi Girl/);
  assert.match(cozyCss, /--font-display:\s*"Afacad Flux"/);
  assert.match(cozyCss, /\.el-v6 \.v5-booth::before[\s\S]*display:\s*none/);
  assert.match(css, /navigation uses one clear hover treatment[\s\S]{0,700}background:\s*transparent;[\s\S]{0,80}box-shadow:\s*none/);
  assert.match(homeCss, /\.site-header \.site-nav > a:hover::after,[\s\S]{0,120}transform:\s*scaleX\(1\)/);
  assert.doesNotMatch(css, /font-family:\s*"Newsreader"|font-family:\s*"IBM Plex Sans"/);
  assert.match(brand, /className="brand-name"><span>sym<span className="brand-accent">biome<\/span>/);
  assert.match(header, /Log in/);
  assert.match(header, /Create account/);
  assert.match(header, /href:\s*"\/",\s*label:\s*"Home"[\s\S]{0,120}href:\s*"\/catalog",\s*label:\s*"Music"/);
  assert.match(header, /if \(href === "\/"\) return pathname === "\/";/);
  assert.match(header, /For Creators/);
  assert.match(header, /For Businesses/);
  assert.match(header, /href:\s*"\/catalog",\s*label:\s*"Music"/);
  assert.match(header, /href:\s*"\/creators"/);
  assert.match(header, /href:\s*"\/business"/);
  assert.match(header, /href:\s*"\/pricing",\s*label:\s*"Pricing"/);
  assert.doesNotMatch(header, /\/#creators|\/#business/);
  assert.doesNotMatch(header, /Start a brief/);
  assert.match(header, /mobile-account-actions/);
  assert.match(header, /aria-controls="site-navigation"/);
  assert.doesNotMatch(header, /label: "Sync"|label: "Music for Business"/);
  assert.doesNotMatch(header, /Admin \/ demo|Licence workspace/);
  assert.match(catalogue, /useTrackPreview\(\)/);
  assert.match(catalogue, /<audio[\s\S]{0,180}preload="none"/);
  assert.match(catalogue, /data-playing=\{isPlaying \|\| undefined\}/);
  assert.match(catalogue, /preview\.toggle\(\{ id: track\.id, previewUrl: track\.previewUrl \}\)/);
  assert.match(catalogue, /Array\.from\(\{ length: 48 \}/);
  assert.match(catalogue, /className="catalogue-v26-preview-source"[\s\S]{0,160}href=\{track\.spotifyUrl\}/);
  assert.doesNotMatch(catalogue, /<iframe|SpotifyPlayer|open\.spotify\.com\/embed/);
  assert.match(catalogue, /Play a preview/i);
  assert.match(catalogue, /catalogue-v26-waveform/);
  assert.match(catalogue, /Search the catalogue/i);
  assert.doesNotMatch(catalogue, /EL-CAT-|download=|Download track|Fake player|Prototype data|Demo tracks/i);
  assert.match(catalogueData, /Melting Snowman/);
  assert.match(catalogueData, /5:32pm/);
  assert.match(catalogueData, /Blue and Green/);
  assert.match(catalogueData, /Drifting away/);
  assert.match(catalogueData, /spotifyId/);
  assert.equal([...catalogueData.matchAll(/previewUrl:\s*"https:\/\/p\.scdn\.co\/mp3-preview\/[a-f0-9]+"/g)].length, 12);
  assert.doesNotMatch(catalogueData, /EL-CAT-/);
  assert.match(creators, /creator-youtube-card\.webp/i);
  assert.match(creators, /creator-audio-editor\.webp/i);
  assert.match(creators, /className="offer-hero offer-hero-creators"[\s\S]*?<\/section>\s*<CatalogueFacts \/>\s*<section className="offer-curation"/);
  assert.match(business, /className="offer-hero offer-hero-business"[\s\S]*?<\/section>\s*<CatalogueFacts \/>\s*<section className="offer-curation offer-curation-reverse business-curation"/);
  assert.doesNotMatch(creators, /creator-piano-human\.webp/i);
  assert.match(creators, /creator-streamer-card\.webp/i);
  assert.match(creators, /creator-social-card\.webp/i);
  assert.match(creators, /creator-podcast-card\.webp/i);
  assert.doesNotMatch(creators, /creator-(?:piano|streamer|social|podcast)\.jpg/i);
  assert.match(offerCss, /\.creators-landing \.offer-use-grid article\s*\{[\s\S]{0,500}border-radius:\s*28px/);
  assert.match(offerCss, /\.creators-landing \.offer-use-grid article > img\s*\{[\s\S]{0,240}position:\s*absolute[\s\S]{0,240}height:\s*100%/);
  assert.match(offerCss, /V63: platforms become a full-width brand rail[\s\S]{0,500}\.creators-landing \.creator-platforms\s*\{[\s\S]{0,240}border-radius:\s*0/);
  assert.match(offerCss, /\.creators-landing \.offer-curation figure\s*\{[\s\S]{0,120}height:\s*clamp\(420px, 50vw, 560px\);[\s\S]{0,80}min-height:\s*0;/);
  assert.match(offerCss, /V53: the first Creators story continues directly from the hero, full bleed\.[\s\S]{0,120}\.creators-landing \.offer-curation\s*\{[\s\S]{0,100}width:\s*100%;[\s\S]{0,260}border-radius:\s*0;[\s\S]{0,100}box-shadow:\s*none;/);
  assert.match(offerCss, /V64: the two main Creator stories each own a complete desktop viewport\.[\s\S]{0,120}@media \(min-width: 1101px\)[\s\S]{0,180}\.creators-landing \.offer-curation,[\s\S]{0,80}\.creators-landing \.offer-uses\s*\{[\s\S]{0,140}min-height:\s*max\(900px, calc\(100svh - 90px\)\)/);
  assert.match(offerCss, /V64: the two main Creator stories each own a complete desktop viewport\.[\s\S]{0,500}\.creators-landing \.offer-curation\s*\{[\s\S]{0,80}margin:\s*0;/);
  assert.match(offerCss, /V64: the two main Creator stories each own a complete desktop viewport\.[\s\S]{0,700}\.creators-landing \.offer-uses\s*\{[\s\S]{0,180}display:\s*flex;[\s\S]{0,100}justify-content:\s*center;[\s\S]{0,240}flex-direction:\s*column;/);
  assert.match(offerCss, /V65: Creator pricing closes the page as a square, full-width beige band\.[\s\S]{0,180}\.creators-landing \.creator-pricing-cta\s*\{[\s\S]{0,200}width:\s*100%;[\s\S]{0,120}max-width:\s*none;[\s\S]{0,160}margin:\s*0;[\s\S]{0,100}border-radius:\s*0;[\s\S]{0,220}background:\s*var\(--marketing-paper\);[\s\S]{0,120}box-shadow:\s*none;/);
  assert.match(offerCss, /V54: the first Business story continues directly from the hero, full bleed\.[\s\S]{0,120}\.business-landing \.business-curation\s*\{[\s\S]{0,100}width:\s*100%;[\s\S]{0,220}border:\s*0;[\s\S]{0,100}border-radius:\s*0;[\s\S]{0,100}box-shadow:\s*none;/);
  assert.match(offerCss, /V66: every core Business story owns one complete desktop viewport\.[\s\S]*?@media \(min-width: 1101px\)[\s\S]*?\.business-landing \.business-curation,[\s\S]*?\.business-landing \.business-options,[\s\S]*?\.business-landing \.business-flow,[\s\S]*?\.business-landing \.business-retail,[\s\S]*?\.business-landing \.business-quote\s*\{[^}]*min-height:\s*max\(900px, calc\(100svh - 90px\)\);[^}]*margin-block:\s*0;/s);
  assert.match(offerCss, /V66: every core Business story owns one complete desktop viewport\.[\s\S]*?\.business-landing \.business-curation figure\s*\{[^}]*max-height:\s*none;/s);
  assert.match(offerCss, /V66: every core Business story owns one complete desktop viewport\.[\s\S]*?\.business-landing \.business-options,[\s\S]*?\.business-landing \.business-flow\s*\{[^}]*display:\s*flex;[^}]*justify-content:\s*center;[^}]*flex-direction:\s*column;/s);
  assert.match(offerCss, /V66: every core Business story owns one complete desktop viewport\.[\s\S]*?\.business-landing \.business-quote\s*\{[^}]*align-items:\s*center;/s);
  assert.match(offerCss, /V67: the Business route closes with a focused beige FAQ\.[\s\S]*?\.business-landing \.business-faq\s*\{[^}]*width:\s*100%;[^}]*max-width:\s*none;[^}]*margin:\s*0;[^}]*background:\s*var\(--marketing-paper\)/s);
  assert.match(offerCss, /V68: the Business request stage is square while its form remains a card\.[\s\S]*?\.business-landing \.business-quote\s*\{[^}]*border-radius:\s*0;/s);
  assert.match(offerCss, /\.business-quote \.form-panel\s*\{[^}]*border-radius:\s*26px;/s);
  assert.match(offerCss, /\.business-landing \.business-faq \.offer-faq-list summary:focus-visible\s*\{[^}]*outline:\s*3px solid var\(--marketing-night\)/s);
  assert.match(offerCss, /V60: Creators and Business share the homepage opening rhythm[\s\S]{0,260}\.offer-landing \.offer-hero\s*\{[\s\S]{0,100}min-height:\s*720px;[\s\S]{0,100}align-items:\s*center;/);
  assert.match(offerCss, /V60: Creators and Business share the homepage opening rhythm[\s\S]{0,1200}@media \(min-width: 901px\) and \(min-height: 800px\)[\s\S]{0,180}min-height:\s*max\(720px, calc\(100svh - 245px\)\)/);
  assert.match(offerCss, /\.offer-landing \.catalogue-facts\s*\{[\s\S]{0,240}--home26-paper:\s*var\(--marketing-cream\);[\s\S]{0,180}background:\s*var\(--marketing-cream\)/);
  assert.match(offerCss, /V55: a cinematic visual pause for the commercial licensing process\.[\s\S]{0,420}\.business-landing \.business-flow::before\s*\{[\s\S]{0,220}business-process-blur\.webp/);
  assert.match(offerCss, /\.business-landing \.business-flow \.offer-section-head\s*\{[\s\S]{0,180}text-align:\s*center/);
  assert.match(offerCss, /\.business-landing \.business-flow \.offer-section-head h2\s*\{[\s\S]{0,180}color:\s*var\(--marketing-paper\);[\s\S]{0,100}font-size:\s*clamp\(54px, 6vw, 92px\)/);
  assert.match(offerCss, /\.business-landing \.business-flow \.offer-flow-grid article\s*\{[\s\S]{0,260}background:\s*linear-gradient/);
  assert.match(creators, /className="offer-flow creator-flow"/);
  assert.match(offerCss, /V61: a cinematic visual pause for the Creator licensing process\.[\s\S]{0,420}\.creators-landing \.creator-flow::before\s*\{[\s\S]{0,240}creator-process-blur\.webp/);
  assert.match(offerCss, /\.creators-landing \.creator-flow \.offer-section-head\s*\{[\s\S]{0,180}text-align:\s*center/);
  assert.match(offerCss, /\.creators-landing \.creator-flow \.offer-section-head h2\s*\{[\s\S]{0,180}color:\s*var\(--marketing-paper\);[\s\S]{0,120}font-size:\s*clamp\(54px, 6vw, 92px\)/);
  assert.match(offerCss, /\.creators-landing \.creator-flow \.offer-flow-grid article\s*\{[\s\S]{0,260}background:\s*linear-gradient/);
  assert.match(offerCss, /\.business-quote \.lead-form input,[\s\S]{0,420}font-size:\s*16px;/);
  assert.match(catalogueData, /food-hospitality\.jpg/i);
  assert.match(catalogCss, /music-header\.jpg/i);
  assert.match(catalogCss, /\.music-playlist-card\s*\{[\s\S]{0,220}border-radius:\s*24px/);
  assert.match(business, /Retail stores[\s\S]*Offices[\s\S]*Restaurants[\s\S]*Hotels[\s\S]*Gyms[\s\S]*Spas/i);
  assert.match(page, /Find the perfect music<br \/>for any situation/i);
  assert.match(page, /licensing income is paid directly and fairly/i);
  assert.match(page, /\/artists\/charlee\.webp/);
  assert.doesNotMatch(business, /\/artists\/meadow\.webp/);
  assert.match(booth, /My channel/);
  assert.match(layout, /openGraph/);
  assert.match(layout, /og\.png/);
  await Promise.all([
    access(new URL("public/fonts/unbounded-var-latin.woff2", root)),
    access(new URL("public/fonts/afacad-flux-var-latin.woff2", root)),
    access(new URL("app/icon.svg", root)),
    access(new URL("public/og.png", root)),
    access(new URL("public/artists/charlee.webp", root)),
    access(new URL("public/artists/meadow.webp", root)),
    access(new URL("public/artists/tibeauthetraveler.webp", root)),
    access(new URL("public/artists/mondo-loops.webp", root)),
    access(new URL("public/artists/sebastian-kamae.webp", root)),
    access(new URL("public/artists/SOURCES.md", root)),
    access(new URL("public/images/stock/vinyl-turntable.jpg", root)),
    access(new URL("public/images/stock/studio-artist.jpg", root)),
    access(new URL("public/images/stock/cozy-workspace.jpg", root)),
    access(new URL("public/images/stock/ATTRIBUTION.md", root)),
    access(new URL("public/images/unsplash/creator-edit.jpg", root)),
    access(new URL("public/images/unsplash/creator-youtube-card.webp", root)),
    access(new URL("public/images/unsplash/creator-audio-editor.webp", root)),
    access(new URL("public/images/unsplash/creator-streamer-card.webp", root)),
    access(new URL("public/images/unsplash/creator-social-card.webp", root)),
    access(new URL("public/images/unsplash/creator-podcast-card.webp", root)),
    access(new URL("public/images/unsplash/creator-video-editor-WsJBwU9psWI.webp", root)),
    access(new URL("public/images/unsplash/food-hospitality.jpg", root)),
    access(new URL("public/images/unsplash/music-header.jpg", root)),
    access(new URL("public/images/unsplash/podcast-home.jpg", root)),
    access(new URL("public/images/unsplash/study-focus-clean.jpg", root)),
    access(new URL("public/images/unsplash/filmmaker-desk.jpg", root)),
    access(new URL("public/images/unsplash/business-headphones-books-T3mKJXfdims.webp", root)),
    access(new URL("public/images/unsplash/editing-desk.jpg", root)),
    access(new URL("public/images/unsplash/studio-artist.jpg", root)),
    access(new URL("public/images/unsplash/hero-listening.jpg", root)),
    access(new URL("public/images/unsplash/hero-turntable.jpg", root)),
    access(new URL("public/images/unsplash/hero-producer.jpg", root)),
    access(new URL("public/images/unsplash/campaign-filmset.jpg", root)),
    access(new URL("public/images/unsplash/retail/cafe.jpg", root)),
    access(new URL("public/images/unsplash/retail/restaurant.jpg", root)),
    access(new URL("public/images/unsplash/retail/hotel.jpg", root)),
    access(new URL("public/images/unsplash/retail/spa.jpg", root)),
    access(new URL("public/images/unsplash/retail/store.jpg", root)),
    access(new URL("public/images/unsplash/retail/office.jpg", root)),
    access(new URL("public/images/catalogue/melting-snowman.jpg", root)),
    access(new URL("public/images/catalogue/532pm.jpg", root)),
    access(new URL("public/images/catalogue/blue-and-green.jpg", root)),
    access(new URL("public/images/catalogue/drifting-away.jpg", root)),
  ]);
});

test("uses the two-colour Symbiome surface system instead of retired UI palettes", async () => {
  const publicStyles = [
    "app/globals.css",
    "app/home-v6.css",
    "app/home-v26.css",
    "app/offer-pages.css",
    "app/catalog-v26.css",
    "app/pricing-v39.css",
    "app/retail-v2.css",
    "app/support-pages.css",
  ];
  const styles = await Promise.all(publicStyles.map(source));
  const retiredEucalyptus =
    /#(?:2f665e|234f4a|9ed4c7|dceae5|7e8976|76806f|8cafa6)\b|rgba?\(\s*(?:47\s*,\s*102\s*,\s*94|35\s*,\s*79\s*,\s*74|158\s*,\s*212\s*,\s*199)\b/i;

  for (const [index, css] of styles.entries()) {
    assert.doesNotMatch(css, retiredEucalyptus, publicStyles[index]);
  }

  const [catalogueData, workspaceCss, brandCss, offerCss, catalogueCss, supportCss] = await Promise.all([
    source("app/data/catalog.ts"),
    source("app/workspace-music.css"),
    source("app/symbiose-brand.css"),
    source("app/offer-pages.css"),
    source("app/catalog-v26.css"),
    source("app/support-pages.css"),
  ]);
  assert.doesNotMatch(catalogueData, retiredEucalyptus, "playlist buttons should not restore eucalyptus");
  const playlistBlock = catalogueData.match(/export const lofiGirlPlaylists = \[([\s\S]*?)\]\s+satisfies readonly LofiGirlPlaylist\[\];/);
  assert.ok(playlistBlock, "the playlist collection should remain a typed list");
  const playlistGenres = [...playlistBlock[1].matchAll(/genre:\s*"([^"]+)"/g)].map((match) => match[1]);
  assert.equal(playlistGenres.length, 12, "the catalogue should present twelve playlist directions");
  assert.equal(new Set(playlistGenres).size, 10, "the twelve playlists should span ten real genre families");
  assert.equal([...catalogueData.matchAll(/borderColor:\s*"#e06343"/gi)].length, 12, "every playlist accent should use Symbiome orange");
  assert.match(workspaceCss, /--wm-side:#292832; --wm-side-soft:#292832;[^\n]*--wm-clay:#e06343; --wm-clay-deep:#e06343; --wm-clay-soft:#e06343; --wm-sage:#e06343/i);
  assert.match(brandCss, /--symbiose-night:\s*#292832/i);
  assert.match(brandCss, /--symbiose-warm:\s*#e06343/i);
  assert.match(brandCss, /--symbiose-oat:\s*#f7ebdd/i);
  assert.match(brandCss, /--symbiose-paper:\s*#fff9f1/i);
  assert.match(brandCss, /Symbiome surface system/i);
  assert.match(brandCss, /\.public-shell \.site-footer\s*\{[^}]*background:\s*var\(--symbiose-night\)/s);
  assert.match(brandCss, /\.creators-landing \.creator-editorial\s*\{[^}]*background:\s*var\(--symbiose-oat\)/s);
  assert.match(brandCss, /\.creators-landing \.creator-editorial-track\s*\{[^}]*background-color:\s*var\(--symbiose-paper\)/s);
  assert.match(brandCss, /\.creators-landing \.creator-editorial-track:hover,[\s\S]{0,180}background-color:\s*#f1e5d8/);
  assert.match(brandCss, /\.music-library-editorial\s*\{[^}]*background:\s*var\(--symbiose-oat\);[^}]*color:\s*var\(--symbiose-night\)/s);
  assert.match(brandCss, /\.music-library-editorial \.catalogue-v26-listen:hover\s*\{[^}]*background:\s*#464551/s);
  assert.doesNotMatch(brandCss, /\.creators-landing \.creator-editorial\s*\{[^}]*background:\s*var\(--symbiose-warm\)/s);
  assert.match(offerCss, /\.creators-landing \.creator-editorial\s*\{[^}]*background:\s*var\(--marketing-paper\)/s);
  assert.match(catalogueCss, /\.catalogue-moods\s*\{[^}]*background:\s*var\(--music-paper\)/s);
  assert.doesNotMatch(offerCss, /\.creators-landing \.creator-editorial\s*\{[^}]*background:\s*#e06343/s);
  assert.doesNotMatch(catalogueCss, /\.catalogue-moods\s*\{[^}]*background:\s*#e06343/s);
  assert.match(supportCss, /--support-ink:\s*#292832[\s\S]*--support-paper:\s*#f7ebdd[\s\S]*--support-warm:\s*#fff9f1/i);
  assert.match(supportCss, /\.support-hero::before\s*\{[^}]*rgba\(224, 99, 67, \.26\)/s);
  assert.doesNotMatch(supportCss, /rgba\(150, 180, 255|rgba\(164, 178, 206/i);
});

test("keeps the connected workspace readable and artist-led", async () => {
  const [layout, workspaceCss, symbioseBrandCss, brand, mark, icon, heroMockup, ogScript, dashboardShell, musicWorkspace, musicWorkspaceCss, catalogueData, cataloguePage, playlistSources] = await Promise.all([
    source("app/layout.tsx"),
    source("app/workspace-v2.css"),
    source("app/symbiose-brand.css"),
    source("app/components/Brand.tsx"),
    source("app/components/SymbiomeMark.tsx"),
    source("app/icon.svg"),
    source("app/components/HeroProductMockup.tsx"),
    source("scripts/render-og-card.py"),
    source("app/components/DashboardShell.tsx"),
    source("app/components/CreatorWorkspace.tsx"),
    source("app/workspace-music.css"),
    source("app/data/catalog.ts"),
    source("app/catalog/page.tsx"),
    source("public/images/unsplash/playlists/SOURCES.md"),
  ]);

  assert.match(layout, /workspace-v2\.css/);
  assert.match(layout, /symbiose-brand\.css/);
  assert.match(workspaceCss, /studio-artist\.jpg/);
  assert.match(workspaceCss, /font-size:\s*36px/);
  assert.match(brand, /className="brand brand-warm"/);
  assert.match(brand, /<SymbiomeMark \/>/);
  assert.match(brand, /aria-label="Symbiome home"/);
  assert.match(mark, /brand-groove-warm/);
  assert.match(mark, /brand-groove-base/);
  const markPaths = [...mark.matchAll(/<path[^>]+d="([^"]+)"/g)].map((match) => match[1]);
  const iconPaths = [...icon.matchAll(/<path[^>]+d="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(markPaths.length, 2, "the reusable mark should keep the two canonical lobes");
  assert.deepEqual(markPaths, iconPaths, "every rendered mark should preserve the board geometry and spacing");
  assert.match(icon, /<title>Symbiome<\/title>/);
  assert.doesNotMatch(icon, /<(?:rect|image)\b/i, "the favicon should keep a transparent canvas");
  assert.match(icon, /fill="#e06343"/i, "the favicon should keep the warm lobe");
  assert.match(icon, /path:last-of-type\s*\{\s*fill:\s*#292832/i, "the favicon should stay visible on light browser chrome");
  assert.match(icon, /prefers-color-scheme:\s*dark[\s\S]{0,100}fill:\s*#fff9f1/i, "the favicon should match the cream logo on dark browser chrome");
  assert.match(heroMockup, /className="mock-logo"[\s\S]{0,120}<SymbiomeMark \/>/);
  assert.doesNotMatch(heroMockup, /className="mock-logo">s<\/span>/);
  assert.match(ogScript, /ICON = ROOT \/ "app" \/ "icon\.svg"/);
  assert.match(ogScript, /Expected two Symbiome paths/);
  assert.match(dashboardShell, /<Brand compact \/>/);
  assert.match(musicWorkspace, /<Brand compact \/>/);
  assert.match(symbioseBrandCss, /--symbiose-warm:\s*#e06343/i);
  assert.match(symbioseBrandCss, /--symbiose-night:\s*#292832/i);
  assert.match(symbioseBrandCss, /--symbiose-brand-warm:\s*var\(--symbiose-warm\)/i);
  assert.match(symbioseBrandCss, /--symbiose-brand-base:\s*var\(--symbiose-night\)/i);
  assert.match(symbioseBrandCss, /\.brand-warm \.brand-groove path[\s\S]*fill:/);
  assert.doesNotMatch(symbioseBrandCss, /stroke-width:\s*13/);
  assert.match(symbioseBrandCss, /\.site-header \.brand-warm \.brand-name/);
  assert.match(symbioseBrandCss, /\.site-footer \.brand-warm/);
  assert.match(symbioseBrandCss, /\.public-shell \.site-header \.brand-warm \.brand-name\s*\{[^}]*font-size:\s*26px/s);
  assert.match(symbioseBrandCss, /\.public-shell \.site-header \.brand-warm \.brand-powered\s*\{[^}]*font-size:\s*12px/s);
  assert.match(symbioseBrandCss, /\.public-shell \.site-header \.site-nav > a\s*\{[^}]*color:\s*#292832;[^}]*font-family:\s*var\(--font-ui\);[^}]*font-size:\s*20px;[^}]*font-weight:\s*700;[^}]*font-kerning:\s*normal;[^}]*text-rendering:\s*geometricPrecision/s);
  assert.match(symbioseBrandCss, /@media \(min-width:\s*1221px\)[\s\S]{0,220}\.public-shell \.site-header \.site-nav\s*\{[^}]*gap:\s*clamp\(12px, 1vw, 18px\)/s);
  assert.match(symbioseBrandCss, /@media \(max-width:\s*1100px\) and \(min-width:\s*981px\)[\s\S]{0,260}font-size:\s*18px/s);
  assert.match(symbioseBrandCss, /@media \(max-width:\s*980px\)[\s\S]{0,260}font-size:\s*20px/s);
  assert.match(musicWorkspace, /useState<LibraryView>\("music"\)/);
  assert.match(musicWorkspace, /Sound effects/);
  assert.match(musicWorkspace, /Voices/);
  assert.match(musicWorkspace, /Coming soon/);
  assert.match(musicWorkspace, /Tune the library/);
  assert.match(musicWorkspace, /music-track-table/);
  assert.match(musicWorkspace, /open\.spotify\.com\/embed\/track/);
  assert.match(musicWorkspace, /easy-license-library-tuned/);
  assert.match(musicWorkspace, /INSPIRED BY LOFI GIRL'S PUBLIC PLAYLISTS/);
  assert.match(musicWorkspace, /workspace-playlist-photo/);
  assert.match(musicWorkspace, /lofiGirlPlaylists\.map/);
  assert.match(musicWorkspaceCss, /\.workspace-audio-player\s*\{[^}]*position:\s*fixed/s);
  assert.match(musicWorkspaceCss, /\.music-track-identity strong\s*\{[^}]*font-size:\s*15px/s);
  assert.match(musicWorkspaceCss, /\.creator-music-app/);
  assert.match(musicWorkspaceCss, /border:3px solid var\(--playlist-border/);
  assert.match(musicWorkspaceCss, /\.workspace-playlist-photo\s*\{[^}]*object-fit:cover/s);
  assert.match(cataloguePage, /width=\{1600\}[\s\S]{0,100}height=\{1200\}[\s\S]{0,100}loading="lazy"[\s\S]{0,80}decoding="async"/);
  assert.match(musicWorkspace, /className="workspace-playlist-photo"[\s\S]{0,180}width=\{1600\}[\s\S]{0,100}height=\{1200\}[\s\S]{0,100}loading="lazy"/);

  let refreshedPlaylistBytes = 0;
  for (const [title, spotifyId, image, sourceId] of [
    ["Lofi Study", "0vvXsWCC9xrXsKd4FyS8kM", "lofi-study-laptop-dwZlYC-6-9c.jpg", "dwZlYC-6-9c"],
    ["Synthwave Night", "1YIe34rcmLjCYpY9wJoM2p", "synthwave-console-p0j-mE6mGo4.jpg", "p0j-mE6mGo4"],
    ["Peaceful Piano", "1u4F50HA53L3Jwxbnk9IeO", "peaceful-piano-hands-5P1-Bemnb0c.jpg", "5P1-Bemnb0c"],
    ["Dark Ambient", "07lYUEyTkWP3NqIa7Kzyqx", "dark-ambient-fog.jpg", null],
    ["Jazz Lofi", "6abvvGTDj4WuFRNDMsHsw8", "jazz-lofi-saxophone.jpg", null],
    ["Chill House", "4lqntZDCCDC5ySCz9Y5eJn", "chill-house.jpg", null],
    ["Sleep Ambient", "4AITFDgLpIPPLYmFIKgsvr", "sleep-ambient-bedside.jpg", null],
    ["Chill Guitar", "1NvyHldjNnayEvqpyk3AYr", "chill-guitar-couch-KEtvAfDlpWI.jpg", "KEtvAfDlpWI"],
    ["Classical", "36varCeUCC5XN7rXuMMa0Z", "classical-quartet-__2fmv-P4eA.jpg", "__2fmv-P4eA"],
    ["Bossa Lofi", "7Lky3YE5SfTMKQxD7FnC6J", "bossa-trees-KttgjNw5Iqo.jpg", "KttgjNw5Iqo"],
    ["Christmas Music", "74UM9i1Dkr7dClq7u4PGYF", "christmas-tree-Kf8ko_oGN20.jpg", "Kf8ko_oGN20"],
    ["Halloween Music", "6FEzJ6EWEHpUz0nz7gIVvJ", "halloween-pumpkin-MYRG0ptGh50.jpg", "MYRG0ptGh50"],
  ]) {
    assert.match(catalogueData, new RegExp(title), title);
    assert.match(catalogueData, new RegExp(spotifyId), spotifyId);
    const imageFile = new URL(`public/images/unsplash/playlists/${image}`, root);
    await access(imageFile);
    if (sourceId) {
      assert.match(catalogueData, new RegExp(sourceId), `${title} source ID`);
      assert.match(playlistSources, new RegExp(sourceId), `${title} source attribution`);
      const metadata = await stat(imageFile);
      assert.ok(metadata.size <= 250_000, `${title} playlist image should stay below 250 KB`);
      refreshedPlaylistBytes += metadata.size;
    }
  }
  assert.ok(refreshedPlaylistBytes <= 1_400_000, "the refreshed playlist images should stay lightweight");
  assert.equal([...playlistSources.matchAll(/original download without watermark/g)].length, 3, "all Unsplash+ originals should be documented as watermark-free downloads");
  for (const retiredImage of ["lofi-study.jpg", "synthwave-night.jpg", "peaceful-piano.jpg", "chill-guitar.jpg"]) {
    assert.doesNotMatch(catalogueData, new RegExp(`playlists/${retiredImage.replace(".", "\\.")}`), retiredImage);
    assert.doesNotMatch(playlistSources, new RegExp(retiredImage.replace(".", "\\.")), retiredImage);
  }
});

test("build emits product assets and removes starter artifacts", async () => {
  const [clientAssets, serverAssets] = await Promise.all([
    readdir(new URL("dist/client/assets/", root)),
    readdir(new URL("dist/server/ssr/assets/", root)),
  ]);

  assert.ok(clientAssets.some((name) => name.startsWith("CreatorWorkspace-")));
  assert.ok(clientAssets.some((name) => name.startsWith("AdminWorkspace-")));
  assert.ok(clientAssets.some((name) => name.endsWith(".css")));
  assert.ok(serverAssets.some((name) => name.startsWith("LeadForm-")));
  await assert.rejects(access(new URL("app/_sites-preview/SkeletonPreview.tsx", root)));
  await assert.rejects(access(new URL("public/favicon.svg", root)));
});

test("validates lead payloads before writing to D1", async () => {
  const api = await source("app/api/leads/route.ts");
  assert.match(api, /MAX_BODY_BYTES = 16_384/);
  assert.match(api, /Unknown field/);
  assert.match(api, /EMAIL_PATTERN/);
  assert.match(api, /type === "sync"/);
  assert.match(api, /retail_waitlist/);
  assert.match(api, /@lofigirl\.com/);
  assert.match(api, /Admin access required/);
  assert.match(api, /Cache-Control.*no-store/s);
});

test("ships a constrained D1 lead schema and current worker compatibility", async () => {
  const [schema, migration, hosting, vite, wrangler] = await Promise.all([
    source("db/schema.ts"),
    source("drizzle/0000_charming_boomerang.sql"),
    source(".openai/hosting.json"),
    source("vite.config.ts"),
    source("wrangler.jsonc"),
  ]);

  assert.match(schema, /leads_request_shape_check/);
  assert.match(schema, /idx_leads_created_at_id/);
  assert.match(migration, /CREATE TABLE `leads`/);
  assert.match(migration, /PRAGMA optimize/);
  assert.match(hosting, /"d1": "DB"/);
  assert.match(vite, /compatibility_date: "2026-08-03"/);
  assert.doesNotMatch(vite, /nodejs_compat/);
  assert.match(wrangler, /"compatibility_date": "2026-08-03"/);
  assert.match(wrangler, /"binding": "DB"/);
  assert.doesNotMatch(wrangler, /nodejs_compat/);
});

test("ships a public GitHub Pages mockup without collecting form data", async () => {
  const [nextConfig, packageJson, pagesBuild, workflow, leadForm] = await Promise.all([
    source("next.config.ts"),
    source("package.json"),
    source("scripts/build-pages.mjs"),
    source(".github/workflows/deploy-pages.yml"),
    source("app/components/LeadForm.tsx"),
  ]);

  assert.match(nextConfig, /output: "export"/);
  assert.match(nextConfig, /basePath: pagesBasePath/);
  assert.match(packageJson, /"build:pages": "node scripts\/build-pages\.mjs"/);
  assert.match(pagesBuild, /NEXT_PUBLIC_STATIC_DEMO: "true"/);
  assert.match(pagesBuild, /projectPath !== join\("app", "api"\)/);
  assert.match(pagesBuild, /\.nojekyll/);
  assert.match(workflow, /actions\/deploy-pages@v4/);
  assert.match(workflow, /pages: write/);
  assert.match(leadForm, /Public prototype: no information is sent or stored\./);
  assert.match(leadForm, /nothing was sent or stored\./);
  assert.ok(leadForm.indexOf("if (isStaticDemo)") < leadForm.indexOf('fetch("/api/leads"'), "the static demo must stop before any network request");
});

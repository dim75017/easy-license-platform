import assert from "node:assert/strict";
import { access, readFile, readdir, stat } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("contains the complete Symbiose music licensing homepage", async () => {
  const [page, layout, css, homeCss, catalogueCss, offerCss, packageJson, artistMarquee, artistSources] = await Promise.all([
    source("app/page.tsx"),
    source("app/layout.tsx"),
    source("app/globals.css"),
    source("app/home-v26.css"),
    source("app/catalog-v26.css"),
    source("app/offer-pages.css"),
    source("package.json"),
    source("app/components/ArtistMarquee.tsx"),
    source("public/artists/SOURCES.md"),
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
  assert.match(page, /home26-audience-business[\s\S]*Music and rights shaped around the project[\s\S]*href="\/business"/i);
  assert.match(page, /Find the perfect music<br \/>for any situation/i);
  assert.match(page, /Explore the full music library[\s\S]*href="\/catalog"|href="\/catalog"[\s\S]*Explore the full music library/i);
  assert.match(page, /editing-desk\.jpg/i);
  assert.match(page, /filmmaker-desk\.jpg/i);
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
  assert.doesNotMatch(page, /home26-curation|home26-faq|home26-final/i);
  assert.doesNotMatch(page, /href="\/pricing"/i);
  assert.match(page, /10,000\+[\s\S]*instrumental and background tracks/i);
  assert.match(page, /0[\s\S]*AI-generated tracks accepted/i);
  assert.match(page, /1,000\+[\s\S]*artists represented worldwide/i);
  assert.match(page, /featuredGenreCount[\s\S]*music genres across our featured playlists/i);
  assert.match(page, /new Set\(lofiGirlPlaylists\.map\(\(playlist\) => playlist\.genre\)\)\.size/i);
  assert.doesNotMatch(page, /Genre families/i);
  assert.doesNotMatch(page, /Curated to belong|Two offers|Not an upload dump|Selected by professionals\.\s*Created by people/i);
  assert.match(layout, /Symbiose — High-quality instrumental music for creators and businesses/);
  assert.match(layout, /offer-pages\.css/);
  assert.match(layout, /catalog-v26\.css/);
  assert.match(layout, /home-v26\.css/);
  assert.match(layout, /themeColor:\s*"#f3ece0"/i);
  assert.match(layout, /colorScheme:\s*"light"/i);
  assert.match(css, /--bg:\s*#07080d/i);
  assert.match(homeCss, /\.home26-hero/);
  assert.match(homeCss, /\.home26-facts\s*\{\s*width:\s*min\(1440px,\s*calc\(100% - 72px\)\)/);
  assert.match(homeCss, /\.home26-facts\s*\{[\s\S]{0,180}grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(homeCss, /\.home26-collection-grid/);
  assert.match(homeCss, /\.home26-audience-panel/);
  assert.match(homeCss, /grid-template-areas:\s*"media copy"/);
  assert.match(homeCss, /\.home26-audience-business \.home26-audience-panel[\s\S]{0,300}grid-template-areas:\s*"copy media"/);
  assert.match(homeCss, /V51: the two licensing routes are full-bleed[\s\S]{0,220}\.home26-audience\s*\{[\s\S]{0,140}width:\s*100%;[\s\S]{0,100}padding:\s*0;/);
  assert.match(homeCss, /V52: equal audience stages and larger artist portraits[\s\S]{0,700}height:\s*clamp\(900px, 48vw, 940px\)/);
  assert.match(homeCss, /V54: keep the next photographic section below the opening viewport[\s\S]{0,260}min-height:\s*max\(720px, calc\(100svh - 245px\)\)/);
  assert.match(homeCss, /V55: artist portraits fill each card[\s\S]{0,900}\.home26-artist-meta\s*\{[\s\S]{0,260}position:\s*absolute;[\s\S]{0,260}color:\s*#fff;/);
  assert.match(homeCss, /V56: a continuous artist marquee[\s\S]{0,900}animation:\s*home26ArtistsLeft 100s linear infinite/);
  assert.match(homeCss, /@keyframes home26ArtistsLeft[\s\S]{0,180}translate3d\(-50%, 0, 0\)/);
  assert.match(homeCss, /\.home26-artist-grid:hover \.home26-artist-track,[\s\S]{0,180}focus-within[\s\S]{0,180}animation-play-state:\s*paused/);
  assert.match(homeCss, /@media \(prefers-reduced-motion: reduce\)[\s\S]{0,900}\.home26-artist-sequence\.is-duplicate[\s\S]{0,120}display:\s*none/);
  assert.match(homeCss, /\.home26-audience-panel,[\s\S]{0,100}\.home26-audience-business \.home26-audience-panel\s*\{[\s\S]{0,220}border-radius:\s*0;[\s\S]{0,180}grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(homeCss, /scroll-snap-type: x mandatory/);
  assert.match(catalogueCss, /\.catalogue-v26/);
  assert.match(catalogueCss, /\.catalogue-v26-use-grid/);
  const cataloguePage = await source("app/catalog/page.tsx");
  assert.match(cataloguePage, /lofiGirlPlaylists/);
  assert.match(cataloguePage, /Explore all playlists/);
  assert.match(cataloguePage, /Browse by mood/);
  assert.doesNotMatch(cataloguePage, /Lofi Girl worlds/);
  assert.doesNotMatch(cataloguePage, /NOW EXPLORING|Instrumental music<br \/>with a human touch/);
  assert.doesNotMatch(cataloguePage, /Symbiose<\/span> Music/);
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
    ["app/pricing/page.tsx", /Simple plans for/i],
    ["app/sync/page.tsx", /One brief/i],
    ["app/retail/page.tsx", /Good music\.<br \/>One less thing/i],
    ["app/app/page.tsx", /CreatorWorkspace/],
    ["app/admin/page.tsx", /AdminWorkspace/],
  ];

  for (const [path, expected] of routes) {
    assert.match(await source(path), expected, path);
  }

  const [creators, business, pricing, pricingCards, retail, sync] = await Promise.all([
    source("app/creators/page.tsx"),
    source("app/business/page.tsx"),
    source("app/pricing/page.tsx"),
    source("app/components/PricingCards.tsx"),
    source("app/retail/page.tsx"),
    source("app/sync/page.tsx"),
  ]);
  assert.match(creators, /Music that leaves room/i);
  assert.doesNotMatch(creators, /CatalogueExplorer/i);
  assert.match(creators, /<CreatorTrackShowcase \/>/i);
  assert.doesNotMatch(creators, /PricingCards|creator-pricing-cards/i);
  assert.match(creators, /creator-pricing-cta[\s\S]*href="\/pricing"[\s\S]*Discover pricing/i);
  assert.doesNotMatch(creators, /Commercial Sync|Custom Commission|Music for Retail/i);
  assert.doesNotMatch(creators, /Artists and payments|More than 1,000 artists|offer-human/i);
  assert.match(business, /Commercial Sync/i);
  assert.match(business, /Custom Commission/i);
  assert.match(business, /Music for Retail · Coming soon/i);
  assert.match(business, /Music that can carry/i);
  assert.match(business, /Rights fit/i);
  assert.match(business, /Every business project gets a custom quote/i);
  assert.match(business, /id="business-brief"/i);
  assert.match(business, /<LeadForm type="sync" \/>/i);
  assert.match(business, /href="#business-brief"/i);
  assert.doesNotMatch(business, /Creator &amp; Pro|€6\.67|€16\.67/i);
  assert.doesNotMatch(business, /Artists and music team|More than 1,000 artists|offer-human/i);
  assert.match(pricing, /FOR CREATORS/i);
  assert.match(pricing, /Rights built around/i);
  assert.match(pricing, /Commercial Sync/i);
  assert.match(pricing, /Custom Commission/i);
  assert.match(pricing, /MUSIC FOR RETAIL/i);
  assert.doesNotMatch(pricingCards, /SY–03 \/ BUSINESS/i);
  assert.match(retail, /Music for Retail — Coming soon/i);
  assert.doesNotMatch(retail, /Music for Business/i);
  assert.match(sync, /Symbiose/i);
});

test("presents one real track from each main playlist on the Creators page", async () => {
  const [creators, showcase, catalogueData, offerCss, artworkSources] = await Promise.all([
    source("app/creators/page.tsx"),
    source("app/components/CreatorTrackShowcase.tsx"),
    source("app/data/catalog.ts"),
    source("app/offer-pages.css"),
    source("public/images/stock/ATTRIBUTION.md"),
  ]);

  assert.match(creators, /these eight tracks — one from each of our main playlists/i);
  assert.match(showcase, /creatorPlaylistTracks\.slice\(0, 8\)\.map/);
  assert.match(showcase, /className=\{isSelected \? "creator-editorial-track is-selected" : "creator-editorial-track"\}/);
  assert.match(showcase, /\{track\.title\}/);
  assert.match(showcase, /\{track\.artist\}/);
  assert.match(showcase, /\{track\.genre\}/);
  assert.match(showcase, /\{track\.duration\}/);
  assert.match(showcase, /src=\{track\.cover\}[\s\S]{0,220}width=\{640\}[\s\S]{0,100}height=\{640\}[\s\S]{0,120}loading="lazy"[\s\S]{0,120}decoding="async"/);
  assert.match(showcase, /open\.spotify\.com\/embed\/track\/\$\{selectedTrack\.spotifyId\}/);

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
  assert.match(offerCss, /\.creator-editorial-track\s*\{[\s\S]{0,260}grid-template-columns:\s*92px minmax\(0, 1fr\) 82px 52px/);
  assert.match(offerCss, /\.creator-editorial-cover\s*\{[\s\S]{0,180}aspect-ratio:\s*1/);
  assert.match(offerCss, /\.creator-editorial-cover img\s*\{[\s\S]{0,180}object-fit:\s*cover/);
  assert.match(offerCss, /@media \(max-width: 760px\)[\s\S]{0,160}\.creator-editorial-grid\s*\{\s*grid-template-columns:\s*1fr/);
});

test("uses real platform logos instead of placeholder glyphs", async () => {
  const [creators, pricing, platformLogo, offerCss, pricingCss] = await Promise.all([
    source("app/creators/page.tsx"),
    source("app/pricing/page.tsx"),
    source("app/components/PlatformLogo.tsx"),
    source("app/offer-pages.css"),
    source("app/pricing-v39.css"),
  ]);

  assert.match(creators, /<PlatformLogo platform=\{name\}/);
  assert.match(creators, /<PlatformLogo platform=\{name\} bare \/>/);
  assert.match(creators, /className="creator-platform-logo"[^>]*role="img"[^>]*aria-label=\{name\}/);
  assert.doesNotMatch(creators, /<PlatformLogo platform=\{name\} \/>\{name\}/);
  assert.match(pricing, /<PlatformLogo platform=\{name\}/);
  assert.doesNotMatch(pricing, /<PlatformLogo platform=\{name\} bare/);
  assert.match(platformLogo, /creatorPlatforms: PlatformName\[\] = \["YouTube", "Twitch", "TikTok", "Instagram", "Kick", "Spotify"\]/);
  assert.doesNotMatch(platformLogo, /creatorPlatforms[^;]*Apple Podcasts/);
  assert.doesNotMatch(creators, /\["YouTube", "▶"\]|\["Twitch", "✦"\]|\["TikTok", "♪"\]/);
  assert.doesNotMatch(pricing, /\["Instagram", "◎"\]|\["Kick", "K"\]|\["Spotify", "≋"\]/);
  assert.match(platformLogo, /<svg viewBox="0 0 24 24"/);
  assert.match(platformLogo, /aria-hidden="true"/);
  assert.match(platformLogo, /background: "#000000"/);
  assert.match(platformLogo, /platform === "TikTok" \? \(bare \? icon\.color : "#FFFFFF"\)/);
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
  assert.match(offerCss, /creator-platform-grid \{[^}]*grid-template-columns:repeat\(3/s);
  assert.match(offerCss, /\.creators-landing \.creator-platform-grid\s*\{[\s\S]{0,160}grid-template-columns:\s*repeat\(6, minmax\(0, 1fr\)\)/);
  assert.match(offerCss, /\.creators-landing \.creator-platform-grid \.platform-brand-icon\s*\{[\s\S]{0,160}width:\s*80px;[\s\S]{0,80}height:\s*80px;/);
  assert.match(offerCss, /V50: Creators shows the platform marks themselves[\s\S]{0,900}\.platform-brand-icon\.is-bare\s*\{[\s\S]{0,260}background:\s*transparent;[\s\S]{0,80}box-shadow:\s*none;/);
  assert.match(offerCss, /V51: the Creators banner is a full-width rectangle[\s\S]{0,180}\.creators-landing \.offer-hero\s*\{[\s\S]{0,80}border-radius:\s*0;/);
  assert.match(pricingCss, /\.pricing-v39-platform-grid \.platform-brand-icon svg/);
  assert.match(pricingCss, /\.pricing-v39-platform-grid \.platform-brand-icon img/);
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
  assertUniquePageImages("Creators", [...imagePaths(creators), backgroundImage(offerCss, ".offer-hero-creators")]);
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

test("ships the Business process backdrop locally and documents its source", async () => {
  const backdrop = new URL("public/images/unsplash/business-process-blur.webp", root);
  const sources = await source("public/images/unsplash/SOURCES.md");

  await access(backdrop);
  const metadata = await stat(backdrop);
  assert.ok(metadata.size <= 80_000, "the blurred Business process backdrop should stay below 80 KB");
  assert.match(sources, /business-process-blur\.webp[\s\S]{0,160}Vitaly Gariev[\s\S]{0,160}KNGa5luu2HA/);
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
  assert.match(home26Css, /\.home26-artist-track\s*\{[\s\S]{0,180}width:\s*max-content;[\s\S]{0,180}animation:\s*home26ArtistsLeft 100s linear infinite/);
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
  assert.match(homeCss, /Symbiose V5 — the licensing signal router/);
  assert.match(homeCss, /\.v5-booth/);
  assert.match(homeCss, /clip-path:/);
  assert.match(cozyCss, /Symbiose V6 — warm, quiet and recognisably Lofi Girl/);
  assert.match(cozyCss, /--font-display:\s*"Afacad Flux"/);
  assert.match(cozyCss, /\.el-v6 \.v5-booth::before[\s\S]*display:\s*none/);
  assert.match(css, /navigation uses one clear hover treatment[\s\S]{0,700}background:\s*transparent;[\s\S]{0,80}box-shadow:\s*none/);
  assert.match(homeCss, /\.site-header \.site-nav > a:hover::after,[\s\S]{0,120}transform:\s*scaleX\(1\)/);
  assert.doesNotMatch(css, /font-family:\s*"Newsreader"|font-family:\s*"IBM Plex Sans"/);
  assert.match(brand, /className="brand-name"><span>sym<span className="brand-accent">biose<\/span>/);
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
  assert.match(catalogue, /featured-track/);
  assert.match(catalogue, /<iframe/);
  assert.match(catalogue, /open\.spotify\.com\/embed\/track/);
  assert.match(catalogue, /Play a preview/i);
  assert.match(catalogue, /catalogue-v26-waveform/);
  assert.match(catalogue, /Search the catalogue/i);
  assert.doesNotMatch(catalogue, /EL-CAT-|download=|Download track|Fake player|Prototype data|Demo tracks/i);
  assert.match(catalogueData, /Melting Snowman/);
  assert.match(catalogueData, /5:32pm/);
  assert.match(catalogueData, /Blue and Green/);
  assert.match(catalogueData, /Drifting away/);
  assert.match(catalogueData, /spotifyId/);
  assert.doesNotMatch(catalogueData, /EL-CAT-/);
  assert.match(creators, /creator-youtube-card\.webp/i);
  assert.match(creators, /creator-audio-editor\.webp/i);
  assert.match(creators, /className="offer-hero offer-hero-creators"[\s\S]*?<\/section>\s*<section className="offer-curation"/);
  assert.match(business, /className="offer-hero offer-hero-business"[\s\S]*?<\/section>\s*<section className="offer-curation offer-curation-reverse business-curation"/);
  assert.doesNotMatch(creators, /creator-piano-human\.webp/i);
  assert.match(creators, /creator-streamer-card\.webp/i);
  assert.match(creators, /creator-social-card\.webp/i);
  assert.match(creators, /creator-podcast-card\.webp/i);
  assert.doesNotMatch(creators, /creator-(?:piano|streamer|social|podcast)\.jpg/i);
  assert.match(offerCss, /\.creators-landing \.offer-use-grid article\s*\{[\s\S]{0,500}border-radius:\s*28px/);
  assert.match(offerCss, /\.creators-landing \.offer-use-grid article > img\s*\{[\s\S]{0,240}position:\s*absolute[\s\S]{0,240}height:\s*100%/);
  assert.match(offerCss, /\.creators-landing \.creator-platforms\s*\{[\s\S]{0,240}border-radius:\s*32px/);
  assert.match(offerCss, /\.creators-landing \.offer-curation figure\s*\{[\s\S]{0,120}height:\s*clamp\(420px, 50vw, 560px\);[\s\S]{0,80}min-height:\s*0;/);
  assert.match(offerCss, /V53: the first Creators story continues directly from the hero, full bleed\.[\s\S]{0,120}\.creators-landing \.offer-curation\s*\{[\s\S]{0,100}width:\s*100%;[\s\S]{0,100}margin:\s*0 0 clamp\(84px, 8vw, 112px\);[\s\S]{0,100}border:\s*0;[\s\S]{0,100}border-radius:\s*0;[\s\S]{0,100}box-shadow:\s*none;/);
  assert.match(offerCss, /V54: the first Business story continues directly from the hero, full bleed\.[\s\S]{0,120}\.business-landing \.business-curation\s*\{[\s\S]{0,100}width:\s*100%;[\s\S]{0,100}margin:\s*0 0 clamp\(82px, 8vw, 108px\);[\s\S]{0,100}border:\s*0;[\s\S]{0,100}border-radius:\s*0;[\s\S]{0,100}box-shadow:\s*none;/);
  assert.match(offerCss, /V55: a cinematic visual pause for the commercial licensing process\.[\s\S]{0,420}\.business-landing \.business-flow::before\s*\{[\s\S]{0,220}business-process-blur\.webp/);
  assert.match(offerCss, /\.business-landing \.business-flow \.offer-section-head\s*\{[\s\S]{0,180}text-align:\s*center/);
  assert.match(offerCss, /\.business-landing \.business-flow \.offer-section-head h2\s*\{[\s\S]{0,180}color:\s*var\(--marketing-paper\);[\s\S]{0,100}font-size:\s*clamp\(54px, 6vw, 92px\)/);
  assert.match(offerCss, /\.business-landing \.business-flow \.offer-flow-grid article\s*\{[\s\S]{0,260}background:\s*linear-gradient/);
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
    access(new URL("public/images/unsplash/food-hospitality.jpg", root)),
    access(new URL("public/images/unsplash/music-header.jpg", root)),
    access(new URL("public/images/unsplash/podcast-home.jpg", root)),
    access(new URL("public/images/unsplash/study.jpg", root)),
    access(new URL("public/images/unsplash/filmmaker-desk.jpg", root)),
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

test("uses the eucalyptus accent instead of the retired brown UI palette", async () => {
  const publicStyles = [
    "app/globals.css",
    "app/home-v6.css",
    "app/home-v26.css",
    "app/offer-pages.css",
    "app/catalog-v26.css",
    "app/pricing-v39.css",
    "app/retail-v2.css",
  ];
  const styles = await Promise.all(publicStyles.map(source));
  const retiredBrown =
    /#(?:b97864|ad705f|855246|955a49|dec4b7|d6a896|e4b5a3|c98d7d|8e5546|8d5344|e5b9aa|dcae9d|deb09f|c98f7d|8b5e52|f2c7b5)\b|rgba?\(\s*(?:185\s*,\s*120\s*,\s*100|173\s*,\s*112\s*,\s*95|149\s*,\s*90\s*,\s*73)\b/i;

  for (const [index, css] of styles.entries()) {
    assert.doesNotMatch(css, retiredBrown, publicStyles[index]);
  }

  const combined = styles.join("\n");
  assert.match(combined, /#2f665e/i, "solid eucalyptus accent");
  assert.match(combined, /#234f4a/i, "deep eucalyptus text accent");
  assert.match(combined, /#9ed4c7/i, "light eucalyptus accent on navy");
  assert.match(combined, /#dceae5/i, "eucalyptus wash");

  const [catalogueData, workspaceCss] = await Promise.all([
    source("app/data/catalog.ts"),
    source("app/workspace-music.css"),
  ]);
  assert.doesNotMatch(catalogueData, /#b97864/i, "playlist buttons should not restore the old brand brown");
  assert.match(workspaceCss, /--wm-clay:#2f665e; --wm-clay-deep:#234f4a; --wm-clay-soft:#9ed4c7/i);
});

test("keeps the connected workspace readable and artist-led", async () => {
  const [layout, workspaceCss, musicWorkspace, musicWorkspaceCss, catalogueData] = await Promise.all([
    source("app/layout.tsx"),
    source("app/workspace-v2.css"),
    source("app/components/CreatorWorkspace.tsx"),
    source("app/workspace-music.css"),
    source("app/data/catalog.ts"),
  ]);

  assert.match(layout, /workspace-v2\.css/);
  assert.match(workspaceCss, /studio-artist\.jpg/);
  assert.match(workspaceCss, /font-size:\s*36px/);
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

  for (const [title, spotifyId, image] of [
    ["Lofi Study", "0vvXsWCC9xrXsKd4FyS8kM", "lofi-study.jpg"],
    ["Synthwave Night", "1YIe34rcmLjCYpY9wJoM2p", "synthwave-night.jpg"],
    ["Peaceful Piano", "1u4F50HA53L3Jwxbnk9IeO", "peaceful-piano.jpg"],
    ["Dark Ambient", "07lYUEyTkWP3NqIa7Kzyqx", "dark-ambient-fog.jpg"],
    ["Jazz Lofi", "6abvvGTDj4WuFRNDMsHsw8", "jazz-lofi-saxophone.jpg"],
    ["Chill House", "4lqntZDCCDC5ySCz9Y5eJn", "chill-house.jpg"],
    ["Sleep Ambient", "4AITFDgLpIPPLYmFIKgsvr", "sleep-ambient-bedside.jpg"],
    ["Chill Guitar", "1NvyHldjNnayEvqpyk3AYr", "chill-guitar.jpg"],
  ]) {
    assert.match(catalogueData, new RegExp(title), title);
    assert.match(catalogueData, new RegExp(spotifyId), spotifyId);
    await access(new URL(`public/images/unsplash/playlists/${image}`, root));
  }
  await access(new URL("public/images/unsplash/playlists/SOURCES.md", root));
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
});

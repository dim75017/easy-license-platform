import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("contains the focused Easy License brand gateway", async () => {
  const [page, layout, css, homeCss, cozyCss, offerCss, packageJson] = await Promise.all([
    source("app/page.tsx"),
    source("app/layout.tsx"),
    source("app/globals.css"),
    source("app/home-v5.css"),
    source("app/home-v6.css"),
    source("app/offer-pages.css"),
    source("package.json"),
  ]);

  assert.match(page, /Human-made music\.[\s\S]*Curated to belong\./i);
  assert.match(layout, /Powered by Lofi Girl/i);
  assert.match(page, /selected by music professionals for quality, consistency and real-world use/i);
  assert.match(page, /Two offers\.[\s\S]*Two clear places to start\./i);
  assert.match(page, /EASY LICENSE FOR CREATORS/i);
  assert.match(page, /EASY LICENSE FOR BUSINESS/i);
  assert.match(page, /href="\/creators"/i);
  assert.match(page, /href="\/business"/i);
  assert.match(page, /Not an upload dump\.[\s\S]*A catalogue with a point of view\./i);
  assert.match(page, /Artists are credited and paid directly and fairly/i);
  assert.doesNotMatch(page, /PricingCards|CatalogueExplorer|v5-offer-group|offer-faq/i);
  assert.doesNotMatch(page, /Custom quote|Per project|EL \/ CREATOR|EL \/ BUSINESS/i);
  assert.doesNotMatch(page, /Music for Business/i);
  assert.match(page, /10,000\+[\s\S]*Human-made tracks/i);
  assert.match(page, /0[\s\S]*AI-generated tracks/i);
  assert.match(page, /1,000\+[\s\S]*Artists worldwide/i);
  assert.doesNotMatch(page, /Genre families/i);
  assert.match(layout, /Easy License — 10,000\+ human-made tracks/);
  assert.match(layout, /offer-pages\.css/);
  assert.match(layout, /themeColor:\s*"#f3ece0"/i);
  assert.match(layout, /colorScheme:\s*"light"/i);
  assert.match(css, /--bg:\s*#07080d/i);
  assert.match(homeCss, /--v5-blue:\s*#514cff/i);
  assert.match(cozyCss, /--cozy-night:\s*#292832/i);
  assert.match(cozyCss, /--cozy-oat:\s*#f3ece0/i);
  assert.match(cozyCss, /hero-producer\.jpg/);
  assert.match(cozyCss, /campaign-filmset\.jpg/);
  assert.match(cozyCss, /retail\/spa\.jpg/);
  assert.match(offerCss, /\.gateway-page/);
  assert.match(offerCss, /\.creators-landing/);
  assert.match(offerCss, /\.business-landing/);
  assert.match(offerCss, /offer-hero-creators/);
  assert.match(offerCss, /offer-hero-business/);
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.doesNotMatch(page, /codex-preview|SkeletonPreview|Your site is taking shape/i);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});

test("defines every public and connected product surface", async () => {
  const routes = [
    ["app/creators/page.tsx", /Make every upload/i],
    ["app/business/page.tsx", /curated for work that matters/i],
    ["app/catalog/page.tsx", /Find the right feeling/i],
    ["app/pricing/page.tsx", /Two creator plans/i],
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
  assert.match(creators, /Professionally curated/i);
  assert.match(creators, /<CatalogueExplorer compact \/>/i);
  assert.match(creators, /<PricingCards expanded \/>/i);
  assert.doesNotMatch(creators, /Commercial Sync|Custom Commission|Music for Retail/i);
  assert.match(business, /Commercial Sync/i);
  assert.match(business, /Custom Commission/i);
  assert.match(business, /Music for Retail · Coming soon/i);
  assert.match(business, /By music professionals/i);
  assert.doesNotMatch(business, /Creator &amp; Pro|€6\.67|€16\.67/i);
  assert.match(pricing, /Easy License for Creators/i);
  assert.doesNotMatch(pricing, /<strong>Business<\/strong>|data-label="Business"/i);
  assert.doesNotMatch(pricingCards, /EL–03 \/ BUSINESS/i);
  assert.match(retail, /Music for Retail — Coming soon/i);
  assert.doesNotMatch(retail, /Music for Business/i);
  assert.match(sync, /Easy License for Business/i);
});

test("ships progressive, accessible motion without an animation dependency", async () => {
  const [page, shell, motion, css, homeCss, cozyCss, booth, packageJson] = await Promise.all([
    source("app/page.tsx"),
    source("app/components/PublicShell.tsx"),
    source("app/components/MotionLayer.tsx"),
    source("app/globals.css"),
    source("app/home-v5.css"),
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
  assert.match(homeCss, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(cozyCss, /animation:\s*none\s*!important/);
  assert.doesNotMatch(packageJson, /framer-motion|gsap/);
});

test("ships the cozy Lofi Girl identity, focused navigation and real artist profiles", async () => {
  const [css, homeCss, cozyCss, layout, brand, header, catalogue, catalogueData, page, business, booth] = await Promise.all([
    source("app/globals.css"),
    source("app/home-v5.css"),
    source("app/home-v6.css"),
    source("app/layout.tsx"),
    source("app/components/Brand.tsx"),
    source("app/components/SiteHeader.tsx"),
    source("app/components/CatalogueExplorer.tsx"),
    source("app/data/catalog.ts"),
    source("app/page.tsx"),
    source("app/business/page.tsx"),
    source("app/components/LicenseBooth.tsx"),
  ]);

  assert.match(css, /font-family:\s*"Unbounded"/);
  assert.match(css, /font-family:\s*"Afacad Flux"/);
  assert.match(css, /unbounded-var-latin\.woff2/);
  assert.match(css, /afacad-flux-var-latin\.woff2/);
  assert.match(homeCss, /Easy License V5 — the licensing signal router/);
  assert.match(homeCss, /\.v5-booth/);
  assert.match(homeCss, /clip-path:/);
  assert.match(cozyCss, /Easy License V6 — warm, quiet and recognisably Lofi Girl/);
  assert.match(cozyCss, /--font-display:\s*"Afacad Flux"/);
  assert.match(cozyCss, /\.el-v6 \.v5-booth::before[\s\S]*display:\s*none/);
  assert.doesNotMatch(css, /font-family:\s*"Newsreader"|font-family:\s*"IBM Plex Sans"/);
  assert.match(brand, /className="brand-accent">license<\/span>/);
  assert.match(header, /Log in/);
  assert.match(header, /Create account/);
  assert.match(header, /For Creators/);
  assert.match(header, /For Businesses/);
  assert.doesNotMatch(header, /href: "\/catalog", label: "Music"/);
  assert.match(header, /href:\s*"\/creators"/);
  assert.match(header, /href:\s*"\/business"/);
  assert.doesNotMatch(header, /\/#creators|\/#business/);
  assert.match(header, /Start a brief/);
  assert.match(header, /mobile-account-actions/);
  assert.match(header, /aria-controls="site-navigation"/);
  assert.doesNotMatch(header, /label: "Sync"|label: "Music for Business"|label: "Pricing"/);
  assert.doesNotMatch(header, /Admin \/ demo|Licence workspace/);
  assert.match(catalogue, /EL-CAT-/);
  assert.match(catalogue, /featured-track/);
  assert.match(catalogueData, /Melting Snowman/);
  assert.match(catalogueData, /Drifting away/);
  assert.match(page, /Selected by professionals\.[\s\S]*Created by people\./i);
  assert.match(page, /\/artists\/charlee\.jpg/);
  assert.match(business, /\/artists\/dario-lessing\.jpg/);
  assert.match(booth, /My channel/);
  assert.match(layout, /openGraph/);
  assert.match(layout, /og\.png/);
  await Promise.all([
    access(new URL("public/fonts/unbounded-var-latin.woff2", root)),
    access(new URL("public/fonts/afacad-flux-var-latin.woff2", root)),
    access(new URL("public/og.png", root)),
    access(new URL("public/artists/charlee.jpg", root)),
    access(new URL("public/artists/dario-lessing.jpg", root)),
    access(new URL("public/artists/mujo.jpg", root)),
    access(new URL("public/artists/project-aer.jpg", root)),
    access(new URL("public/artists/amies.jpg", root)),
    access(new URL("public/artists/meadow.jpg", root)),
    access(new URL("public/images/stock/vinyl-turntable.jpg", root)),
    access(new URL("public/images/stock/studio-artist.jpg", root)),
    access(new URL("public/images/stock/cozy-workspace.jpg", root)),
    access(new URL("public/images/stock/ATTRIBUTION.md", root)),
    access(new URL("public/images/unsplash/creator-edit.jpg", root)),
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
    access(new URL("public/images/catalogue/melting-snowman.jpg", root)),
    access(new URL("public/images/catalogue/532pm.jpg", root)),
    access(new URL("public/images/catalogue/blue-and-green.jpg", root)),
    access(new URL("public/images/catalogue/drifting-away.jpg", root)),
  ]);
});

test("keeps the connected workspace readable and artist-led", async () => {
  const [layout, workspaceCss] = await Promise.all([
    source("app/layout.tsx"),
    source("app/workspace-v2.css"),
  ]);

  assert.match(layout, /workspace-v2\.css/);
  assert.match(workspaceCss, /studio-artist\.jpg/);
  assert.match(workspaceCss, /font-size:\s*36px/);
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

import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("contains the finished Easy License landing experience", async () => {
  const [page, layout, css, packageJson] = await Promise.all([
    source("app/page.tsx"),
    source("app/layout.tsx"),
    source("app/globals.css"),
    source("package.json"),
  ]);

  assert.match(page, /License music\./);
  assert.match(page, /Powered by Lofi Girl/i);
  assert.match(page, /For creators/i);
  assert.match(page, /Sync & custom music/i);
  assert.match(page, /Music for spaces/i);
  assert.match(layout, /Easy License — Music licensing made simple/);
  assert.match(css, /--bg:\s*#07080d/i);
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.doesNotMatch(page, /codex-preview|SkeletonPreview|Your site is taking shape/i);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});

test("defines every public and connected product surface", async () => {
  const routes = [
    ["app/catalog/page.tsx", /Find the right feeling/i],
    ["app/pricing/page.tsx", /One clear plan/i],
    ["app/sync/page.tsx", /One brief/i],
    ["app/retail/page.tsx", /Give every space/i],
    ["app/app/page.tsx", /CreatorWorkspace/],
    ["app/admin/page.tsx", /AdminWorkspace/],
  ];

  for (const [path, expected] of routes) {
    assert.match(await source(path), expected, path);
  }
});

test("ships progressive, accessible motion without an animation dependency", async () => {
  const [page, shell, motion, css, packageJson] = await Promise.all([
    source("app/page.tsx"),
    source("app/components/PublicShell.tsx"),
    source("app/components/MotionLayer.tsx"),
    source("app/globals.css"),
    source("package.json"),
  ]);

  assert.match(page, /data-reveal="hero-title"/);
  assert.match(page, /data-pointer-glow/);
  assert.match(shell, /<MotionLayer/);
  assert.match(motion, /IntersectionObserver/);
  assert.match(motion, /requestAnimationFrame/);
  assert.match(motion, /prefers-reduced-motion/);
  assert.match(css, /\.motion-enhanced \[data-reveal\]/);
  assert.match(css, /@keyframes productScan/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(packageJson, /framer-motion|gsap/);
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

test("ships a constrained D1 lead schema and migration", async () => {
  const [schema, migration, hosting] = await Promise.all([
    source("db/schema.ts"),
    source("drizzle/0000_charming_boomerang.sql"),
    source(".openai/hosting.json"),
  ]);

  assert.match(schema, /leads_request_shape_check/);
  assert.match(schema, /idx_leads_created_at_id/);
  assert.match(migration, /CREATE TABLE `leads`/);
  assert.match(migration, /PRAGMA optimize/);
  assert.match(hosting, /"d1": "DB"/);
});

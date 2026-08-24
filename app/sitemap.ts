import type { MetadataRoute } from "next";
import { SITE_ORIGIN } from "./_lib/seo";

export const dynamic = "force-static";

const routes = [
  "/",
  "/catalog",
  "/creators",
  "/business",
  "/pricing",
  "/sync",
  "/retail",
  "/about",
  "/help",
  "/contact",
  "/legal",
  "/privacy",
  "/cookies",
  "/press",
  "/careers",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map((path) => ({
    url: new URL(path, SITE_ORIGIN).toString(),
    changeFrequency: path === "/catalog" ? "daily" : path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : path === "/catalog" ? 0.9 : 0.6,
  }));
}

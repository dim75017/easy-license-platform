import type { MetadataRoute } from "next";
import { SITE_ORIGIN } from "./_lib/seo";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/admin",
          "/app",
          "/create-account",
          "/signin-with-chatgpt",
          "/signout-with-chatgpt",
        ],
      },
    ],
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
    host: SITE_ORIGIN,
  };
}

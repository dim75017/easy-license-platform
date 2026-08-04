import type { NextConfig } from "next";

const isPagesBuild = process.env.BUILD_TARGET === "pages";
const pagesBasePath = process.env.PAGES_BASE_PATH ?? "/easy-license-platform";

const nextConfig: NextConfig = {
  ...(isPagesBuild
    ? {
        output: "export",
        basePath: pagesBasePath,
        trailingSlash: true,
        images: { unoptimized: true },
        // The public demo excludes the Cloudflare-only API before Next builds.
        // Vinext remains the type-authoritative production build.
        typescript: { ignoreBuildErrors: true },
      }
    : {}),
};

export default nextConfig;

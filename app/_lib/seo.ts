import type { Metadata } from "next";

export const SITE_ORIGIN = "https://easy-license.dsomoguy.chatgpt.site";
const OG_IMAGE = "/og.png";

export function pageMetadata(
  title: string,
  description: string,
  path: string,
): Metadata {
  const socialTitle = path === "/" ? title : `${title} — Symbiome`;
  return {
    title: path === "/" ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: "Symbiome",
      url: path,
      title: socialTitle,
      description,
      images: [
        {
          url: OG_IMAGE,
          width: 1732,
          height: 876,
          alt: "Symbiome human-made music catalogue",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description,
      images: [OG_IMAGE],
    },
  };
}

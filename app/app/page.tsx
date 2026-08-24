import type { Metadata } from "next";
import { CreatorWorkspace } from "../components/CreatorWorkspace";
import { requireCompletedSymbiomeProfile } from "../chatgpt-auth";

export const metadata: Metadata = { title: "Discover music", robots: { index: false, follow: false } };

export default async function CreatorAppPage() {
  if (process.env.BUILD_TARGET !== "pages") {
    await requireCompletedSymbiomeProfile("/app");
  }
  return <CreatorWorkspace />;
}

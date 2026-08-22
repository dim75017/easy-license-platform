import type { Metadata } from "next";
import { CreatorWorkspace } from "../../components/CreatorWorkspace";

export const metadata: Metadata = { title: "Business music library", robots: { index: false, follow: false } };

export default function BusinessAppPage() {
  return <CreatorWorkspace workspaceRole="business" />;
}

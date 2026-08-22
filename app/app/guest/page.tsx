import type { Metadata } from "next";
import { CreatorWorkspace } from "../../components/CreatorWorkspace";

export const metadata: Metadata = {
  title: "Browse music without an account",
  robots: { index: false, follow: false },
};

export default function GuestMusicPage() {
  return <CreatorWorkspace workspaceRole="guest" />;
}

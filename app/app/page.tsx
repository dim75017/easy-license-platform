import type { Metadata } from "next";
import { CreatorWorkspace } from "../components/CreatorWorkspace";

export const metadata: Metadata = { title: "Discover music", robots: { index: false, follow: false } };

export default function CreatorAppPage() { return <CreatorWorkspace />; }

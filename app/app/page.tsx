import type { Metadata } from "next";
import { CreatorWorkspace } from "../components/CreatorWorkspace";

export const metadata: Metadata = { title: "Music library", robots: { index: false, follow: false } };

export default function CreatorAppPage() { return <CreatorWorkspace />; }

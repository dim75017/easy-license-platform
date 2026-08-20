import type { Metadata } from "next";
import { AdminWorkspace } from "../components/AdminWorkspace";

export const metadata: Metadata = {
  title: "Admin analytics",
  description: "Protected aggregate analytics for Symbiome members, catalogue health and incoming requests.",
  robots: { index: false, follow: false },
};

export default function AdminPage() { return <AdminWorkspace />; }

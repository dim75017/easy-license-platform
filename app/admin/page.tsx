import type { Metadata } from "next";
import { AdminWorkspace } from "../components/AdminWorkspace";
import { requireSymbiomeAdmin } from "../chatgpt-auth";

export const metadata: Metadata = {
  title: "Admin analytics",
  description: "Protected aggregate analytics for Symbiome members, catalogue health and incoming requests.",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  if (process.env.BUILD_TARGET !== "pages") {
    await requireSymbiomeAdmin("/admin");
  }
  return <AdminWorkspace />;
}

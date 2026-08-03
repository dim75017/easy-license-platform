import type { Metadata } from "next";
import { AdminWorkspace } from "../components/AdminWorkspace";

export const metadata: Metadata = { title: "Admin CMS demo", robots: { index: false, follow: false } };

export default function AdminPage() { return <AdminWorkspace />; }

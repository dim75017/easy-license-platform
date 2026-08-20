import type { Metadata } from "next";
import { Suspense } from "react";
import { PublicShell } from "../components/PublicShell";
import { AccountSetup } from "../components/AccountSetup";

export const metadata: Metadata = {
  title: "Create your account",
  description:
    "Create your Symbiome account and set up the music workspace for your channels.",
  robots: { index: false, follow: false },
};

export default function CreateAccountPage() {
  return (
    <PublicShell>
      <Suspense fallback={null}>
        <AccountSetup />
      </Suspense>
    </PublicShell>
  );
}

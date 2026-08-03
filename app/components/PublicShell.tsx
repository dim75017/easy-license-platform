import { MotionLayer } from "./MotionLayer";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";

export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="public-shell">
      <MotionLayer />
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
    </div>
  );
}

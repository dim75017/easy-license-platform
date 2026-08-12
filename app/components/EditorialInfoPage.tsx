import type { ReactNode } from "react";
import Link from "next/link";
import { PublicShell } from "./PublicShell";

export type EditorialAction = {
  label: ReactNode;
  ariaLabel?: string;
  href: string;
  external?: boolean;
  secondary?: boolean;
};

export type EditorialSection = {
  id: string;
  eyebrow: string;
  title: ReactNode;
  tocTitle?: ReactNode;
  content: ReactNode;
};

function ActionLink({ action }: { action: EditorialAction }) {
  const className = action.secondary ? "support-button support-button-secondary cta-swipe" : "support-button cta-swipe";
  if (action.external) {
    return <a className={className} href={action.href} target="_blank" rel="noreferrer" aria-label={action.ariaLabel}><span className="support-button-label">{action.label}</span><span aria-hidden="true">↗</span></a>;
  }
  return <Link className={className} href={action.href} aria-label={action.ariaLabel}><span className="support-button-label">{action.label}</span><span aria-hidden="true">→</span></Link>;
}

export function EditorialInfoPage({
  eyebrow,
  title,
  lead,
  actions = [],
  highlights = [],
  sections,
}: {
  eyebrow: string;
  title: ReactNode;
  lead: string;
  actions?: EditorialAction[];
  highlights?: Array<{ value: string; label: string }>;
  sections: EditorialSection[];
}) {
  return (
    <PublicShell>
      <article className="support-page">
        <header className="support-hero">
          <div className="support-hero-inner" data-reveal="group">
            <p className="support-kicker">{eyebrow}</p>
            <h1>{title}</h1>
            <p className="support-lead">{lead}</p>
            {actions.length > 0 && <div className="support-actions">{actions.map((action, index) => <ActionLink action={action} key={`${action.href}-${index}`} />)}</div>}
          </div>
        </header>

        {highlights.length > 0 && (
          <div className="support-highlights" aria-label="Key information">
            {highlights.map((item) => <div key={item.label}><strong>{item.value}</strong><span>{item.label}</span></div>)}
          </div>
        )}

        <div className="support-layout">
          <nav className="support-toc" aria-label={`${eyebrow} sections`}>
            <p>On this page</p>
            {sections.map((section, index) => <a href={`#${section.id}`} key={section.id}><span>{String(index + 1).padStart(2, "0")}</span><span className="support-toc-label">{section.tocTitle ?? section.title}</span></a>)}
          </nav>
          <div className="support-content">
            {sections.map((section, index) => (
              <section id={section.id} key={section.id}>
                <div className="support-section-title">
                  <p><span>{String(index + 1).padStart(2, "0")}</span>{section.eyebrow}</p>
                  <h2>{section.title}</h2>
                </div>
                <div className="support-section-body">{section.content}</div>
              </section>
            ))}
          </div>
        </div>
      </article>
    </PublicShell>
  );
}

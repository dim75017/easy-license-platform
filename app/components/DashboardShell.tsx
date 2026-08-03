"use client";

import Link from "next/link";
import { ReactNode } from "react";
import { Brand } from "./Brand";

export type DashboardItem = {
  id: string;
  icon: string;
  label: string;
  badge?: string;
};

export function DashboardShell({
  area,
  items,
  active,
  onChange,
  children,
}: {
  area: "client" | "admin";
  items: DashboardItem[];
  active: string;
  onChange: (id: string) => void;
  children: ReactNode;
}) {
  return (
    <div className={`dashboard-shell ${area}-shell`}>
      <aside className="dashboard-sidebar">
        <div className="dashboard-brand-row">
          <Brand compact />
          <span className={area === "admin" ? "area-pill area-admin" : "area-pill"}>{area}</span>
        </div>
        <nav className="dashboard-nav" aria-label={`${area} navigation`}>
          <span className="dashboard-nav-label">Workspace</span>
          {items.map((item) => (
            <button
              key={item.id}
              className={active === item.id ? "is-active" : ""}
              type="button"
              onClick={() => onChange(item.id)}
            >
              <span>{item.icon}</span>
              <strong>{item.label}</strong>
              {item.badge && <small>{item.badge}</small>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="prototype-note"><span>◉</span><p><strong>Interactive prototype</strong>Demo data only</p></div>
          <Link href="/">← Back to website</Link>
        </div>
      </aside>
      <section className="dashboard-main">
        {children}
      </section>
    </div>
  );
}

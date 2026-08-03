"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Brand } from "./Brand";

const navItems = [
  { href: "/pricing", label: "For creators" },
  { href: "/sync", label: "Sync & custom" },
  { href: "/retail", label: "For spaces" },
  { href: "/catalog", label: "Catalogue" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="site-header">
      <div className="prototype-bar"><span>Prototype preview</span><p>No music rights are granted through this demo.</p></div>
      <div className="site-header-inner">
        <Brand />
        <button
          className="nav-toggle"
          type="button"
          aria-label="Toggle navigation"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <span />
          <span />
        </button>
        <nav className={open ? "site-nav is-open" : "site-nav"} aria-label="Main navigation">
          {navItems.map((item) => (
            <Link
              className={pathname === item.href ? "is-active" : ""}
              href={item.href}
              key={item.href}
              onClick={() => setOpen(false)}
            >
              {item.label}
              {item.href === "/retail" && <span className="nav-soon">Soon</span>}
            </Link>
          ))}
        </nav>
        <div className="site-header-actions">
          <Link className="text-link" href="/admin">Admin</Link>
          <Link className="button button-small button-ghost" href="/app">Client area</Link>
        </div>
      </div>
    </header>
  );
}

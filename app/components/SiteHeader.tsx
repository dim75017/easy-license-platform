"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Brand } from "./Brand";

const navItems = [
  { href: "/catalog", label: "Music" },
  { href: "/creators", label: "For Creators" },
  { href: "/business", label: "For Businesses" },
  { href: "/pricing", label: "Pricing" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isBusinessSurface = ["/business", "/sync", "/retail"].includes(pathname);

  const isActive = (href: string) => {
    if (href === "/catalog") return pathname === "/catalog";
    if (href === "/creators") return pathname === "/creators";
    if (href === "/business") return isBusinessSurface;
    if (href === "/pricing") return pathname === "/pricing";
    return pathname === href;
  };

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Brand />
        <button
          className="nav-toggle"
          type="button"
          aria-label={open ? "Close navigation" : "Open navigation"}
          aria-expanded={open}
          aria-controls="site-navigation"
          onClick={() => setOpen((value) => !value)}
        >
          <span />
          <span />
        </button>
        <nav id="site-navigation" className={open ? "site-nav is-open" : "site-nav"} aria-label="Main navigation">
          {navItems.map((item, index) => (
            <Link
              className={isActive(item.href) ? "is-active" : ""}
              href={item.href}
              key={`${item.href}-${item.label}`}
              onClick={() => setOpen(false)}
            >
              <span className="nav-index">0{index + 1}</span>
              {item.label}
            </Link>
          ))}
          <div className="mobile-account-actions">
            <Link className="header-login" href="/app" onClick={() => setOpen(false)}>Log in</Link>
            <Link className="button button-small button-primary" href="/pricing" onClick={() => setOpen(false)}>Create account</Link>
          </div>
        </nav>
        <div className="site-header-actions">
          <Link className="header-login" href="/app">Log in</Link>
          <Link className="button button-small button-primary" href="/pricing">Create account</Link>
        </div>
      </div>
    </header>
  );
}

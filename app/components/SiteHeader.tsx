"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Brand } from "./Brand";

const navItems = [
  { href: "/catalog", label: "Music" },
  { href: "/creators", label: "For Creators" },
  { href: "/business", label: "For Business" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isBusinessSurface = ["/business", "/sync", "/retail"].includes(pathname);
  const accountHref = isBusinessSurface ? "/sync#brief" : "/creators#creator-plans";
  const accountLabel = isBusinessSurface ? "Start a brief" : "Create account";

  const isActive = (href: string) => {
    if (href === "/creators") return pathname === "/creators" || pathname === "/pricing";
    if (href === "/business") return isBusinessSurface;
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
            <Link className="button button-small button-primary" href={accountHref} onClick={() => setOpen(false)}>{accountLabel}</Link>
          </div>
        </nav>
        <div className="site-header-actions">
          <Link className="header-login" href="/app">Log in</Link>
          <Link className="button button-small button-primary" href={accountHref}>{accountLabel}</Link>
        </div>
      </div>
    </header>
  );
}

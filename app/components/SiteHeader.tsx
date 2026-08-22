"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { publicAccountSignOutHref } from "../_lib/public-account-auth";
import { Brand } from "./Brand";
import { WorkspaceProfileSwitcher } from "./WorkspaceProfileSwitcher";

const navItems = [
  { href: "/", label: "Home" },
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
    if (href === "/") return pathname === "/";
    if (href === "/catalog") return pathname === "/catalog";
    if (href === "/creators") return pathname === "/creators";
    if (href === "/business") return isBusinessSurface;
    if (href === "/pricing") return pathname === "/pricing";
    return pathname === href;
  };

  const navigateFromHeader = (href: string) => {
    setOpen(false);
    if (href !== pathname) {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }
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
        <div id="site-navigation" className={open ? "site-navigation-shell is-open" : "site-navigation-shell"}>
          <nav className="site-nav" aria-label="Main navigation">
            {navItems.map((item, index) => (
              <Link
                className={isActive(item.href) ? "is-active" : ""}
                href={item.href}
                key={`${item.href}-${item.label}`}
                onClick={() => navigateFromHeader(item.href)}
                scroll
              >
                <span className="nav-index">0{index + 1}</span>
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="site-header-actions">
            <a className="header-login" href={publicAccountSignOutHref("login")} onClick={() => setOpen(false)}>Log in</a>
            <a className="button button-small button-primary cta-swipe" href={publicAccountSignOutHref("create")} onClick={() => setOpen(false)}>Create account</a>
            <div className="public-profile-access">
              <WorkspaceProfileSwitcher activeRole={null} compact />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

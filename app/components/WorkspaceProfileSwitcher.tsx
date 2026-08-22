"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { publicAccountSignOutHref, publicGuestViewHref } from "../_lib/public-account-auth";

type WorkspaceRole = "guest" | "creator" | "business" | "admin";
type ProfileLibraryView = "channels" | "licences" | "license-song" | "custom-song";
type ProfileState = "loading" | "guest" | "authenticated";

type WorkspaceProfile = {
  displayName: string;
  email: string;
  plan: string | null;
  admin: boolean;
};

const isStaticDemo = process.env.NEXT_PUBLIC_STATIC_DEMO === "true";
const signOutHref = publicAccountSignOutHref("login");
const guestViewHref = publicGuestViewHref();

export function WorkspaceProfileSwitcher({
  activeRole,
  compact = false,
  activeLibraryView,
  onOpenLibraryView,
}: {
  activeRole?: WorkspaceRole | null;
  compact?: boolean;
  activeLibraryView?: ProfileLibraryView;
  onOpenLibraryView?: (view: ProfileLibraryView) => void;
}) {
  const [open, setOpen] = useState(false);
  const [profileState, setProfileState] = useState<ProfileState>(isStaticDemo ? "guest" : "loading");
  const [profile, setProfile] = useState<WorkspaceProfile | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isStaticDemo) return;
    const controller = new AbortController();
    fetch("/api/account/profile", {
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.status === 401) {
          setProfileState("guest");
          return;
        }
        if (!response.ok) throw new Error("profile_unavailable");
        const payload = (await response.json()) as {
          identity?: { email?: string; displayName?: string };
          profile?: { displayName?: string; plan?: string } | null;
          capabilities?: { admin?: boolean };
        };
        const email = payload.identity?.email?.trim() ?? "";
        const displayName = payload.profile?.displayName?.trim()
          || payload.identity?.displayName?.trim()
          || email.split("@")[0]
          || "Member";
        if (!email) throw new Error("invalid_profile_identity");
        setProfile({
          displayName,
          email,
          plan: payload.profile?.plan ?? null,
          admin: payload.capabilities?.admin === true,
        });
        setProfileState("authenticated");
      })
      .catch((error: unknown) => {
        if ((error as { name?: string }).name !== "AbortError") {
          setProfile(null);
          setProfileState("guest");
        }
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    const frame = window.requestAnimationFrame(() => {
      menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    });
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const closeMenu = () => setOpen(false);
  const displayName = profile?.displayName ?? (profileState === "loading" ? "Checking account" : "Guest listener");
  const accountLabel = profileState === "authenticated"
    ? profile?.admin
      ? "Administrator"
      : profile?.plan
        ? `${profile.plan.charAt(0).toUpperCase()}${profile.plan.slice(1)} plan`
        : "Member account"
    : profileState === "loading"
      ? "Loading profile"
      : "Signed out";
  const initials = profileState === "authenticated"
    ? displayName.split(/\s+/u).slice(0, 2).map((part) => part.charAt(0)).join("").toUpperCase()
    : "GU";

  function handleMenuKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const items = [...(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    if (items.length === 0) return;
    event.preventDefault();
    const currentIndex = items.indexOf(document.activeElement as HTMLElement);
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? items.length - 1
        : event.key === "ArrowDown"
          ? (currentIndex + 1 + items.length) % items.length
          : (currentIndex - 1 + items.length) % items.length;
    items[nextIndex]?.focus();
  }

  function handleLibraryMenuClick(event: ReactMouseEvent<HTMLAnchorElement>, nextView: ProfileLibraryView) {
    closeMenu();
    if (
      !onOpenLibraryView
      || event.button !== 0
      || event.metaKey
      || event.ctrlKey
      || event.shiftKey
      || event.altKey
    ) return;
    const shouldRestoreFocus = event.detail === 0;
    event.preventDefault();
    onOpenLibraryView(nextView);
    if (shouldRestoreFocus) window.requestAnimationFrame(() => buttonRef.current?.focus());
  }

  return (
    <div className={`music-profile-switcher${compact ? " is-compact" : ""}`} ref={rootRef}>
      <button
        className="music-app-account"
        type="button"
        aria-label={`Open profile and help for ${displayName}`}
        aria-haspopup="menu"
        aria-controls={compact ? "music-profile-menu-mobile" : "music-profile-menu-desktop"}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        ref={buttonRef}
      >
        <span aria-hidden="true">{initials || "ME"}</span>
        {!compact && <div><strong>{displayName}</strong><small>{accountLabel}</small></div>}
        <i aria-hidden="true">⌃</i>
      </button>

      {open && (
        <div
          className="music-profile-menu"
          id={compact ? "music-profile-menu-mobile" : "music-profile-menu-desktop"}
          role="menu"
          aria-label="Profile, account tools and workspace views"
          onKeyDown={handleMenuKeyDown}
          ref={menuRef}
        >
          <div className="music-profile-menu-account" role="none">
            <span aria-hidden="true">{initials || "ME"}</span>
            <div><strong>{displayName}</strong><small>{profile?.email || accountLabel}</small></div>
          </div>
          <span className="music-profile-menu-label">CHOOSE A VIEW</span>
          <a className={activeRole === "guest" ? "is-active" : ""} href={guestViewHref} role="menuitem" aria-current={activeRole === "guest" ? "page" : undefined} onClick={closeMenu}>
            <i aria-hidden="true">○</i><span><strong>No account</strong><small>Public library as a guest</small></span>
          </a>
          <Link className={activeRole === "creator" ? "is-active" : ""} href="/app" role="menuitem" aria-current={activeRole === "creator" ? "page" : undefined} onClick={closeMenu}>
            <i aria-hidden="true">♫</i><span><strong>Creator</strong><small>Music library and licences</small></span>
          </Link>
          <Link className={activeRole === "business" ? "is-active" : ""} href="/app/business?view=music" role="menuitem" aria-current={activeRole === "business" ? "page" : undefined} onClick={closeMenu}>
            <i aria-hidden="true">◇</i><span><strong>Business</strong><small>Sync, custom music and retail</small></span>
          </Link>
          <Link className={activeRole === "admin" ? "is-active" : ""} href="/admin" role="menuitem" aria-current={activeRole === "admin" ? "page" : undefined} onClick={closeMenu}>
            <i aria-hidden="true">◎</i><span><strong>Admin</strong><small>{profile?.admin ? "Analytics access enabled" : "Secure sign-in required"}</small></span>
          </Link>
          <span className="music-profile-menu-divider" aria-hidden="true" />
          <span className="music-profile-menu-label">ACCOUNT &amp; HELP</span>
          {activeRole === "business" ? (
            <>
              <Link className={activeLibraryView === "license-song" ? "is-active" : ""} href="/app/business?view=license-song" role="menuitem" aria-current={activeLibraryView === "license-song" ? "page" : undefined} onClick={(event) => handleLibraryMenuClick(event, "license-song")}>
                <i aria-hidden="true">◇</i><span><strong>License a song</strong><small>Usage rights and quote</small></span>
              </Link>
              <Link className={activeLibraryView === "custom-song" ? "is-active" : ""} href="/app/business?view=custom-song" role="menuitem" aria-current={activeLibraryView === "custom-song" ? "page" : undefined} onClick={(event) => handleLibraryMenuClick(event, "custom-song")}>
                <i aria-hidden="true">♫</i><span><strong>Request custom song</strong><small>Original music brief</small></span>
              </Link>
            </>
          ) : (
            <>
              <Link className={activeLibraryView === "licences" ? "is-active" : ""} href="/app?view=licences" role="menuitem" aria-current={activeLibraryView === "licences" ? "page" : undefined} onClick={(event) => handleLibraryMenuClick(event, "licences")}>
                <i aria-hidden="true">◇</i><span><strong>Licences</strong><small>Usage rights and coverage</small></span>
              </Link>
              <Link className={activeLibraryView === "channels" ? "is-active" : ""} href="/app?view=channels" role="menuitem" aria-current={activeLibraryView === "channels" ? "page" : undefined} onClick={(event) => handleLibraryMenuClick(event, "channels")}>
                <i aria-hidden="true">◉</i><span><strong>Channels</strong><small>Connected creator accounts</small></span>
              </Link>
            </>
          )}
          <Link href="/help" role="menuitem" onClick={closeMenu}>
            <i aria-hidden="true">?</i><span><strong>Help centre</strong><small>Guides, licensing and support</small></span>
          </Link>
          <span className="music-profile-menu-divider" aria-hidden="true" />
          {profileState === "authenticated" ? (
            <a className="music-profile-session-action" href={signOutHref} role="menuitem">Log out</a>
          ) : (
            <a className="music-profile-session-action" href={signOutHref} role="menuitem" onClick={closeMenu}>Log in</a>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DashboardShell } from "./DashboardShell";
import { WorkspaceProfileSwitcher } from "./WorkspaceProfileSwitcher";
import "../workspace-music.css";

type GroupCount = { key: string; count: number };
type Analytics = {
  generatedAt: string;
  members: {
    total: number;
    new7d: number;
    new30d: number;
    companyProfiles: number;
    marketingOptIns: number;
    byPlan: GroupCount[];
    byPlatform: GroupCount[];
    daily30d: Array<{ day: string; count: number }>;
  };
  catalogue: null | {
    totalTracks: number;
    publishedTracks: number;
    readyTracks: number;
    reviewTracks: number;
    hiddenTracks: number;
    rightsPending: number;
    rightsRestricted: number;
    aiPending: number;
    aiRejected: number;
    playableTracks: number;
    totalReleases: number;
    publishedReleases: number;
    tracksByStatus: GroupCount[];
    assetsByState: GroupCount[];
    ingestByStatus: GroupCount[];
  };
  leads: {
    total: number;
    sync: number;
    retail: number;
    open: number;
    new7d: number;
    byStatus: GroupCount[];
  };
};

type AdminState = "loading" | "ready" | "signed-out" | "forbidden" | "unconfigured" | "error" | "demo";
type AdminView = "overview" | "members" | "catalogue" | "leads";

const isStaticDemo = process.env.NEXT_PUBLIC_STATIC_DEMO === "true";
const secureAdminUrl = "https://easy-license.dsomoguy.chatgpt.site/admin";
const adminSignInHref = "/signin-with-chatgpt?return_to=%2Fadmin";

const baseItems = [
  { id: "overview", icon: "⌂", label: "Overview" },
  { id: "members", icon: "♙", label: "Members" },
  { id: "catalogue", icon: "♫", label: "Catalogue" },
  { id: "leads", icon: "◇", label: "Requests" },
] as const;

export function AdminWorkspace() {
  const [active, setActive] = useState<AdminView>("overview");
  const [state, setState] = useState<AdminState>(isStaticDemo ? "demo" : "loading");
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    if (isStaticDemo) return;
    const controller = new AbortController();
    fetch("/api/admin/analytics", {
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.status === 401) {
          setState("signed-out");
          return;
        }
        if (response.status === 403) {
          setState("forbidden");
          return;
        }
        if (response.status === 503) {
          setState("unconfigured");
          return;
        }
        if (!response.ok) throw new Error("admin_analytics_unavailable");
        const payload = (await response.json()) as Analytics;
        if (!validAnalytics(payload)) throw new Error("invalid_admin_analytics");
        setAnalytics(payload);
        setState("ready");
      })
      .catch((error: unknown) => {
        if ((error as { name?: string }).name !== "AbortError") setState("error");
      });
    return () => controller.abort();
  }, [retryNonce]);

  const items = useMemo(() => baseItems.map((item) => ({
    ...item,
    badge: analytics
      ? item.id === "members"
        ? formatCompact(analytics.members.total)
        : item.id === "catalogue"
          ? analytics.catalogue
            ? formatCompact(analytics.catalogue.publishedTracks)
            : undefined
          : item.id === "leads"
            ? formatCompact(analytics.leads.open)
            : undefined
      : undefined,
  })), [analytics]);

  return (
    <DashboardShell
      area="admin"
      items={items}
      active={active}
      onChange={(id) => setActive(id as AdminView)}
    >
      <header className="dashboard-topbar">
        <div>
          <span className="dashboard-overline">Symbiome operations</span>
          <h1>{items.find((item) => item.id === active)?.label ?? "Admin"}</h1>
        </div>
        <div className="dashboard-top-actions">
          {state === "ready" && <span className="admin-live-pill"><i /> Live D1 analytics</span>}
          <WorkspaceProfileSwitcher activeRole="admin" compact />
        </div>
      </header>

      <div className="dashboard-content admin-content admin-live-content">
        {state !== "ready" || !analytics ? (
          <AdminAccessState
            state={state}
            onRetry={() => {
              setAnalytics(null);
              setState("loading");
              setRetryNonce((value) => value + 1);
            }}
          />
        ) : (
          <>
            {active === "overview" && <AdminOverview analytics={analytics} />}
            {active === "members" && <MembersAnalytics analytics={analytics} />}
            {active === "catalogue" && <CatalogueAnalytics analytics={analytics} />}
            {active === "leads" && <LeadAnalytics analytics={analytics} />}
            <p className="admin-generated-at">Last calculated {formatDateTime(analytics.generatedAt)} · Aggregate data only</p>
          </>
        )}
      </div>
    </DashboardShell>
  );
}

function AdminAccessState({ state, onRetry }: { state: AdminState; onRetry: () => void }) {
  const content = state === "demo"
    ? { eyebrow: "SECURE ADMIN", title: "Open Admin on the live app.", copy: "GitHub Pages never embeds member analytics. Continue to the secure Symbiome app to authenticate and view live aggregates." }
    : state === "signed-out"
      ? { eyebrow: "SIGN IN REQUIRED", title: "Admin analytics are protected.", copy: "Sign in with the catalogue-owner account. Secure authentication and the server allowlist are checked before any database query runs." }
      : state === "forbidden"
        ? { eyebrow: "ACCESS DENIED", title: "This account is not an administrator.", copy: "The selected workspace view never grants access. Only the explicit server-side administrator allowlist can unlock these analytics." }
        : state === "unconfigured"
          ? { eyebrow: "SETUP REQUIRED", title: "Admin access is not configured.", copy: "The deployment has no administrator allowlist, so the analytics endpoint has failed closed." }
          : state === "error"
            ? { eyebrow: "TEMPORARILY UNAVAILABLE", title: "The analytics could not be loaded.", copy: "No placeholder number is shown. Retry the live database request when the service is available." }
            : { eyebrow: "LIVE ANALYTICS", title: "Loading the real numbers…", copy: "Members, catalogue health and requests are being calculated from D1." };

  return (
    <section className="admin-access-state" aria-live="polite">
      <span>{content.eyebrow}</span>
      <h2>{content.title}</h2>
      <p>{content.copy}</p>
      <div>
        {state === "demo" && <a className="button button-primary cta-swipe" href={secureAdminUrl}>Open secure Admin</a>}
        {state === "signed-out" && <a className="button button-primary cta-swipe" href={adminSignInHref}>Choose a sign-in method</a>}
        {state === "error" && <button className="button button-primary cta-swipe" type="button" onClick={onRetry}>Retry analytics</button>}
        {(state === "forbidden" || state === "unconfigured") && <Link className="button button-ghost" href="/app">Return to Creator view</Link>}
      </div>
      {state === "loading" && <span className="admin-analytics-loader" aria-hidden="true" />}
    </section>
  );
}

function AdminOverview({ analytics }: { analytics: Analytics }) {
  const catalogue = analytics.catalogue;
  return (
    <>
      <section className="admin-live-intro">
        <div><span>REAL OPERATING DATA</span><h2>One view across members, music and incoming requests.</h2><p>No estimated revenue, fake customer activity or invented licences. Every number below is calculated from the production database.</p></div>
        <Link className="button button-primary cta-swipe" href="/app">Open the library</Link>
      </section>
      <div className="metric-grid admin-live-metrics">
        <Metric icon="♙" label="Members" value={analytics.members.total} note={`+${analytics.members.new30d} in 30 days`} tone="violet" />
        <Metric icon="↗" label="New this week" value={analytics.members.new7d} note="Completed profiles" tone="blue" />
        <Metric icon="♫" label="Published tracks" value={catalogue?.publishedTracks ?? null} note={catalogue ? `${catalogue.playableTracks} playable` : "Catalogue unavailable"} tone="green" />
        <Metric icon="◎" label="Published releases" value={catalogue?.publishedReleases ?? null} note={catalogue ? `${catalogue.totalReleases} total releases` : "Catalogue unavailable"} tone="amber" />
        <Metric icon="◇" label="Open requests" value={analytics.leads.open} note={`+${analytics.leads.new7d} this week`} tone="pink" />
      </div>
      <div className="admin-live-grid">
        <section className="dashboard-panel admin-chart-panel">
          <PanelHeading eyebrow="MEMBER GROWTH" title="New profiles · 30 days" />
          <DailyBars rows={analytics.members.daily30d} />
        </section>
        <section className="dashboard-panel">
          <PanelHeading eyebrow="ACCOUNT MIX" title="Plans and platforms" />
          <Breakdown title="Plan preference" rows={analytics.members.byPlan} total={analytics.members.total} />
          <Breakdown title="Primary platform" rows={analytics.members.byPlatform} total={analytics.members.total} />
        </section>
        <section className="dashboard-panel">
          <PanelHeading eyebrow="CATALOGUE HEALTH" title="Publication readiness" />
          {catalogue ? <StatusGrid rows={[
            { label: "Playable", value: catalogue.playableTracks },
            { label: "Ready", value: catalogue.readyTracks },
            { label: "Needs review", value: catalogue.reviewTracks },
            { label: "Rights pending", value: catalogue.rightsPending },
            { label: "AI review pending", value: catalogue.aiPending },
            { label: "Restricted / rejected", value: catalogue.rightsRestricted + catalogue.aiRejected },
          ]} /> : <UnavailableSection />}
        </section>
        <section className="dashboard-panel">
          <PanelHeading eyebrow="COMMERCIAL INTAKE" title="Real requests" />
          <StatusGrid rows={[
            { label: "All requests", value: analytics.leads.total },
            { label: "Open", value: analytics.leads.open },
            { label: "Sync", value: analytics.leads.sync },
            { label: "Retail", value: analytics.leads.retail },
          ]} />
        </section>
      </div>
    </>
  );
}

function MembersAnalytics({ analytics }: { analytics: Analytics }) {
  const members = analytics.members;
  return (
    <section className="admin-live-section">
      <header><span>MEMBER ANALYTICS</span><h2>{members.total.toLocaleString("en-US")} completed profiles</h2><p>Onboarding and declared account preferences. This is not a count of paid or active subscriptions.</p></header>
      <div className="admin-live-summary-grid">
        <Metric icon="7" label="New · 7 days" value={members.new7d} note="Profiles created" tone="blue" />
        <Metric icon="30" label="New · 30 days" value={members.new30d} note="Profiles created" tone="violet" />
        <Metric icon="⌂" label="Company profiles" value={members.companyProfiles} note={percentage(members.companyProfiles, members.total)} tone="amber" />
        <Metric icon="✉" label="Marketing opt-ins" value={members.marketingOptIns} note={percentage(members.marketingOptIns, members.total)} tone="green" />
      </div>
      <div className="admin-live-grid">
        <section className="dashboard-panel admin-chart-panel"><PanelHeading eyebrow="GROWTH" title="Daily sign-ups" /><DailyBars rows={members.daily30d} /></section>
        <section className="dashboard-panel"><PanelHeading eyebrow="SEGMENTS" title="Declared setup" /><Breakdown title="Plan preference" rows={members.byPlan} total={members.total} /><Breakdown title="Primary platform" rows={members.byPlatform} total={members.total} /></section>
      </div>
    </section>
  );
}

function CatalogueAnalytics({ analytics }: { analytics: Analytics }) {
  const catalogue = analytics.catalogue;
  if (!catalogue) return <section className="admin-live-section"><header><span>CATALOGUE</span><h2>Catalogue analytics unavailable</h2><p>The member and lead sections remain live. No catalogue total is replaced with zero.</p></header><UnavailableSection /></section>;
  return (
    <section className="admin-live-section">
      <header><span>CATALOGUE ANALYTICS</span><h2>{catalogue.publishedTracks.toLocaleString("en-US")} published tracks</h2><p>{catalogue.playableTracks.toLocaleString("en-US")} have an available listening copy. Masters remain private.</p></header>
      <div className="admin-live-summary-grid">
        <Metric icon="♫" label="All track records" value={catalogue.totalTracks} note={`${catalogue.publishedTracks} published`} tone="violet" />
        <Metric icon="◎" label="Releases" value={catalogue.totalReleases} note={`${catalogue.publishedReleases} published`} tone="blue" />
        <Metric icon="◇" label="Rights attention" value={catalogue.rightsPending + catalogue.rightsRestricted} note={`${catalogue.rightsRestricted} restricted`} tone="amber" />
        <Metric icon="0" label="AI review attention" value={catalogue.aiPending + catalogue.aiRejected} note={`${catalogue.aiRejected} rejected`} tone="green" />
      </div>
      <div className="admin-live-grid admin-live-grid-three">
        <section className="dashboard-panel"><PanelHeading eyebrow="TRACKS" title="Status" /><Breakdown title="Track records" rows={catalogue.tracksByStatus} total={catalogue.totalTracks} /></section>
        <section className="dashboard-panel"><PanelHeading eyebrow="ASSETS" title="Storage state" /><Breakdown title="Assets by kind and state" rows={catalogue.assetsByState} total={sumRows(catalogue.assetsByState)} /></section>
        <section className="dashboard-panel"><PanelHeading eyebrow="PIPELINE" title="Ingestion backlog" /><Breakdown title="Items by status" rows={catalogue.ingestByStatus} total={sumRows(catalogue.ingestByStatus)} /></section>
      </div>
    </section>
  );
}

function LeadAnalytics({ analytics }: { analytics: Analytics }) {
  const leads = analytics.leads;
  return (
    <section className="admin-live-section">
      <header><span>REQUEST ANALYTICS</span><h2>{leads.open.toLocaleString("en-US")} open requests</h2><p>Aggregated Sync and Retail intake only. Names, emails and project descriptions are not exposed in this dashboard response.</p></header>
      <div className="admin-live-summary-grid">
        <Metric icon="◇" label="All requests" value={leads.total} note={`${leads.open} open`} tone="violet" />
        <Metric icon="S" label="Sync requests" value={leads.sync} note={percentage(leads.sync, leads.total, "requests")} tone="blue" />
        <Metric icon="R" label="Retail interest" value={leads.retail} note={percentage(leads.retail, leads.total, "requests")} tone="amber" />
        <Metric icon="7" label="New · 7 days" value={leads.new7d} note="Incoming requests" tone="green" />
      </div>
      <section className="dashboard-panel admin-status-panel"><PanelHeading eyebrow="WORKFLOW" title="Requests by status" /><Breakdown title="Current state" rows={leads.byStatus} total={leads.total} /></section>
    </section>
  );
}

function Metric({ icon, label, value, note, tone }: { icon: string; label: string; value: number | null; note: string; tone: string }) {
  return <article><span className={`metric-icon ${tone}`}>{icon}</span><p>{label}</p><strong>{value === null ? "—" : value.toLocaleString("en-US")}</strong><small>{note}</small></article>;
}

function PanelHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return <div className="panel-heading"><div><span>{eyebrow}</span><h3>{title}</h3></div></div>;
}

function DailyBars({ rows }: { rows: Array<{ day: string; count: number }> }) {
  const max = Math.max(1, ...rows.map((row) => row.count));
  if (rows.length === 0) return <div className="admin-empty-analytics"><strong>No profiles in the last 30 days</strong><span>The chart will populate from real sign-ups.</span></div>;
  return <div className="admin-daily-bars" role="img" aria-label={`${sumRows(rows.map((row) => ({ key: row.day, count: row.count })))} new profiles over the last 30 days`}>{rows.map((row) => <span key={row.day} title={`${row.day}: ${row.count}`}><i style={{ height: `${Math.max(5, (row.count / max) * 100)}%` }} /><small>{row.day.slice(5)}</small></span>)}</div>;
}

function Breakdown({ title, rows, total }: { title: string; rows: GroupCount[]; total: number }) {
  if (rows.length === 0) return <div className="admin-empty-analytics"><strong>{title}</strong><span>No data yet.</span></div>;
  return <div className="admin-breakdown"><h4>{title}</h4>{rows.map((row) => <div key={row.key}><span><strong>{humanLabel(row.key)}</strong><small>{row.count.toLocaleString("en-US")}</small></span><i><b style={{ width: `${Math.max(2, total ? (row.count / total) * 100 : 0)}%` }} /></i></div>)}</div>;
}

function StatusGrid({ rows }: { rows: Array<{ label: string; value: number }> }) {
  return <div className="admin-status-grid">{rows.map((row) => <div key={row.label}><span>{row.label}</span><strong>{row.value.toLocaleString("en-US")}</strong></div>)}</div>;
}

function UnavailableSection() {
  return <div className="admin-empty-analytics"><strong>Section unavailable</strong><span>The dashboard will not substitute missing data with a false zero.</span></div>;
}

function validAnalytics(value: unknown): value is Analytics {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const source = value as Partial<Analytics>;
  return typeof source.generatedAt === "string"
    && !!source.members
    && finiteCount(source.members.total)
    && Array.isArray(source.members.byPlan)
    && Array.isArray(source.members.byPlatform)
    && Array.isArray(source.members.daily30d)
    && !!source.leads
    && finiteCount(source.leads.total)
    && Array.isArray(source.leads.byStatus);
}

function finiteCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function sumRows(rows: GroupCount[]): number { return rows.reduce((sum, row) => sum + row.count, 0); }
function percentage(value: number, total: number, label = "members"): string { return total ? `${Math.round((value / total) * 100)}% of ${label}` : `No ${label} yet`; }
function formatCompact(value: number): string { return value > 999 ? `${Math.floor(value / 1000)}k+` : String(value); }
function humanLabel(value: string): string { return value.replace(/[_:]+/gu, " · ").replace(/\b\w/gu, (letter) => letter.toUpperCase()); }
function formatDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "just now" : date.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

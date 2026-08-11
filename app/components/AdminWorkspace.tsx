"use client";

import { useMemo, useState } from "react";
import { DashboardShell } from "./DashboardShell";

const items = [
  { id: "overview", icon: "⌂", label: "Overview" },
  { id: "customers", icon: "♙", label: "Customers", badge: "284" },
  { id: "rights", icon: "◇", label: "Rights queue", badge: "17" },
  { id: "sync", icon: "◎", label: "Sync pipeline", badge: "8" },
  { id: "catalogue", icon: "♫", label: "Catalogue" },
  { id: "retail", icon: "▦", label: "Retail waitlist", badge: "41" },
];

const rightsRequests = [
  { channel: "Studio Mornings", platform: "YouTube", plan: "Creator", submitted: "7 min ago", status: "New" },
  { channel: "Quiet Code", platform: "YouTube", plan: "Pro", submitted: "24 min ago", status: "Review" },
  { channel: "Focus Room Live", platform: "Twitch", plan: "Pro", submitted: "1 h ago", status: "Ready" },
  { channel: "The Daily Desk", platform: "Podcast", plan: "Pro", submitted: "3 h ago", status: "Needs info" },
  { channel: "Slow Sundays", platform: "YouTube", plan: "Creator", submitted: "Yesterday", status: "Ready" },
];

const customers = [
  { name: "Alex Morgan", channel: "Studio Mornings", plan: "Creator", status: "Active", joined: "03 Aug 2026" },
  { name: "Mina Park", channel: "Quiet Code", plan: "Pro", status: "Active", joined: "02 Aug 2026" },
  { name: "Jules Bernard", channel: "The Daily Desk", plan: "Pro", status: "Review", joined: "01 Aug 2026" },
  { name: "Sam Wilson", channel: "Slow Sundays", plan: "Creator", status: "Active", joined: "30 Jul 2026" },
  { name: "Nora Klein", channel: "Focus Room Live", plan: "Creator", status: "Past due", joined: "29 Jul 2026" },
];

const syncProjects = [
  { company: "Northstar Games", project: "Indie game soundtrack", lane: "Qualified", value: "€18–30k", color: "violet" },
  { company: "Maison Lune", project: "Global fragrance film", lane: "Rights check", value: "€40–60k", color: "blue" },
  { company: "Cloud Coffee", project: "Original sonic identity", lane: "Proposal", value: "€12–18k", color: "peach" },
  { company: "Sunday Studio", project: "Podcast theme package", lane: "New brief", value: "€5–8k", color: "mint" },
];

export function AdminWorkspace() {
  const [active, setActive] = useState("overview");
  const [rightsFilter, setRightsFilter] = useState("All");
  const [selectedProject, setSelectedProject] = useState(0);

  const filteredRights = useMemo(
    () => rightsFilter === "All" ? rightsRequests : rightsRequests.filter((request) => request.status === rightsFilter),
    [rightsFilter],
  );

  return (
    <DashboardShell area="admin" items={items} active={active} onChange={setActive}>
      <header className="dashboard-topbar">
        <div>
          <span className="dashboard-overline">Symbiose CMS</span>
          <h1>{items.find((item) => item.id === active)?.label}</h1>
        </div>
        <div className="dashboard-top-actions">
          <span className="demo-data-pill"><i /> Demo data</span>
          <button className="notification-button" type="button" aria-label="Notifications">◌<span>4</span></button>
          <div className="dashboard-user"><span className="user-avatar admin-avatar">SY</span><span><strong>Licensing team</strong><small>Administrator</small></span></div>
        </div>
      </header>

      <div className="dashboard-content admin-content">
        {active === "overview" && (
          <>
            <div className="welcome-row admin-welcome">
              <div><p>Monday, 3 August</p><h2>Here&apos;s what needs attention.</h2><span>A single view across subscriptions, rights and commercial projects.</span></div>
              <button className="button button-primary" type="button" onClick={() => setActive("rights")}>Review rights queue <span>17</span></button>
            </div>
            <div className="metric-grid admin-metrics">
              <article><span className="metric-icon violet">♙</span><p>Active customers</p><strong>267</strong><small className="positive">↑ 18 this month</small></article>
              <article><span className="metric-icon blue">€</span><p>Recurring revenue</p><strong>€2.85k</strong><small>Prototype MRR</small></article>
              <article><span className="metric-icon amber">◇</span><p>Rights queue</p><strong>17</strong><small className="warning">5 need attention</small></article>
              <article><span className="metric-icon pink">◎</span><p>Sync pipeline</p><strong>€124k</strong><small>8 open projects</small></article>
              <article><span className="metric-icon green">▦</span><p>Retail interest</p><strong>41</strong><small className="positive">12 new this week</small></article>
            </div>

            <div className="dashboard-two-columns admin-overview-grid">
              <section className="dashboard-panel">
                <div className="panel-heading"><div><span>RIGHTS OPERATIONS</span><h3>Latest channel requests</h3></div><button type="button" onClick={() => setActive("rights")}>Open queue →</button></div>
                <RightsTable rows={rightsRequests.slice(0, 4)} />
              </section>
              <section className="dashboard-panel pipeline-panel">
                <div className="panel-heading"><div><span>COMMERCIAL</span><h3>Sync pipeline</h3></div><button type="button" onClick={() => setActive("sync")}>All projects →</button></div>
                <div className="pipeline-summary"><div><span>Weighted pipeline</span><strong>€124,000</strong></div><div className="pipeline-bars"><i style={{ width: "46%" }} /><i style={{ width: "28%" }} /><i style={{ width: "18%" }} /><i style={{ width: "8%" }} /></div><div className="pipeline-legend"><span>New 4</span><span>Qualified 2</span><span>Proposal 1</span><span>Rights 1</span></div></div>
                <div className="mini-project-list">
                  {syncProjects.slice(0, 3).map((project) => <button type="button" key={project.company} onClick={() => setActive("sync")}><span className={`project-mark ${project.color}`}>{project.company.slice(0, 1)}</span><span><strong>{project.company}</strong><small>{project.project}</small></span><em>{project.value}</em><i>→</i></button>)}
                </div>
              </section>
            </div>

            <div className="dashboard-three-columns">
              <section className="dashboard-panel health-panel"><div className="panel-heading"><div><span>CATALOGUE HEALTH</span><h3>Rights readiness</h3></div><span className="status-pill status-live"><i /> Healthy</span></div><div className="health-ring"><div><strong>82%</strong><span>ready</span></div></div><div className="health-legend"><span><i className="ready" />Eligible <strong>6,560</strong></span><span><i className="review" />Review <strong>1,040</strong></span><span><i className="blocked" />Blocked <strong>400</strong></span></div><button type="button" onClick={() => setActive("catalogue")}>Open catalogue →</button></section>
              <section className="dashboard-panel activity-panel"><div className="panel-heading"><div><span>ACTIVITY</span><h3>Live operations</h3></div><span>Today</span></div><ul><li><i className="green" />Licence SY-0284 issued<span>4 min</span></li><li><i className="violet" />New Creator subscriber<span>12 min</span></li><li><i className="amber" />Rights check needs info<span>24 min</span></li><li><i className="blue" />Sync brief received<span>41 min</span></li><li><i className="green" />Channel marked ready<span>1 h</span></li></ul></section>
              <section className="dashboard-panel launch-panel"><div className="panel-heading"><div><span>LAUNCH READINESS</span><h3>Production checklist</h3></div><strong>5 / 9</strong></div><div className="launch-progress"><i /></div><ul><li className="done"><i>✓</i>Product prototype</li><li className="done"><i>✓</i>Creator pricing</li><li className="done"><i>✓</i>Sync intake</li><li><i>4</i>Final licence terms</li><li><i>5</i>Content ID architecture</li></ul></section>
            </div>
          </>
        )}

        {active === "rights" && (
          <section className="dashboard-panel detail-view">
            <div className="panel-heading"><div><span>CONTENT ID & CHANNELS</span><h3>Rights operations queue</h3></div><button className="button button-small button-primary" type="button">Export queue</button></div>
            <div className="filter-tabs">{["All", "New", "Review", "Ready", "Needs info"].map((filter) => <button type="button" className={rightsFilter === filter ? "is-active" : ""} onClick={() => setRightsFilter(filter)} key={filter}>{filter}</button>)}</div>
            <RightsTable rows={filteredRights} full />
            <div className="notice-card"><span>ⓘ</span><p><strong>Manual-first launch workflow</strong>Channel requests remain human-reviewed until a granular YouTube / Content Manager integration is approved and tested.</p></div>
          </section>
        )}

        {active === "customers" && (
          <section className="dashboard-panel detail-view">
            <div className="panel-heading"><div><span>ACCOUNTS</span><h3>Customers and subscriptions</h3></div><button className="button button-small button-primary" type="button">＋ Add customer</button></div>
            <label className="dashboard-search"><span>⌕</span><input placeholder="Search customer, channel or plan" /></label>
            <div className="admin-table customer-table"><div className="table-head"><span>Customer</span><span>Channel</span><span>Plan</span><span>Status</span><span>Joined</span><span /></div>{customers.map((customer) => <div className="table-row" key={customer.channel}><span data-label="Customer"><i>{customer.name.slice(0, 1)}</i><strong>{customer.name}</strong></span><span data-label="Channel">{customer.channel}</span><span data-label="Plan"><em>{customer.plan}</em></span><span data-label="Status"><StatusBadge status={customer.status} /></span><span data-label="Joined">{customer.joined}</span><button type="button">•••</button></div>)}</div>
          </section>
        )}

        {active === "sync" && (
          <section className="dashboard-panel detail-view">
            <div className="panel-heading"><div><span>BRANDS & PRODUCTIONS</span><h3>Sync and custom music pipeline</h3></div><button className="button button-small button-primary" type="button">＋ New opportunity</button></div>
            <div className="sync-workspace">
              <div className="sync-project-list">{syncProjects.map((project, index) => <button type="button" className={selectedProject === index ? "is-active" : ""} onClick={() => setSelectedProject(index)} key={project.company}><span className={`project-mark ${project.color}`}>{project.company.slice(0, 1)}</span><span><strong>{project.company}</strong><small>{project.project}</small></span><em>{project.lane}</em><i>{project.value}</i></button>)}</div>
              <div className="sync-project-detail"><span className="dashboard-overline">Selected opportunity</span><h2>{syncProjects[selectedProject].company}</h2><p>{syncProjects[selectedProject].project}</p><div className="project-detail-grid"><span><small>Stage</small><strong>{syncProjects[selectedProject].lane}</strong></span><span><small>Value</small><strong>{syncProjects[selectedProject].value}</strong></span><span><small>Music path</small><strong>{selectedProject === 1 ? "Existing catalogue" : "Custom music"}</strong></span><span><small>Owner</small><strong>Licensing team</strong></span></div><div className="project-timeline"><span className="done"><i>✓</i>Brief received</span><span className={selectedProject > 1 ? "" : "done"}><i>{selectedProject > 1 ? "2" : "✓"}</i>Qualified</span><span><i>3</i>Rights / creative</span><span><i>4</i>Agreement</span></div><button className="button button-ghost button-full" type="button">Open full project</button></div>
            </div>
          </section>
        )}

        {active === "catalogue" && <CatalogueAdmin />}
        {active === "retail" && (
          <section className="dashboard-panel detail-view">
            <div className="panel-heading"><div><span>EARLY ACCESS</span><h3>Music for Retail interest</h3></div><button className="button button-small button-primary" type="button">Export 41 leads</button></div>
            <div className="retail-kpis"><div><span>☕</span><strong>17</strong><small>Cafés & restaurants</small></div><div><span>▦</span><strong>11</strong><small>Retail stores</small></div><div><span>⌂</span><strong>8</strong><small>Hotels & offices</small></div><div><span>◎</span><strong>5</strong><small>Multi-location</small></div></div>
            <div className="notice-card"><span>↗</span><p><strong>Second-phase product</strong>Use this demand signal to validate pricing, public-performance rights and multi-location controls before development starts.</p></div>
          </section>
        )}
      </div>
    </DashboardShell>
  );
}

function StatusBadge({ status }: { status: string }) {
  const kind = status === "Active" || status === "Ready" ? "live" : status === "Past due" || status === "Needs info" ? "danger" : status === "Review" ? "waiting" : "neutral";
  return <span className={`status-pill status-${kind}`}><i />{status}</span>;
}

function RightsTable({ rows, full = false }: { rows: typeof rightsRequests; full?: boolean }) {
  return <div className={full ? "admin-table rights-table is-full" : "admin-table rights-table"}><div className="table-head"><span>Channel</span><span>Platform</span><span>Plan</span><span>Submitted</span><span>Status</span><span /></div>{rows.map((request) => <div className="table-row" key={request.channel}><span data-label="Channel"><i>▶</i><strong>{request.channel}</strong></span><span data-label="Platform">{request.platform}</span><span data-label="Plan"><em>{request.plan}</em></span><span data-label="Submitted">{request.submitted}</span><span data-label="Status"><StatusBadge status={request.status} /></span><button type="button" aria-label={`Open ${request.channel}`}>→</button></div>)}</div>;
}

function CatalogueAdmin() {
  const rows = [
    ["Window Seat", "Catalogue preview", "Creator + Pro", "Eligible", "Verified"],
    ["Soft Focus", "Catalogue preview", "Creator + Pro", "Review", "Pending"],
    ["After the Rain", "Catalogue preview", "Pro", "Eligible", "Verified"],
    ["Quiet Momentum", "Catalogue preview", "Creator + Pro", "Blocked", "Missing scope"],
    ["Corner Café", "Catalogue preview", "Creator + Pro", "Eligible", "Verified"],
  ];
  return <section className="dashboard-panel detail-view"><div className="panel-heading"><div><span>RIGHTS-CLEARED MUSIC</span><h3>Catalogue eligibility</h3></div><button className="button button-small button-primary" type="button">＋ Add track</button></div><div className="catalogue-admin-toolbar"><label className="dashboard-search"><span>⌕</span><input placeholder="Search 8,000 tracks" /></label><button type="button">All eligibility⌄</button><button type="button">All plans⌄</button></div><div className="admin-table catalogue-admin-table"><div className="table-head"><span>Track</span><span>Artist</span><span>Plans</span><span>Eligibility</span><span>Rights proof</span><span /></div>{rows.map((row, index) => <div className="table-row" key={row[0]}><span data-label="Track"><i className={`catalogue-dot dot-${index}`}>♫</i><strong>{row[0]}</strong></span><span data-label="Artist">{row[1]}</span><span data-label="Plans"><em>{row[2]}</em></span><span data-label="Eligibility"><StatusBadge status={row[3]} /></span><span data-label="Rights proof">{row[4]}</span><button type="button">→</button></div>)}</div></section>;
}

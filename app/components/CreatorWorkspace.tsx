"use client";

import { useState } from "react";
import { DashboardShell } from "./DashboardShell";
import { tracks } from "../data/catalog";

const items = [
  { id: "overview", icon: "⌂", label: "Overview" },
  { id: "catalogue", icon: "♫", label: "Catalogue" },
  { id: "downloads", icon: "↓", label: "Downloads", badge: "4" },
  { id: "channels", icon: "▶", label: "Channels" },
  { id: "licences", icon: "◇", label: "Licences" },
];

export function CreatorWorkspace() {
  const [active, setActive] = useState("overview");
  const [copied, setCopied] = useState(false);
  const [channelConnected, setChannelConnected] = useState(true);

  async function copyCredit() {
    const credit = 'Music: "Window Seat"\nArtist: Catalogue preview\nLicensed via Easy License';
    try {
      await navigator.clipboard.writeText(credit);
    } catch {
      // Clipboard can be unavailable in embedded previews; the UI remains demonstrative.
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <DashboardShell area="client" items={items} active={active} onChange={setActive}>
      <header className="dashboard-topbar">
        <div>
          <span className="dashboard-overline">Creator workspace</span>
          <h1>{items.find((item) => item.id === active)?.label}</h1>
        </div>
        <div className="dashboard-user">
          <span className="notification-dot">2</span>
          <span className="user-avatar">DM</span>
          <span><strong>Demo creator</strong><small>Creator plan</small></span>
        </div>
      </header>

      <div className="dashboard-content">
        {active === "overview" && (
          <>
            <div className="welcome-row">
              <div><p>Made by real artists</p><h2>Ready for your next upload.</h2><span>Your music, your rights and your proof of licence in one calm place.</span></div>
              <button className="button button-primary" type="button" onClick={() => setActive("catalogue")}>Browse catalogue</button>
            </div>
            <div className="metric-grid creator-metrics">
              <article><span className="metric-icon violet">✦</span><p>Current plan</p><strong>Creator</strong><small>€7.99 / month</small></article>
              <article><span className="metric-icon green">▶</span><p>Connected channels</p><strong>{channelConnected ? "1 / 1" : "0 / 1"}</strong><small className={channelConnected ? "positive" : "warning"}>{channelConnected ? "Connection verified" : "Action needed"}</small></article>
              <article><span className="metric-icon blue">↓</span><p>Downloads</p><strong>26</strong><small>This billing period</small></article>
              <article><span className="metric-icon amber">◇</span><p>Licence</p><strong>Active</strong><small>Renews 08 Sep 2026</small></article>
            </div>

            <div className="dashboard-two-columns">
              <section className="dashboard-panel">
                <div className="panel-heading"><div><span>RECENTLY ADDED</span><h3>Fresh for your next video</h3></div><button type="button" onClick={() => setActive("catalogue")}>View all →</button></div>
                <div className="compact-track-list">
                  {tracks.slice(0, 4).map((track, index) => (
                    <div className={`compact-track accent-${track.accent}`} key={track.id}>
                      <button type="button" aria-label={`Play ${track.title}`}>▶</button>
                      <span><strong>{track.title}</strong><small>{track.mood} · {track.bpm} BPM</small></span>
                      {index < 2 && <em>New</em>}
                      <button type="button" aria-label={`Download ${track.title}`}>↓</button>
                    </div>
                  ))}
                </div>
              </section>
              <section className="dashboard-panel rights-panel">
                <div className="panel-heading"><div><span>RIGHTS CENTRE</span><h3>Ready to publish</h3></div><span className="status-pill status-live"><i /> Active</span></div>
                <div className="rights-orbit"><span>✓</span><i /><i /><i /></div>
                <p>Your declared channel and active plan are recorded in this prototype workspace.</p>
                <div className="rights-steps">
                  <span className="done"><i>✓</i>Plan active</span>
                  <span className="done"><i>✓</i>Channel verified</span>
                  <span><i>3</i>Rights workflow</span>
                </div>
                <button className="button button-ghost button-full" type="button" onClick={() => setActive("channels")}>View channel status</button>
              </section>
            </div>

            <section className="dashboard-panel attribution-panel">
              <div><span className="metric-icon pink">▣</span><div><span>ATTRIBUTION HELPER</span><h3>Credit the music in one click</h3><p>Optional where your licence allows it. Always appreciated by artists.</p></div></div>
              <code>Music: “Window Seat” · Licensed via Easy License</code>
              <button className={copied ? "button button-light is-success" : "button button-light"} type="button" onClick={copyCredit}>{copied ? "✓ Copied" : "Copy credit"}</button>
            </section>
          </>
        )}

        {active === "catalogue" && <WorkspaceCatalogue />}
        {active === "downloads" && <DownloadsView />}
        {active === "channels" && (
          <section className="dashboard-panel detail-view">
            <div className="panel-heading"><div><span>CHANNEL MANAGEMENT</span><h3>Your declared channels</h3></div><button className="button button-small button-primary" type="button" onClick={() => setChannelConnected(!channelConnected)}>{channelConnected ? "Disconnect demo" : "Connect demo channel"}</button></div>
            <div className="channel-card">
              <span className="channel-avatar">▶</span>
              <div><strong>Demo Creator Channel</strong><small>youtube.com/@demo-creator</small></div>
              <span className={channelConnected ? "status-pill status-live" : "status-pill status-waiting"}><i /> {channelConnected ? "Connected" : "Not connected"}</span>
              <button type="button">•••</button>
            </div>
            <div className="notice-card"><span>ⓘ</span><p><strong>Content ID operations are not live in this prototype.</strong>The production workflow depends on the final YouTube / Content Manager architecture and human review.</p></div>
          </section>
        )}
        {active === "licences" && (
          <section className="dashboard-panel detail-view">
            <div className="panel-heading"><div><span>DOCUMENTS</span><h3>Your licence centre</h3></div><span className="status-pill status-live"><i /> Up to date</span></div>
            <div className="licence-document">
              <span>◇</span><div><strong>Easy License · Creator</strong><small>EL-DEMO-2026-0001 · Active since 03 Aug 2026</small></div><button type="button">Preview</button><button type="button">↓ PDF</button>
            </div>
            <div className="licence-scope-grid">
              <div><small>Covered</small><strong>Own monetised content</strong></div>
              <div><small>Channels</small><strong>1 per platform</strong></div>
              <div><small>Territory</small><strong>Worldwide</strong></div>
              <div><small>Status</small><strong>Prototype terms</strong></div>
            </div>
          </section>
        )}
      </div>
    </DashboardShell>
  );
}

function WorkspaceCatalogue() {
  const [search, setSearch] = useState("");
  const visible = tracks.filter((track) => `${track.title} ${track.mood} ${track.use}`.toLowerCase().includes(search.toLowerCase()));
  return (
    <section className="dashboard-panel detail-view">
      <div className="panel-heading"><div><span>MUSIC DISCOVERY</span><h3>Find a track for the moment</h3></div><span className="status-pill status-neutral">{visible.length} previews</span></div>
      <label className="dashboard-search"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Try “dreamy study”" /></label>
      <div className="workspace-track-grid">
        {visible.map((track) => (
          <article className={`workspace-track accent-${track.accent}`} key={track.id}>
            <div className="workspace-cover"><button type="button" aria-label={`Play ${track.title}`}>▶</button><span>{track.mood}</span></div>
            <strong>{track.title}</strong><small>{track.artist}</small>
            <div><span>{track.bpm} BPM</span><button type="button">↓</button></div>
          </article>
        ))}
      </div>
    </section>
  );
}

function DownloadsView() {
  return (
    <section className="dashboard-panel detail-view">
      <div className="panel-heading"><div><span>YOUR LIBRARY</span><h3>Recent downloads</h3></div><button type="button">Export list ↓</button></div>
      <div className="download-table">
        {tracks.slice(0, 4).map((track, index) => (
          <div key={track.id}><span className={`download-art accent-${track.accent}`}>♫</span><span><strong>{track.title}</strong><small>{track.artist}</small></span><span>{track.mood}</span><span>{["Today", "Yesterday", "31 Jul", "29 Jul"][index]}</span><span>WAV + MP3</span><button type="button">•••</button></div>
        ))}
      </div>
    </section>
  );
}

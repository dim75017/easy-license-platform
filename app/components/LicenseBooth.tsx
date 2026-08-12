"use client";

import Link from "next/link";
import { useState } from "react";

const routes = [
  {
    id: "creator",
    tab: "My channel",
    code: "ROUTE / 01",
    plan: "Creator",
    price: "€7.99",
    cadence: "/ month",
    coverage: "1 channel · video + live",
    destination: "YouTube / Twitch",
    action: "Start with Creator",
    href: "/pricing",
    color: "acid",
  },
  {
    id: "pro",
    tab: "Client work",
    code: "ROUTE / 02",
    plan: "Pro",
    price: "€19.99",
    cadence: "/ month",
    coverage: "3 channels · client work",
    destination: "Social / podcast / web",
    action: "Choose Pro",
    href: "/pricing",
    color: "coral",
  },
  {
    id: "sync",
    tab: "Campaign",
    code: "ROUTE / 03",
    plan: "Sync",
    price: "Brief",
    cadence: "+ quote",
    coverage: "Existing or custom music",
    destination: "Brand / film / game",
    action: "Open a sync brief",
    href: "/sync",
    color: "blue",
  },
] as const;

const waveform = [24, 54, 38, 76, 44, 90, 52, 68, 34, 82, 46, 64, 96, 58, 72, 30, 62, 42, 78, 50, 86, 36, 66, 48];

export function LicenseBooth() {
  const [route, setRoute] = useState<(typeof routes)[number]["id"]>("creator");
  const selected = routes.find((item) => item.id === route) ?? routes[0];

  return (
    <div className={`v5-booth v5-booth-${selected.color}`} data-pointer-glow="">
      <div className="v5-booth-topline">
        <span>Symbiome · by Lofi Girl</span>
        <span className="v5-live"><i /> Live prototype</span>
      </div>

      <div className="v5-booth-tabs" role="tablist" aria-label="Choose a music use">
        {routes.map((item) => (
          <button
            type="button"
            role="tab"
            aria-selected={selected.id === item.id}
            className={selected.id === item.id ? "is-active" : ""}
            key={item.id}
            onClick={() => setRoute(item.id)}
          >
            <small>{item.code.slice(-2)}</small>
            {item.tab}
          </button>
        ))}
      </div>

      <div className="v5-booth-track">
        <div className="v5-booth-art" aria-hidden="true"><span>SY</span><i /></div>
        <div>
          <small>TRACK / SY-CAT-0041</small>
          <strong>Cloudlines</strong>
          <span>Charlee Nguyen · 02:42</span>
        </div>
        <div className="v5-booth-wave" aria-hidden="true">
          {waveform.map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}
        </div>
      </div>

      <div className="v5-booth-route" aria-hidden="true">
        <span className="is-complete"><i>1</i>Track</span>
        <b />
        <span className="is-complete"><i>2</i>Use</span>
        <b />
        <span className="is-current"><i>3</i>Licence</span>
      </div>

      <div className="v5-booth-result" aria-live="polite">
        <div>
          <small>{selected.code} / MATCH FOUND</small>
          <strong>{selected.plan}</strong>
          <p>{selected.coverage}<br />{selected.destination}</p>
        </div>
        <div className="v5-booth-price"><strong>{selected.price}</strong><span>{selected.cadence}</span></div>
      </div>

      <Link className="v5-console-action cta-swipe" href={selected.href}>
        <span>{selected.action}</span>
        <i aria-hidden="true">↗</i>
      </Link>
    </div>
  );
}

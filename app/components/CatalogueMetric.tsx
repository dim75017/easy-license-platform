"use client";

import { useEffect, useState } from "react";
import { catalogApiOrigin } from "../lib/catalog-client";

type CatalogueMetricName = "tracks" | "artists" | "releases" | "genres";
type CatalogueFacts = Record<CatalogueMetricName, number>;

let cachedFacts: CatalogueFacts | null = null;
let pendingFacts: Promise<CatalogueFacts | null> | null = null;

export function CatalogueMetric({
  metric,
  fallback = "Live",
}: {
  metric: CatalogueMetricName;
  fallback?: string;
}) {
  const [facts, setFacts] = useState<CatalogueFacts | null>(cachedFacts);

  useEffect(() => {
    if (facts) return;
    let active = true;
    loadCatalogueFacts().then((nextFacts) => {
      if (active && nextFacts) setFacts(nextFacts);
    });
    return () => {
      active = false;
    };
  }, [facts]);

  return <>{facts ? formatCount(facts[metric]) : fallback}</>;
}

function loadCatalogueFacts(): Promise<CatalogueFacts | null> {
  if (cachedFacts) return Promise.resolve(cachedFacts);
  if (pendingFacts) return pendingFacts;

  const url = `${catalogApiOrigin}/api/catalog/facts`;
  pendingFacts = fetch(url, {
    cache: "no-store",
    credentials: catalogApiOrigin ? "omit" : "same-origin",
  })
    .then(async (response) => {
      if (!response.ok) return null;
      const facts = parseCatalogueFacts(await response.json());
      if (facts) cachedFacts = facts;
      return facts;
    })
    .catch(() => null)
    .finally(() => {
      pendingFacts = null;
    });
  return pendingFacts;
}

function parseCatalogueFacts(value: unknown): CatalogueFacts | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const catalogue = (value as { catalogue?: unknown }).catalogue;
  if (!catalogue || typeof catalogue !== "object" || Array.isArray(catalogue)) return null;
  const source = catalogue as Record<string, unknown>;
  const entries = ["tracks", "artists", "releases", "genres"] as const;
  if (!entries.every((key) => Number.isSafeInteger(source[key]) && (source[key] as number) >= 0)) return null;
  return {
    tracks: source.tracks as number,
    artists: source.artists as number,
    releases: source.releases as number,
    genres: source.genres as number,
  };
}

function formatCount(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

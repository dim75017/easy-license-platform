import { accountDatabase } from "@/db/account-runtime";
import { ensureLeadSchema } from "@/db";
import { requireCatalogAdmin } from "../../catalog/_lib/auth";
import {
  catalogErrorResponse,
  CatalogApiError,
  noStoreJson,
} from "../../catalog/_lib/http";

type NumericRow = Record<string, number | string | null>;
type GroupRow = { key: string; count: number };

const memberSummarySql = `
SELECT
  COUNT(*) AS total,
  COALESCE(SUM(CASE WHEN datetime(created_at) >= datetime('now', '-7 days') THEN 1 ELSE 0 END), 0) AS new_7d,
  COALESCE(SUM(CASE WHEN datetime(created_at) >= datetime('now', '-30 days') THEN 1 ELSE 0 END), 0) AS new_30d,
  COALESCE(SUM(CASE WHEN company IS NOT NULL THEN 1 ELSE 0 END), 0) AS company_profiles,
  COALESCE(SUM(CASE WHEN marketing_opt_in = 1 THEN 1 ELSE 0 END), 0) AS marketing_opt_ins
FROM user_profiles`;

const memberDailySql = `
SELECT date(created_at) AS key, COUNT(*) AS count
FROM user_profiles
WHERE datetime(created_at) >= datetime('now', '-30 days')
GROUP BY date(created_at)
ORDER BY date(created_at) ASC`;

const catalogueSummarySql = `
SELECT
  COUNT(*) AS total_tracks,
  COALESCE(SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END), 0) AS published_tracks,
  COALESCE(SUM(CASE WHEN status = 'ready' THEN 1 ELSE 0 END), 0) AS ready_tracks,
  COALESCE(SUM(CASE WHEN status = 'needs_review' THEN 1 ELSE 0 END), 0) AS review_tracks,
  COALESCE(SUM(CASE WHEN status = 'hidden' THEN 1 ELSE 0 END), 0) AS hidden_tracks,
  COALESCE(SUM(CASE WHEN rights_status = 'pending' THEN 1 ELSE 0 END), 0) AS rights_pending,
  COALESCE(SUM(CASE WHEN rights_status = 'restricted' THEN 1 ELSE 0 END), 0) AS rights_restricted,
  COALESCE(SUM(CASE WHEN ai_review_status = 'pending' THEN 1 ELSE 0 END), 0) AS ai_pending,
  COALESCE(SUM(CASE WHEN ai_review_status = 'rejected' THEN 1 ELSE 0 END), 0) AS ai_rejected,
  COALESCE(SUM(CASE WHEN status = 'published' AND EXISTS (
    SELECT 1 FROM track_assets playable
    WHERE playable.track_id = tracks.id
      AND playable.kind = 'streaming_copy'
      AND playable.status = 'available'
  ) THEN 1 ELSE 0 END), 0) AS playable_tracks
FROM tracks`;

const releaseSummarySql = `
SELECT
  COUNT(*) AS total_releases,
  COALESCE(SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END), 0) AS published_releases
FROM releases`;

const leadSummarySql = `
SELECT
  COUNT(*) AS total,
  COALESCE(SUM(CASE WHEN type = 'sync' THEN 1 ELSE 0 END), 0) AS sync,
  COALESCE(SUM(CASE WHEN type = 'retail_waitlist' THEN 1 ELSE 0 END), 0) AS retail,
  COALESCE(SUM(CASE WHEN status NOT IN ('closed', 'archived') THEN 1 ELSE 0 END), 0) AS open,
  COALESCE(SUM(CASE WHEN datetime(created_at) >= datetime('now', '-7 days') THEN 1 ELSE 0 END), 0) AS new_7d
FROM leads`;

export async function GET(request: Request): Promise<Response> {
  try {
    await requireCatalogAdmin(request);

    const database = await accountDatabase();
    await ensureLeadSchema();

    const memberResults = await database.batch<NumericRow>([
      database.prepare(memberSummarySql),
      database.prepare(
        "SELECT plan_preference AS key, COUNT(*) AS count FROM user_profiles GROUP BY plan_preference ORDER BY count DESC, key ASC",
      ),
      database.prepare(
        "SELECT primary_platform AS key, COUNT(*) AS count FROM user_profiles GROUP BY primary_platform ORDER BY count DESC, key ASC",
      ),
      database.prepare(memberDailySql),
    ]);

    const leadResults = await database.batch<NumericRow>([
      database.prepare(leadSummarySql),
      database.prepare(
        "SELECT status AS key, COUNT(*) AS count FROM leads GROUP BY status ORDER BY count DESC, key ASC",
      ),
    ]);

    let catalogue: ReturnType<typeof cataloguePayload> | null = null;
    try {
      const catalogueResults = await database.batch<NumericRow>([
        database.prepare(catalogueSummarySql),
        database.prepare(releaseSummarySql),
        database.prepare(
          "SELECT status AS key, COUNT(*) AS count FROM tracks GROUP BY status ORDER BY count DESC, key ASC",
        ),
        database.prepare(
          "SELECT kind || ':' || status AS key, COUNT(*) AS count FROM track_assets GROUP BY kind, status ORDER BY kind ASC, status ASC",
        ),
        database.prepare(
          "SELECT status AS key, COUNT(*) AS count FROM ingest_items GROUP BY status ORDER BY count DESC, key ASC",
        ),
      ]);
      catalogue = cataloguePayload(catalogueResults);
    } catch (error) {
      console.error("Admin catalogue analytics are unavailable", error);
    }

    return noStoreJson({
      generatedAt: new Date().toISOString(),
      members: memberPayload(memberResults),
      catalogue,
      leads: leadPayload(leadResults),
    });
  } catch (error) {
    if (error instanceof CatalogApiError) return catalogErrorResponse(error);
    console.error("Admin analytics request failed", error);
    return noStoreJson(
      {
        error: {
          code: "admin_analytics_unavailable",
          message: "Admin analytics are temporarily unavailable.",
        },
      },
      { status: 500 },
    );
  }
}

function memberPayload(results: D1Result<NumericRow>[]) {
  const summary = firstRow(results[0]);
  return {
    total: numberValue(summary.total),
    new7d: numberValue(summary.new_7d),
    new30d: numberValue(summary.new_30d),
    companyProfiles: numberValue(summary.company_profiles),
    marketingOptIns: numberValue(summary.marketing_opt_ins),
    byPlan: groupRows(results[1]),
    byPlatform: groupRows(results[2]),
    daily30d: groupRows(results[3]).map((row) => ({
      day: row.key,
      count: row.count,
    })),
  };
}

function cataloguePayload(results: D1Result<NumericRow>[]) {
  const tracks = firstRow(results[0]);
  const releases = firstRow(results[1]);
  return {
    totalTracks: numberValue(tracks.total_tracks),
    publishedTracks: numberValue(tracks.published_tracks),
    readyTracks: numberValue(tracks.ready_tracks),
    reviewTracks: numberValue(tracks.review_tracks),
    hiddenTracks: numberValue(tracks.hidden_tracks),
    rightsPending: numberValue(tracks.rights_pending),
    rightsRestricted: numberValue(tracks.rights_restricted),
    aiPending: numberValue(tracks.ai_pending),
    aiRejected: numberValue(tracks.ai_rejected),
    playableTracks: numberValue(tracks.playable_tracks),
    totalReleases: numberValue(releases.total_releases),
    publishedReleases: numberValue(releases.published_releases),
    tracksByStatus: groupRows(results[2]),
    assetsByState: groupRows(results[3]),
    ingestByStatus: groupRows(results[4]),
  };
}

function leadPayload(results: D1Result<NumericRow>[]) {
  const summary = firstRow(results[0]);
  return {
    total: numberValue(summary.total),
    sync: numberValue(summary.sync),
    retail: numberValue(summary.retail),
    open: numberValue(summary.open),
    new7d: numberValue(summary.new_7d),
    byStatus: groupRows(results[1]),
  };
}

function firstRow(result: D1Result<NumericRow> | undefined): NumericRow {
  return result?.results[0] ?? {};
}

function groupRows(result: D1Result<NumericRow> | undefined): GroupRow[] {
  return (result?.results ?? []).flatMap((row) => {
    if (typeof row.key !== "string" || !row.key) return [];
    return [{ key: row.key, count: numberValue(row.count) }];
  });
}

function numberValue(value: unknown): number {
  const number = Number(value ?? 0);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

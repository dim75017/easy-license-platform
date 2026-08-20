import { accountDatabase } from "../../../../db/account-runtime";
import { catalogAdminEmails } from "../../../../db/catalog-runtime";
import { sitesIdentityFromHeaders } from "../../../_lib/sites-identity";

const plans = new Set(["creator", "pro"]);
const platforms = new Set([
  "youtube",
  "twitch",
  "podcast",
  "instagram",
  "tiktok",
  "other",
]);

type AccountIdentity = {
  userId: string;
  email: string;
  displayName: string;
};

type ProfileRow = {
  display_name: string;
  company: string | null;
  plan_preference: string;
  primary_platform: string;
  marketing_opt_in: number;
  onboarding_completed_at: string;
};

export async function GET(request: Request) {
  const identity = await accountIdentity(request);
  if (!identity) return json({ error: "authentication_required" }, 401);

  const database = await accountDatabase();
  const profile = await database
    .prepare(
      `SELECT display_name, company, plan_preference, primary_platform,
              marketing_opt_in, onboarding_completed_at
       FROM user_profiles
       WHERE external_user_id = ?1
       LIMIT 1`,
    )
    .bind(identity.userId)
    .first<ProfileRow>();

  return json({
    identity: { email: identity.email, displayName: identity.displayName },
    profile: profile ? publicProfile(profile) : null,
    capabilities: { admin: catalogAdminEmails().has(identity.email) },
  });
}

export async function POST(request: Request) {
  const identity = await accountIdentity(request);
  if (!identity) return json({ error: "authentication_required" }, 401);
  if (!isSameOrigin(request)) return json({ error: "invalid_origin" }, 403);

  const length = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(length) && length > 8192) {
    return json({ error: "request_too_large" }, 413);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const input = profileInput(payload);
  if (!input.ok) return json({ error: input.error }, 400);

  const now = new Date().toISOString();
  const database = await accountDatabase();
  await database
    .prepare(
      `INSERT INTO user_profiles (
         external_user_id, email, display_name, company, plan_preference,
         primary_platform, marketing_opt_in, policies_acknowledged_at,
         onboarding_completed_at, created_at, updated_at
       ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8, ?8, ?8)
       ON CONFLICT(external_user_id) DO UPDATE SET
         email = excluded.email,
         display_name = excluded.display_name,
         company = excluded.company,
         plan_preference = excluded.plan_preference,
         primary_platform = excluded.primary_platform,
         marketing_opt_in = excluded.marketing_opt_in,
         policies_acknowledged_at = COALESCE(user_profiles.policies_acknowledged_at, excluded.policies_acknowledged_at),
         onboarding_completed_at = excluded.onboarding_completed_at,
         updated_at = excluded.updated_at`,
    )
    .bind(
      identity.userId,
      identity.email,
      input.value.displayName,
      input.value.company,
      input.value.plan,
      input.value.platform,
      input.value.marketingOptIn ? 1 : 0,
      now,
    )
    .run();

  return json({
    profile: {
      displayName: input.value.displayName,
      company: input.value.company,
      plan: input.value.plan,
      platform: input.value.platform,
      marketingOptIn: input.value.marketingOptIn,
      onboardingCompletedAt: now,
    },
  });
}

async function accountIdentity(
  request: Request,
): Promise<AccountIdentity | null> {
  const identity = await sitesIdentityFromHeaders(request.headers);
  if (!identity) return null;

  const encodedName = request.headers.get("oai-authenticated-user-full-name");
  const encoding = request.headers.get(
    "oai-authenticated-user-full-name-encoding",
  );
  const decodedName =
    encodedName && encoding === "percent-encoded-utf-8"
      ? safeDecode(encodedName)
      : null;
  const displayName =
    cleanText(decodedName, 120) ?? identity.email.split("@")[0];
  return { ...identity, displayName };
}

function profileInput(payload: unknown):
  | {
      ok: true;
      value: {
        displayName: string;
        company: string | null;
        plan: string;
        platform: string;
        marketingOptIn: boolean;
      };
    }
  | { ok: false; error: string } {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, error: "invalid_profile" };
  }
  const source = payload as Record<string, unknown>;
  const displayName = cleanText(source.displayName, 120);
  const company = cleanText(source.company, 160);
  const plan = typeof source.plan === "string" ? source.plan : "";
  const platform = typeof source.platform === "string" ? source.platform : "";
  if (!displayName) return { ok: false, error: "display_name_required" };
  if (!plans.has(plan)) return { ok: false, error: "invalid_plan" };
  if (!platforms.has(platform)) return { ok: false, error: "invalid_platform" };
  if (source.acceptPolicies !== true) {
    return { ok: false, error: "policies_acknowledgement_required" };
  }
  return {
    ok: true,
    value: {
      displayName,
      company,
      plan,
      platform,
      marketingOptIn: source.marketingOptIn === true,
    },
  };
}

function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim().replace(/\s+/gu, " ");
  return cleaned && cleaned.length <= max ? cleaned : null;
}

function safeDecode(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function publicProfile(row: ProfileRow) {
  return {
    displayName: row.display_name,
    company: row.company,
    plan: row.plan_preference,
    platform: row.primary_platform,
    marketingOptIn: row.marketing_opt_in === 1,
    onboardingCompletedAt: row.onboarding_completed_at,
  };
}

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
